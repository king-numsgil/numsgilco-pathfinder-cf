# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Start Vite dev server + Worker (via @cloudflare/vite-plugin), http://localhost:5173
bun run build        # tsc -b && vite build
bun run lint         # eslint . --max-warnings 0
bun check            # Type-check all four tsconfig projects (use this, not tsc --noEmit)
bun run deploy       # build + wrangler deploy
bun run ui <route>   # UI harness: screenshot + layout/console report (see below)

bun run db:push      # Push schema changes directly to the database (no migration files)
bun run db:generate  # Generate Drizzle migration SQL files
bun run db:studio    # Open Drizzle Studio GUI
bun run db:seed      # DESTRUCTIVE: TRUNCATE CASCADE all tables then re-seed from data/codex.json
bun run cf-typegen   # Regenerate worker-configuration.d.ts from wrangler.jsonc bindings
```

`bun run dev` starts both the Vite frontend and the Cloudflare Worker in a single process via `@cloudflare/vite-plugin`. There is no separate worker dev command. The user usually has it running already — check `http://localhost:5173` before starting another.

## Architecture

### Overview

A Cloudflare Worker serves both the Hono JSON API (`/api/*`) and the Vite-built SPA (static assets). In `wrangler.jsonc`, `"run_worker_first": ["/api/*"]` sends every API request to the Worker (even direct browser navigations); everything else is a static asset or falls back to `index.html` via `"not_found_handling": "single-page-application"`, so client routes like `/spells/<id>` deep-link fine.

```
vite.config.ts         — Vite + cloudflare() + vanillaExtractPlugin() + react()
worker/index.ts        — Hono app; mounts /api (lookups), /api/spells, /api/feats; JSON onError; exports AppType
worker/routes/         — lookups.ts (lists + /stats), spells.ts, feats.ts (search + detail), params.ts (shared parsing)
worker/db/schema.ts    — Drizzle schema (single source of truth)
worker/db/index.ts     — createDb(connectionString) factory
src/api/index.ts       — Typed Hono client (hc<AppType>), all fetch helpers + derived types
src/pages/             — Route-level components + their co-located hooks, state helpers and styles
src/env-shim.d.ts      — Minimal `Env` so the SPA project can type-check the worker import
db/seed.ts             — One-shot seed script (bun only, not Worker)
scripts/ui.ts          — UI harness (Bun.WebView + headless Chrome)
data/*.json            — Canonical source data for the seed
drizzle.config.ts      — Reads .env for DB URL; used by drizzle-kit commands
```

### Database

- **Self-hosted PostgreSQL** (DigitalOcean Droplet) accessed via **Cloudflare Hyperdrive** (connection pooling).
- `postgres.js` requires `prepare: false` — Hyperdrive manages the pool and does not support prepared statements.
- At runtime, `c.env.HYPERDRIVE.connectionString` provides the connection string. Locally, Wrangler and drizzle-kit both read `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` from `.env`.
- All primary keys are **ULIDs** (text), generated with `ulidx`. Never use integer sequences.
- **Subdomains are shared across multiple domains** (e.g. "Shadow" belongs to both Darkness and Death). The M2M relationship is modeled via `domain_subdomains` junction table — `subdomains.name` is unique and there is no `domainId` FK on the subdomains table.
- **Bloodline, patron and mystery junction tables store the CLASS level** at which the spell is granted, not the spell level (see Worker / API for the conversion).
- **Seed data is `data/codex.json`** (Archive of Nethys scrape; the older `spell_codex.json`, `feats.json`, `domains.json`, `OracleMysteries.json` are no longer read). Records reference each other by codex key (`spell:abeyance`); `db/seed.ts` maps keys to ULIDs. `bun db/seed.ts --dry-run` validates the data and reports counts/warnings without touching the DB.
- Spell and feat text columns hold **Markdown** (`*spell names*`, `**bold**`, tables). Spells can have several subschools (`spell_subschools`). Junction `note` columns hold list-entry qualifiers ("air only").

### Worker / API

- Spell search (`GET /api/spells`) uses **EXISTS correlated subqueries** built by `buildWhere()` in `worker/routes/spells.ts`, driven by the `SOURCES` table. Source types (class, domain, subdomain, bloodline, patron, mystery) are OR'd. Level constraints are baked into each source subquery. When only a level filter is present (no source filter), the level is OR'd across all six junction tables.
- Each spell list row carries `level` = lowest matching spell level (`buildLevelExpr()`); `sort=level` orders by it.
- `SOURCES[*].level` converts class level → spell level: sorcerer bloodlines `(cl-1)/2` (granted at 3, 5, …, 19), bloodrager bloodlines — `bloodlines.bloodrager`, named e.g. `Aberrant (Bloodrager)` — `(cl-4)/3` (7, 10, 13, 16), patrons and mysteries `cl/2` (2, 4, …, 18). The detail endpoint returns both `level` and `classLevel`.
- Filter parameters accept **comma-separated IDs** (e.g. `school=id1,id2`), split by `parseIds()` / `parseLevels()` in `params.ts`. `limit`/`offset` are coerced and clamped by `paginationSchema` (bad values → 400). Name search escapes LIKE wildcards (`escapeLike()`).
- Lookup routes send `Cache-Control: public, max-age=3600`; the SPA also caches them in memory (`once()` in `src/api/index.ts`).
- `GET /api/domains` returns `{ id, name, subdomains: [] }` — the subdomain nesting is built at query time from `domainSubdomains`.

