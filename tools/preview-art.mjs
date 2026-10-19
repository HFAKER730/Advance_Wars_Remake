/**
 * Standalone preview server for the faction art proposal.
 *
 * Serves `tools/art-preview/index.html` plus the two directories it imports
 * from (`public/`, and the page itself), so the proposal can be reviewed
 * without touching the game server or its routes. Read-only: it never writes
 * state and never touches `data/`.
 *
 *   node tools/preview-art.mjs [port]
 *
 * Defaults to port 4174. Prints the URL, then serves until Ctrl+C.
 */
import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const PREVIEW = resolve(HERE, "art-preview");
const PUBLIC = resolve(ROOT, "public");
const PORT = Number(process.argv[2] ?? 4174);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

/** Route a request path to a file, keeping every read inside the two roots. */
function resolveTarget(pathname) {
  if (pathname === "/" || pathname === "/index.html") return resolve(PREVIEW, "index.html");
  // `/art/*` and the unit-art / renderer imports live under public/.
  const candidates = [
    resolve(PUBLIC, `.${pathname}`),
    resolve(PREVIEW, `.${pathname}`),
  ];
  for (const candidate of candidates)
    if (
      candidate.startsWith(`${PUBLIC}${sep}`) ||
      candidate.startsWith(`${PREVIEW}${sep}`)
    )
      return candidate;
  return null;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes("\0") || pathname.includes("\\")) {
      res.writeHead(404).end("not found");
      return;
    }
    const target = resolveTarget(pathname);
    if (!target) {
      res.writeHead(404).end("not found");
      return;
    }
    let info;
    try {
      info = await stat(target);
    } catch {
      res.writeHead(404).end("not found");
      return;
    }
    if (!info.isFile()) {
      res.writeHead(404).end("not found");
      return;
    }
    const type = MIME[extname(target)] ?? "text/plain; charset=utf-8";
    const headers = {
      "Content-Type": type,
      "Content-Length": info.size,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (type.startsWith("text/html"))
      headers["Content-Security-Policy"] =
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:";
    res.writeHead(200, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(target).pipe(res);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`预览服务错误：${error.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`阵营建模提案预览：http://127.0.0.1:${PORT}`);
  console.log(`静态根：${PUBLIC}`);
  console.log("按 Ctrl+C 结束。");
});
