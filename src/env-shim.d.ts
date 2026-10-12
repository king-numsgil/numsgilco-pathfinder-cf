// Minimal Env shim so tsconfig.app.json can resolve worker/index.ts for
// the AppType import. The real declaration lives in worker-configuration.d.ts;
// this subset is enough for TypeScript to type-check the hc<AppType> call.
interface Env {
    HYPERDRIVE: { connectionString: string };
    BETTER_AUTH_URL: string;
    BETTER_AUTH_SECRET: string;
    DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
}
