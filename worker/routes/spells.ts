import { zValidator } from "@hono/zod-validator";
import { and, asc, count, eq, exists, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../db";
import * as s from "../db/schema";
import { escapeLike, paginationSchema, parseIds, parseLevels } from "./params";

type HonoEnv = { Bindings: Env };

// ─── Spell level conversion ───────────────────────────────────────────────────
// Bloodline, patron and mystery tables store the CLASS level at which a spell is
// granted, not the spell's level. Sorcerer bloodlines grant at 3, 5, …, 19
// (spell level 1–9), bloodrager bloodlines at 7, 10, 13, 16 (spell level 1–4),
// and witch patrons / oracle mysteries at 2, 4, …, 18 (spell level 1–9).

const bloodlineSpellLevel = sql`CASE
    WHEN ${s.bloodlineSpells.bloodlineId} IN (
        SELECT ${s.bloodlines.id} FROM ${s.bloodlines}
        WHERE ${s.bloodlines.bloodrager}
    )
    THEN (${s.bloodlineSpells.classLevel} - 4) / 3
    ELSE (${s.bloodlineSpells.classLevel} - 1) / 2
END`;

export function bloodlineLevel(bloodrager: boolean, classLevel: number): number {
    return bloodrager ? (classLevel - 4) / 3 : (classLevel - 1) / 2;
}

export function evenClassLevel(classLevel: number): number {
    return classLevel / 2;
}

// ─── Spell sources ────────────────────────────────────────────────────────────

interface SpellSource {
    table: PgTable;
    spellId: PgColumn;
    sourceId: PgColumn;
    // Expression yielding the spell's level when obtained from this source
    level: SQL;
}

const SOURCES = {
    class: {
        table: s.spellClasses,
        spellId: s.spellClasses.spellId,
        sourceId: s.spellClasses.classId,
        level: sql`${s.spellClasses.level}`,
    },
    domain: {
        table: s.domainSpells,
        spellId: s.domainSpells.spellId,
        sourceId: s.domainSpells.domainId,
        level: sql`${s.domainSpells.level}`,
    },
    subdomain: {
        table: s.subdomainSpells,
        spellId: s.subdomainSpells.spellId,
        sourceId: s.subdomainSpells.subdomainId,
        level: sql`${s.subdomainSpells.level}`,
    },
    bloodline: {
        table: s.bloodlineSpells,
        spellId: s.bloodlineSpells.spellId,
        sourceId: s.bloodlineSpells.bloodlineId,
        level: bloodlineSpellLevel,
    },
    patron: {
        table: s.patronSpells,
        spellId: s.patronSpells.spellId,
        sourceId: s.patronSpells.patronId,
        level: sql`${s.patronSpells.classLevel} / 2`,
    },
    mystery: {
        table: s.mysterySpells,
        spellId: s.mysterySpells.spellId,
        sourceId: s.mysterySpells.mysteryId,
        level: sql`${s.mysterySpells.classLevel} / 2`,
    },
} satisfies Record<string, SpellSource>;

type SourceKey = keyof typeof SOURCES;

interface SearchParams {
    q?: string;
    levels: number[];
    schoolIds: string[];
    subschoolIds: string[];
    descriptors: string[];
    sourceIds: Record<SourceKey, string[]>;
}

// Correlated condition: rows of this source granting the current spell,
// restricted to the selected source IDs and levels (if any)
function sourceCondition(src: SpellSource, ids: string[], levels: number[]): SQL {
    const conds: SQL[] = [eq(src.spellId, s.spells.id)];
    if (ids.length) {
        conds.push(inArray(src.sourceId, ids));
    }
    if (levels.length) {
        conds.push(inArray(src.level, levels));
    }
    return and(...conds)!;
}

// Sources the search is scoped to. Selected source types are OR'd: a spell you
// can get from a class OR a domain counts. With no source selected, every
// source type applies (unrestricted by ID).
function activeSources(params: SearchParams): { src: SpellSource; ids: string[] }[] {
    const keys = Object.keys(SOURCES) as SourceKey[];
    const selected = keys.filter((k) => params.sourceIds[k].length > 0);
    return (selected.length ? selected : keys).map((k) => ({src: SOURCES[k], ids: params.sourceIds[k]}));
}

function hasSourceFilter(params: SearchParams): boolean {
    return Object.values(params.sourceIds).some((ids) => ids.length > 0);
}

function buildWhere(db: ReturnType<typeof createDb>, params: SearchParams): SQL | undefined {
    const {q, levels, schoolIds, subschoolIds, descriptors} = params;
    const filters: SQL[] = [];

    if (q) {
        filters.push(ilike(s.spells.name, `%${escapeLike(q)}%`));
    }
    if (schoolIds.length) {
        filters.push(inArray(s.spells.schoolId, schoolIds));
    }
    if (subschoolIds.length) {
        filters.push(exists(db.select({_: sql`1`}).from(s.spellSubschools).where(and(
            eq(s.spellSubschools.spellId, s.spells.id),
            inArray(s.spellSubschools.subschoolId, subschoolIds),
        ))));
    }
    if (descriptors.length) {
        // Postgres && operator: spell's descriptor array overlaps with the selected set
        filters.push(sql`${s.spells.descriptors} && ARRAY[${sql.join(
            descriptors.map((d) => sql`${d}`),
            sql`, `,
        )}]::text[]`);
    }

    if (hasSourceFilter(params) || levels.length) {
        const sourceExists = activeSources(params).map(({src, ids}) =>
            exists(db.select({_: sql`1`}).from(src.table).where(sourceCondition(src, ids, levels))),
        );
        filters.push(sourceExists.length === 1 ? sourceExists[0] : or(...sourceExists)!);
    }

    return filters.length > 0 ? and(...filters) : undefined;
}

// Lowest spell level among the active sources (and selected levels).
// LEAST ignores NULLs, so sources that don't grant the spell drop out.
function buildLevelExpr(params: SearchParams): SQL<number | null> {
    const mins = activeSources(params).map(({src, ids}) =>
        sql`(SELECT MIN(${src.level}) FROM ${src.table} WHERE ${sourceCondition(src, ids, params.levels)})`,
    );
    return sql<number | null>`LEAST(${sql.join(mins, sql`, `)})`;
}

// "creation, calling" — a few spells have two subschools
const subschoolNames = sql<string | null>`(
    SELECT string_agg(${s.subschools.name}, ', ' ORDER BY ${s.subschools.name})
    FROM ${s.spellSubschools}
    JOIN ${s.subschools} ON ${s.subschools.id} = ${s.spellSubschools.subschoolId}
    WHERE ${s.spellSubschools.spellId} = ${s.spells.id}
)`;

// ─── Query schema ─────────────────────────────────────────────────────────────

export const spellsQuerySchema = z.object({
    q: z.string().optional(),
    level: z.string().optional(),
    school: z.string().optional(),
    subschool: z.string().optional(),
    descriptor: z.string().optional(),
    class: z.string().optional(),
    domain: z.string().optional(),
    subdomain: z.string().optional(),
    bloodline: z.string().optional(),
    patron: z.string().optional(),
    mystery: z.string().optional(),
    sort: z.enum(["name", "level"]).default("name"),
    ...paginationSchema,
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const app = new Hono<HonoEnv>()
    .get("/", zValidator("query", spellsQuerySchema), async (c) => {
        const db = createDb(c.env.HYPERDRIVE.connectionString);

        const {
            q,
            level, school, subschool, descriptor,
            class: classParam,
            domain, subdomain, bloodline, patron, mystery,
            sort, limit, offset,
        } = c.req.valid("query");

        const searchParams: SearchParams = {
            q,
            levels: parseLevels(level),
            schoolIds: parseIds(school),
            subschoolIds: parseIds(subschool),
            descriptors: parseIds(descriptor),
            sourceIds: {
                class: parseIds(classParam),
                domain: parseIds(domain),
                subdomain: parseIds(subdomain),
                bloodline: parseIds(bloodline),
                patron: parseIds(patron),
                mystery: parseIds(mystery),
            },
        };

        const where = buildWhere(db, searchParams);
        const levelExpr = buildLevelExpr(searchParams);
        const orderBy = sort === "level"
            ? [sql`${levelExpr} ASC NULLS LAST`, asc(s.spells.name)]
            : [asc(s.spells.name)];

        const [{total}, data] = await Promise.all([
            db.select({total: count()}).from(s.spells).where(where).then((r) => r[0]),
            db
                .select({
                    id: s.spells.id,
                    name: s.spells.name,
                    level: levelExpr,
                    school: s.schools.name,
                    subschool: subschoolNames,
                    descriptors: s.spells.descriptors,
                    sourcebook: s.spells.sourcebook,
                })
                .from(s.spells)
                .leftJoin(s.schools, eq(s.spells.schoolId, s.schools.id))
                .where(where)
                .orderBy(...orderBy)
                .limit(limit)
                .offset(offset),
        ]);

        return c.json({data, total, limit, offset});
    })
    .get("/:id", async (c) => {
        const db = createDb(c.env.HYPERDRIVE.connectionString);
        const id = c.req.param("id");

        const spell = await db.query.spells.findFirst({
            where: eq(s.spells.id, id),
            with: {
                school: true,
                deity: true,
                spellSubschools: {with: {subschool: true}},
                spellClasses: {
                    with: {class: true},
                    orderBy: (sc, {asc: a}) => [a(sc.level)],
                },
                domainSpells: {
                    with: {domain: true},
                    orderBy: (ds, {asc: a}) => [a(ds.level)],
                },
                subdomainSpells: {
                    with: {subdomain: true},
                    orderBy: (ss, {asc: a}) => [a(ss.level)],
                },
                bloodlineSpells: {
                    with: {bloodline: true},
                    orderBy: (bs, {asc: a}) => [a(bs.classLevel)],
                },
                patronSpells: {
                    with: {patron: true},
                    orderBy: (ps, {asc: a}) => [a(ps.classLevel)],
                },
                mysterySpells: {
                    with: {mystery: true},
                    orderBy: (ms, {asc: a}) => [a(ms.classLevel)],
                },
            },
        });

        if (!spell) {
            return c.json({error: "Not found"} as const, 404);
        }

        return c.json({
            id: spell.id,
            name: spell.name,
            link: spell.link,
            description: spell.description,
            mythicText: spell.mythicText,
            pfsLegal: spell.pfsLegal,

            school: spell.school ?? null,
            subschools: spell.spellSubschools
                .map((ss) => ss.subschool)
                .sort((a, b) => a.name.localeCompare(b.name)),
            deity: spell.deity ? {id: spell.deity.id, name: spell.deity.name} : null,
            descriptors: spell.descriptors,

            castingTime: spell.castingTime,
            range: spell.range,
            area: spell.area,
            effect: spell.effect,
            targets: spell.targets,
            duration: spell.duration,
            savingThrow: spell.savingThrow,
            spellResistance: spell.spellResistance,
            sourcebook: spell.sourcebook,
            sources: spell.sources,

            components: {
                verbal: spell.verbal,
                somatic: spell.somatic,
                material: spell.material,
                focus: spell.focus,
                divineFocus: spell.divineFocus,
                cost: spell.componentCost,
                text: spell.componentsText,
            },
            dismissible: spell.dismissible,
            shapeable: spell.shapeable,

            race: spell.race,
            extra: spell.extra,

            classes: spell.spellClasses.map((sc) => ({...sc.class, level: sc.level})),
            domains: spell.domainSpells.map((ds) => ({...ds.domain, level: ds.level, note: ds.note})),
            subdomains: spell.subdomainSpells.map((ss) => ({...ss.subdomain, level: ss.level, note: ss.note})),
            bloodlines: spell.bloodlineSpells.map((bs) => ({
                id: bs.bloodline.id,
                name: bs.bloodline.name,
                level: bloodlineLevel(bs.bloodline.bloodrager, bs.classLevel),
                classLevel: bs.classLevel,
                note: bs.note,
            })),
            patrons: spell.patronSpells.map((ps) => ({
                ...ps.patron,
                level: evenClassLevel(ps.classLevel),
                classLevel: ps.classLevel,
                note: ps.note,
            })),
            mysteries: spell.mysterySpells.map((ms) => ({
                ...ms.mystery,
                level: evenClassLevel(ms.classLevel),
                classLevel: ms.classLevel,
                note: ms.note,
            })),
        });
    });

export default app;
