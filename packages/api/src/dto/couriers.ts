import { z } from "zod";

export const listCouriersResponseSchema = z.object({
	couriers: z.array(z.string()),
});

export type ListCouriersResponse = z.infer<typeof listCouriersResponseSchema>;
