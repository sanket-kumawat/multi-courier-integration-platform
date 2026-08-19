# Bulk Create Orders

Submit up to 100 orders for asynchronous creation. Returns a `batch_id` immediately; orders are processed in the background with bounded concurrency. Poll the [Batch Status](./batches.md) endpoint for results.

## Endpoint

```
POST /api/v1/orders/bulk
```

## Headers

| Header | Required | Description |
| --- | --- | --- |
| `Content-Type` | Yes | `application/json` |
| `X-Request-Id` | No | Client-supplied correlation ID. Auto-generated if omitted. |

## Request Body

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `orders` | `array` | Yes | Length `1..100` | Array of order objects. Each element uses the same schema as [Create Order](./orders-create.md). |

### Order Element Schema

Each element in `orders` has the exact same schema as the [Create Order](./orders-create.md) request body, including `courier_partner`, `order_id`, `service_type`, `payment`, `package`, `shipper`, `consignee`, and `return_address`.

### Validation Rules

- **Array size:** minimum 1, maximum 100 orders.
- **Duplicate detection:** if any two elements share the same `order_id` **within the same batch**, the entire request is rejected with `400`.
- **Mixed couriers:** different `order_id` entries may use different `courier_partner` values. All must be registered.
- **Per-order validation:** each order is validated against the same Zod schema as single create. If any order fails validation, the entire batch is rejected (fail-fast on structural errors).

## Example Request

```bash
curl -X POST http://localhost:3000/api/v1/orders/bulk \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req_01J5A8B3C4D5E6F7G8H9" \
  -d '{
    "orders": [
      {
        "courier_partner": "urbanebolt",
        "order_id": "BULK-001",
        "service_type": "NDD",
        "payment": {
          "mode": "PREPAID",
          "declared_value": 500.00,
          "collectable_value": 0,
          "invoice_number": "INV-001",
          "invoice_date": "2026-08-19",
          "invoice_value": 500.00
        },
        "package": {
          "description": "T-Shirt",
          "quantity": 1,
          "pieces": 1,
          "weight_kg": 0.3,
          "length_cm": 25,
          "breadth_cm": 20,
          "height_cm": 5
        },
        "shipper": { "name": "Warehouse", "phone": "9876543210", "email": "wh@example.com", "address_line1": "123 Main St", "address_type": "Seller", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001", "country": "IN" },
        "consignee": { "name": "Alice", "phone": "9123456789", "email": "alice@example.com", "address_line1": "456 Oak Ave", "address_type": "Home", "city": "Delhi", "state": "Delhi", "pincode": "110001", "country": "IN" },
        "return_address": { "name": "Warehouse", "phone": "9876543210", "email": "wh@example.com", "address_line1": "123 Main St", "address_type": "Seller", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001", "country": "IN" }
      },
      {
        "courier_partner": "mock",
        "order_id": "BULK-002",
        "service_type": "SDD",
        "payment": {
          "mode": "COD",
          "declared_value": 1200.00,
          "collectable_value": 1200.00,
          "invoice_number": "INV-002",
          "invoice_date": "2026-08-19",
          "invoice_value": 1200.00
        },
        "package": {
          "description": "Electronics",
          "quantity": 1,
          "pieces": 1,
          "weight_kg": 1.5,
          "length_cm": 30,
          "breadth_cm": 20,
          "height_cm": 15
        },
        "shipper": { "name": "Warehouse", "phone": "9876543210", "email": "wh@example.com", "address_line1": "123 Main St", "address_type": "Seller", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001", "country": "IN" },
        "consignee": { "name": "Bob", "phone": "9234567890", "email": "bob@example.com", "address_line1": "789 Elm St", "address_type": "Office", "city": "Bengaluru", "state": "Karnataka", "pincode": "560001", "country": "IN" },
        "return_address": { "name": "Warehouse", "phone": "9876543210", "email": "wh@example.com", "address_line1": "123 Main St", "address_type": "Seller", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001", "country": "IN" }
      }
    ]
  }'
```

## Success Response (Accepted)

**Status:** `202 Accepted`

```json
{
  "batch_id": "bch_01J5A8B3C4D5E6F7G8H9",
  "accepted": 2,
  "status": "QUEUED",
  "poll_url": "/api/v1/batches/bch_01J5A8B3C4D5E6F7G8H9"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `batch_id` | `string` | Unique batch identifier for polling results. |
| `accepted` | `integer` | Number of orders accepted for processing. |
| `status` | `string` | Always `"QUEUED"` on acceptance. |
| `poll_url` | `string` | Relative URL to poll for batch results. |

## Processing Behavior

- Orders are processed **concurrently** with bounded concurrency (default 10 parallel workers, configurable via `BULK_CONCURRENCY`).
- Each order follows the same create flow as the single [Create Order](./orders-create.md) endpoint, including idempotency checks and retry logic.
- Orders within a batch are **independent** — one order's failure does not affect others.
- Processing survives the original HTTP connection closing.

## Idempotency

- The `order_id` field is the idempotency key, same as single create.
- Submitting an `order_id` that already exists (from a previous single or bulk create) follows the same idempotency rules: matching payload hash returns the existing result; different hash returns `IDEMPOTENCY_CONFLICT` for that item.
- Resubmitting the entire bulk request is safe — already-created orders are returned as-is.

## Error Responses

### 400 — Validation Error

Returned when the request body or any order element fails validation, or when the batch exceeds 100 orders.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": [
      { "field": "orders", "message": "Array must contain between 1 and 100 elements" }
    ]
  }
}
```

### 400 — Duplicate Order IDs in Batch

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Duplicate order_id values in batch",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": [
      { "field": "orders[3].order_id", "message": "Duplicate of orders[0].order_id: 'BULK-001'" }
    ]
  }
}
```

### 400 — Unknown Courier

If any order references an unknown courier, the entire batch is rejected.

```json
{
  "error": {
    "code": "UNKNOWN_COURIER",
    "message": "Courier partner 'fastship' is not supported",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": [
      { "field": "orders[2].courier_partner", "message": "Supported couriers: urbanebolt, mock" }
    ]
  }
}
```

### 500 — Internal Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": []
  }
}
```

## Side Effects

- A `bulk_batches` row is created with status `QUEUED`.
- A `bulk_batch_items` row is created for each order in the batch.
- An `orders` row is created (with status `PENDING`) for each order via idempotent insert.
- Background processing begins immediately after the response is sent.

## Design Trade-offs

| Approach | Why not? |
| --- | --- |
| Sequential in one request | 100 partner RTTs would cause gateway timeouts; violates PRD concurrency requirement. |
| `Promise.all` inline | Holds HTTP connection for potentially 30–60s; client disconnect cancels work. |
| Server-Sent Events | Awkward for OMS integrations; retry/reconnect logic is complex. |
| **`202` + poll (chosen)** | Responsive API; processing survives disconnects; partial success is a stable resource. |

## Related

- [Batch Status](./batches.md) — poll for results
- [Create Order](./orders-create.md) — single order schema reference
- [Error Reference](./errors.md)
