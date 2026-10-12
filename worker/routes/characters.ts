import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { ulid } from "ulidx";
import { z } from "zod";
import { type AuthEnv, requireUser } from "../auth";
import type { AppDb } from "../db";
import * as s from "../db/schema";
import {
    grantedSpells, loadSources, normalizeSources, type SourceInput, sourceSchema, validateSources,
} from "./characterSources";

// Spell levels 0–9: slot arrays always have ten entries
const LEVELS = 10;
const spellLevel = z.number().int().min(0).max(LEVELS - 1);
const slotArray = z.array(z.number().int().min(0).max(20)).length(LEVELS);
const emptySlots = (): number[] => Array<number>(LEVELS).fill(0);

const characterSchema = z.object({
    name: z.string().trim().min(1).max(80),
    classId: z.string().min(1),
    level: z.number().int().min(1).max(20),
    prepared: z.boolean(),
    slots: slotArray.optional(),
    // Domains, bloodlines… — the full list (replaces the current one on PATCH)
    sources: z.array(sourceSchema).max(20).optional(),
});

const patchSchema = characterSchema.partial().extend({
    slotsUsed: slotArray.optional(),
});

// Problem with the class or sources, if any
async function validateInput(db: AppDb, input: { classId?: string; sources?: SourceInput[] }): Promise<string | null> {
    if (input.classId && !await classExists(db, input.classId)) {
        return "Unknown class";
    }
    return input.sources ? validateSources(db, input.sources) : null;
}

const sourceRows = (characterId: string, sources: SourceInput[]) =>
    normalizeSources(sources).map((src) => ({
        id: ulid(),
        characterId,
        type: src.type,
        sourceId: src.sourceId,
        domainId: src.domainId ?? null,
    }));

async function classExists(db: AppDb, id: string): Promise<boolean> {
    const [row] = await db.select({id: s.classes.id}).from(s.classes).where(eq(s.classes.id, id));
    return row !== undefined;
}

async function findOwned(db: AppDb, id: string, userId: string) {
    const [row] = await db
        .select()
        .from(s.characters)
        .where(and(eq(s.characters.id, id), eq(s.characters.userId, userId)));
    return row ?? null;
}

// The character with its known spells and today's prepared slots
async function loadDetail(db: AppDb, id: string, userId: string) {
    const [row] = await db
        .select({character: s.characters, className: s.classes.name})
        .from(s.characters)
        .innerJoin(s.classes, eq(s.classes.id, s.characters.classId))
        .where(and(eq(s.characters.id, id), eq(s.characters.userId, userId)));
    if (!row) {
        return null;
    }

    const [known, prepared, sources] = await Promise.all([
        db
            .select({
                id: s.spells.id,
                name: s.spells.name,
                level: s.characterSpells.level,
                school: s.schools.name,
            })
            .from(s.characterSpells)
            .innerJoin(s.spells, eq(s.spells.id, s.characterSpells.spellId))
            .leftJoin(s.schools, eq(s.schools.id, s.spells.schoolId))
            .where(eq(s.characterSpells.characterId, id))
            .orderBy(asc(s.characterSpells.level), asc(s.spells.name)),
        db
            .select({
                id: s.preparedSpells.id,
                spellId: s.preparedSpells.spellId,
                name: s.spells.name,
                level: s.preparedSpells.level,
                cast: s.preparedSpells.cast,
            })
            .from(s.preparedSpells)
            .innerJoin(s.spells, eq(s.spells.id, s.preparedSpells.spellId))
            .where(eq(s.preparedSpells.characterId, id))
            .orderBy(asc(s.preparedSpells.level), asc(s.spells.name), asc(s.preparedSpells.id)),
        loadSources(db, id),
    ]);

    const {character} = row;
    return {
        id: character.id,
        name: character.name,
        classId: character.classId,
        className: row.className,
        level: character.level,
        prepared: character.prepared,
        slots: character.slots,
        slotsUsed: character.slotsUsed,
        sources,
        spells: known,
        preparedSpells: prepared,
    };
}

const notFound = {error: "Not found"} as const;