### Frontend

- **React Router v7** with `createBrowserRouter` (clean URLs, e.g. `/spells/<id>?level=1`). Legacy hash links (`/#/spells/<id>`) are rewritten at startup in `App.tsx`.
- **SpellModal** and **FeatModal** are nested routes under `/spells/:id` and `/feats/:id`, rendered via `useOutlet()` in the list page. The list renders its own `<title>` only when no modal is open; the modal renders the record's.
- **List filters, search and sort live in the URL query** (`useSearchParams`, updated with `replace`). URL param names mirror the API's — see `spellFilterState.ts` / `featFilterState.ts`. Links to a modal carry the current query.
- Modal history: opening from the list passes `FROM_LIST` router state (`{fromList, depth: 1}`); in-modal links to another record push history with `useNestedModalState()` (depth + 1), so Back returns to the previous record. `useCloseModal()` goes `navigate(-depth)` straight back to the list; for deep links (no `fromList`) it replaces the entry with the list.
- Detail modals: `useDetail(id, fetcher)` fetches; `useDetailModalLayout()` puts the name in the header bar, wraps long words, and goes full-screen below 48em.
- Shared list plumbing: `useInfiniteList` (paging + IntersectionObserver; a failed page stops auto-loading until `retry()`), `useUrlSearch`, `ListFooter`/`ListError`, `SectionLabel`/`LabeledSection`.
- `src/api/index.ts` derives all response/request types from the Worker's Hono app — never hand-write API types.
- **vanilla-extract** `.css.ts` files are co-located next to the components that use them.

### Code style

- **Components**: arrow functions typed with `FC` — `export const Foo: FC<FooProps> = ({bar}) => ...`. Never `function Foo()` for components, never `React.FC`.
- **Props**: a plain `interface FooProps { ... }` declared right above the component (not a type alias, not an inline object type).
- **JSX returns**: no parentheses around the returned JSX — `return <Div ...>`. Wrap in a fragment if multiple roots are needed.

### React patterns enforced by ESLint

- **`eslint-plugin-react-hooks` v7** (`set-state-in-effect` rule): calling `setState` synchronously in a `useEffect` body is an error. State updates go in async callbacks, `startTransition`, Promise `.then()` handlers, or effect events (`useEffectEvent`) called from effects. Prefer deriving state over resetting it — e.g. `useDetail` tags results with their ID so a stale result reads as "loading".
- **`react-refresh/only-export-components`**: `.tsx` files must only export React components. Hooks, types, constants and helpers shared between components go in `.ts` files (e.g. `spellFilterState.ts`, `useInfiniteList.ts`).

### TypeScript projects

Four tsconfig projects, all referenced from `tsconfig.json`:
- `tsconfig.app.json` — SPA (`src/`, plus `worker/` so `hc<AppType>` can infer API types)
- `tsconfig.node.json` — tooling config (`vite.config.ts`, `drizzle.config.ts`)
- `tsconfig.worker.json` — Hono Worker (`worker/`)
- `tsconfig.db.json` — Bun scripts (`db/`, `worker/db/`, `scripts/`), adds `bun-types`

TypeScript is pinned to 6.x because typescript-eslint does not support TS 7 yet.

### UI harness

`bun run ui <route> [options]` loads `http://localhost:5173/<route>` (or `--base=<url>`, e.g. a `vite preview` on :4173) in headless Chrome (Bun.WebView), waits for loaders to disappear and layout to settle, then saves a screenshot to `.ui/` (gitignored) and reports:
- **offscreen** — elements past the viewport's right edge
- **clipped** — containers whose content is wider than they are (expected for the list tables on mobile; anything else is usually a bug)
- **console** — page errors/warnings

Options: `--device=mobile|tablet|desktop` (390×844 / 820×1180 / 1440×900) or `--size=WxH`, `--click=<selector>`, `--type=<text>`, `--scroll=<selector>`, `--eval=<expression>`, `--full`, `--dpr=2`, `--out=<file>`. Pass the route **without** a leading slash (`spells/<id>`): Git Bash rewrites `/…` arguments into Windows paths. Mobile sizes use DevTools device emulation because headless Chrome won't go below 500px wide.

Use it to check UI changes on both mobile and desktop before calling them done; read the screenshots.

## Critical constraints

- **`data/*.json` is the canonical source data** — never overwrite or regenerate it.
- **DO NOT commit `.env`** — it contains the database password.
- **`bun run db:seed` is destructive** — it runs `TRUNCATE CASCADE` on all tables before inserting. Only run intentionally.
