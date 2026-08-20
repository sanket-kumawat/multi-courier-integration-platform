import type { Address, CreateShipmentInput } from "../contract";

export type UrbaneBoltManifestItem = {
	customerCode: string;
	orderNumber: string;
	declaredValue: number;
	itemDescription: string;
	collectableValue: number;
	height: number;
	length: number;
	breadth: number;
	weight: number;
	pieces: number;
	serviceType: "SDD" | "NDD";
	payMode: "COD" | "PPD";
	itemQuantity: number;
	invoiceNumber: string;
	invoiceDate: string;
	invoiceValue: number;
	shprName: string;
	shprPhone: string;
	shprEmail: string;
	shprAddress: string;
	shprAddressType: string;
	shprCity: string;
	shprState: string;
	shprPin: string;
	shprCountry: string;
	consName: string;
	consPhone: string;
	consEmail: string;
	consAddress: string;
	consAddressType: string;
	consCity: string;
	consState: string;
	consPin: string;
	consCountry: string;
	rtnName: string;
	rtnPhone: string;
	rtnEmail: string;
	rtnAddress: string;
	rtnAddressType: string;
	rtnCity: string;
	rtnState: string;
	rtnPin: string;
	rtnCountry: string;
};

export function mapPayMode(mode: "COD" | "PREPAID"): "COD" | "PPD" {
	return mode === "PREPAID" ? "PPD" : "COD";
}

export function mapCountry(country: string): string {
	return country === "IN" ? "INDIA" : country;
}

function partyFields(address: Address) {
	return {
		name: address.name,
		phone: address.phone,
		email: address.email,
		address: address.addressLine1,
		addressType: address.addressType,
		city: address.city,
		state: address.state,
		pin: address.pincode,
		country: mapCountry(address.country),
	};
}

export function toManifestItem(
	input: CreateShipmentInput,
	customerCode: string,
): UrbaneBoltManifestItem {
	const shipper = partyFields(input.shipper);
	const consignee = partyFields(input.consignee);
	const rtn = partyFields(input.returnAddress);

	return {
		customerCode,
		orderNumber: input.orderId,
		declaredValue: input.payment.declaredValue,
		itemDescription: input.pkg.description,
		collectableValue: input.payment.collectableValue,
		height: input.pkg.heightCm,
		length: input.pkg.lengthCm,
		breadth: input.pkg.breadthCm,
		weight: input.pkg.weightKg,
		pieces: input.pkg.pieces,
		serviceType: input.serviceType,
		payMode: mapPayMode(input.payment.mode),
		itemQuantity: input.pkg.quantity,
		invoiceNumber: input.payment.invoiceNumber,
		invoiceDate: input.payment.invoiceDate,
		invoiceValue: input.payment.invoiceValue,
		shprName: shipper.name,
		shprPhone: shipper.phone,
		shprEmail: shipper.email,
		shprAddress: shipper.address,
		shprAddressType: shipper.addressType,
		shprCity: shipper.city,
		shprState: shipper.state,
		shprPin: shipper.pin,
		shprCountry: shipper.country,
		consName: consignee.name,
		consPhone: consignee.phone,
		consEmail: consignee.email,
		consAddress: consignee.address,
		consAddressType: consignee.addressType,
		consCity: consignee.city,
		consState: consignee.state,
		consPin: consignee.pin,
		consCountry: consignee.country,
		rtnName: rtn.name,
		rtnPhone: rtn.phone,
		rtnEmail: rtn.email,
		rtnAddress: rtn.address,
		rtnAddressType: rtn.addressType,
		rtnCity: rtn.city,
		rtnState: rtn.state,
		rtnPin: rtn.pin,
		rtnCountry: rtn.country,
	};
}
