import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Create a Drizzle instance backed by a Hyperdrive connection.
 * Call this once per Worker request (or once at module level if your
 * Worker handles a single long-lived connection).
 *
 * `prepare: false` is required for Hyperdrive — it manages its own
 * connection pool and doesn't support prepared statements across requests.
 */
export function createDb(connectionString: string) {
    const client = postgres(connectionString, {prepare: false});
    return drizzle(client, {schema});
}

export type AppDb = ReturnType<typeof createDb>;
export * from "./schema";
