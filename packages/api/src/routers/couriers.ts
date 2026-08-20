import { registry } from "@multi-courier-integration-platform/couriers";
import { listCouriersResponseSchema } from "../dto/couriers";
import { publicProcedure } from "../index";

export const listCouriers = publicProcedure
	.route({
		method: "GET",
		path: "/couriers",
		summary: "List couriers",
		description:
			"Return registered courier partner ids. These are the valid courier_partner values.",
		tags: ["couriers"],
		successDescription: "Registered courier partners",
	})
	.output(listCouriersResponseSchema)
	.handler(({ context }) => ({
		couriers: (context.courierRegistry ?? registry).list(),
	}));
