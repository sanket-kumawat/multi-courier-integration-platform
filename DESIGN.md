# Design

Short extract of [`docs/architecture.md`](docs/architecture.md) §§4, 7, and 9. That spec is the engineering contract.

## Architecture

**Strategy + registry.** `CourierAdapter` is the partner plugin (`createShipment`, `track`, `cancel`, `mapStatus`). `CourierRegistry` maps `courier_partner` → adapter. Unknown partners fail before any courier I/O. Application services (`OrderService`, `TrackingService`, `CancelService`, `BulkOrderService`) own persistence, idempotency, and status rules. They never `switch` on partner names.

Adding a courier is a new adapter module, env vars, and one `registry.register()` call. Public Zod DTOs, routers, and existing adapters stay closed.

```
Consumer → REST /api/v1 or /rpc → services → CourierRegistry → adapter → partner
                              ↘ PostgreSQL (orders, tracking_events, courier_api_calls, bulk_*)
```

Two HTTP surfaces, one brain: OpenAPI at `/api/v1` and typed oRPC at `/rpc`.

**Package direction:** `apps/server` → `api` → `couriers` + `db` + `env`. Adapters never import `api`, `db`, or Express.

## Data model

Internal PKs are UUIDv7. Consumer `order_id` is a unique varchar (idempotency key). Money is `numeric(12,2)`. Timestamps are `timestamptz`. Partner-specific JSON stays in `jsonb` audit columns, not public DTOs.

Canonical status: `PENDING`, `CREATED`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RTO`, `CANCELLED`, `FAILED`.

Append-only: `tracking_events`, `courier_api_calls`, `shipment_documents`, `shipment_actions`. Orders cannot be deleted without that history (`ON DELETE RESTRICT`).

Create flow: idempotent insert `PENDING` → partner call → `CREATED` + AWB, or `FAILED` after retries. Same `order_id` + same payload hash replays; different hash → `409 IDEMPOTENCY_CONFLICT`.

UrbaneBolt access tokens live in **process memory only**.

## Bulk (`202` + poll)

Bulk create does not hold the HTTP connection for partner RTTs.

1. Validate 1–100 orders, reject duplicate in-batch `order_id`, reject unknown couriers for the whole request.
2. Insert `bulk_batches` (`QUEUED`) + `bulk_batch_items` + idempotent `PENDING` orders.
3. Return `202` with `batch_id` and `poll_url`.
4. In-process worker (started after listen): `SELECT … FOR UPDATE SKIP LOCKED`, then `OrderService.create` under `p-limit(BULK_CONCURRENCY)` (default 10).
5. Items left `PROCESSING` past `BULK_ITEM_STALE_MS` are reclaimed on the next tick.

A 95/5 mixed outcome is `COMPLETED` with per-`order_id` reasons. `GET /batches/{batch_id}` keeps `results: []` until `COMPLETED`.
