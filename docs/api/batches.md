# Get Batch Status

Poll the processing status and per-order results of a bulk create batch.

## Endpoint

```
GET /api/v1/batches/{batch_id}
```

## Path Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `batch_id` | `string` | Yes | The batch identifier returned by [Bulk Create](./orders-bulk.md). |

## Headers

| Header | Required | Description |
| --- | --- | --- |
| `X-Request-Id` | No | Client-supplied correlation ID. Auto-generated if omitted. |

## Example Request

```bash
curl http://localhost:3000/api/v1/batches/bch_01J5A8B3C4D5E6F7G8H9 \
  -H "X-Request-Id: req_01J5A8B3C4D5E6F7G8H9"
```

## Success Response — In Progress

**Status:** `200 OK`

```json
{
  "batch_id": "bch_01J5A8B3C4D5E6F7G8H9",
  "status": "PROCESSING",
  "total": 100,
  "succeeded": 42,
  "failed": 3,
  "pending": 55,
  "created_at": "2026-08-19T12:40:00.000Z",
  "updated_at": "2026-08-19T12:40:30.000Z",
  "completed_at": null,
  "results": []
}
```

## Success Response — Completed

**Status:** `200 OK`

```json
{
  "batch_id": "bch_01J5A8B3C4D5E6F7G8H9",
  "status": "COMPLETED",
  "total": 100,
  "succeeded": 95,
  "failed": 5,
  "pending": 0,
  "created_at": "2026-08-19T12:40:00.000Z",
  "updated_at": "2026-08-19T12:41:15.000Z",
  "completed_at": "2026-08-19T12:41:15.000Z",
  "results": [
    {
      "order_id": "BULK-001",
      "position": 0,
      "success": true,
      "awb": "200000001170",
      "status": "CREATED",
      "error": null
    },
    {
      "order_id": "BULK-002",
      "position": 1,
      "success": true,
      "awb": "200000001171",
      "status": "CREATED",
      "error": null
    },
    {
      "order_id": "BULK-050",
      "position": 49,
      "success": false,
      "awb": null,
      "status": "FAILED",
      "error": {
        "code": "COURIER_REJECTED",
        "message": "Pincode not serviceable"
      }
    },
    {
      "order_id": "BULK-075",
      "position": 74,
      "success": false,
      "awb": null,
      "status": "FAILED",
      "error": {
        "code": "COURIER_UNAVAILABLE",
        "message": "Courier partner is temporarily unavailable"
      }
    }
  ]
}
```

## Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `batch_id` | `string` | No | Batch identifier. |
| `status` | `string` | No | Batch status (see below). |
| `total` | `integer` | No | Total number of orders in the batch. |
| `succeeded` | `integer` | No | Number of orders successfully created. |
| `failed` | `integer` | No | Number of orders that failed. |
| `pending` | `integer` | No | Number of orders still being processed. |
| `created_at` | `string` | No | ISO 8601 timestamp when the batch was accepted. |
| `updated_at` | `string` | No | ISO 8601 timestamp of last status change. |
| `completed_at` | `string` | Yes | ISO 8601 timestamp when all items finished. `null` while processing. |
| `results` | `array` | No | Per-order results. Empty array while `status` is `QUEUED` or `PROCESSING`. Populated when `COMPLETED`. |

### Batch `status` Values

| Status | Description |
| --- | --- |
| `QUEUED` | Batch accepted, processing has not started yet. |
| `PROCESSING` | At least one order is being processed. |
| `COMPLETED` | All orders have been processed (success or failure). Per-order failures are normal — this status means the batch itself completed. |
| `FAILED` | The worker crashed before finishing. Remaining items may be reclaimed on the next worker tick. |

### `results[]` Object

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `order_id` | `string` | No | Consumer order ID. |
| `position` | `integer` | No | 0-based position in the original request array. |
| `success` | `boolean` | No | `true` if the shipment was created at the courier. |
| `awb` | `string` | Yes | AWB / tracking number. `null` on failure. |
| `status` | `string` | No | Canonical status (`CREATED` on success, `FAILED` on failure). |
| `error` | `object` | Yes | Error details. `null` on success. |

### `error` Object (within results)

| Field | Type | Description |
| --- | --- | --- |
| `code` | `string` | Error code (e.g. `COURIER_REJECTED`, `COURIER_UNAVAILABLE`, `IDEMPOTENCY_CONFLICT`). |
| `message` | `string` | Human-readable error message. No raw partner data is leaked. |

## Polling Strategy

Recommended client polling approach:

1. Start polling after receiving `202` from [Bulk Create](./orders-bulk.md).
2. Poll every **2–5 seconds**.
3. Stop when `status` is `COMPLETED` or `FAILED`.
4. For `PROCESSING`, optionally show incremental progress using `succeeded` + `failed` + `pending` counts.

## Error Responses

### 404 — Batch Not Found

```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Batch 'bch_nonexistent' not found",
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

- The `results` array is only populated when `status` is `COMPLETED`. While the batch is `QUEUED` or `PROCESSING`, `results` is an empty array to keep response size predictable.
- Batch results are persisted — polling after completion always returns the same data.
- Individual order results can also be queried via [Get Order](./orders-get.md) using the `order_id`.

## Related

- [Bulk Create Orders](./orders-bulk.md) — submit the batch
- [Get Order](./orders-get.md) — query individual orders from the batch
- [Error Reference](./errors.md)
