import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createAuth } from "./auth";
import { createDb } from "./db";
import characters from "./routes/characters";
import feats from "./routes/feats";
import lookups from "./routes/lookups";
import spells from "./routes/spells";

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>()
    // Better Auth: Discord sign-in/callback, session, sign-out
    .on(["GET", "POST"], "/api/auth/*", (c) =>
        createAuth(c.env, createDb(c.env.HYPERDRIVE.connectionString)).handler(c.req.raw),
    )
    .route("/api", lookups)
    .route("/api/spells", spells)
    .route("/api/feats", feats)
    .route("/api/characters", characters)
    // Only /api/* reaches the Worker (run_worker_first); everything else is the SPA
    .notFound((c) => c.json({error: "Not found"}, 404))
    .onError((err, c) => {
        if (err instanceof HTTPException) {
            return err.getResponse();
        }
        console.error(err);
        return c.json({error: "Internal server error"}, 500);
    });

export type AppType = typeof app;
export default app;
