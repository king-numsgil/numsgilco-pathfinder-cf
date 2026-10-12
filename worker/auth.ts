// "minimal" leaves out the Kysely dialects; the Drizzle adapter doesn't need them
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { ulid } from "ulidx";
import { type AppDb, createDb } from "./db";
import * as s from "./db/schema";

/**
 * Better Auth with Discord sign-in. Built per request: the database connection
 * comes from the Hyperdrive binding, which only exists on the request's env.
 */
export function createAuth(env: Env, db: AppDb) {
    return betterAuth({
        baseURL: env.BETTER_AUTH_URL,
        secret: env.BETTER_AUTH_SECRET,
        basePath: "/api/auth",
        database: drizzleAdapter(db, {
            provider: "pg",
            schema: {
                user: s.users,
                session: s.sessions,
                account: s.accounts,
                verification: s.verifications,
            },
        }),
        socialProviders: {
            discord: {
                clientId: env.DISCORD_CLIENT_ID,
                clientSecret: env.DISCORD_CLIENT_SECRET,
            },
        },
        session: {
            // Signed copy of the session in a cookie: most requests skip the DB lookup
            cookieCache: {enabled: true, maxAge: 5 * 60},
        },
        advanced: {
            database: {generateId: () => ulid()},
        },
    });
}

export interface SessionUser {
    id: string;
    name: string;
    image: string | null | undefined;
}

export type AuthEnv = {
    Bindings: Env;
    Variables: { db: AppDb; user: SessionUser };
};

/** Rejects anonymous requests with 401; otherwise exposes `db` and `user`. */
export const requireUser = createMiddleware<AuthEnv>(async (c, next) => {
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const session = await createAuth(c.env, db).api.getSession({headers: c.req.raw.headers});
    if (!session) {
        throw new HTTPException(401, {
            res: Response.json({error: "Sign in required"}, {status: 401}),
        });
    }
    const {id, name, image} = session.user;
    c.set("db", db);
    c.set("user", {id, name, image});
    await next();
    // Per-user data must never be stored by a shared cache
    c.header("Cache-Control", "private, no-store");
});
