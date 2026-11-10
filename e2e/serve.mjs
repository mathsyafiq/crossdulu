// Serves ./dist with the production headers from public/_headers, like Cloudflare Pages would.
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT || 4321);

const headers = {};
for (const l of readFileSync(join(ROOT, "public/_headers"), "utf8").split("\n").slice(1)) {
  const m = l.trim().match(/^([\w-]+):\s*(.+)$/);
  if (m) headers[m[1]] = m[2];
}
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".mjs": "text/javascript" };

http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(DIST, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) {
    const nf = join(DIST, "404.html");
    if (existsSync(nf)) {
      res.writeHead(404, { "Content-Type": MIME[".html"], ...headers });
      return res.end(readFileSync(nf));
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": MIME[extname(f)] || "application/octet-stream", ...headers });
  res.end(readFileSync(f));
}).listen(PORT, () => console.log(`serving dist on ${PORT}`));
