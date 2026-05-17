import { Hono } from "hono";
import lookups from "./routes/lookups";
import spells from "./routes/spells";

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>()
    .route("/api", lookups)
    .route("/api/spells", spells);

export type AppType = typeof app;
export default app;
