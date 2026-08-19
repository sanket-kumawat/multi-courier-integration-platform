# Track Order

Pull the latest shipment status from the courier partner API and return the full tracking history. New status events are persisted as append-only rows before the response is sent.

## Endpoint

```
GET /api/v1/orders/{order_id}/track
```

## Path Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `order_id` | `string` | Yes | The consumer-supplied order identifier. |

## Headers

| Header | Required | Description |
| --- | --- | --- |
| `X-Request-Id` | No | Client-supplied correlation ID. Auto-generated if omitted. |

## Example Request

```bash
curl http://localhost:3000/api/v1/orders/OMS-2026-000142/track \
  -H "X-Request-Id: req_01J5A8B3C4D5E6F7G8H9"
```

## Success Response

**Status:** `200 OK`

```json
{
  "order_id": "OMS-2026-000142",
  "courier_partner": "urbanebolt",
  "awb": "200000001170",
  "status": "IN_TRANSIT",
  "stale": false,
  "history": [
    {
      "status": "CREATED",
      "occurred_at": "2026-08-19T12:40:11.204Z",
      "description": "Shipment manifested",
      "location": null
    },
    {
      "status": "PICKED_UP",
      "occurred_at": "2026-08-19T14:15:00.000Z",
      "description": "Picked up from seller",
      "location": "BLR-WH01"
    },
    {
      "status": "IN_TRANSIT",
      "occurred_at": "2026-08-19T18:02:00.000Z",
      "description": "Reached hub",
      "location": "BLR"
    }
  ]
}
```

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `order_id` | `string` | No | Consumer order ID. |
| `courier_partner` | `string` | No | Courier partner identifier. |
| `awb` | `string` | No | AWB / tracking number. |
| `status` | `string` | No | Latest canonical status. |
| `stale` | `boolean` | No | `true` if the courier API was unreachable and the response shows the last known DB state. `false` when freshly fetched from the partner. |
| `history` | `array` | No | Ordered list of tracking events, oldest first. |

### `history[]` Object

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `status` | `string` | No | Canonical status at this event. |
| `occurred_at` | `string` | No | ISO 8601 timestamp from the courier (or server time if the partner omits it). |
| `description` | `string` | No | Human-readable description of the event. |
| `location` | `string` | Yes | Location/hub code if provided by the courier. |

## Canonical Status Values

| Status | Description |
| --- | --- |
| `PENDING` | Order inserted locally, courier not yet called. |
| `CREATED` | Shipment manifested at the courier. |
| `PICKED_UP` | Package picked up from the shipper. |
| `IN_TRANSIT` | Package in transit between hubs. |
| `OUT_FOR_DELIVERY` | Package out for last-mile delivery. |
| `DELIVERED` | Successfully delivered to the consignee. |
| `RTO` | Return to origin initiated. |
| `CANCELLED` | Shipment cancelled. |
| `FAILED` | Courier call failed after all retries. |

## Stale Tracking Behavior

When the courier partner API is down (5xx, timeout, network error) after all retry attempts:

- If the order has been previously tracked successfully (has history in the database), return the last known state with `"stale": true` and HTTP `200`.
- If the order was never successfully manifested (no AWB), return `502 COURIER_UNAVAILABLE`.

This ensures consumers always get the best available data without being blocked by transient courier outages.

## Status Progression Rules

- Status never moves **backwards** (e.g. `IN_TRANSIT` will not revert to `CREATED`).
- Exception: if the courier reports `RTO` after `DELIVERED`, the status updates to `RTO` (genuine business event).
- Unknown partner statuses are mapped to `IN_TRANSIT` and the raw status string is preserved in the tracking event's raw payload.

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

### 502 — Courier Unavailable

Returned when the courier API is unreachable and no prior tracking data exists.

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

- New `tracking_events` rows are appended for any events not already in the database (deduplication by `order_id` + `occurred_at` + `partner_status`).
- The `orders.status` is updated to the latest canonical status.
- A `courier_api_calls` row is inserted for the partner tracking request.

## Related

- [Get Order](./orders-get.md) — database-only read (no partner call)
- [Create Order](./orders-create.md)
- [Cancel Order](./orders-cancel.md)
- [Error Reference](./errors.md)
