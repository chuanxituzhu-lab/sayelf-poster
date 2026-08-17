#!/usr/bin/env node
/**
 * Sayelf Poster — MCP server (stdio transport).
 *
 * Exposes the rule-based poster engine as Model Context Protocol tools so that
 * AI-assisted platforms (Claude Code, Codex, WorkBuddy, or any MCP client) can
 * drive generation, evaluation, rendering and the material library without
 * shelling out or knowing the internal module layout.
 *
 * Design notes:
 *   - No API keys, no network. Same deterministic engine as the CLI/WebUI.
 *   - Tools return JSON text content; render_poster can also write an SVG file.
 *   - Full runs can be large, so generate_poster returns a summary by default
 *     and can persist the full run to disk for follow-up evaluate/render calls.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

import {
  generateCandidates,
  applyDesignCommand,
  evaluateDesign,
  inspectDesignContext,
  renderSvg,
  summarizeRun,
  listCompositions,
  PLATFORM_PROFILES,
  STYLE_PROFILES,
  IMAGE_TREATMENTS,
  LANGUAGE_PROFILES
} from "./core.mjs";
import { getLearningMemorySummary } from "./learning-memory.mjs";
import {
  listLibrary,
  getLibraryItem,
  saveLibraryItem,
  deleteLibraryItem,
  LIBRARY_CLASSIFICATIONS
} from "./library.mjs";
import {
  listOnlineLibrary,
  seedAwardReferences,
  saveOnlineReference,
  deleteOnlineReference,
  ONLINE_LIBRARY_LIMIT
} from "./online-library.mjs";

const PLATFORM_IDS = Object.keys(PLATFORM_PROFILES);

/* --------------------------- helpers --------------------------- */

