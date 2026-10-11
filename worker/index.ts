import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import feats from "./routes/feats";
import lookups from "./routes/lookups";
import spells from "./routes/spells";

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>()
    .route("/api", lookups)
    .route("/api/spells", spells)
    .route("/api/feats", feats)
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
