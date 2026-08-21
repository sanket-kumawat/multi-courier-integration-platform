# Multi-Courier Integration Platform

Courier-agnostic backend for creating, tracking, and cancelling shipments. Consumers pass `courier_partner`; they never see partner payload shapes. The first live adapter is **UrbaneBolt**. A **mock** adapter is registered for tests and local demos.

REST lives at `/api/v1`. The web app can use typed `/rpc`. Both call the same services.

## Quick start

```bash
pnpm install
pnpm run db:start          # docker compose postgres
cp apps/server/.env.example apps/server/.env
# set DATABASE_URL (default in the example matches compose)
pnpm run db:migrate
pnpm run dev               # API :3000, web :3001
```

Health: `GET http://localhost:3000/api/v1/health`  
OpenAPI UI: `http://localhost:3000/api-reference`  
HTTP examples: [`docs/http-examples.md`](docs/http-examples.md)

## Environment

Copy `apps/server/.env.example`. Required for boot: `DATABASE_URL`, `CORS_ORIGIN`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `COURIER_TIMEOUT_MS` | `10000` | Partner HTTP timeout |
| `COURIER_RETRY_ATTEMPTS` | `3` | 5xx / timeout / network retries |
| `COURIER_RETRY_BASE_MS` | `200` | Backoff base (full jitter) |
| `COURIER_RETRY_MAX_MS` | `2000` | Backoff cap |
| `BULK_CONCURRENCY` | `10` | Skip-locked worker parallelism |
| `BULK_POLL_INTERVAL_MS` | `500` | Worker tick |
| `BULK_ITEM_STALE_MS` | `60000` | Reclaim crashed `PROCESSING` items |
| `URBANEBOLT_BASE_URL` | UAT | Partner base URL |
| `URBANEBOLT_USERNAME` / `PASSWORD` / `CUSTOMER_CODE` | — | UAT credentials (never commit) |

Mock needs no secrets. Missing UrbaneBolt credentials fail at first `urbanebolt` call (`COURIER_AUTH_FAILED`), not at boot (except production, which asserts they are set).

## API

| Method | Path | Success |
| --- | --- | --- |
| `POST` | `/api/v1/orders` | `201` |
| `GET` | `/api/v1/orders/{order_id}` | `200` |
| `GET` | `/api/v1/orders/{order_id}/track` | `200` |
| `POST` | `/api/v1/orders/{order_id}/cancel` | `200` |
| `POST` | `/api/v1/orders/bulk` | `202` |
| `GET` | `/api/v1/batches/{batch_id}` | `200` |
| `GET` | `/api/v1/couriers` | `200` |
| `GET` | `/api/v1/health` | `200` |

`order_id` in paths is the **consumer** id (idempotency key), not the internal UUID. Errors use `{ error: { code, message, request_id, details } }`. Every response echoes `X-Request-Id`.

## Tests

```bash
pnpm run test
pnpm run check-types
pnpm run check
```

CI must not hit UrbaneBolt UAT. Adapter tests mock `fetch`. Optional live smoke: `URBANEBOLT_SMOKE=1` in `packages/couriers`.

## How to add a courier

Adding a partner is **one adapter module + env vars + one `registry.register()`**. Do not edit existing adapters, public Zod DTOs, routers, or `OrderService`.

1. Create `packages/couriers/src/<id>/` with `adapter.ts` implementing `CourierAdapter` (`createShipment`, `track`, `cancel`, `mapStatus`). Put partner JSON parsing in isolated files. Use `createCourierHttp()` so timeout, retry, and redaction stay shared.
2. Add credentials to `packages/env/src/server.ts` and `apps/server/.env.example`.
3. Register in `packages/couriers/src/index.ts`: `registry.register(new YourAdapter())`.
4. Cover mappers and mocked HTTP in `packages/couriers/src/<id>/*.test.ts`.

`GET /api/v1/couriers` will list the new id. Callers pass it as `courier_partner`.

## Architecture

See [`DESIGN.md`](DESIGN.md) and [`docs/architecture.md`](docs/architecture.md).

- **Strategy + registry:** services never `switch` on partner names.
- **Bulk:** `202` + poll, PostgreSQL `SKIP LOCKED`, `p-limit(BULK_CONCURRENCY)` — not inline `Promise.all`.
- **Logs:** evlog wide events (`order.create`, `order.track`, `order.cancel`, `order.bulk.accept`, `courier.http`). Tokens and `Authorization` are redacted. Partner bodies live in append-only `courier_api_calls`, not HTTP error envelopes.

## Deploy on Railway

You need **three services** in one Railway project: Postgres, `server`, and `web`.

This is a **shared pnpm monorepo**. Do **not** leave Root Directory empty with Railpack defaults — that builds the workspace root and fails with `No start command detected`.

### 1. Create the project

1. [New project](https://railway.com/new) → **Deploy from GitHub** → select this repo.
2. Add **PostgreSQL** (New → Database → PostgreSQL).
3. Add two services from the same repo: `server` and `web` (Root Directory stays empty / repo root).

### 2. Force Dockerfile builds (required)

Railpack will not find `apps/*/Dockerfile` on its own. For **each** service, either:

**Option A — service variable (fastest)**

| Service | Variable |
| --- | --- |
| `server` | `RAILWAY_DOCKERFILE_PATH=apps/server/Dockerfile` |
| `web` | `RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile` |

**Option B — config as code**

| Service | Railway Config File |
| --- | --- |
| `server` | `/apps/server/railway.json` |
| `web` | `/apps/web/railway.json` |

(Settings → Config-as-code → Config file path. Use the leading `/`.)

Then redeploy. Build logs should say `Using detected Dockerfile!`, not `Railpack`.

### 3. Server variables

```text
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
CORS_ORIGIN=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
URBANEBOLT_BASE_URL=https://uat.urbanebolt.in
URBANEBOLT_USERNAME=<your-username>
URBANEBOLT_PASSWORD=<your-password>
URBANEBOLT_CUSTOMER_CODE=<your-customer-code>
```

Generate a public domain for `server`. The image runs migrations on start, then listens on `$PORT`.

### 4. Web variables

Set **before** the first successful web build (baked into the Vite bundle):

```text
VITE_SERVER_URL=https://${{server.RAILWAY_PUBLIC_DOMAIN}}
```

Generate a public domain for `web`, then redeploy `server` if `CORS_ORIGIN` was set too early.

### 5. Verify

- API health: `https://<server-domain>/api/v1/health`
- OpenAPI UI: `https://<server-domain>/api-reference`
- App: `https://<web-domain>/`

### Troubleshooting: `No start command detected` / Railpack

Usually one of:

1. **`.dockerignore` was excluding `Dockerfile`** (fixed in repo) — push latest `chore/deployment` and redeploy.
2. Service has no config — root `railway.json` defaults to the **server** image. For **web**, set Config file path to `/apps/web/railway.json` (or `RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile`).
3. Railpack fallback: Build `pnpm run build:server` / Start `pnpm run start:server` (web: `build:web` / `start:web`).

### Notes

- Production refuses to boot without UrbaneBolt credentials.
- Prefer `${{service.VAR}}` references over hard-coded URLs.
- Local stack: `pnpm run docker:up`.

## Scripts

- `pnpm run dev` / `dev:server` / `dev:web`
- `pnpm run db:start` / `db:migrate` / `db:studio`
- `pnpm run test` / `check-types` / `check`
- `pnpm run docker:up` / `docker:down`
