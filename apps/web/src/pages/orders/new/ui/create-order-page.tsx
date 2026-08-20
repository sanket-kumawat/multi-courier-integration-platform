import {
	type CreateOrderInput,
	createOrderSchema,
} from "@multi-courier-integration-platform/api/dto/orders";
import { Button } from "@multi-courier-integration-platform/ui/components/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@multi-courier-integration-platform/ui/components/field";
import { Input } from "@multi-courier-integration-platform/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@multi-courier-integration-platform/ui/components/select";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { HTMLAttributes, FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";

import {
	fieldErrorsFromDetails,
	fieldErrorsFromZod,
	type FieldErrors,
	getApiErrorCode,
	readErrorDetails,
} from "../model/form-errors";
import {
	type AddressFormValues,
	AddressFields,
	defaultConsigneeAddress,
	defaultWarehouseAddress,
} from "./address-fields";
import { CourierSelect } from "@/features/select-courier";
import { orpc } from "@/shared/api";
import { toastApiError } from "@/shared/lib";

type CreateOrderFormValues = {
	courier_partner: string;
	order_id: string;
	service_type: "SDD" | "NDD";
	payment: {
		mode: "COD" | "PREPAID";
		declared_value: string;
		collectable_value: string;
		invoice_number: string;
		invoice_date: string;
		invoice_value: string;
	};
	package: {
		description: string;
		sku: string;
		quantity: string;
		pieces: string;
		weight_kg: string;
		length_cm: string;
		breadth_cm: string;
		height_cm: string;
	};
	shipper: AddressFormValues;
	consignee: AddressFormValues;
	return_address: AddressFormValues;
};

function todayIsoDate(): string {
	return new Date().toISOString().slice(0, 10);
}

function defaultFormValues(): CreateOrderFormValues {
	const warehouse = defaultWarehouseAddress();
	return {
		courier_partner: "mock",
		order_id: `OMS-DEMO-${Date.now()}`,
		service_type: "NDD",
		payment: {
			mode: "COD",
			declared_value: "1299",
			collectable_value: "1299",
			invoice_number: "INV-8891",
			invoice_date: todayIsoDate(),
			invoice_value: "1299",
		},
		package: {
			description: "Books",
			sku: "BK-441122",
			quantity: "1",
			pieces: "1",
			weight_kg: "1.1",
			length_cm: "12",
			breadth_cm: "10",
			height_cm: "10",
		},
		shipper: warehouse,
		consignee: defaultConsigneeAddress(),
		return_address: { ...warehouse },
	};
}

function toNumber(value: string): number {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return Number.NaN;
	}
	return Number(trimmed);
}

function toCreateOrderInput(values: CreateOrderFormValues): unknown {
	return {
		courier_partner: values.courier_partner,
		order_id: values.order_id.trim(),
		service_type: values.service_type,
		payment: {
			mode: values.payment.mode,
			declared_value: toNumber(values.payment.declared_value),
			collectable_value: toNumber(values.payment.collectable_value),
			invoice_number: values.payment.invoice_number.trim(),
			invoice_date: values.payment.invoice_date.trim(),
			invoice_value: toNumber(values.payment.invoice_value),
		},
		package: {
			description: values.package.description.trim(),
			sku: values.package.sku.trim() || undefined,
			quantity: toNumber(values.package.quantity),
			pieces: toNumber(values.package.pieces),
			weight_kg: toNumber(values.package.weight_kg),
			length_cm: toNumber(values.package.length_cm),
			breadth_cm: toNumber(values.package.breadth_cm),
			height_cm: toNumber(values.package.height_cm),
		},
		shipper: values.shipper,
		consignee: values.consignee,
		return_address: values.return_address,
	};
}