function jsonContent(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function textContent(text) {
  return { content: [{ type: "text", text }] };
}

function errorResult(message) {
  return { isError: true, content: [{ type: "text", text: `sayelf-poster error: ${message}` }] };
}

async function readRunOrCandidate(file) {
  const parsed = JSON.parse(await fs.readFile(file, "utf8"));
  const candidate = parsed.candidates
    ? parsed.candidates.find(item => item.id === parsed.selectedId) ?? parsed.candidates[0]
    : parsed;
  return { parsed, candidate };
}

async function writeJson(outPath, value) {
  const resolved = path.resolve(outPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return resolved;
}

/* --------------------------- tool definitions --------------------------- */

const TOOLS = [
  {
    name: "generate_poster",
    description:
      "Generate three scored, platform-adapted poster candidates from a prompt. Rule-based and API-free. Returns a summary (selected candidate, scores, composition, award benchmarking) and can persist the full run to disk for follow-up evaluate/render calls.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Creative brief / content prompt (Chinese or English)." },
        platform: { type: "string", enum: PLATFORM_IDS, description: "Target platform profile.", default: "xhs_cover" },
        goal: { type: "string", description: "Optional campaign goal; can seed the subheadline." },
        tone: { type: "string", description: "Optional tone hint (高级 / 温暖 / 直接 / 大胆 / 大片 …)." },
        headline: { type: "string", description: "Optional explicit headline (overrides auto copy)." },
        subheadline: { type: "string", description: "Optional explicit subheadline." },
        cta: { type: "string", description: "Call to action label.", default: "了解更多" },
        language: { type: "string", enum: ["auto", "zh", "en"], description: "Poster language.", default: "auto" },
        removeElements: { type: "string", description: "Comma-separated elements to remove from the key visual." },
        addElements: { type: "string", description: "Comma-separated elements to add." },
        professional: { type: "boolean", description: "Professional mode: unlock style/layout/treatment overrides.", default: false },
        outFile: { type: "string", description: "Optional path to write the full run JSON (recommended before evaluate/render)." },
        full: { type: "boolean", description: "Return the full run instead of a summary.", default: false }
      },
      required: ["prompt"]
    }
  },
  {
    name: "evaluate_poster",
    description:
      "Re-score a saved run or candidate JSON file against hard gates, publish/creative scores, typography readability (WCAG), and international/China award benchmarking.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Path to a run.json or a single candidate JSON produced by generate_poster." }
      },
      required: ["file"]
    }
  },
  {
    name: "render_poster",
    description:
      "Render a saved run/candidate to an SVG poster. Returns the SVG markup and, if outFile is given, writes it to disk.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Path to a run.json or candidate JSON." },
        outFile: { type: "string", description: "Optional path to write the .svg file." },
        includeMarkup: { type: "boolean", description: "Include the SVG string in the response.", default: true }
      },
      required: ["file"]
    }
  },
  {
    name: "inspect_design_context",
    description: "Inspect a semantic poster node after a WebUI click. Read-only: returns the selected node, bounds, style, and allowed commands without changing the design.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Path to a run.json or candidate JSON." },
        candidate: { type: "object", description: "Inline candidate JSON when no file is used." },
        nodeId: { type: "string", description: "Semantic node id: image, headline, subheadline, cta, rule, shade, or root.", default: "root" }
      }
    }
  },
  {
    name: "apply_design_command",
    description: "Apply one safe semantic design command to a poster candidate, re-score it, rebuild its scene graph, and optionally persist the updated candidate. Click context is read-only; this tool is the mutation gate.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Path to a run.json or candidate JSON." },
        candidate: { type: "object", description: "Inline candidate JSON when no file is used." },
        targetId: { type: "string", description: "Target node id when the command does not include one." },
        command: { type: "object", description: "Structured command, for example {type:'set_text',targetId:'headline',value:'新标题'} or {type:'set_image_treatment',treatmentId:'line_art'}." },
        text: { type: "string", description: "Optional natural-language command, for example '把字体改成哑金色' or '画面改成线描风格'." },
        source: { type: "string", description: "Calling platform or session label." },
        outFile: { type: "string", description: "Optional path to write the updated candidate JSON." }
      }
    }
  },
  {
    name: "list_compositions",
    description: "List the named composition layouts (geometry-driven) the engine can choose from.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "list_platforms",
    description: "List supported platform profiles with ratios and pixel dimensions.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "list_capabilities",
    description: "List available styles, image treatments, languages and composition/platform ids in one call — a discovery entry point for AI clients.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_award_memory",
    description: "Return the award-learning memory summary, optionally matched against a text query.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Optional text to surface relevant learned mechanisms." } }
    }
  },
  {
    name: "library_list",
    description: "List archived material-library items and evolution summary (max 20 slots).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "library_save",
    description: "Archive a candidate (from a run/candidate JSON file) into the local material library with a classification.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Path to a run.json or candidate JSON." },
        classification: {
          type: "string",
          enum: Object.keys(LIBRARY_CLASSIFICATIONS),
          description: "publishable / refine / experimental.",
          default: "refine"
        },
        source: { type: "string", description: "Optional provenance label (e.g. the AI platform name)." },
        withPreview: { type: "boolean", description: "Render and store an SVG preview.", default: true }
      },
      required: ["file"]
    }
  },
  {
    name: "library_delete",
    description: "Delete a material-library item by its id (e.g. material-...).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Library item id." } },
      required: ["id"]
    }
  },
  {
    name: "online_library_list",
    description: `List online award-reference cards and distilled creative mechanisms (max ${ONLINE_LIBRARY_LIMIT} slots).`,
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "online_library_seed",
    description: "Import the award-reference works already present in the local award-learning memory into the bounded online inspiration library.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "online_library_save",
    description: "Save an online reference as source metadata and a transferable creative-mechanism note without copying the original artwork.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        sourceUrl: { type: "string", description: "Official http(s) source page." },
        authority: { type: "string" },
        region: { type: "string", enum: ["international", "china", "unknown"] },
        category: { type: "string" },
        transfer: { type: "string", description: "Distilled mechanism that can be transferred to a new brief." }
      },
      required: ["title", "sourceUrl"]
    }
  },
  {
    name: "online_library_delete",
    description: "Delete an online inspiration reference by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"]
    }
  }
];

/* --------------------------- tool handlers --------------------------- */

async function handleGenerate(args) {
  const run = generateCandidates({
    prompt: args.prompt,
    platform: PLATFORM_PROFILES[args.platform] ? args.platform : "xhs_cover",
    goal: args.goal ?? "",
    tone: args.tone ?? "",
    headline: args.headline ?? "",
    subheadline: args.subheadline ?? "",
    cta: args.cta ?? "了解更多",
    language: args.language ?? "auto",
    removeElements: args.removeElements ?? "",
    addElements: args.addElements ?? "",
    mode: args.professional ? "professional" : "automatic"
  });
  let savedTo;
  if (args.outFile) savedTo = await writeJson(args.outFile, run);
  const payload = args.full ? run : summarizeRun(run);
  return jsonContent({ savedTo, selectedId: run.selectedId, ...(args.full ? { run: payload } : { summary: payload }) });
}

