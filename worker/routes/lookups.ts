import { asc, count, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createDb } from "../db";
import * as s from "../db/schema";

type HonoEnv = { Bindings: Env };

type NamedTable =
    | typeof s.classes
    | typeof s.schools
    | typeof s.subschools
    | typeof s.deities
    | typeof s.bloodlines
    | typeof s.patrons
    | typeof s.mysteries
    | typeof s.psychicDisciplines;

function listNamed(connectionString: string, table: NamedTable): Promise<{ id: string; name: string }[]> {
    const db = createDb(connectionString);
    return db.select({id: table.id, name: table.name}).from(table).orderBy(asc(table.name));
}

// Reference data only changes on re-seed; let browsers reuse it for an hour
const CACHE_CONTROL = "public, max-age=3600";

const app = new Hono<HonoEnv>()
    // Mounted at /api, so this wraps every API route: keep a route's own policy
    // (per-user routes send private, no-store)
    .use(async (c, next) => {
        await next();
        if (c.res.ok && !c.res.headers.has("Cache-Control")) {
            c.header("Cache-Control", CACHE_CONTROL);
        }
    })
    .get("/classes", async (c) => c.json(await listNamed(c.env.HYPERDRIVE.connectionString, s.classes)))
    .get("/schools", async (c) => c.json(await listNamed(c.env.HYPERDRIVE.connectionString, s.schools)))
    .get("/subschools", async (c) => c.json(await listNamed(c.env.HYPERDRIVE.connectionString, s.subschools)))
    .get("/deities", async (c) => c.json(await listNamed(c.env.HYPERDRIVE.connectionString, s.deities)))
    .get("/bloodlines", async (c) => c.json(await listNamed(c.env.HYPERDRIVE.connectionString, s.bloodlines)))
    .get("/patrons", async (c) => c.json(await listNamed(c.env.HYPERDRIVE.connectionString, s.patrons)))
    .get("/mysteries", async (c) => c.json(await listNamed(c.env.HYPERDRIVE.connectionString, s.mysteries)))
    .get("/disciplines", async (c) => c.json(await listNamed(c.env.HYPERDRIVE.connectionString, s.psychicDisciplines)))
    .get("/domains", async (c) => {
        const db = createDb(c.env.HYPERDRIVE.connectionString);
        const rows = await db.query.domains.findMany({
            orderBy: asc(s.domains.name),
            with: {
                domainSubdomains: {
                    with: {subdomain: true},
                    orderBy: (ds, {asc: a}) => [a(ds.subdomainId)],
                },
            },
        });
        return c.json(
            rows.map((d) => ({
                id: d.id,
                name: d.name,
                subdomains: d.domainSubdomains
                    .map((ds) => ds.subdomain)
                    .sort((a, b) => a.name.localeCompare(b.name)),
            })),
        );
    })
    .get("/descriptors", async (c) => {
        const db = createDb(c.env.HYPERDRIVE.connectionString);
        const rows = await db
            .selectDistinct({descriptor: sql<string>`unnest(${s.spells.descriptors})`})
            .from(s.spells)
            .orderBy(sql`1`);
        return c.json(rows.map((r) => r.descriptor).filter(Boolean));
    })
    .get("/feat-types", async (c) => {
        const db = createDb(c.env.HYPERDRIVE.connectionString);
        const rows = await db
            .selectDistinct({type: sql<string>`unnest(${s.feats.types})`})
            .from(s.feats)
            .orderBy(sql`1`);
        return c.json(rows.map((r) => r.type).filter(Boolean));
    })
    .get("/stats", async (c) => {
        const db = createDb(c.env.HYPERDRIVE.connectionString);
        const [[spells], [feats]] = await Promise.all([
            db.select({total: count()}).from(s.spells),
            db.select({total: count()}).from(s.feats),
        ]);
        return c.json({spells: spells.total, feats: feats.total});
    });

export default app;
