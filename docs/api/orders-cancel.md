# Cancel Order

Cancel a shipment before pickup. Sends a cancellation request to the courier partner and updates the order status.

## Endpoint

```
POST /api/v1/orders/{order_id}/cancel
```

## Path Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `order_id` | `string` | Yes | The consumer-supplied order identifier. |

## Headers

| Header | Required | Description |
| --- | --- | --- |
| `Content-Type` | No | No request body required. |
| `X-Request-Id` | No | Client-supplied correlation ID. Auto-generated if omitted. |

## Request Body

None. The `order_id` in the URL path identifies the order to cancel.

## Example Request

```bash
curl -X POST http://localhost:3000/api/v1/orders/OMS-2026-000142/cancel \
  -H "X-Request-Id: req_01J5A8B3C4D5E6F7G8H9"
```

## Success Response

**Status:** `200 OK`

```json
{
  "order_id": "OMS-2026-000142",
  "status": "CANCELLED",
  "cancelled_at": "2026-08-19T13:10:00.000Z"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `order_id` | `string` | Consumer order ID. |
| `status` | `string` | Always `"CANCELLED"` on success. |
| `cancelled_at` | `string` | ISO 8601 timestamp of cancellation. |

## Cancellation Rules

Cancellation is only allowed when the current order status is one of:

| Current Status | Cancellation | Notes |
| --- | --- | --- |
| `PENDING` | Allowed | Order not yet sent to courier. Cancelled locally only. |
| `CREATED` | Allowed | Shipment manifested but not yet picked up. Courier cancel API is called. |
| `FAILED` | Allowed | Previous courier call failed. Cancel locally (no courier call needed). |
| `PICKED_UP` | **Not allowed** | Package already collected. |
| `IN_TRANSIT` | **Not allowed** | Package in transit. |
| `OUT_FOR_DELIVERY` | **Not allowed** | Package out for delivery. |
| `DELIVERED` | **Not allowed** | Already delivered. |
| `RTO` | **Not allowed** | Return to origin in progress. |
| `CANCELLED` | **Idempotent** | Already cancelled — returns success with original `cancelled_at`. |

## Idempotent Cancellation

If the order is already `CANCELLED`, the endpoint returns `200` with the existing cancellation timestamp. It does **not** call the courier partner again. This makes cancel safe to retry on network failures.

## Error Responses

### 404 — Order Not Found

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

### 409 — Cancellation Not Allowed

Returned when the shipment has progressed past the cancellable window.

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

### 422 — Courier Rejected

Returned when the courier partner rejects the cancellation (e.g. cancellation window closed on their side).

```json
{
  "error": {
    "code": "COURIER_REJECTED",
    "message": "Cancellation window closed",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": []
  }
}
```

### 502 — Courier Auth Failed

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

### 502 — Courier Unavailable

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

- The `orders.status` is updated to `CANCELLED`.
- A `tracking_events` row is appended with status `CANCELLED`.
- A `courier_api_calls` row is inserted for the partner cancel request (if the courier was called).
- For `PENDING` or `FAILED` orders, no courier API call is made — only the local database is updated.

## Related

- [Create Order](./orders-create.md)
- [Get Order](./orders-get.md)
- [Track Order](./orders-track.md)
- [Error Reference](./errors.md)
