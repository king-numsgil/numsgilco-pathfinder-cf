import { zValidator } from "@hono/zod-validator";
import { and, asc, count, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../db";
import * as s from "../db/schema";
import { escapeLike, paginationSchema, parseIds } from "./params";

type HonoEnv = { Bindings: Env };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWhere(params: {
    q?: string;
    types: string[];
    maxBab?: number;
    maxCl?: number;
}): SQL | undefined {
    const {q, types, maxBab, maxCl} = params;
    const filters: SQL[] = [];

    if (q) {
        filters.push(ilike(s.feats.name, `%${escapeLike(q)}%`));
    }

    if (types.length) {
        // Feat must have at least one of the selected types (array overlap)
        filters.push(sql`${s.feats.types} && ARRAY[${sql.join(
            types.map((t) => sql`${t}`),
            sql`, `,
        )}]::text[]`);
    }

    if (maxBab !== undefined) {
        filters.push(or(
            sql`${s.feats.minBab} IS NULL`,
            sql`${s.feats.minBab} <= ${maxBab}`,
        )!);
    }

    if (maxCl !== undefined) {
        filters.push(or(
            sql`${s.feats.minCasterLevel} IS NULL`,
            sql`${s.feats.minCasterLevel} <= ${maxCl}`,
        )!);
    }

    return filters.length > 0 ? and(...filters) : undefined;
}

// ─── Query schema ─────────────────────────────────────────────────────────────

export const featsQuerySchema = z.object({
    q: z.string().optional(),
    type: z.string().optional(),
    maxBab: z.coerce.number().int().min(0).max(20).optional(),
    maxCl: z.coerce.number().int().min(0).max(20).optional(),
    ...paginationSchema,
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const app = new Hono<HonoEnv>()
    .get("/", zValidator("query", featsQuerySchema), async (c) => {
        const db = createDb(c.env.HYPERDRIVE.connectionString);
        const {q, type, maxBab, maxCl, limit, offset} = c.req.valid("query");

        const params = {
            q,
            types: parseIds(type),
            maxBab,
            maxCl,
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
            link: feat.link,
            pfsLegal: feat.pfsLegal,
            types: feat.types,
            description: feat.description,
            prerequisites: feat.prerequisites,
            benefit: feat.benefit,
            normal: feat.normal,
            special: feat.special,
            goal: feat.goal,
            completionBenefit: feat.completionBenefit,
            combatTrick: feat.combatTrick,
            mythic: feat.mythic,
            extra: feat.extra,
            source: feat.source,
            sources: feat.sources,
            multiples: feat.multiples,
            minBab: feat.minBab,
            minCasterLevel: feat.minCasterLevel,
            requires: feat.prerequisiteLinks.map((l) => ({
                id: l.requiredFeat.id,
                name: l.requiredFeat.name,
                types: l.requiredFeat.types,
                note: l.note,
            })),
            requiredBy: feat.dependentLinks.map((l) => ({
                id: l.feat.id,
                name: l.feat.name,
                types: l.feat.types,
            })).sort((a, b) => a.name.localeCompare(b.name)),
        });
    });

export default app;
