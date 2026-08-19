# Health Check

Liveness probe for the server. Used by Docker Compose health checks, load balancers, and monitoring.

## Endpoint

```
GET /api/v1/health
```

## Headers

None required.

## Example Request

```bash
curl http://localhost:3000/api/v1/health
```

## Success Response

**Status:** `200 OK`

```json
{
  "status": "ok",
  "timestamp": "2026-08-19T12:40:11.204Z"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `status` | `string` | Always `"ok"` when the server is running. |
| `timestamp` | `string` | ISO 8601 server timestamp. |

## Error Responses

If the server process is running but unable to respond (extremely unlikely for this endpoint), standard HTTP errors apply. No custom error envelope is returned from the health check — a non-`200` response indicates the server is unhealthy.

## Notes

- This endpoint does **not** verify database connectivity or courier partner availability. It is a pure liveness check.
- The legacy health check at `GET /` also returns `200 OK` (plain text `"OK"`) for backward compatibility with existing Docker Compose health check configuration.
- For readiness checks that verify database connectivity, a separate `GET /api/v1/ready` endpoint may be added in the future.

## Related

- [List Couriers](./couriers.md) — verify which courier partners are registered
