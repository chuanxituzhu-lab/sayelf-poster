import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(root, "../data");
const storePath = path.join(dataRoot, "online-inspiration-library.json");
const memoryPath = path.join(dataRoot, "award-learning-memory.json");

export const ONLINE_LIBRARY_LIMIT = 10;

const EMPTY_STORE = {
  schemaVersion: "online-inspiration-v0.1",
  limit: ONLINE_LIBRARY_LIMIT,
  items: []
};

async function readStore() {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...EMPTY_STORE,
      ...parsed,
      limit: ONLINE_LIBRARY_LIMIT,
      items: Array.isArray(parsed.items) ? parsed.items : []
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return structuredClone(EMPTY_STORE);
  }
}

async function writeStore(store) {
  await fs.mkdir(dataRoot, { recursive: true });
  const tempPath = `${storePath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, storePath);
}

async function readAwardMemory() {
  return JSON.parse(await fs.readFile(memoryPath, "utf8"));
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    const error = new Error("sourceUrl must be an http(s) URL");
    error.statusCode = 400;
    throw error;
  }
}

function now() {
  return new Date().toISOString();
}

function publicItem(item) {
  return { ...item };
}

export function buildAwardReferenceSeed(memory = {}) {
  const items = [];
  for (const source of memory.sources ?? []) {
    for (const [index, reference] of (source.referenceWorks ?? []).entries()) {
      if (!reference?.name) continue;
      items.push({
        id: `online-${source.id}-${index + 1}`,
        title: reference.name,
        referenceName: reference.name,
        authority: source.authority,
        region: source.region,
        category: reference.category ?? "Award reference",
        transfer: reference.transfer ?? "保留可迁移的创意机制，重新用于新的语境。",
        sourceId: source.id,
        sourceUrl: normalizeUrl(source.officialUrls?.[0]),
        sourceUrls: (source.officialUrls ?? []).map(normalizeUrl),
        sourceType: source.type,
        savedFrom: "award-learning-memory",
        memoryVersion: memory.memoryVersion ?? "unknown"
      });
    }
  }
  return items;
}

export async function listOnlineLibrary() {
  const store = await readStore();
  return {
    schemaVersion: store.schemaVersion,
    limit: ONLINE_LIBRARY_LIMIT,
    remaining: ONLINE_LIBRARY_LIMIT - store.items.length,
    items: store.items.map(publicItem)
  };
}

export async function seedAwardReferences() {
  const store = await readStore();
  const seeds = buildAwardReferenceSeed(await readAwardMemory());
  const existing = new Set(store.items.map(item => `${item.sourceId}:${item.referenceName}`));
  const additions = seeds
    .filter(item => !existing.has(`${item.sourceId}:${item.referenceName}`))
    .slice(0, Math.max(0, ONLINE_LIBRARY_LIMIT - store.items.length))
    .map(item => ({ ...item, createdAt: now(), updatedAt: now() }));
  if (additions.length) {
    store.items = [...additions.reverse(), ...store.items];
    await writeStore(store);
  }
  return { added: additions.length, ...(await listOnlineLibrary()) };
}

export async function saveOnlineReference({ title, sourceUrl, authority, region, category, transfer } = {}) {
  const store = await readStore();
  if (!String(title ?? "").trim()) {
    const error = new Error("title is required");
    error.statusCode = 400;
    throw error;
  }
  if (store.items.length >= ONLINE_LIBRARY_LIMIT) {
    const error = new Error(`线上灵感库已达到 ${ONLINE_LIBRARY_LIMIT} 张上限`);
    error.statusCode = 409;
    throw error;
  }
  const timestamp = now();
  const item = {
    id: `online-manual-${Date.now()}`,
    title: String(title).trim(),
    referenceName: String(title).trim(),
    authority: String(authority ?? "未标注来源").trim(),
    region: String(region ?? "unknown").trim(),
    category: String(category ?? "未分类").trim(),
    transfer: String(transfer ?? "保留可迁移的创意机制，重新用于新的语境。").trim(),
    sourceId: "manual",
    sourceUrl: normalizeUrl(sourceUrl),
    sourceUrls: [normalizeUrl(sourceUrl)],
    sourceType: "manual online reference",
    savedFrom: "manual",
    memoryVersion: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  store.items.unshift(item);
  await writeStore(store);
  return publicItem(item);
}

export async function deleteOnlineReference(id) {
  const store = await readStore();
  const index = store.items.findIndex(item => item.id === id);
  if (index < 0) return false;
  store.items.splice(index, 1);
  await writeStore(store);
  return true;
}
