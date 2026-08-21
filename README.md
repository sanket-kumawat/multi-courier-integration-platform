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

### 1. Create the project

1. [New project](https://railway.com/new) → **Deploy from GitHub** → select this repo.
2. Add a **PostgreSQL** plugin (New → Database → PostgreSQL).
3. Add two empty services from the same repo (or duplicate the first): name them `server` and `web`.

### 2. Server service

Settings:

| Setting | Value |
| --- | --- |
| Config as Code path | `apps/server/railway.json` |
| Root directory | leave empty (repo root) |

Variables:

```text
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
CORS_ORIGIN=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
URBANEBOLT_BASE_URL=https://uat.urbanebolt.in
URBANEBOLT_USERNAME=<your-username>
URBANEBOLT_PASSWORD=<your-password>
URBANEBOLT_CUSTOMER_CODE=<your-customer-code>
```

Generate a public domain for `server` (Settings → Networking → Generate domain).

The server image runs `drizzle-kit migrate` on every start, then listens on `$PORT`.

### 3. Web service

Settings:

| Setting | Value |
| --- | --- |
| Config as Code path | `apps/web/railway.json` |
| Root directory | leave empty (repo root) |

Variables (needed at **build** time — set before the first successful build):

```text
VITE_SERVER_URL=https://${{server.RAILWAY_PUBLIC_DOMAIN}}
```

Generate a public domain for `web`. If `CORS_ORIGIN` was set before the web domain existed, redeploy `server` after both domains are known.

`VITE_SERVER_URL` is baked into the static bundle. Changing the server URL requires a **web rebuild**.

### 4. Verify

- API health: `https://<server-domain>/api/v1/health`
- OpenAPI UI: `https://<server-domain>/api-reference`
- App: `https://<web-domain>/`

### Notes

- Production refuses to boot without UrbaneBolt credentials (`assertUrbaneBoltConfigured`).
- Prefer Railway variable references (`${{service.VAR}}`) over hard-coded URLs so domains stay in sync.
- Local Docker Compose remains available via `pnpm run docker:up` (see Quick start).

## Scripts

- `pnpm run dev` / `dev:server` / `dev:web`
- `pnpm run db:start` / `db:migrate` / `db:studio`
- `pnpm run test` / `check-types` / `check`
- `pnpm run docker:up` / `docker:down`
