import { pgEnum } from "drizzle-orm/pg-core";

export const orderStatusEnum = pgEnum("order_status", [
	"PENDING",
	"CREATED",
	"PICKED_UP",
	"IN_TRANSIT",
	"OUT_FOR_DELIVERY",
	"DELIVERED",
	"RTO",
	"CANCELLED",
	"FAILED",
]);

export const paymentModeEnum = pgEnum("payment_mode", ["COD", "PREPAID"]);

export const serviceTypeEnum = pgEnum("service_type", [
	"SDD",
	"NDD",
	"SURFACE",
]);

export const addressRoleEnum = pgEnum("address_role", [
	"SHIPPER",
	"CONSIGNEE",
	"RETURN",
]);

export const courierOperationEnum = pgEnum("courier_operation", [
	"AUTH",
	"PINCODE",
	"CREATE",
	"TRACK",
	"CANCEL",
	"LABEL",
	"EPOD",
	"NDR_RTO",
	"NDR_REATTEMPT",
	"PAYMODE_CHANGE",
]);

export const courierCallErrorEnum = pgEnum("courier_call_error", [
	"TIMEOUT",
	"NETWORK",
	"HTTP",
]);

export const batchStatusEnum = pgEnum("batch_status", [
	"QUEUED",
	"PROCESSING",
	"COMPLETED",
	"FAILED",
]);

export const batchItemStatusEnum = pgEnum("batch_item_status", [
	"QUEUED",
	"PROCESSING",
	"SUCCEEDED",
	"FAILED",
]);

export const documentTypeEnum = pgEnum("document_type", ["LABEL", "EPOD"]);

export const shipmentActionTypeEnum = pgEnum("shipment_action_type", [
	"CANCEL",
	"RTO_LOCK",
	"REATTEMPT",
	"PAYMODE_CHANGE",
]);
