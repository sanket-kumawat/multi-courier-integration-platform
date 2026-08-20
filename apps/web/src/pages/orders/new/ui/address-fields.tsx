import type { HTMLAttributes } from "react";

import {
	Field,
	FieldError,
	FieldLabel,
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

import type { FieldErrors } from "../model/form-errors";

export type AddressFormValues = {
	name: string;
	phone: string;
	email: string;
	address_line1: string;
	address_type: string;
	city: string;
	state: string;
	pincode: string;
	country: string;
};

const ADDRESS_TYPES = ["Home", "Office", "Seller"] as const;

type AddressFieldsProps = {
	prefix: string;
	value: AddressFormValues;
	onChange: (next: AddressFormValues) => void;
	errors: FieldErrors;
	disabled?: boolean;
};

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

export function AddressFields({
	prefix,
	value,
	onChange,
	errors,
	disabled,
}: AddressFieldsProps) {
	const patch = (partial: Partial<AddressFormValues>) =>
		onChange({ ...value, ...partial });

	const typePath = `${prefix}.address_type`;
	const typeError = errors[typePath];

	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<TextField
				id={`${prefix}-name`}
				label="Name"
				path={`${prefix}.name`}
				value={value.name}
				errors={errors}
				disabled={disabled}
				onChange={(name) => patch({ name })}
			/>
			<TextField
				id={`${prefix}-phone`}
				label="Phone"
				path={`${prefix}.phone`}
				value={value.phone}
				errors={errors}
				disabled={disabled}
				inputMode="numeric"
				onChange={(phone) => patch({ phone })}
			/>
			<TextField
				id={`${prefix}-email`}
				label="Email"
				path={`${prefix}.email`}
				value={value.email}
				errors={errors}
				disabled={disabled}
				type="email"
				onChange={(email) => patch({ email })}
			/>
			<div className="sm:col-span-2">
				<TextField
					id={`${prefix}-address-line1`}
					label="Address line 1"
					path={`${prefix}.address_line1`}
					value={value.address_line1}
					errors={errors}
					disabled={disabled}
					onChange={(address_line1) => patch({ address_line1 })}
				/>
			</div>
			<Field data-invalid={typeError ? true : undefined}>
				<FieldLabel htmlFor={`${prefix}-address-type`}>Address type</FieldLabel>
				<Select
					value={value.address_type}
					disabled={disabled}
					onValueChange={(address_type) => {
						if (address_type) {
							patch({ address_type });
						}
					}}
				>
					<SelectTrigger
						id={`${prefix}-address-type`}
						className="w-full"
						aria-invalid={typeError ? true : undefined}
					>
						<SelectValue placeholder="Select type" />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{ADDRESS_TYPES.map((type) => (
								<SelectItem key={type} value={type}>
									{type}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
				<FieldError>{typeError}</FieldError>
			</Field>
			<TextField
				id={`${prefix}-city`}
				label="City"
				path={`${prefix}.city`}
				value={value.city}
				errors={errors}
				disabled={disabled}
				onChange={(city) => patch({ city })}
			/>
			<TextField
				id={`${prefix}-state`}
				label="State"
				path={`${prefix}.state`}
				value={value.state}
				errors={errors}
				disabled={disabled}
				onChange={(state) => patch({ state })}
			/>
			<TextField
				id={`${prefix}-pincode`}
				label="PIN code"
				path={`${prefix}.pincode`}
				value={value.pincode}
				errors={errors}
				disabled={disabled}
				inputMode="numeric"
				onChange={(pincode) => patch({ pincode })}
			/>
			<TextField
				id={`${prefix}-country`}
				label="Country"
				path={`${prefix}.country`}
				value={value.country}
				errors={errors}
				disabled={disabled}
				onChange={(country) => patch({ country })}
			/>
		</div>
	);
}

export function defaultWarehouseAddress(): AddressFormValues {
	return {
		name: "Warehouse Alpha",
		phone: "9425018023",
		email: "warehouse@example.com",
		address_line1: "Plot 137-139, Sector-I, Industrial Area",
		address_type: "Seller",
		city: "Bengaluru",
		state: "Karnataka",
		pincode: "560001",
		country: "IN",
	};
}

export function defaultConsigneeAddress(): AddressFormValues {
	return {
		name: "Rahul Sharma",
		phone: "8320226438",
		email: "rahul@example.com",
		address_line1: "Plot 26-27, Om Nagar Society",
		address_type: "Home",
		city: "Surat",
		state: "Gujarat",
		pincode: "395007",
		country: "IN",
	};
}
