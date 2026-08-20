CREATE TYPE "public"."address_role" AS ENUM('SHIPPER', 'CONSIGNEE', 'RETURN');--> statement-breakpoint
CREATE TYPE "public"."batch_item_status" AS ENUM('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."batch_status" AS ENUM('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."courier_call_error" AS ENUM('TIMEOUT', 'NETWORK', 'HTTP');--> statement-breakpoint
CREATE TYPE "public"."courier_operation" AS ENUM('AUTH', 'PINCODE', 'CREATE', 'TRACK', 'CANCEL', 'LABEL', 'EPOD', 'NDR_RTO', 'NDR_REATTEMPT', 'PAYMODE_CHANGE');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('LABEL', 'EPOD');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RTO', 'CANCELLED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('COD', 'PREPAID');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('SDD', 'NDD', 'SURFACE');--> statement-breakpoint
CREATE TYPE "public"."shipment_action_type" AS ENUM('CANCEL', 'RTO_LOCK', 'REATTEMPT', 'PAYMODE_CHANGE');--> statement-breakpoint
CREATE TABLE "courier_api_calls" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_id" uuid,
	"courier_partner" varchar(32) NOT NULL,
	"operation" "courier_operation" NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"request_url" text NOT NULL,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"http_status" integer,
	"error_type" "courier_call_error",
	"duration_ms" integer NOT NULL,
	"request_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_batch_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"batch_id" uuid NOT NULL,
	"order_id" varchar(64) NOT NULL,
	"position" integer NOT NULL,
	"status" "batch_item_status" DEFAULT 'QUEUED' NOT NULL,
	"error_code" varchar(64),
	"error_message" text,
	"order_uuid" uuid,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bulk_batch_items_position_chk" CHECK ("bulk_batch_items"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bulk_batches" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"status" "batch_status" DEFAULT 'QUEUED' NOT NULL,
	"total" integer NOT NULL,
	"succeeded" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "bulk_batches_total_chk" CHECK ("bulk_batches"."total" between 1 and 100),
	CONSTRAINT "bulk_batches_counts_chk" CHECK ("bulk_batches"."succeeded" >= 0 and "bulk_batches"."failed" >= 0 and "bulk_batches"."succeeded" + "bulk_batches"."failed" <= "bulk_batches"."total")
);
--> statement-breakpoint
CREATE TABLE "shipment_actions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" "shipment_action_type" NOT NULL,
	"succeeded" boolean NOT NULL,
	"partner_message" text,
	"from_payment_mode" "payment_mode",
	"to_payment_mode" "payment_mode",
	"request_payload" jsonb,
	"response_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_documents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" "document_type" NOT NULL,
	"url" text,
	"partner_status" varchar(64),
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_packages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"description" varchar(256) NOT NULL,
	"sku" varchar(64),
	"hsn" varchar(16),
	"quantity" integer DEFAULT 1 NOT NULL,
	"pieces" integer DEFAULT 1 NOT NULL,
	"weight_kg" numeric(10, 3) NOT NULL,
	"volumetric_weight_kg" numeric(10, 3),
	"length_cm" numeric(8, 2) NOT NULL,
	"breadth_cm" numeric(8, 2) NOT NULL,
	"height_cm" numeric(8, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_packages_quantity_chk" CHECK ("order_packages"."quantity" > 0),
	CONSTRAINT "order_packages_pieces_chk" CHECK ("order_packages"."pieces" > 0),
	CONSTRAINT "order_packages_weight_chk" CHECK ("order_packages"."weight_kg" > 0),
	CONSTRAINT "order_packages_dims_chk" CHECK ("order_packages"."length_cm" > 0 and "order_packages"."breadth_cm" > 0 and "order_packages"."height_cm" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_parties" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_id" uuid NOT NULL,
	"role" "address_role" NOT NULL,
	"external_id" varchar(64),
	"name" varchar(128) NOT NULL,
	"phone" varchar(16) NOT NULL,
	"email" varchar(320),
	"address_line1" text NOT NULL,
	"address_type" varchar(32) NOT NULL,
	"city" varchar(64) NOT NULL,
	"state" varchar(64) NOT NULL,
	"pincode" char(6) NOT NULL,
	"country" char(2) DEFAULT 'IN' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_parties_pincode_chk" CHECK ("order_parties"."pincode" ~ '^[0-9]{6}$'),
	CONSTRAINT "order_parties_phone_chk" CHECK ("order_parties"."phone" ~ '^[0-9]{10,15}$'),
	CONSTRAINT "order_parties_country_chk" CHECK ("order_parties"."country" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_id" varchar(64) NOT NULL,
	"courier_partner" varchar(32) NOT NULL,
	"courier_shipment_id" varchar(128),
	"awb" varchar(64),
	"status" "order_status" DEFAULT 'PENDING' NOT NULL,
	"service_type" "service_type" NOT NULL,
	"payment_mode" "payment_mode" NOT NULL,
	"declared_value" numeric(12, 2) NOT NULL,
	"collectable_value" numeric(12, 2) NOT NULL,
	"invoice_number" varchar(64) NOT NULL,
	"invoice_date" char(10) NOT NULL,
	"invoice_value" numeric(12, 2) NOT NULL,
	"seller_gstin" varchar(32),
	"seller_ern" varchar(32),
	"tax_total" numeric(12, 2),
	"tax_breakdown" jsonb,
	"is_reverse" boolean DEFAULT false NOT NULL,
	"is_dangerous_goods" boolean DEFAULT false NOT NULL,
	"is_surface" boolean DEFAULT false NOT NULL,
	"payload_hash" char(64) NOT NULL,
	"request_snapshot" jsonb NOT NULL,
	"last_courier_request" jsonb,
	"last_courier_response" jsonb,
	"last_error_code" varchar(64),
	"batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_cod_collectable_chk" CHECK ("orders"."payment_mode" <> 'COD' or "orders"."collectable_value" > 0),
	CONSTRAINT "orders_prepaid_collectable_chk" CHECK ("orders"."payment_mode" <> 'PREPAID' or "orders"."collectable_value" = 0),
	CONSTRAINT "orders_invoice_date_chk" CHECK ("orders"."invoice_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);
--> statement-breakpoint
CREATE TABLE "pincode_serviceability" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"courier_partner" varchar(32) NOT NULL,
	"pincode" char(6) NOT NULL,
	"is_serviceable" boolean NOT NULL,
	"service_types" jsonb,
	"raw_payload" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pincode_serviceability_pin_chk" CHECK ("pincode_serviceability"."pincode" ~ '^[0-9]{6}$')
);
--> statement-breakpoint
CREATE TABLE "tracking_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "order_status" NOT NULL,
	"partner_status" varchar(64) NOT NULL,
	"description" text,
	"location" varchar(128),
	"occurred_at" timestamp with time zone NOT NULL,
	"partner_event_id" varchar(128),
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courier_api_calls" ADD CONSTRAINT "courier_api_calls_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_batch_items" ADD CONSTRAINT "bulk_batch_items_batch_id_bulk_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."bulk_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_batch_items" ADD CONSTRAINT "bulk_batch_items_order_uuid_orders_id_fk" FOREIGN KEY ("order_uuid") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_actions" ADD CONSTRAINT "shipment_actions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_documents" ADD CONSTRAINT "shipment_documents_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_packages" ADD CONSTRAINT "order_packages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_parties" ADD CONSTRAINT "order_parties_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_batch_id_bulk_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."bulk_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courier_api_calls_order_idx" ON "courier_api_calls" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "courier_api_calls_request_id_idx" ON "courier_api_calls" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "courier_api_calls_partner_op_idx" ON "courier_api_calls" USING btree ("courier_partner","operation","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bulk_batch_items_batch_order_uidx" ON "bulk_batch_items" USING btree ("batch_id","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bulk_batch_items_batch_position_uidx" ON "bulk_batch_items" USING btree ("batch_id","position");--> statement-breakpoint
CREATE INDEX "bulk_batch_items_queued_idx" ON "bulk_batch_items" USING btree ("created_at") WHERE "bulk_batch_items"."status" = 'QUEUED';--> statement-breakpoint
CREATE INDEX "bulk_batch_items_processing_idx" ON "bulk_batch_items" USING btree ("claimed_at") WHERE "bulk_batch_items"."status" = 'PROCESSING';--> statement-breakpoint
CREATE INDEX "bulk_batch_items_order_id_idx" ON "bulk_batch_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "bulk_batches_status_idx" ON "bulk_batches" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "shipment_actions_order_idx" ON "shipment_actions" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "shipment_actions_type_idx" ON "shipment_actions" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "shipment_documents_order_type_idx" ON "shipment_documents" USING btree ("order_id","type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "order_packages_order_position_uidx" ON "order_packages" USING btree ("order_id","position");--> statement-breakpoint
CREATE INDEX "order_packages_sku_idx" ON "order_packages" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "order_parties_order_role_uidx" ON "order_parties" USING btree ("order_id","role");--> statement-breakpoint
CREATE INDEX "order_parties_pincode_idx" ON "order_parties" USING btree ("pincode");--> statement-breakpoint
CREATE INDEX "order_parties_phone_idx" ON "order_parties" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_id_uidx" ON "orders" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_partner_awb_uidx" ON "orders" USING btree ("courier_partner","awb") WHERE "orders"."awb" is not null;--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "orders_partner_status_idx" ON "orders" USING btree ("courier_partner","status");--> statement-breakpoint
CREATE INDEX "orders_batch_id_idx" ON "orders" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "orders_pending_idx" ON "orders" USING btree ("created_at") WHERE "orders"."status" = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "pincode_serviceability_partner_pin_uidx" ON "pincode_serviceability" USING btree ("courier_partner","pincode");--> statement-breakpoint
CREATE INDEX "tracking_events_order_occurred_idx" ON "tracking_events" USING btree ("order_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_events_dedup_uidx" ON "tracking_events" USING btree ("order_id","occurred_at","partner_status");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_events_partner_event_uidx" ON "tracking_events" USING btree ("order_id","partner_event_id") WHERE "tracking_events"."partner_event_id" is not null;