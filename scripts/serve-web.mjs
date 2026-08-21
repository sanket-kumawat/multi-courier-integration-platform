import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const port = Number(process.env.PORT) || 3001;
const root = join(process.cwd(), "apps/web/dist");

const types = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
};

function safePath(urlPath) {
	const decoded = decodeURIComponent((urlPath || "/").split("?")[0] || "/");
	const relative = decoded === "/" ? "/index.html" : decoded;
	const full = normalize(join(root, relative));
	if (!full.startsWith(root)) {
		return null;
	}
	return full;
}

createServer(async (req, res) => {
	try {
		let filePath = safePath(req.url || "/");
		if (!filePath) {
			res.writeHead(403).end("Forbidden");
			return;
		}

		let data;
		try {
			data = await readFile(filePath);
		} catch {
			// SPA fallback
			filePath = join(root, "index.html");
			data = await readFile(filePath);
		}

		res.writeHead(200, {
			"Content-Type": types[extname(filePath)] || "application/octet-stream",
		});
		res.end(data);
	} catch {
		res.writeHead(404).end("Not found");
	}
}).listen(port, "0.0.0.0", () => {
	console.log(`web listening on http://0.0.0.0:${port}`);
});
