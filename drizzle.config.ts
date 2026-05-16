import { defineConfig } from "drizzle-kit";

// Reads the same env var that Wrangler uses to simulate Hyperdrive locally.
// For the worker at runtime, Hyperdrive.connectionString is provided by the binding.
const url = process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE;
if (!url) {
    throw new Error(
        "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE is not set in .env",
    );
}

export default defineConfig({
    schema: "./worker/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: { url },
});
