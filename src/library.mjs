import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(root, "../data");
const storePath = path.join(dataRoot, "material-library.json");

export const LIBRARY_LIMIT = 20;
export const LIBRARY_CLASSIFICATIONS = {
  publishable: { id: "publishable", name: "可直接发布", description: "硬门槛通过，可作为稳定成片。" },
  refine: { id: "refine", name: "候选优化", description: "创意或执行有价值，保留用于下一轮迭代。" },
  experimental: { id: "experimental", name: "实验探索", description: "具有新机制或新风格，等待验证。" }
};

const EMPTY_STORE = {
  schemaVersion: "library-v0.5",
  limit: LIBRARY_LIMIT,
  items: [],
  evolutionLog: []
};

async function readStore() {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...EMPTY_STORE,
      ...parsed,
      limit: LIBRARY_LIMIT,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      evolutionLog: Array.isArray(parsed.evolutionLog) ? parsed.evolutionLog : []
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

function normalizeClassification(value) {
  return LIBRARY_CLASSIFICATIONS[value] ? value : "refine";
}

function cloneCandidate(candidate = {}) {
  const clone = structuredClone(candidate);
  if (clone.image) clone.image.dataUrl = "";
  return clone;
}

function negativeEntropy(candidate = {}) {
  const evaluation = candidate.evaluation ?? {};
  const fields = [
    candidate.subject?.id,
    candidate.targetPlatform?.id,
    candidate.mechanism?.id,
    candidate.style?.id,
    candidate.layout?.id,
    candidate.imageTreatment?.id,
    candidate.headline,
    candidate.subheadline,
    evaluation.awardComparison?.international?.score,
    evaluation.awardComparison?.china?.score
  ];
  const completeness = fields.filter(value => value !== undefined && value !== null && String(value).length > 0).length / fields.length;
  const gateCount = Array.isArray(evaluation.gates) ? evaluation.gates.length : 0;
  const passedGates = Array.isArray(evaluation.gates) ? evaluation.gates.filter(gate => gate.passed).length : 0;
  const gateOrder = gateCount ? passedGates / gateCount : 0;
  const orderScore = Math.round((completeness * 0.55 + gateOrder * 0.25 + (Math.max(0, evaluation.total ?? 0) / 100) * 0.2) * 100);
  return {
    modelVersion: "negative-entropy-v0.5",
    orderScore,
    entropy: 100 - orderScore,
    label: orderScore >= 85 ? "结构稳定，可复用" : orderScore >= 70 ? "结构已形成，继续优化" : "信息仍分散，需要整理",
    completeness: Math.round(completeness * 100),
    gateOrder: Math.round(gateOrder * 100)
  };
}

function buildItem({ candidate, classification, previewSvg, source = "generated" }) {
  const createdAt = new Date().toISOString();
  const evaluation = candidate.evaluation ?? {};
  return {
    id: `material-${candidate.id ?? Date.now()}`,
    title: candidate.headline || "Untitled poster",
    classification: normalizeClassification(classification),
    source,
    language: candidate.language ?? "zh",
    platform: {
      id: candidate.targetPlatform?.id ?? "unknown",
      name: candidate.targetPlatform?.name ?? "Unknown platform",
      ratio: candidate.targetPlatform?.ratio ?? "unknown"
    },
    subject: candidate.subject ?? null,
    imageInsight: candidate.imageInsight ?? null,
    style: candidate.style ?? null,
    mechanism: candidate.mechanism ?? null,
    imageTreatment: candidate.imageTreatment ?? null,
    typography: candidate.typography ?? null,
    evaluation: {
      total: evaluation.total ?? 0,
      publishScore: evaluation.publishScore ?? 0,
      creativeScore: evaluation.creativeScore ?? 0,
      attentionScore: evaluation.attentionScore ?? 0,
      level: evaluation.level ?? "未评估",
      hardGatePassed: Boolean(evaluation.hardGatePassed),
      awardComparison: evaluation.awardComparison ?? null
    },
    learning: candidate.learning ?? null,
    candidate: cloneCandidate(candidate),
    previewSvg: previewSvg ?? "",
    negativeEntropy: negativeEntropy(candidate),
    createdAt,
    updatedAt: createdAt,
    lastUsedAt: null,
    usageCount: 0
  };
}

function publicItem(item) {
  const { candidate, previewSvg, ...metadata } = item;
  return { ...metadata, hasPreview: Boolean(previewSvg) };
}

export async function listLibrary() {
  const store = await readStore();
  return {
    schemaVersion: store.schemaVersion,
    limit: LIBRARY_LIMIT,
    items: store.items.map(publicItem),
    evolution: summarizeEvolution(store)
  };
}

export async function getLibraryItem(id) {
  const store = await readStore();
  return store.items.find(item => item.id === id) ?? null;
}

export async function saveLibraryItem({ candidate, classification, previewSvg, source }) {
  if (!candidate || typeof candidate !== "object") throw new Error("candidate is required");
  const store = await readStore();
  const existingIndex = store.items.findIndex(item => item.id === `material-${candidate.id}`);
  if (existingIndex < 0 && store.items.length >= LIBRARY_LIMIT) {
    const error = new Error(`素材库已达到 ${LIBRARY_LIMIT} 张上限，请先删除或替换旧素材`);
    error.statusCode = 409;
    throw error;
  }
  const item = existingIndex >= 0 ? {
    ...store.items[existingIndex],
    classification: normalizeClassification(classification ?? store.items[existingIndex].classification),
    previewSvg: previewSvg || store.items[existingIndex].previewSvg,
    updatedAt: new Date().toISOString(),
    negativeEntropy: negativeEntropy(candidate),
    evaluation: buildItem({ candidate, classification, previewSvg }).evaluation,
    candidate: cloneCandidate(candidate)
  } : buildItem({ candidate, classification, previewSvg, source });
  if (existingIndex >= 0) store.items[existingIndex] = item;
  else store.items.unshift(item);
  store.evolutionLog.unshift({
    id: `evolution-${Date.now()}`,
    type: existingIndex >= 0 ? "material-updated" : "material-archived",
    materialId: item.id,
    at: item.updatedAt,
    observation: {
      platform: item.platform.id,
      mechanism: item.mechanism?.id ?? "unknown",
      awardScores: item.evaluation.awardComparison ? {
        international: item.evaluation.awardComparison.international.score,
        china: item.evaluation.awardComparison.china.score
      } : null,
      negativeEntropy: item.negativeEntropy.orderScore
    },
    nextAdjustment: item.evaluation.hardGatePassed ? "保留机制关系，下一轮替换对象或语境验证创新" : "优先修复未通过的硬门槛，再进入创意迭代"
  });
  store.evolutionLog = store.evolutionLog.slice(0, 50);
  await writeStore(store);
  return publicItem(item);
}

export async function deleteLibraryItem(id) {
  const store = await readStore();
  const index = store.items.findIndex(item => item.id === id);
  if (index < 0) return false;
  store.items.splice(index, 1);
  store.evolutionLog.unshift({ id: `evolution-${Date.now()}`, type: "material-removed", materialId: id, at: new Date().toISOString(), observation: null, nextAdjustment: "保持素材库在 20 张以内，优先保留高分且可迁移的机制" });
  store.evolutionLog = store.evolutionLog.slice(0, 50);
  await writeStore(store);
  return true;
}

export function summarizeEvolution(store) {
  const items = store.items ?? [];
  const average = key => items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.evaluation?.[key] ?? 0), 0) / items.length) : 0;
  const mechanisms = [...new Set(items.map(item => item.mechanism?.id).filter(Boolean))];
  const platforms = [...new Set(items.map(item => item.platform?.id).filter(Boolean))];
  const classificationCounts = Object.fromEntries(Object.keys(LIBRARY_CLASSIFICATIONS).map(key => [key, items.filter(item => item.classification === key).length]));
  const international = items.map(item => item.evaluation?.awardComparison?.international?.score).filter(Number.isFinite);
  const china = items.map(item => item.evaluation?.awardComparison?.china?.score).filter(Number.isFinite);
  const awardAverage = values => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const orderScore = items.length ? Math.round(items.reduce((sum, item) => sum + (item.negativeEntropy?.orderScore ?? 0), 0) / items.length) : 0;
  return {
    label: "负熵进化",
    principle: "把生成结果、评分、机制来源和下一步调整结构化沉淀，降低下一轮的不确定性。",
    itemCount: items.length,
    limit: LIBRARY_LIMIT,
    remaining: LIBRARY_LIMIT - items.length,
    classificationCounts,
    mechanismCount: mechanisms.length,
    platformCount: platforms.length,
    averageTotal: average("total"),
    averagePublishScore: average("publishScore"),
    averageInternationalAwardScore: awardAverage(international),
    averageChinaAwardScore: awardAverage(china),
    averageOrderScore: orderScore,
    latestEvents: (store.evolutionLog ?? []).slice(0, 5)
  };
}
