import { Hono } from "hono";
import { asc } from "drizzle-orm";
import { createDb } from "../db";
import * as s from "../db/schema";

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>();

app.get("/classes", async (c) => {
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const rows = await db.select().from(s.classes).orderBy(asc(s.classes.name));
    return c.json(rows);
});

app.get("/schools", async (c) => {
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const rows = await db.select().from(s.schools).orderBy(asc(s.schools.name));
    return c.json(rows);
});

app.get("/subschools", async (c) => {
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const rows = await db.select().from(s.subschools).orderBy(asc(s.subschools.name));
    return c.json(rows);
});

app.get("/deities", async (c) => {
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const rows = await db.select().from(s.deities).orderBy(asc(s.deities.name));
    return c.json(rows);
});

app.get("/bloodlines", async (c) => {
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const rows = await db.select().from(s.bloodlines).orderBy(asc(s.bloodlines.name));
    return c.json(rows);
});

app.get("/patrons", async (c) => {
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const rows = await db.select().from(s.patrons).orderBy(asc(s.patrons.name));
    return c.json(rows);
});

app.get("/mysteries", async (c) => {
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const rows = await db.select().from(s.mysteries).orderBy(asc(s.mysteries.name));
    return c.json(rows);
});

// Domains with subdomains nested
app.get("/domains", async (c) => {
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const rows = await db.query.domains.findMany({
        orderBy: asc(s.domains.name),
        with: {
            domainSubdomains: {
                with: { subdomain: true },
                orderBy: (ds, { asc: a }) => [a(ds.subdomainId)],
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
});

export default app;
