import { and, asc, count, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { createDb } from "../db";
import * as s from "../db/schema";

type HonoEnv = { Bindings: Env };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseIds(p: string | undefined): string[] {
    return p ? p.split(",").map((x) => x.trim()).filter(Boolean) : [];
}

function buildWhere(params: {
    q?: string;
    types: string[];
    maxBab?: number;
    maxCl?: number;
}): SQL | undefined {
    const {q, types, maxBab, maxCl} = params;
    const filters: SQL[] = [];

    if (q) {
        filters.push(ilike(s.feats.name, `%${q}%`));
    }

    if (types.length) {
        // Feat must have at least one of the selected types (array overlap)
        filters.push(sql`${s.feats.types} && ARRAY[${sql.join(
            types.map((t) => sql`${t}`),
            sql`, `,
        )}]::text[]`);
    }

    if (maxBab !== undefined && !isNaN(maxBab)) {
        filters.push(or(
            sql`${s.feats.minBab} IS NULL`,
            sql`${s.feats.minBab} <= ${maxBab}`,
        )!);
    }

    if (maxCl !== undefined && !isNaN(maxCl)) {
        filters.push(or(
            sql`${s.feats.minCasterLevel} IS NULL`,
            sql`${s.feats.minCasterLevel} <= ${maxCl}`,
        )!);
    }

    return filters.length > 0 ? and(...filters) : undefined;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const app = new Hono<HonoEnv>()
    .get("/", async (c) => {
        const db = createDb(c.env.HYPERDRIVE.connectionString);

        const rawLimit = parseInt(c.req.query("limit") ?? "50", 10);
        const rawOffset = parseInt(c.req.query("offset") ?? "0", 10);
        const limit = Math.min(isNaN(rawLimit) ? 50 : rawLimit, 200);
        const offset = isNaN(rawOffset) ? 0 : rawOffset;

        const rawMaxBab = c.req.query("maxBab");
        const rawMaxCl = c.req.query("maxCl");

        const params = {
            q: c.req.query("q"),
            types: parseIds(c.req.query("type")),
            maxBab: rawMaxBab !== undefined ? parseInt(rawMaxBab, 10) : undefined,
            maxCl: rawMaxCl !== undefined ? parseInt(rawMaxCl, 10) : undefined,
        };

        const where = buildWhere(params);

        const [{total}, data] = await Promise.all([
            db.select({total: count()}).from(s.feats).where(where).then((r) => r[0]),
            db
                .select({
                    id: s.feats.id,
                    name: s.feats.name,
                    types: s.feats.types,
                    prerequisites: s.feats.prerequisites,
                    benefit: s.feats.benefit,
                    source: s.feats.source,
                    multiples: s.feats.multiples,
                    minBab: s.feats.minBab,
                    minCasterLevel: s.feats.minCasterLevel,
                })
                .from(s.feats)
                .where(where)
                .orderBy(asc(s.feats.name))
                .limit(limit)
                .offset(offset),
        ]);

        return c.json({data, total, limit, offset});
    })
    .get("/:id", async (c) => {
        const db = createDb(c.env.HYPERDRIVE.connectionString);
        const id = c.req.param("id");

        const feat = await db.query.feats.findFirst({
            where: eq(s.feats.id, id),
            with: {
                prerequisiteLinks: {
                    with: {requiredFeat: true},
                    orderBy: (l, {asc: a}) => [a(l.requiredFeatId)],
                },
                dependentLinks: {
                    with: {feat: true},
                    orderBy: (l, {asc: a}) => [a(l.featId)],
                },
            },
        });

        if (!feat) {
            return c.json({error: "Not found"} as const, 404);
        }

        return c.json({
            id: feat.id,
            name: feat.name,
            types: feat.types,
            description: feat.description,
            prerequisites: feat.prerequisites,
            benefit: feat.benefit,
            normal: feat.normal,
            special: feat.special,
            raceName: feat.raceName,
            note: feat.note,
            goal: feat.goal,
            completionBenefit: feat.completionBenefit,
            source: feat.source,
            multiples: feat.multiples,
            minBab: feat.minBab,
            minCasterLevel: feat.minCasterLevel,
            requires: feat.prerequisiteLinks.map((l) => ({
                id: l.requiredFeat.id,
                name: l.requiredFeat.name,
                note: l.note,
            })),
            requiredBy: feat.dependentLinks.map((l) => ({
                id: l.feat.id,
                name: l.feat.name,
            })).sort((a, b) => a.name.localeCompare(b.name)),
        });
    });

export default app;
