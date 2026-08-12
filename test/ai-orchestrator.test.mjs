import assert from "node:assert/strict";
import test from "node:test";
import { detectProviders, normalizeAssistantResult, normalizeSessionResult, prepareGeneration, prepareSessionCommand } from "../src/ai-orchestrator.mjs";

test("assistant results normalize common bridge response shapes", () => {
  const result = normalizeAssistantResult({
    analysis: {
      corePoint: "让空间成为人与自然的入口",
      mechanismId: "scene-desire",
      headlineVariants: ["进入自然", "住进风景"]
    }
  });
  assert.equal(result.corePoint, "让空间成为人与自然的入口");
  assert.equal(result.mechanismId, "scene-desire");
  assert.deepEqual(result.headlineVariants, ["进入自然", "住进风景"]);
});

test("local mode is always available without an assistant platform", async () => {
  const providers = await detectProviders({ assistantProvider: "local" });
  const prepared = await prepareGeneration({ prompt: "建筑海报", assistantProvider: "local" });
  assert.equal(providers.selected, "local-rules");
  assert.equal(prepared.aiProvider.id, "local-rules");
  assert.equal(prepared.aiProvider.status, "local");
  assert.equal(prepared.aiAnalysis, undefined);
});

test("session commands return a safe design patch without changing state on selection", async () => {
  const normalized = normalizeSessionResult({ message: "调整完成", patch: { headline: "进入风景", imageTreatmentId: "line_art" } });
  assert.deepEqual(normalized.patch, { headline: "进入风景", imageTreatment: { id: "line_art" } });
  const local = await prepareSessionCommand({
    assistantProvider: "local",
    instruction: "主标题改为：进入风景，画面改成线描",
    selection: { target: "headline", text: "旧标题" },
    candidate: { headline: "旧标题" }
  });
  assert.equal(local.patch.headline, "进入风景");
  assert.equal(local.patch.imageTreatment.id, "line_art");
});
