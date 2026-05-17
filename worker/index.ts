import { Hono } from "hono";
import feats from "./routes/feats";
import lookups from "./routes/lookups";
import spells from "./routes/spells";

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>()
    .route("/api", lookups)
    .route("/api/spells", spells)
    .route("/api/feats", feats);

export type AppType = typeof app;
export default app;
