# Get Order

Retrieve a persisted order by its consumer order ID.

## Endpoint

```
GET /api/v1/orders/{order_id}
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
curl http://localhost:3000/api/v1/orders/OMS-2026-000142 \
  -H "X-Request-Id: req_01J5A8B3C4D5E6F7G8H9"
```

## Success Response

**Status:** `200 OK`

```json
{
  "order_id": "OMS-2026-000142",
  "internal_id": "0193f0c2-7a1b-7d3e-b8c1-4f2a9e1d6c00",
  "courier_partner": "urbanebolt",
  "courier_shipment_id": "UB-88421",
  "awb": "200000001170",
  "status": "CREATED",
  "created_at": "2026-08-19T12:40:11.204Z",
  "updated_at": "2026-08-19T12:40:11.204Z"
}
```

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `order_id` | `string` | No | Consumer order ID. |
| `internal_id` | `string` | No | Platform UUID. |
| `courier_partner` | `string` | No | Courier partner identifier. |
| `courier_shipment_id` | `string` | Yes | Partner shipment ID. `null` if the partner call has not succeeded yet (status `PENDING` or `FAILED`). |
| `awb` | `string` | Yes | AWB / tracking number. `null` until assigned by the partner. |
| `status` | `string` | No | Canonical status: `PENDING`, `CREATED`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RTO`, `CANCELLED`, `FAILED`. |
| `created_at` | `string` | No | ISO 8601 timestamp. |
| `updated_at` | `string` | No | ISO 8601 timestamp. |

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

## Notes

- This endpoint reads from the database only. It does **not** call the courier partner API.
- To fetch live tracking updates from the courier, use [Track Order](./orders-track.md) instead.
- The `status` reflects the last known state from the most recent create, track, or cancel operation.

## Related

- [Create Order](./orders-create.md)
- [Track Order](./orders-track.md)
- [Cancel Order](./orders-cancel.md)
- [Error Reference](./errors.md)
