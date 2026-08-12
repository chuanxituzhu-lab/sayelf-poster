#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { generateCandidates, evaluateDesign, renderSvg, summarizeRun, PLATFORM_PROFILES, listCompositions } from "./core.mjs";
import { getLearningMemorySummary } from "./learning-memory.mjs";

function flag(args, name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
}

function hasFlag(args, name) {
  return args.includes(name);
}

function commandMemory() {
  console.log(JSON.stringify(getLearningMemorySummary(), null, 2));
}

function commandCompositions() {
  console.log(JSON.stringify(listCompositions(), null, 2));
}

function printHelp() {
  console.log(`poster-system CLI\n\nCommands:\n  generate      Generate and score three poster candidates\n  evaluate      Evaluate a saved candidate JSON file\n  render        Render a saved candidate JSON file to SVG\n  memory        Show the current award-learning memory\n  compositions  List the named composition layouts\n\nExamples:\n  node src/cli.mjs generate --prompt "海边建筑旅居广告" --platform xhs_cover --out run.json\n  node src/cli.mjs evaluate --file run.json\n  node src/cli.mjs render --file run.json --out poster.svg\n  node src/cli.mjs compositions\n  node src/cli.mjs memory\n\nPlatforms: ${Object.keys(PLATFORM_PROFILES).join(", ")}`);
}

async function commandGenerate(args) {
  const imagePath = flag(args, "--image");
  if (imagePath) await fs.access(imagePath);
  const run = generateCandidates({
    prompt: flag(args, "--prompt"),
    goal: flag(args, "--goal"),
    tone: flag(args, "--tone"),
    subject: flag(args, "--subject"),
    headline: flag(args, "--headline"),
    subheadline: flag(args, "--subheadline"),
    cta: flag(args, "--cta", "了解更多"),
    removeElements: flag(args, "--remove"),
    addElements: flag(args, "--add"),
    platform: flag(args, "--platform", "xhs_cover"),
    mode: hasFlag(args, "--professional") ? "professional" : "automatic",
    imagePath
  });
  const out = flag(args, "--out");
  if (out) {
    await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
    await fs.writeFile(out, JSON.stringify(run, null, 2), "utf8");
  }
  console.log(JSON.stringify(hasFlag(args, "--full") ? run : summarizeRun(run), null, 2));
}

async function readDesign(file) {
  const parsed = JSON.parse(await fs.readFile(file, "utf8"));
  return parsed.candidates ? parsed.candidates.find(candidate => candidate.id === parsed.selectedId) ?? parsed.candidates[0] : parsed;
}

async function commandEvaluate(args) {
  const candidate = await readDesign(flag(args, "--file"));
  console.log(JSON.stringify(evaluateDesign(candidate), null, 2));
}

async function commandRender(args) {
  const candidate = await readDesign(flag(args, "--file"));
  const svg = renderSvg(candidate);
  const out = flag(args, "--out", "poster.svg");
  await fs.writeFile(out, svg, "utf8");
  console.log(JSON.stringify({ out: path.resolve(out), bytes: Buffer.byteLength(svg), candidateId: candidate.id }, null, 2));
}

const [command, ...args] = process.argv.slice(2);
try {
  if (!command || command === "help" || command === "--help") printHelp();
  else if (command === "generate") await commandGenerate(args);
  else if (command === "evaluate") await commandEvaluate(args);
  else if (command === "render") await commandRender(args);
  else if (command === "memory") commandMemory();
  else if (command === "compositions") commandCompositions();
  else throw new Error(`Unknown command: ${command}`);
} catch (error) {
  console.error(`poster-system: ${error.message}`);
  process.exitCode = 1;
}
