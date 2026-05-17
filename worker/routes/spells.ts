import { zValidator } from "@hono/zod-validator";
import { and, asc, count, eq, exists, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../db";
import * as s from "../db/schema";

type HonoEnv = { Bindings: Env };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseIds(p: string | undefined): string[] {
    return p ? p.split(",").map((x) => x.trim()).filter(Boolean) : [];
}

function parseLevels(p: string | undefined): number[] {
    return p
        ? p.split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => !isNaN(n))
        : [];
}

function buildWhere(
    db: ReturnType<typeof createDb>,
    params: {
        q?: string;
        levels: number[];
        classIds: string[];
        domainIds: string[];
        subdomainIds: string[];
        schoolIds: string[];
        subschoolIds: string[];
        descriptors: string[];
        bloodlineIds: string[];
        patronIds: string[];
        mysteryIds: string[];
    },
): SQL | undefined {
    const {
        q, levels, classIds, domainIds, subdomainIds, schoolIds, subschoolIds,
        descriptors, bloodlineIds, patronIds, mysteryIds,
    } = params;

    const filters: SQL[] = [];

    if (q) {
        filters.push(ilike(s.spells.name, `%${q}%`));
    }
    if (schoolIds.length) {
        filters.push(inArray(s.spells.schoolId, schoolIds));
    }
    if (subschoolIds.length) {
        filters.push(inArray(s.spells.subschoolId, subschoolIds));
    }
    if (descriptors.length) {
        // Postgres && operator: spell's descriptor array overlaps with the selected set
        filters.push(sql`${s.spells.descriptors} && ARRAY[${sql.join(
            descriptors.map((d) => sql`${d}`),
            sql`, `,
        )}]::text[]`);
    }

    // Each source type produces an EXISTS correlated subquery.
    // Level constraint is baked into each source it applies to.
    // Multiple sources are OR'd: a spell you can get from class OR domain both count.
    const sourceExists: SQL[] = [];

    if (classIds.length) {
        const conds: SQL[] = [eq(s.spellClasses.spellId, s.spells.id), inArray(s.spellClasses.classId, classIds)];
        if (levels.length) {
            conds.push(inArray(s.spellClasses.level, levels));
        }
        sourceExists.push(exists(db.select({_: sql`1`}).from(s.spellClasses).where(and(...conds))));
    }

    if (domainIds.length) {
        const conds: SQL[] = [eq(s.domainSpells.spellId, s.spells.id), inArray(s.domainSpells.domainId, domainIds)];
        if (levels.length) {
            conds.push(inArray(s.domainSpells.level, levels));
        }
        sourceExists.push(exists(db.select({_: sql`1`}).from(s.domainSpells).where(and(...conds))));
    }

    if (subdomainIds.length) {
        const conds: SQL[] = [eq(s.subdomainSpells.spellId, s.spells.id), inArray(s.subdomainSpells.subdomainId, subdomainIds)];
        if (levels.length) {
            conds.push(inArray(s.subdomainSpells.level, levels));
        }
        sourceExists.push(exists(db.select({_: sql`1`}).from(s.subdomainSpells).where(and(...conds))));
    }

    if (bloodlineIds.length) {
        const conds: SQL[] = [eq(s.bloodlineSpells.spellId, s.spells.id), inArray(s.bloodlineSpells.bloodlineId, bloodlineIds)];
        if (levels.length) {
            conds.push(inArray(s.bloodlineSpells.classLevel, levels));
        }
        sourceExists.push(exists(db.select({_: sql`1`}).from(s.bloodlineSpells).where(and(...conds))));
    }

    if (patronIds.length) {
        const conds: SQL[] = [eq(s.patronSpells.spellId, s.spells.id), inArray(s.patronSpells.patronId, patronIds)];
        if (levels.length) {
            conds.push(inArray(s.patronSpells.classLevel, levels));
        }
        sourceExists.push(exists(db.select({_: sql`1`}).from(s.patronSpells).where(and(...conds))));
    }

    if (mysteryIds.length) {
        const conds: SQL[] = [eq(s.mysterySpells.spellId, s.spells.id), inArray(s.mysterySpells.mysteryId, mysteryIds)];
        if (levels.length) {
            conds.push(inArray(s.mysterySpells.classLevel, levels));
        }
        sourceExists.push(exists(db.select({_: sql`1`}).from(s.mysterySpells).where(and(...conds))));
    }

    // Level-only (no source filter): spell must appear at that level in any source
    if (sourceExists.length === 0 && levels.length) {
        sourceExists.push(
            exists(db.select({_: sql`1`}).from(s.spellClasses).where(and(eq(s.spellClasses.spellId, s.spells.id), inArray(s.spellClasses.level, levels)))),
            exists(db.select({_: sql`1`}).from(s.domainSpells).where(and(eq(s.domainSpells.spellId, s.spells.id), inArray(s.domainSpells.level, levels)))),
            exists(db.select({_: sql`1`}).from(s.subdomainSpells).where(and(eq(s.subdomainSpells.spellId, s.spells.id), inArray(s.subdomainSpells.level, levels)))),
            exists(db.select({_: sql`1`}).from(s.bloodlineSpells).where(and(eq(s.bloodlineSpells.spellId, s.spells.id), inArray(s.bloodlineSpells.classLevel, levels)))),
            exists(db.select({_: sql`1`}).from(s.patronSpells).where(and(eq(s.patronSpells.spellId, s.spells.id), inArray(s.patronSpells.classLevel, levels)))),
            exists(db.select({_: sql`1`}).from(s.mysterySpells).where(and(eq(s.mysterySpells.spellId, s.spells.id), inArray(s.mysterySpells.classLevel, levels)))),
        );
    }

    if (sourceExists.length === 1) {
        filters.push(sourceExists[0]);
    } else if (sourceExists.length > 1) {
        filters.push(or(...sourceExists)!);
    }

    return filters.length > 0 ? and(...filters) : undefined;
}

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
    limit: z.string().optional(),
    offset: z.string().optional(),
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
            limit: rawLimit, offset: rawOffset,
        } = c.req.valid("query");

        const limit = Math.min(parseInt(rawLimit ?? "50", 10) || 50, 200);
        const offset = parseInt(rawOffset ?? "0", 10) || 0;

        const searchParams = {
            q,
            levels: parseLevels(level),
            classIds: parseIds(classParam),
            domainIds: parseIds(domain),
            subdomainIds: parseIds(subdomain),
            schoolIds: parseIds(school),
            subschoolIds: parseIds(subschool),
            descriptors: parseIds(descriptor),
            bloodlineIds: parseIds(bloodline),
            patronIds: parseIds(patron),
            mysteryIds: parseIds(mystery),
        };

        const where = buildWhere(db, searchParams);

        const [{total}, data] = await Promise.all([
            db.select({total: count()}).from(s.spells).where(where).then((r) => r[0]),
            db
                .select({
                    id: s.spells.id,
                    name: s.spells.name,
                    school: s.schools.name,
                    subschool: s.subschools.name,
                    descriptors: s.spells.descriptors,
                    sourcebook: s.spells.sourcebook,
                    rating: s.spells.rating,
                })
                .from(s.spells)
                .leftJoin(s.schools, eq(s.spells.schoolId, s.schools.id))
                .leftJoin(s.subschools, eq(s.spells.subschoolId, s.subschools.id))
                .where(where)
                .orderBy(asc(s.spells.name))
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
                subschool: true,
                deity: true,
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
            augmented: spell.augmented,
            rating: spell.rating,

            school: spell.school ?? null,
            subschool: spell.subschool ?? null,
            deity: spell.deity ?? null,
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

            components: {
                verbal: spell.verbal,
                somatic: spell.somatic,
                material: spell.material,
                focus: spell.focus,
                divineFocus: spell.divineFocus,
                cost: spell.componentCost,
            },
            dismissible: spell.dismissible,
            shapeable: spell.shapeable,

            permanency: spell.permanency
                ? {cl: spell.permanencyCl, cost: spell.permanencyCost}
                : null,
            slaLevel: spell.slaLevel,
            race: spell.race,

            classes: spell.spellClasses.map((sc) => ({...sc.class, level: sc.level})),
            domains: spell.domainSpells.map((ds) => ({...ds.domain, level: ds.level})),
            subdomains: spell.subdomainSpells.map((ss) => ({...ss.subdomain, level: ss.level})),
            bloodlines: spell.bloodlineSpells.map((bs) => ({...bs.bloodline, classLevel: bs.classLevel})),
            patrons: spell.patronSpells.map((ps) => ({...ps.patron, classLevel: ps.classLevel})),
            mysteries: spell.mysterySpells.map((ms) => ({
                ...ms.mystery,
                classLevel: ms.classLevel,
                note: ms.note,
            })),
        });
    });

export default app;
