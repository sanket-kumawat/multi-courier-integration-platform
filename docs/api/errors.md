# Error Reference

All API endpoints return errors in a single, consistent envelope. No raw courier partner data, tokens, or stack traces are ever included in error responses.

## Error Envelope

Every error response follows this shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": []
  }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `code` | `string` | Machine-readable error code. Stable across versions — safe to match on programmatically. |
| `message` | `string` | Human-readable description. May change across versions — do not match on this field. |
| `request_id` | `string` | Correlation ID from the `X-Request-Id` header or auto-generated UUID. Use this when reporting issues. |
| `details` | `array` | Field-level error details. Empty array `[]` when there is no field-level information. |

### `details[]` Object

| Field | Type | Description |
| --- | --- | --- |
| `field` | `string` | Dot-notation path to the invalid field (e.g. `"consignee.pincode"`, `"orders[2].courier_partner"`). |
| `message` | `string` | Description of what is wrong with this specific field. |

## Error Codes

### Client Errors (4xx)

#### `VALIDATION_ERROR` — `400 Bad Request`

Returned when the request body fails Zod schema validation.

**Common triggers:**
- Missing required fields
- Invalid field types or formats
- `payment.collectable_value > 0` with `mode: "PREPAID"`
- `payment.collectable_value = 0` with `mode: "COD"`
- Pincode not 6 digits
- Phone not 10 digits
- `service_type` not `SDD` or `NDD`
- Bulk `orders` array empty or exceeding 100 items
- Duplicate `order_id` values within a bulk batch

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": [
      { "field": "consignee.pincode", "message": "Must be a 6-digit Indian pincode" },
      { "field": "payment.collectable_value", "message": "Must be greater than 0 for COD orders" },
      { "field": "package.weight_kg", "message": "Must be a positive number" }
    ]
  }
}
```

#### `UNKNOWN_COURIER` — `400 Bad Request`

Returned when `courier_partner` is not registered in the courier registry.

```json
{
  "error": {
    "code": "UNKNOWN_COURIER",
    "message": "Courier partner 'fastship' is not supported",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": [
      { "field": "courier_partner", "message": "Supported couriers: urbanebolt, mock" }
    ]
  }
}
```

**Client action:** Use [List Couriers](./couriers.md) to get valid identifiers.

#### `UNSUPPORTED_SERVICE` — `400 Bad Request`

Returned when the chosen courier adapter does not support the requested `service_type` or `payment.mode` combination.

```json
{
  "error": {
    "code": "UNSUPPORTED_SERVICE",
    "message": "Courier 'mock' does not support service type 'EXPRESS'",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": [
      { "field": "service_type", "message": "Supported service types: SDD, NDD" }
    ]
  }
}
```

#### `ORDER_NOT_FOUND` — `404 Not Found`

Returned when the `order_id` or `batch_id` does not exist in the database.

```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order 'OMS-2026-999999' not found",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": []
  }
}
```

#### `IDEMPOTENCY_CONFLICT` — `409 Conflict`

Returned when the same `order_id` is submitted with a different payload (different SHA-256 hash of the canonical create body).

```json
{
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "Order 'OMS-2026-000142' already exists with a different payload",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": []
  }
}
```

**Client action:** Use a different `order_id` or submit the original payload to get the existing result.

#### `CANCELLATION_NOT_ALLOWED` — `409 Conflict`

Returned when attempting to cancel an order that has progressed past the cancellable window.

```json
{
  "error": {
    "code": "CANCELLATION_NOT_ALLOWED",
    "message": "Cannot cancel order with status 'IN_TRANSIT'. Cancellation is only allowed for PENDING, CREATED, or FAILED orders.",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": [
      { "field": "status", "message": "Current status is 'IN_TRANSIT'" }
    ]
  }
}
```

**Cancellable statuses:** `PENDING`, `CREATED`, `FAILED`.  
**Non-cancellable statuses:** `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RTO`.  
**Already cancelled:** returns `200` with the existing cancellation (idempotent).

### Courier Partner Errors (4xx/5xx)

#### `COURIER_REJECTED` — `422 Unprocessable Entity`

Returned when the courier partner accepts the request format but rejects the shipment for a business reason.

```json
{
  "error": {
    "code": "COURIER_REJECTED",
    "message": "Pincode not serviceable",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": []
  }
}
```

**Possible messages (allowlisted, not raw partner text):**
- `Pincode not serviceable`
- `Duplicate order`
- `Cancellation window closed`
- `Invalid payload`
- `Courier rejected the request` (default fallback)

**Client action:** Fix the order data and retry, or choose a different courier partner.

#### `COURIER_AUTH_FAILED` — `502 Bad Gateway`

Returned when authentication with the courier partner fails even after automatic token refresh and one retry.

```json
{
  "error": {
    "code": "COURIER_AUTH_FAILED",
    "message": "Failed to authenticate with courier partner",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": []
  }
}
```

**Client action:** This is typically a configuration issue (expired credentials). Contact the platform operator.

#### `COURIER_UNAVAILABLE` — `502 Bad Gateway`

Returned when the courier partner API is unreachable after all retry attempts (HTTP 5xx, timeout, or network error).

```json
{
  "error": {
    "code": "COURIER_UNAVAILABLE",
    "message": "Courier partner is temporarily unavailable",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": []
  }
}
```

**Client action:** Retry after a short delay. The order is persisted with status `FAILED` and can be reconciled later.

### Server Errors (5xx)

#### `INTERNAL_ERROR` — `500 Internal Server Error`

Returned on unexpected/unhandled errors. No internal details are exposed.

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

**Client action:** Report the `request_id` to the platform operator for investigation.

## Error Code Quick Reference

| Code | HTTP | Retryable | Description |
| --- | --- | --- | --- |
| `VALIDATION_ERROR` | `400` | No (fix payload) | Schema validation failed |
| `UNKNOWN_COURIER` | `400` | No (fix courier_partner) | Unregistered courier partner |
| `UNSUPPORTED_SERVICE` | `400` | No (fix service_type/mode) | Adapter does not support the requested service |
| `ORDER_NOT_FOUND` | `404` | No | Order or batch does not exist |
| `IDEMPOTENCY_CONFLICT` | `409` | No (use different order_id) | Same order_id, different payload |
| `CANCELLATION_NOT_ALLOWED` | `409` | No | Shipment past cancellation window |
| `COURIER_REJECTED` | `422` | No (fix data or change courier) | Partner rejected the shipment |
| `COURIER_AUTH_FAILED` | `502` | No (config issue) | Partner authentication failed |
| `COURIER_UNAVAILABLE` | `502` | **Yes** (with backoff) | Partner API down |
| `INTERNAL_ERROR` | `500` | **Yes** (with backoff) | Unexpected server error |

## Retry Guidance

For `COURIER_UNAVAILABLE` and `INTERNAL_ERROR`, the platform has already exhausted its internal retry budget before returning the error. Client-side retries should use exponential backoff starting at 5 seconds.

For all other error codes, retrying with the same payload will produce the same error. The client must fix the request before retrying.

## Correlation and Debugging

Every request is assigned a `request_id` (from the `X-Request-Id` header or auto-generated). This ID appears in:

- The error response `request_id` field
- The `X-Request-Id` response header
- Server-side logs (evlog structured events)
- The `courier_api_calls` audit table

When reporting an issue, always include the `request_id` for fast investigation.

## Related

- [Create Order](./orders-create.md)
- [Get Order](./orders-get.md)
- [Track Order](./orders-track.md)
- [Cancel Order](./orders-cancel.md)
- [Bulk Create Orders](./orders-bulk.md)
- [Batch Status](./batches.md)
- [List Couriers](./couriers.md)
- [Health Check](./health.md)
