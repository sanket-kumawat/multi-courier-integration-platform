# Create Order

Create a single shipment through a courier partner.

## Endpoint

```
POST /api/v1/orders
```

## Headers


| Header         | Required | Description                                                                                              |
| -------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `Content-Type` | Yes      | `application/json`                                                                                       |
| `X-Request-Id` | No       | Client-supplied correlation ID (UUID). Auto-generated if omitted and echoed back in the response header. |




## Request Body


| Field             | Type     | Required | Description                                                                                                    |
| ----------------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `courier_partner` | `string` | Yes      | Registered courier identifier (e.g. `"urbanebolt"`, `"mock"`). Must exist in the courier registry.             |
| `order_id`        | `string` | Yes      | Consumer-supplied unique order identifier. 1–64 chars, pattern `[A-Za-z0-9._-]+`. Used as the idempotency key. |
| `service_type`    | `string` | Yes      | Delivery speed: `"SDD"` (same-day) or `"NDD"` (next-day).                                                      |
| `payment`         | `object` | Yes      | Payment details (see below).                                                                                   |
| `package`         | `object` | Yes      | Package details (see below).                                                                                   |
| `shipper`         | `object` | Yes      | Shipper address (see Address schema).                                                                          |
| `consignee`       | `object` | Yes      | Consignee/recipient address (see Address schema).                                                              |
| `return_address`  | `object` | Yes      | Return address for RTO/failed deliveries (see Address schema).                                                 |




### `payment` Object


| Field               | Type     | Required | Validation          | Description                                                              |
| ------------------- | -------- | -------- | ------------------- | ------------------------------------------------------------------------ |
| `mode`              | `string` | Yes      | `"COD"`             | `"PREPAID"`                                                              |
| `declared_value`    | `number` | Yes      | `> 0`               | Declared value of goods in INR.                                          |
| `collectable_value` | `number` | Yes      | `>= 0`              | Amount to collect on delivery. Must be `> 0` for COD, `= 0` for PREPAID. |
| `invoice_number`    | `string` | Yes      | Non-empty           | Invoice reference number.                                                |
| `invoice_date`      | `string` | Yes      | `YYYY-MM-DD` format | Invoice date.                                                            |
| `invoice_value`     | `number` | Yes      | `> 0`               | Invoice value in INR.                                                    |




### `package` Object


| Field         | Type      | Required | Validation | Description                        |
| ------------- | --------- | -------- | ---------- | ---------------------------------- |
| `description` | `string`  | Yes      | Non-empty  | Item description (e.g. `"Books"`). |
| `sku`         | `string`  | No       | —          | Product SKU code.                  |
| `quantity`    | `integer` | Yes      | `>= 1`     | Number of items.                   |
| `pieces`      | `integer` | Yes      | `>= 1`     | Number of physical pieces/boxes.   |
| `weight_kg`   | `number`  | Yes      | `> 0`      | Total weight in kilograms.         |
| `length_cm`   | `number`  | Yes      | `> 0`      | Length in centimeters.             |
| `breadth_cm`  | `number`  | Yes      | `> 0`      | Breadth in centimeters.            |
| `height_cm`   | `number`  | Yes      | `> 0`      | Height in centimeters.             |




### Address Object (shared by `shipper`, `consignee`, `return_address`)


| Field           | Type     | Required | Validation                               | Description           |
| --------------- | -------- | -------- | ---------------------------------------- | --------------------- |
| `name`          | `string` | Yes      | Non-empty                                | Contact name.         |
| `phone`         | `string` | Yes      | 10-digit Indian mobile (spaces stripped) | Contact phone number. |
| `email`         | `string` | Yes      | Valid email                              | Contact email.        |
| `address_line1` | `string` | Yes      | Non-empty                                | Street address.       |
| `address_type`  | `string` | Yes      | `"Home"`                                 | `"Office"`            |
| `city`          | `string` | Yes      | Non-empty                                | City name.            |
| `state`         | `string` | Yes      | Non-empty                                | State name.           |
| `pincode`       | `string` | Yes      | 6-digit Indian PIN                       | Postal code.          |
| `country`       | `string` | Yes      | ISO 3166-1 alpha-2 (e.g. `"IN"`)         | Country code.         |




## Example Request