const app = new Hono<AuthEnv>()
    .use(requireUser)
    .get("/", async (c) => {
        const rows = await c.var.db
            .select({
                id: s.characters.id,
                name: s.characters.name,
                classId: s.characters.classId,
                className: s.classes.name,
                level: s.characters.level,
                prepared: s.characters.prepared,
            })
            .from(s.characters)
            .innerJoin(s.classes, eq(s.classes.id, s.characters.classId))
            .where(eq(s.characters.userId, c.var.user.id))
            .orderBy(asc(s.characters.name));
        return c.json(rows);
    })
    .post("/", zValidator("json", characterSchema), async (c) => {
        const input = c.req.valid("json");
        const {name, classId, level, prepared, slots, sources = []} = input;
        const problem = await validateInput(c.var.db, input);
        if (problem) {
            return c.json({error: problem}, 400);
        }
        const id = ulid();
        await c.var.db.transaction(async (tx) => {
            await tx.insert(s.characters).values({
                id,
                userId: c.var.user.id,
                name,
                classId,
                level,
                prepared,
                slots: slots ?? emptySlots(),
                slotsUsed: emptySlots(),
            });
            if (sources.length) {
                await tx.insert(s.characterSources).values(sourceRows(id, sources));
            }
        });
        return c.json({id}, 201);
    })
    .get("/:id", async (c) => {
        const detail = await loadDetail(c.var.db, c.req.param("id"), c.var.user.id);
        return detail ? c.json(detail) : c.json(notFound, 404);
    })
    // Spells the character's domains, bloodlines… grant at its current level
    .get("/:id/granted", async (c) => {
        const {db, user} = c.var;
        const id = c.req.param("id");
        const character = await findOwned(db, id, user.id);
        if (!character) {
            return c.json(notFound, 404);
        }
        return c.json(await grantedSpells(db, character, await loadSources(db, id)));
    })
    .patch("/:id", zValidator("json", patchSchema), async (c) => {
        const {db, user} = c.var;
        const id = c.req.param("id");
        const {sources, ...changes} = c.req.valid("json");
        if (!await findOwned(db, id, user.id)) {
            return c.json(notFound, 404);
        }
        const problem = await validateInput(db, {classId: changes.classId, sources});
        if (problem) {
            return c.json({error: problem}, 400);
        }
        await db.transaction(async (tx) => {
            if (Object.keys(changes).length > 0) {
                await tx.update(s.characters).set(changes).where(eq(s.characters.id, id));
            }
            if (sources) {
                await tx.delete(s.characterSources).where(eq(s.characterSources.characterId, id));
                if (sources.length) {
                    await tx.insert(s.characterSources).values(sourceRows(id, sources));
                }
            }
        });
        const detail = await loadDetail(db, id, user.id);
        return detail ? c.json(detail) : c.json(notFound, 404);
    })
    .delete("/:id", async (c) => {
        const deleted = await c.var.db
            .delete(s.characters)
            .where(and(eq(s.characters.id, c.req.param("id")), eq(s.characters.userId, c.var.user.id)))
            .returning({id: s.characters.id});
        return deleted.length ? c.json({ok: true}) : c.json(notFound, 404);
    })
    // New day: every prepared slot and spontaneous slot is available again
    .post("/:id/rest", async (c) => {
        const {db, user} = c.var;
        const id = c.req.param("id");
        if (!await findOwned(db, id, user.id)) {
            return c.json(notFound, 404);
        }
        await Promise.all([
            db.update(s.characters).set({slotsUsed: emptySlots()}).where(eq(s.characters.id, id)),
            db.update(s.preparedSpells).set({cast: false}).where(eq(s.preparedSpells.characterId, id)),
        ]);
        const detail = await loadDetail(db, id, user.id);
        return detail ? c.json(detail) : c.json(notFound, 404);
    })
    // Add a spell to the spellbook / spells known, or change its level
    .put("/:id/spells/:spellId", zValidator("json", z.object({level: spellLevel})), async (c) => {
        const {db, user} = c.var;
        const {id, spellId} = c.req.param();
        const {level} = c.req.valid("json");
        if (!await findOwned(db, id, user.id)) {
            return c.json(notFound, 404);
        }
        const [spell] = await db.select({id: s.spells.id}).from(s.spells).where(eq(s.spells.id, spellId));
        if (!spell) {
            return c.json(notFound, 404);
        }
        await db
            .insert(s.characterSpells)
            .values({characterId: id, spellId, level})
            .onConflictDoUpdate({
                target: [s.characterSpells.characterId, s.characterSpells.spellId],
                set: {level},
            });
        const detail = await loadDetail(db, id, user.id);
        return detail ? c.json(detail) : c.json(notFound, 404);
    })
    .delete("/:id/spells/:spellId", async (c) => {
        const {db, user} = c.var;
        const {id, spellId} = c.req.param();
        if (!await findOwned(db, id, user.id)) {
            return c.json(notFound, 404);
        }
        await db
            .delete(s.characterSpells)
            .where(and(eq(s.characterSpells.characterId, id), eq(s.characterSpells.spellId, spellId)));
        const detail = await loadDetail(db, id, user.id);
        return detail ? c.json(detail) : c.json(notFound, 404);
    })
    // Prepare a spell in one slot (may be higher than the spell's level)
    .post("/:id/prepared", zValidator("json", z.object({spellId: z.string().min(1), level: spellLevel})), async (c) => {
        const {db, user} = c.var;
        const id = c.req.param("id");
        const {spellId, level} = c.req.valid("json");
        if (!await findOwned(db, id, user.id)) {
            return c.json(notFound, 404);
        }
        const [spell] = await db.select({id: s.spells.id}).from(s.spells).where(eq(s.spells.id, spellId));
        if (!spell) {
            return c.json(notFound, 404);
        }
        await db.insert(s.preparedSpells).values({id: ulid(), characterId: id, spellId, level});
        const detail = await loadDetail(db, id, user.id);
        return detail ? c.json(detail) : c.json(notFound, 404);
    })
    .patch("/:id/prepared/:preparedId", zValidator("json", z.object({cast: z.boolean()})), async (c) => {
        const {db, user} = c.var;
        const {id, preparedId} = c.req.param();
        if (!await findOwned(db, id, user.id)) {
            return c.json(notFound, 404);
        }
        await db
            .update(s.preparedSpells)
            .set({cast: c.req.valid("json").cast})
            .where(and(eq(s.preparedSpells.id, preparedId), eq(s.preparedSpells.characterId, id)));
        const detail = await loadDetail(db, id, user.id);
        return detail ? c.json(detail) : c.json(notFound, 404);
    })
    .delete("/:id/prepared/:preparedId", async (c) => {
        const {db, user} = c.var;
        const {id, preparedId} = c.req.param();
        if (!await findOwned(db, id, user.id)) {
            return c.json(notFound, 404);
        }
        await db
            .delete(s.preparedSpells)
            .where(and(eq(s.preparedSpells.id, preparedId), eq(s.preparedSpells.characterId, id)));
        const detail = await loadDetail(db, id, user.id);
        return detail ? c.json(detail) : c.json(notFound, 404);
    });

export default app;
