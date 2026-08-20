import { healthResponseSchema } from "../dto/health";
import { publicProcedure } from "../index";

export const healthCheck = publicProcedure
	.route({
		method: "GET",
		path: "/health",
		summary: "Liveness probe",
		description:
			"Returns ok when the process is running. Does not check the database or courier partners.",
		tags: ["health"],
		successDescription: "Server is alive",
	})
	.output(healthResponseSchema)
	.handler(() => ({
		status: "ok" as const,
		timestamp: new Date().toISOString(),
	}));
