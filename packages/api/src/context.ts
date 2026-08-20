import type { Request, Response } from "express";

interface CreateContextOptions {
	req: Request;
	res?: Response;
}

export function resolveRequestId(req: Request): string {
	const fromHeader = req.header("x-request-id")?.trim();
	if (fromHeader) {
		return fromHeader;
	}
	return crypto.randomUUID();
}

export async function createContext({ req, res }: CreateContextOptions) {
	const fromLocals = res?.locals.requestId;
	const requestId =
		typeof fromLocals === "string" && fromLocals.length > 0
			? fromLocals
			: resolveRequestId(req);

	return {
		auth: null,
		session: null,
		requestId,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
