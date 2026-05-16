# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Start Vite dev server + Worker (via @cloudflare/vite-plugin)
bun run build        # tsc -b && vite build
bun run lint         # eslint . (zero warnings enforced)
bun run deploy       # build + wrangler deploy

bun run db:push      # Push schema changes directly to Supabase (no migration files)
bun run db:generate  # Generate Drizzle migration SQL files
bun run db:studio    # Open Drizzle Studio GUI
bun run db:seed      # TRUNCATE CASCADE all tables then re-seed from data/*.json
bun run cf-typegen   # Regenerate worker-configuration.d.ts from wrangler.jsonc bindings
```

`bun run dev` starts both the Vite frontend and the Cloudflare Worker in a single process via `@cloudflare/vite-plugin`. There is no separate worker dev command.

## Architecture

### Overview

A Cloudflare Worker serves both the Hono JSON API (`/api/*`) and the Vite-built SPA (static assets). The Worker handles API routes; all other requests fall through to the SPA via `"not_found_handling": "single-page-application"` in `wrangler.jsonc`.

```
vite.config.ts         — Vite + cloudflare() + vanillaExtractPlugin() + react()
worker/index.ts        — Hono app; mounts /api/spells and /api (lookups)
worker/routes/         — lookups.ts (simple lists), spells.ts (search + detail)
worker/db/schema.ts    — Drizzle schema (single source of truth)
worker/db/index.ts     — createDb(connectionString) factory
src/                   — React 19 SPA
src/api/index.ts       — All fetch helpers + shared TypeScript types
src/pages/             — Route-level components + their co-located helpers
db/seed.ts             — One-shot seed script (bun only, not Worker)
drizzle.config.ts      — Reads .env for DB URL; used by drizzle-kit commands
```

### Database

- **Supabase PostgreSQL** accessed via **Cloudflare Hyperdrive** (connection pooling).
- `postgres.js` requires `prepare: false` — Hyperdrive manages the pool and does not support prepared statements.
- At runtime, `c.env.HYPERDRIVE.connectionString` provides the connection string. Locally, Wrangler reads `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` from `.env`.
- All primary keys are **ULIDs** (text), generated with `ulidx`. Never use integer sequences.
- **Subdomains are shared across multiple domains** (e.g. "Shadow" belongs to both Darkness and Death). The M2M relationship is modeled via `domain_subdomains` junction table — `subdomains.name` is unique and there is no `domainId` FK on the subdomains table.
- Schema lives in `worker/db/schema.ts` and is shared between the Worker and `db/seed.ts` via `tsconfig.db.json`.

### Worker / API

- Spell search (`GET /api/spells`) uses **EXISTS correlated subqueries** built by `buildWhere()` in `worker/routes/spells.ts`. Source types (class, domain, subdomain, bloodline, patron, mystery) are OR'd. Level constraints are baked into each source subquery. When only a level filter is present (no source filter), the level is OR'd across all six junction tables.
- Filter parameters accept **comma-separated IDs** (e.g. `school=id1,id2`). `parseIds()` and `parseLevels()` split and sanitize them.
- `GET /api/domains` returns `{ id, name, subdomains: [] }` — the subdomain nesting is built at query time from `domainSubdomains`.

### Frontend

- **React Router v7** uses `createHashRouter` (not BrowserRouter). Hash routing is required because the Worker SPA fallback doesn't support pushState-based navigation for client-side routes.
- **SpellModal** and **FeatModal** are nested routes under `/spells/:id` and `/feats/:id`, rendered as `<Outlet />` children of the list page.
- `src/api/index.ts` owns all type definitions shared between the SPA and API response shapes. No types are imported from `worker/`.
- **vanilla-extract** `.css.ts` files are co-located next to the components that use them.
- `src/data/feats.ts` is still static placeholder data — the Feats page is not yet wired to the real API.

### React patterns enforced by ESLint

- **`eslint-plugin-react-hooks` v7** (`set-state-in-effect` rule): calling `setState` synchronously in a `useEffect` body is an error. All state updates must be inside async callbacks, `startTransition`, or Promise `.then()` handlers.
- **`react-refresh/only-export-components`**: `.tsx` files must only export React components. Types, constants, and utility functions that are shared between components go in `.ts` files (e.g. `spellFilterState.ts`).
- The key-based remount pattern (`key={id}` on a child component) is used to avoid synchronous loading-state resets when a new spell is opened.

### TypeScript projects

Three tsconfig targets:
- `tsconfig.app.json` — SPA (`src/`)
- `tsconfig.worker.json` — Hono Worker (`worker/`)
- `tsconfig.db.json` — DB seed scripts (`db/`, `worker/db/`), adds `bun-types`

Run `bunx tsc --noEmit` to type-check all projects simultaneously.

## Critical constraints

- **DO NOT run `data/refresh.ts`** — it is a Deno script written ~2 years ago. Running it would overwrite the source data.
- **DO NOT commit `.env`** — it contains the Supabase database password.
- **`bun run db:seed` is destructive** — it runs `TRUNCATE CASCADE` on all tables before inserting. Only run intentionally.