async function handleEvaluate(args) {
  const { candidate } = await readRunOrCandidate(args.file);
  return jsonContent(evaluateDesign(candidate));
}

async function handleRender(args) {
  const { candidate } = await readRunOrCandidate(args.file);
  const svg = renderSvg(candidate);
  let savedTo;
  if (args.outFile) {
    const resolved = path.resolve(args.outFile);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, svg, "utf8");
    savedTo = resolved;
  }
  const includeMarkup = args.includeMarkup !== false;
  return jsonContent({
    candidateId: candidate.id,
    bytes: Buffer.byteLength(svg),
    savedTo,
    svg: includeMarkup ? svg : undefined
  });
}

async function readInlineOrFile(args) {
  if (args.file) return (await readRunOrCandidate(args.file)).candidate;
  if (args.candidate && typeof args.candidate === "object") return args.candidate;
  throw new Error("需要提供 file 或 candidate");
}

async function handleDesignContext(args) {
  const candidate = await readInlineOrFile(args);
  return jsonContent(inspectDesignContext(candidate, args.nodeId ?? "root"));
}

async function handleDesignCommand(args) {
  const candidate = await readInlineOrFile(args);
  const result = applyDesignCommand(candidate, args.command ?? args.text, { targetId: args.targetId, source: args.source ?? "mcp" });
  let savedTo;
  if (args.outFile) savedTo = await writeJson(args.outFile, result.candidate);
  return jsonContent({ ...result, savedTo });
}

async function handleLibrarySave(args) {
  const { candidate } = await readRunOrCandidate(args.file);
  const previewSvg = args.withPreview !== false ? renderSvg(candidate) : undefined;
  const item = await saveLibraryItem({
    candidate,
    classification: args.classification ?? "refine",
    previewSvg,
    source: args.source ?? "mcp"
  });
  return jsonContent(item);
}

function capabilities() {
  return {
    engine: "sayelf-poster",
    platforms: Object.values(PLATFORM_PROFILES).map(({ id, name, ratio, width, height }) => ({ id, name, ratio, width, height })),
    styles: Object.values(STYLE_PROFILES).map(({ id, name, mood }) => ({ id, name, mood })),
    imageTreatments: Object.values(IMAGE_TREATMENTS).map(({ id, name, description }) => ({ id, name, description })),
    languages: Object.values(LANGUAGE_PROFILES).map(({ id, name }) => ({ id, name })),
    compositions: listCompositions(),
    classifications: Object.values(LIBRARY_CLASSIFICATIONS).map(({ id, name, description }) => ({ id, name, description }))
  };
}

async function dispatch(name, args = {}) {
  switch (name) {
    case "generate_poster": return handleGenerate(args);
    case "evaluate_poster": return handleEvaluate(args);
    case "render_poster": return handleRender(args);
    case "inspect_design_context": return handleDesignContext(args);
    case "apply_design_command": return handleDesignCommand(args);
    case "list_compositions": return jsonContent(listCompositions());
    case "list_platforms": return jsonContent(capabilities().platforms);
    case "list_capabilities": return jsonContent(capabilities());
    case "get_award_memory": return jsonContent(getLearningMemorySummary(args.query ?? ""));
    case "library_list": return jsonContent(await listLibrary());
    case "library_save": return handleLibrarySave(args);
    case "library_delete": {
      const ok = await deleteLibraryItem(args.id);
      return ok ? textContent(`deleted ${args.id}`) : errorResult(`not found: ${args.id}`);
    }
    case "online_library_list": return jsonContent(await listOnlineLibrary());
    case "online_library_seed": return jsonContent(await seedAwardReferences());
    case "online_library_save": return jsonContent(await saveOnlineReference(args));
    case "online_library_delete": {
      const ok = await deleteOnlineReference(args.id);
      return ok ? textContent(`deleted ${args.id}`) : errorResult(`not found: ${args.id}`);
    }
    default:
      return errorResult(`unknown tool: ${name}`);
  }
}

/* --------------------------- server wiring --------------------------- */

const server = new Server(
  { name: "sayelf-poster", version: "0.7.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;
  try {
    return await dispatch(name, args ?? {});
  } catch (error) {
    return errorResult(error.message);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe for logs; stdout is the MCP channel.
  process.stderr.write("sayelf-poster MCP server ready (stdio)\n");
}

main().catch(error => {
  process.stderr.write(`sayelf-poster MCP fatal: ${error.message}\n`);
  process.exit(1);
});
