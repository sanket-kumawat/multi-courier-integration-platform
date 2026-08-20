import {
	createContext,
	resolveRequestId,
} from "@multi-courier-integration-platform/api/context";
import { encodeErrorEnvelope } from "@multi-courier-integration-platform/api/errors";
import { appRouter } from "@multi-courier-integration-platform/api/routers/index";
import { createProductionServices } from "@multi-courier-integration-platform/api/services/index";
import { env } from "@multi-courier-integration-platform/env/server";
import { OpenAPIHandler } from "@orpc/openapi/node";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/node";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import cors from "cors";
import { initLogger } from "evlog";
import { evlog } from "evlog/express";
import { createFsDrain } from "evlog/fs";
import express from "express";

initLogger({
	env: { service: "multi-courier-integration-platform-server" },
});

const app = express();
const { orderService, trackingService, cancelService } =
	createProductionServices();

app.use(
	evlog({
		drain: process.env.NODE_ENV === "production" ? undefined : createFsDrain(),
	}),
);

app.use(
	cors({
		origin: env.CORS_ORIGIN,
		methods: ["GET", "POST", "OPTIONS"],
	}),
);

app.use((req, res, next) => {
	const requestId = resolveRequestId(req);
	res.locals.requestId = requestId;
	res.setHeader("X-Request-Id", requestId);
	next();
});

const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
			docsPath: "/",
			specPath: "/spec.json",
			docsTitle: "Multi-Courier Integration Platform",
			specGenerateOptions: {
				info: {
					title: "Multi-Courier Integration Platform",
					version: "1.0.0",
				},
			},
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
	customErrorResponseBodyEncoder: encodeErrorEnvelope,
});

app.use(async (req, res, next) => {
	const context = await createContext({
		req,
		res,
		orderService,
		trackingService,
		cancelService,
	});

	const rpcResult = await rpcHandler.handle(req, res, {
		prefix: "/rpc",
		context,
	});
	if (rpcResult.matched) {
		return;
	}

	const apiResult = await apiHandler.handle(req, res, {
		prefix: "/api/v1",
		context,
	});
	if (apiResult.matched) {
		return;
	}

	next();
});

app.use(express.json());

app.get("/", (_req, res) => {
	res.status(200).send("OK");
});

app.get("/api-reference/spec.json", (_req, res) => {
	res.redirect(307, "/api/v1/spec.json");
});

app.get("/api-reference", (_req, res) => {
	res.type("html").send(`<!doctype html>
<html>
  <head>
    <title>Multi-Courier Integration Platform</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference("#app", { url: "/api/v1/spec.json" });
    </script>
  </body>
</html>`);
});

app.listen(3000, () => {
	console.log("Server is running on http://localhost:3000");
});
