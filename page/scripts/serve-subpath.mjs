// Static server for dist/ under any URL prefix, like GitHub Pages.
// Usage: node scripts/serve-subpath.mjs <dir> <prefix> [port]
// Requests outside the prefix get 404, which proves nothing leaves the sub-path.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const [, , dirArg = "dist", prefixArg = "/", portArg = "5193"] = process.argv;
const port = Number(portArg);
if (port === 4191 || port === 4291) throw new Error("Reserved port");
const root = resolve(dirArg);
const prefix = prefixArg.endsWith("/") ? prefixArg : `${prefixArg}/`;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    let path = decodeURIComponent(url.pathname);
    if (path === prefix.slice(0, -1) && prefix !== "/") {
      res.writeHead(301, { Location: prefix });
      res.end();
      return;
    }
    if (!path.startsWith(prefix)) {
      res.writeHead(404);
      res.end("Outside the sub-path");
      return;
    }
    path = path.slice(prefix.length);
    if (path === "" || path.endsWith("/")) path += "index.html";
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}${prefix}`);
});
