# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary audience for the web app is **developers** evaluating or integrating the platform (demo / showcase). UI flows and copy should still be designed for **operations people** who create, track, and cancel shipments day to day — even though ops is not the main live user of this demo.

API consumers (order-management systems and similar internal services) are the durable backend audience; they are not the web UI’s primary users.

## Product Purpose

Multi-Courier Integration Platform is a courier-agnostic service for creating, tracking, cancelling, and bulk-creating shipments. Callers pass a `courier_partner` id and work against one unified contract; they never see partner-specific payloads.

The `apps/web` surface exists to **showcase and demo those APIs** — not to replace the API as the system of record for integrations.

Success for the demo UI: a developer (or reviewer) can exercise the real create / track / cancel / bulk / courier-list flows through an ops-shaped interface and understand the product without reading OpenAPI alone.

## Positioning

One stable API and pluggable courier adapters. Adding a partner is a new adapter module plus registration — routes, unified DTOs, and core services stay closed. The caller always chooses `courier_partner`; there is no automatic courier selection in v1.

The first live partner is **UrbaneBolt**. A **mock** adapter supports tests and local demos.

## Operating Context

- Turborepo monorepo: Express API (`apps/server`), React web (`apps/web`), shared `packages/api`, `couriers`, `db`, `ui`, `env`.
- Two HTTP surfaces, one brain: REST `/api/v1` and typed oRPC `/rpc` (web uses oRPC).
- Local run: PostgreSQL via Docker, `pnpm run dev` (API :3000, web :3001); OpenAPI UI at `/api-reference`.
- Canonical shipment statuses and idempotent `order_id` create semantics are part of how the product is evaluated.

## Capabilities and Constraints

**Confirmed capabilities**

- Create, get, track, and cancel orders; list registered couriers; health check.
- Bulk create (1–100) with `202` + poll; partial success with per-order outcomes.
- Normalized errors; partner bodies stay out of public error envelopes.
- Append-only tracking and courier-call audit history in PostgreSQL.

**v1 constraints (do not invent around these)**

- No multi-tenant consumer auth (internal-network API).
- No rate-card / SLA routing or auto partner selection.
- Tracking is pull-based; no courier webhooks.
- Label printing, ePOD, NDR, pay-mode change are not first-class unified endpoints.
- Background bulk work is in-process against PostgreSQL (no separate worker fleet).

**Undecided**

- Exact demo information architecture and which screens ship first beyond showcasing the existing API surface.
- Product display name for the UI (repo title is fine; no binding brand).

## Brand Commitments

No durable brand, logo, or naming commitment. “Multi-Courier Integration Platform” / repo naming is descriptive only. Scaffold “Better T Stack” ASCII home art is not product identity and may be replaced.

## Evidence on Hand

- Spec and contract: `docs/architecture.md`, `DESIGN.md`, `README.md`, `prd.pdf`.
- API docs and HTTP examples under `docs/`.
- Live partner: UrbaneBolt (credentials local/env only; never fabricate UAT outcomes).
- No customer testimonials, case studies, pricing, or licensing claims — do not invent them.

## Product Principles

1. **One contract, many partners** — UI and copy never leak partner-specific payload shapes or error bodies.
2. **Demo the real API** — the web app showcases working platform behavior; it is not a fake marketing shell.
3. **Ops-shaped, developer-used** — design for operational clarity even when the audience is integrators and reviewers.
4. **Caller chooses the courier** — never imply automatic routing or partner preference the product does not have.
5. **Honest scope** — respect v1 non-goals; do not promise auth, webhooks, or document APIs the backend does not expose.
