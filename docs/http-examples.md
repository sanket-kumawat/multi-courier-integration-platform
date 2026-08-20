# HTTP examples

Base URL: `http://localhost:3000`. Every call may send `X-Request-Id`; the server echoes it (or generates one).

Use `courier_partner: "mock"` without UAT credentials. `order_id` values containing `FAIL` are rejected by the mock adapter.

## Health and couriers

```bash
curl -s http://localhost:3000/api/v1/health
curl -s http://localhost:3000/api/v1/couriers
```

## Create

```bash
curl -s -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: req_demo_create" \
  -d '{
    "courier_partner": "mock",
    "order_id": "OMS-2026-000142",
    "service_type": "NDD",
    "payment": {
      "mode": "COD",
      "declared_value": 1299,
      "collectable_value": 1299,
      "invoice_number": "INV-8891",
      "invoice_date": "2026-08-19",
      "invoice_value": 1299
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

Identical body + same `order_id` replays `201`. Change the payload (for example `package.sku`) → `409 IDEMPOTENCY_CONFLICT`.

## Get, track, cancel

```bash
curl -s http://localhost:3000/api/v1/orders/OMS-2026-000142
curl -s http://localhost:3000/api/v1/orders/OMS-2026-000142/track
curl -s -X POST http://localhost:3000/api/v1/orders/OMS-2026-000142/cancel
```

## Bulk (202 + poll)

```bash
curl -s -X POST http://localhost:3000/api/v1/orders/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "orders": [
      { "courier_partner": "mock", "order_id": "BULK-001", "service_type": "NDD", "payment": { "mode": "PREPAID", "declared_value": 500, "collectable_value": 0, "invoice_number": "INV-001", "invoice_date": "2026-08-19", "invoice_value": 500 }, "package": { "description": "T-Shirt", "quantity": 1, "pieces": 1, "weight_kg": 0.3, "length_cm": 25, "breadth_cm": 20, "height_cm": 5 }, "shipper": { "name": "Warehouse", "phone": "9876543210", "email": "wh@example.com", "address_line1": "123 Main St", "address_type": "Seller", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001", "country": "IN" }, "consignee": { "name": "Alice", "phone": "9123456789", "email": "alice@example.com", "address_line1": "456 Oak Ave", "address_type": "Home", "city": "Delhi", "state": "Delhi", "pincode": "110001", "country": "IN" }, "return_address": { "name": "Warehouse", "phone": "9876543210", "email": "wh@example.com", "address_line1": "123 Main St", "address_type": "Seller", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001", "country": "IN" } },
      { "courier_partner": "mock", "order_id": "BULK-FAIL-2", "service_type": "NDD", "payment": { "mode": "PREPAID", "declared_value": 500, "collectable_value": 0, "invoice_number": "INV-002", "invoice_date": "2026-08-19", "invoice_value": 500 }, "package": { "description": "T-Shirt", "quantity": 1, "pieces": 1, "weight_kg": 0.3, "length_cm": 25, "breadth_cm": 20, "height_cm": 5 }, "shipper": { "name": "Warehouse", "phone": "9876543210", "email": "wh@example.com", "address_line1": "123 Main St", "address_type": "Seller", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001", "country": "IN" }, "consignee": { "name": "Bob", "phone": "9234567890", "email": "bob@example.com", "address_line1": "789 Elm St", "address_type": "Office", "city": "Bengaluru", "state": "Karnataka", "pincode": "560001", "country": "IN" }, "return_address": { "name": "Warehouse", "phone": "9876543210", "email": "wh@example.com", "address_line1": "123 Main St", "address_type": "Seller", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001", "country": "IN" } }
    ]
  }'
```

Poll with the returned `batch_id`:

```bash
curl -s http://localhost:3000/api/v1/batches/<batch_id>
```

`results` stays `[]` until `status` is `COMPLETED`. Duplicate `order_id` values in one bulk body → `400 VALIDATION_ERROR`.

## OpenAPI

- Spec: `http://localhost:3000/api/v1/spec.json`
- UI: `http://localhost:3000/api-reference`
