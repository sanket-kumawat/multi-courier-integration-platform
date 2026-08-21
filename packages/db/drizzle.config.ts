import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

const localEnvPath = resolve(import.meta.dirname, "../../apps/server/.env");
if (existsSync(localEnvPath)) {
	dotenv.config({ path: localEnvPath });
}

const url =
	process.env.DATABASE_URL?.trim() ||
	process.env.DATABASE_PRIVATE_URL?.trim() ||
	"";

if (!url) {
	throw new Error(
		"DATABASE_URL is missing. On Railway, set DATABASE_URL=${{Postgres.DATABASE_URL}} on the server service (use your Postgres service name if it differs).",
	);
}

export default defineConfig({
	schema: "./src/schema",
	out: "./src/migrations",
	dialect: "postgresql",
	dbCredentials: { url },
});
