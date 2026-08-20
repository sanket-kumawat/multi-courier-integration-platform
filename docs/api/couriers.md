# List Couriers

List all registered courier partners available for order creation.

## Endpoint

```
GET /api/v1/couriers
```

## Headers

| Header | Required | Description |
| --- | --- | --- |
| `X-Request-Id` | No | Client-supplied correlation ID. Auto-generated if omitted. |

## Example Request

```bash
curl http://localhost:3000/api/v1/couriers
```

## Success Response

**Status:** `200 OK`

```json
{
  "couriers": ["mock", "urbanebolt"]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `couriers` | `string[]` | Sorted list of registered courier partner identifiers. These are the valid values for the `courier_partner` field in order creation requests. |

## Error Responses

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

- This endpoint reads from the in-memory courier registry. No database or external API calls are made.
- The list reflects adapters registered at server startup. Adding a new courier requires a code deployment.
- Registered partners: `mock` (no network) and `urbanebolt` (UAT/live, credentials from env).
- When a request to any write endpoint (`POST /orders`, `POST /orders/bulk`, etc.) references an unknown `courier_partner`, the error response includes this list of supported couriers in its `details` field.

## Related

- [Create Order](./orders-create.md) — uses `courier_partner` from this list
- [Bulk Create Orders](./orders-bulk.md) — each order specifies a `courier_partner`
- [Error Reference](./errors.md)
