import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeInput, applyDesignCommand, evaluateDesign, generateCandidates, inspectDesignContext, renderSvg } from "./core.mjs";
import { getLearningMemorySummary } from "./learning-memory.mjs";
import { deleteLibraryItem, getLibraryItem, listLibrary, saveLibraryItem } from "./library.mjs";
import { deleteOnlineReference, listOnlineLibrary, saveOnlineReference, seedAwardReferences } from "./online-library.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(root, "../web");
const port = Number(process.env.PORT || 4174);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function serveStatic(req, res) {
  const requestPath = new URL(req.url, "http://localhost").pathname;
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.resolve(webRoot, relative);
  if (!filePath.startsWith(webRoot)) return sendJson(res, 403, { error: "Forbidden" });
  try {
    const body = await fs.readFile(filePath);
    res.writeHead(200, { "content-type": MIME[path.extname(filePath)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") return sendJson(res, 200, { ok: true, service: "sayelf-poster", version: "0.7.0" });
    if (req.method === "GET" && req.url === "/api/learning-memory") return sendJson(res, 200, getLearningMemorySummary());
    if (req.method === "GET" && req.url === "/api/library") return sendJson(res, 200, await listLibrary());
    if (req.method === "GET" && req.url === "/api/online-library") return sendJson(res, 200, await listOnlineLibrary());
    if (req.method === "POST" && req.url === "/api/online-library/seed-award-references") return sendJson(res, 200, await seedAwardReferences());
    const onlineItemMatch = req.url.match(/^\/api\/online-library\/items\/([^/]+)$/);
    if (req.method === "POST" && req.url === "/api/online-library/items") return sendJson(res, 200, await saveOnlineReference(await readJson(req)));
    if (req.method === "DELETE" && onlineItemMatch) {
      const removed = await deleteOnlineReference(decodeURIComponent(onlineItemMatch[1]));
      return removed ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: "Online reference not found" });
    }
    if (req.method === "GET" && req.url === "/api/evolution") return sendJson(res, 200, (await listLibrary()).evolution);
    const previewMatch = req.method === "GET" ? req.url.match(/^\/api\/library\/items\/([^/]+)\/preview$/) : null;
    if (previewMatch) {
      const item = await getLibraryItem(decodeURIComponent(previewMatch[1]));
      if (!item?.previewSvg) return sendJson(res, 404, { error: "Preview not found" });
      res.writeHead(200, { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store" });
      return res.end(item.previewSvg);
    }
    const itemMatch = req.url.match(/^\/api\/library\/items\/([^/]+)$/);
    if (req.method === "POST" && (req.url === "/api/library/items" || itemMatch)) {
      const body = await readJson(req);
      const candidate = body.candidate ?? body;
      const saved = await saveLibraryItem({ candidate, classification: body.classification, source: body.source, previewSvg: renderSvg(candidate) });
      return sendJson(res, 200, saved);
    }
    if (req.method === "DELETE" && itemMatch) {
      const removed = await deleteLibraryItem(decodeURIComponent(itemMatch[1]));
      return removed ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: "Material not found" });
    }
    if (req.method === "POST" && req.url === "/api/analyze") return sendJson(res, 200, analyzeInput(await readJson(req)));
    if (req.method === "POST" && req.url === "/api/generate") return sendJson(res, 200, generateCandidates(await readJson(req)));
    if (req.method === "POST" && req.url === "/api/design-context") {
      const body = await readJson(req);
      return sendJson(res, 200, inspectDesignContext(body.candidate ?? body, body.nodeId ?? "root"));
    }
    if (req.method === "POST" && req.url === "/api/design-command") {
      const body = await readJson(req);
      return sendJson(res, 200, applyDesignCommand(body.candidate ?? body, body.command ?? body.text, { targetId: body.targetId, source: body.source ?? "webui-session" }));
    }
    if (req.method === "POST" && req.url === "/api/evaluate") {
      const body = await readJson(req);
      return sendJson(res, 200, evaluateDesign(body.candidate ?? body, body.input ?? {}));
    }
    if (req.method === "POST" && req.url === "/api/render") {
      const body = await readJson(req);
      const svg = renderSvg(body.candidate ?? body);
      res.writeHead(200, { "content-type": "image/svg+xml; charset=utf-8", "content-disposition": "attachment; filename=poster.svg" });
      return res.end(svg);
    }
    if (req.method === "GET") return serveStatic(req, res);
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, error.statusCode ?? 400, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`poster-system WebUI: http://localhost:${port}`);
});