function TextField({
	id,
	label,
	path,
	value,
	errors,
	disabled,
	onChange,
	type = "text",
	inputMode,
}: {
	id: string;
	label: string;
	path: string;
	value: string;
	errors: FieldErrors;
	disabled?: boolean;
	onChange: (value: string) => void;
	type?: string;
	inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
	const message = errors[path];
	return (
		<Field data-invalid={message ? true : undefined}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input
				id={id}
				type={type}
				inputMode={inputMode}
				value={value}
				disabled={disabled}
				aria-invalid={message ? true : undefined}
				onChange={(event) => onChange(event.target.value)}
			/>
			<FieldError>{message}</FieldError>
		</Field>
	);
}

export function CreateOrderPage() {
	const navigate = useNavigate();
	const [values, setValues] = useState<CreateOrderFormValues>(defaultFormValues);
	const [errors, setErrors] = useState<FieldErrors>({});

	const createMutation = useMutation(orpc.createOrder.mutationOptions());

	const pending = createMutation.isPending;

	const setPaymentMode = (mode: "COD" | "PREPAID") => {
		setValues((current) => {
			const collectable_value =
				mode === "PREPAID"
					? "0"
					: current.payment.collectable_value === "0"
						? current.payment.declared_value
						: current.payment.collectable_value;
			return {
				...current,
				payment: { ...current.payment, mode, collectable_value },
			};
		});
	};

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setErrors({});

		const parsed = createOrderSchema.safeParse(toCreateOrderInput(values));
		if (!parsed.success) {
			setErrors(fieldErrorsFromZod(parsed.error));
			toast.error("VALIDATION_ERROR: Fix the highlighted fields");
			return;
		}

		try {
			const order = await createMutation.mutateAsync(parsed.data as CreateOrderInput);
			toast.success(
				order.awb ? `AWB ${order.awb}` : `Order ${order.order_id} created`,
			);
			await navigate({
				to: "/orders/$orderId",
				params: { orderId: order.order_id },
			});
		} catch (error) {
			const code = getApiErrorCode(error);
			if (code === "VALIDATION_ERROR") {
				setErrors(fieldErrorsFromDetails(readErrorDetails(error)));
				toast.error("VALIDATION_ERROR: Fix the highlighted fields");
				return;
			}
			if (code === "IDEMPOTENCY_CONFLICT" || code === "UNKNOWN_COURIER") {
				toastApiError(error);
				return;
			}
			toastApiError(error);
		}
	};

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
			<div className="flex flex-col gap-1">
				<h1 className="font-medium text-xl tracking-tight">Create shipment</h1>
				<p className="text-muted-foreground text-sm">
					Submit one order through a registered courier. Same{" "}
					<code className="text-foreground">order_id</code> + payload replays the
					existing order.
				</p>
			</div>

			<form className="flex flex-col gap-8" onSubmit={onSubmit} noValidate>
				<FieldGroup>
					<FieldSet>
						<FieldLegend>Partner and order</FieldLegend>
						<div className="grid gap-4 sm:grid-cols-2">
							<CourierSelect
								value={values.courier_partner || null}
								onValueChange={(courier_partner) =>
									setValues((current) => ({
										...current,
										courier_partner: courier_partner ?? "",
									}))
								}
								disabled={pending}
								className="sm:col-span-2"
							/>
							{errors.courier_partner ? (
								<FieldError className="sm:col-span-2">
									{errors.courier_partner}
								</FieldError>
							) : null}
							<TextField
								id="order-id"
								label="Order ID"
								path="order_id"
								value={values.order_id}
								errors={errors}
								disabled={pending}
								onChange={(order_id) =>
									setValues((current) => ({ ...current, order_id }))
								}
							/>
							<Field data-invalid={errors.service_type ? true : undefined}>
								<FieldLabel htmlFor="service-type">Service type</FieldLabel>
								<Select
									value={values.service_type}
									disabled={pending}
									onValueChange={(service_type) => {
										if (service_type === "SDD" || service_type === "NDD") {
											setValues((current) => ({ ...current, service_type }));
										}
									}}
								>
									<SelectTrigger
										id="service-type"
										className="w-full"
										aria-invalid={errors.service_type ? true : undefined}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											<SelectItem value="SDD">SDD — same day</SelectItem>
											<SelectItem value="NDD">NDD — next day</SelectItem>
										</SelectGroup>
									</SelectContent>
								</Select>
								<FieldError>{errors.service_type}</FieldError>
							</Field>
						</div>
					</FieldSet>

					<FieldSet>
						<FieldLegend>Payment</FieldLegend>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field data-invalid={errors["payment.mode"] ? true : undefined}>
								<FieldLabel htmlFor="payment-mode">Mode</FieldLabel>
								<Select
									value={values.payment.mode}
									disabled={pending}
									onValueChange={(mode) => {
										if (mode === "COD" || mode === "PREPAID") {
											setPaymentMode(mode);
										}
									}}
								>
									<SelectTrigger id="payment-mode" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											<SelectItem value="COD">COD</SelectItem>
											<SelectItem value="PREPAID">PREPAID</SelectItem>
										</SelectGroup>
									</SelectContent>
								</Select>
								<FieldError>{errors["payment.mode"]}</FieldError>
							</Field>
							<TextField
								id="declared-value"
								label="Declared value"
								path="payment.declared_value"
								value={values.payment.declared_value}
								errors={errors}
								disabled={pending}
								inputMode="decimal"
								onChange={(declared_value) =>
									setValues((current) => ({
										...current,
										payment: { ...current.payment, declared_value },
									}))
								}
							/>
							<TextField
								id="collectable-value"
								label="Collectable value"
								path="payment.collectable_value"
								value={values.payment.collectable_value}
								errors={errors}
								disabled={pending || values.payment.mode === "PREPAID"}
								inputMode="decimal"
								onChange={(collectable_value) =>
									setValues((current) => ({
										...current,
										payment: { ...current.payment, collectable_value },
									}))
								}
							/>
							<TextField
								id="invoice-number"
								label="Invoice number"
								path="payment.invoice_number"
								value={values.payment.invoice_number}
								errors={errors}
								disabled={pending}
								onChange={(invoice_number) =>
									setValues((current) => ({
										...current,
										payment: { ...current.payment, invoice_number },
									}))
								}
							/>
							<TextField
								id="invoice-date"
								label="Invoice date"
								path="payment.invoice_date"
								value={values.payment.invoice_date}
								errors={errors}
								disabled={pending}
								type="date"
								onChange={(invoice_date) =>
									setValues((current) => ({
										...current,
										payment: { ...current.payment, invoice_date },
									}))
								}
							/>
							<TextField
								id="invoice-value"
								label="Invoice value"
								path="payment.invoice_value"
								value={values.payment.invoice_value}
								errors={errors}
								disabled={pending}
								inputMode="decimal"
								onChange={(invoice_value) =>
									setValues((current) => ({
										...current,
										payment: { ...current.payment, invoice_value },
									}))
								}
							/>
						</div>
					</FieldSet>

					<FieldSet>
						<FieldLegend>Package</FieldLegend>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="sm:col-span-2">
								<TextField
									id="package-description"
									label="Description"
									path="package.description"
									value={values.package.description}
									errors={errors}
									disabled={pending}
									onChange={(description) =>
										setValues((current) => ({
											...current,
											package: { ...current.package, description },
										}))
									}
								/>
							</div>
							<TextField
								id="package-sku"
								label="SKU (optional)"
								path="package.sku"
								value={values.package.sku}
								errors={errors}
								disabled={pending}
								onChange={(sku) =>
									setValues((current) => ({
										...current,
										package: { ...current.package, sku },
									}))
								}
							/>
							<TextField
								id="package-quantity"
								label="Quantity"
								path="package.quantity"
								value={values.package.quantity}
								errors={errors}
								disabled={pending}
								inputMode="numeric"
								onChange={(quantity) =>
									setValues((current) => ({
										...current,
										package: { ...current.package, quantity },
									}))
								}
							/>
							<TextField
								id="package-pieces"
								label="Pieces"
								path="package.pieces"
								value={values.package.pieces}
								errors={errors}
								disabled={pending}
								inputMode="numeric"
								onChange={(pieces) =>
									setValues((current) => ({
										...current,
										package: { ...current.package, pieces },
									}))
								}
							/>
							<TextField
								id="package-weight"
								label="Weight (kg)"
								path="package.weight_kg"
								value={values.package.weight_kg}
								errors={errors}
								disabled={pending}
								inputMode="decimal"
								onChange={(weight_kg) =>
									setValues((current) => ({
										...current,
										package: { ...current.package, weight_kg },
									}))
								}
							/>
							<TextField
								id="package-length"
								label="Length (cm)"
								path="package.length_cm"
								value={values.package.length_cm}
								errors={errors}
								disabled={pending}
								inputMode="decimal"
								onChange={(length_cm) =>
									setValues((current) => ({
										...current,
										package: { ...current.package, length_cm },
									}))
								}
							/>
							<TextField
								id="package-breadth"
								label="Breadth (cm)"
								path="package.breadth_cm"
								value={values.package.breadth_cm}
								errors={errors}
								disabled={pending}
								inputMode="decimal"
								onChange={(breadth_cm) =>
									setValues((current) => ({
										...current,
										package: { ...current.package, breadth_cm },
									}))
								}
							/>
							<TextField
								id="package-height"
								label="Height (cm)"
								path="package.height_cm"
								value={values.package.height_cm}
								errors={errors}
								disabled={pending}
								inputMode="decimal"
								onChange={(height_cm) =>
									setValues((current) => ({
										...current,
										package: { ...current.package, height_cm },
									}))
								}
							/>
						</div>
					</FieldSet>

					<FieldSet>
						<FieldLegend>Shipper</FieldLegend>
						<AddressFields
							prefix="shipper"
							value={values.shipper}
							errors={errors}
							disabled={pending}
							onChange={(shipper) =>
								setValues((current) => ({ ...current, shipper }))
							}
						/>
					</FieldSet>

					<FieldSet>
						<FieldLegend>Consignee</FieldLegend>
						<AddressFields
							prefix="consignee"
							value={values.consignee}
							errors={errors}
							disabled={pending}
							onChange={(consignee) =>
								setValues((current) => ({ ...current, consignee }))
							}
						/>
					</FieldSet>

					<FieldSet>
						<FieldLegend>Return address</FieldLegend>
						<AddressFields
							prefix="return_address"
							value={values.return_address}
							errors={errors}
							disabled={pending}
							onChange={(return_address) =>
								setValues((current) => ({ ...current, return_address }))
							}
						/>
					</FieldSet>
				</FieldGroup>

				<div className="flex items-center gap-3">
					<Button type="submit" disabled={pending}>
						{pending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
						Create order
					</Button>
				</div>
			</form>
		</main>
	);
}
