#!/usr/bin/env node
/**
 * MCP smoke test. Spawns the Sayelf Poster MCP server over stdio and drives a
 * minimal client handshake + a generate → evaluate → render round-trip.
 * Use this to verify an AI-platform integration path before configuring a client.
 *
 *   node scripts/mcp-smoke.mjs
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(here, "../src/mcp-server.mjs");
const runFile = path.join(os.tmpdir(), `sayelf-smoke-${Date.now()}.json`);
const svgFile = path.join(os.tmpdir(), `sayelf-smoke-${Date.now()}.svg`);

const srv = spawn("node", [serverPath], { stdio: ["pipe", "pipe", "inherit"] });
let buf = "";
const pending = new Map();

srv.stdout.on("data", chunk => {
  buf += chunk.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});

function rpc(method, params, id) {
  return new Promise(resolve => {
    pending.set(id, resolve);
    srv.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

function unwrap(response) {
  if (response.error) throw new Error(response.error.message);
  return JSON.parse(response.result.content[0].text);
}

async function run() {
  await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "1" } }, 1);
  srv.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

  const tools = await rpc("tools/list", {}, 2);
  console.log("✓ tools/list:", tools.result.tools.map(t => t.name).join(", "));

  const gen = unwrap(await rpc("tools/call", {
    name: "generate_poster",
    arguments: { prompt: "为海边建筑旅居空间制作高级中文封面", platform: "xhs_cover", outFile: runFile }
  }, 3));
  console.log("✓ generate_poster: selected", gen.selectedId, "→", gen.savedTo);

  const context = unwrap(await rpc("tools/call", {
    name: "inspect_design_context",
    arguments: { file: runFile, nodeId: "headline" }
  }, 7));
  console.log("✓ inspect_design_context:", context.selection.id, "→", context.selection.supportedCommands.join("/"));

  const edit = unwrap(await rpc("tools/call", {
    name: "apply_design_command",
    arguments: { file: runFile, text: "把字体改成哑金色", targetId: "headline", outFile: runFile, source: "mcp-smoke" }
  }, 8));
  console.log("✓ apply_design_command:", edit.command.type, "→", edit.candidate.typography.headlineColor);

  const ev = unwrap(await rpc("tools/call", { name: "evaluate_poster", arguments: { file: runFile } }, 4));
  console.log("✓ evaluate_poster: level", ev.level, "publishScore", ev.publishScore);

  const rn = unwrap(await rpc("tools/call", { name: "render_poster", arguments: { file: runFile, outFile: svgFile, includeMarkup: false } }, 5));
  console.log("✓ render_poster:", rn.bytes, "bytes →", rn.savedTo);

  const cap = unwrap(await rpc("tools/call", { name: "list_capabilities", arguments: {} }, 6));
  console.log("✓ list_capabilities:", cap.platforms.length, "platforms,", cap.compositions.length, "compositions");

  console.log("\nSmoke test passed.");
  srv.kill();
  process.exit(0);
}

run().catch(error => {
  console.error("Smoke test FAILED:", error.message);
  srv.kill();
  process.exit(1);
});