```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req_01J5A8B3C4D5E6F7G8H9" \
  -d '{
    "courier_partner": "urbanebolt",
    "order_id": "OMS-2026-000142",
    "service_type": "NDD",
    "payment": {
      "mode": "COD",
      "declared_value": 1299.00,
      "collectable_value": 1299.00,
      "invoice_number": "INV-8891",
      "invoice_date": "2026-08-19",
      "invoice_value": 1299.00
    },
    "package": {
      "description": "Books",
      "sku": "BK-441122",
      "quantity": 1,
      "pieces": 1,
      "weight_kg": 1.1,
      "length_cm": 12,
      "breadth_cm": 10,
      "height_cm": 10
    },
    "shipper": {
      "name": "Warehouse Alpha",
      "phone": "9425018023",
      "email": "warehouse@example.com",
      "address_line1": "Plot 137-139, Sector-I, Industrial Area",
      "address_type": "Seller",
      "city": "Bengaluru",
      "state": "Karnataka",
      "pincode": "560001",
      "country": "IN"
    },
    "consignee": {
      "name": "Rahul Sharma",
      "phone": "8320226438",
      "email": "rahul@example.com",
      "address_line1": "Plot 26-27, Om Nagar Society",
      "address_type": "Home",
      "city": "Surat",
      "state": "Gujarat",
      "pincode": "395007",
      "country": "IN"
    },
    "return_address": {
      "name": "Warehouse Alpha",
      "phone": "9425018023",
      "email": "warehouse@example.com",
      "address_line1": "Plot 137-139, Sector-I, Industrial Area",
      "address_type": "Seller",
      "city": "Bengaluru",
      "state": "Karnataka",
      "pincode": "560001",
      "country": "IN"
    }
  }'
```



## Success Response

**Status:** `201 Created`

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


| Field                 | Type     | Description                                                                      |
| --------------------- | -------- | -------------------------------------------------------------------------------- |
| `order_id`            | `string` | The consumer-supplied order ID (echoed back).                                    |
| `internal_id`         | `string` | Platform-generated UUID for internal reference.                                  |
| `courier_partner`     | `string` | The courier partner used.                                                        |
| `courier_shipment_id` | `string` | Partner's internal shipment/order identifier. May equal `awb` for some partners. |
| `awb`                 | `string` | Air Waybill / tracking number assigned by the courier.                           |
| `status`              | `string` | Canonical shipment status. Always `"CREATED"` on success.                        |
| `created_at`          | `string` | ISO 8601 timestamp.                                                              |
| `updated_at`          | `string` | ISO 8601 timestamp.                                                              |




## Idempotency

- Submitting the same `order_id` with an identical payload returns the existing order (same response as the original create, using the current status).
- Submitting the same `order_id` with a **different** payload hash returns `409 IDEMPOTENCY_CONFLICT`.
- If the original create is in `PENDING` or `FAILED` state (partner call did not succeed), the retry re-attempts the partner call with the same order data.



## Error Responses



### 400 — Validation Error

Returned when the request body fails Zod schema validation.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "request_id": "req_01J5A8B3C4D5E6F7G8H9",
    "details": [
      { "field": "consignee.pincode", "message": "Must be a 6-digit Indian pincode" },
      { "field": "payment.collectable_value", "message": "Must be greater than 0 for COD orders" }
    ]
  }
}
```



### 400 — Unknown Courier

Returned when `courier_partner` is not registered.

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



### 409 — Idempotency Conflict

Returned when the same `order_id` is submitted with a different payload.

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



### 422 — Courier Rejected

Returned when the courier partner accepts the request format but rejects the shipment (e.g. pincode not serviceable).

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



### 502 — Courier Auth Failed

Returned when authentication with the courier partner fails even after automatic token refresh and retry.

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

Returned when the courier partner API is unreachable after all retry attempts (5xx, timeout, network failure).

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

Returned on unexpected server errors. No internal details are leaked.

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

- An `orders` row is inserted with status `PENDING` before calling the courier, then updated to `CREATED` or `FAILED`.
- A `tracking_events` row is appended with the initial status.
- A `courier_api_calls` row is inserted for each HTTP attempt to the partner (including retries), with request/response payloads (secrets redacted).



## Related

- [Get Order](./orders-get.md)
- [Track Order](./orders-track.md)
- [Cancel Order](./orders-cancel.md)
- [Bulk Create](./orders-bulk.md)
- [Error Reference](./errors.md)

