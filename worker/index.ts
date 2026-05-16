import { Hono } from "hono";
import lookups from "./routes/lookups";
import spells from "./routes/spells";

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>();

app.route("/api", lookups);
app.route("/api/spells", spells);

export default app;
