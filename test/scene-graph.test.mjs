import test from "node:test";
import assert from "node:assert/strict";
import { applyDesignCommand, generateCandidates, inspectDesignContext } from "../src/core.mjs";

function candidate() {
  return generateCandidates({ prompt: "广告大片海边建筑海报", platform: "poster" }).candidates[0];
}

test("generated candidates carry semantic scene-graph nodes", () => {
  const item = candidate();
  assert.equal(item.sceneGraph.version, "0.1");
  assert.deepEqual(item.sceneGraph.nodes.map(node => node.id), ["image", "background", "shade", "rule", "kicker", "headline", "subheadline", "mechanism", "cta"]);
  assert.equal(item.sceneGraph.commandPolicy, "click_is_read_only_command_is_mutating");
});

test("inspectDesignContext is read-only and returns safe commands", () => {
  const item = candidate();
  const before = JSON.stringify(item);
  const context = inspectDesignContext(item, "headline");
  assert.equal(context.selection.id, "headline");
  assert.equal(context.selection.editable, true);
  assert.ok(context.selection.supportedCommands.includes("set_text"));
  assert.equal(JSON.stringify(item), before);
});

test("natural-language session commands update copy and re-score", () => {
  const item = candidate();
  const result = applyDesignCommand(item, "把标题改成“住进风景里”", { source: "test" });
  assert.equal(result.command.type, "set_text");
  assert.equal(result.candidate.headline, "住进风景里");
  assert.equal(result.candidate.editHistory.at(-1).source, "test");
  assert.equal(result.candidate.sceneGraph.nodes.find(node => node.id === "headline").content.text, "住进风景里");
});

test("session commands can unify visible typography to matte gold", () => {
  const result = applyDesignCommand(candidate(), "把字体改成哑金色");
  assert.equal(result.candidate.typography.headlineColor, "#c4a46a");
  assert.equal(result.candidate.typography.secondaryColor, "#c4a46a");
  assert.equal(result.candidate.typography.accentColor, "#c4a46a");
  assert.equal(result.candidate.sceneGraph.nodes.find(node => node.id === "cta").style.color, "#c4a46a");
});

test("image treatment and layout commands stay inside the allow-list", () => {
  const transformed = applyDesignCommand(candidate(), { type: "set_image_treatment", treatmentId: "line_art" });
  assert.equal(transformed.candidate.imageTreatment.id, "line_art");
  const centered = applyDesignCommand(transformed.candidate, { type: "set_layout", patch: { alignment: "center" } });
  assert.equal(centered.candidate.layout.alignment, "center");
  assert.equal(centered.candidate.composition.regions.headline.anchor, "middle");
  assert.equal(centered.candidate.evaluation.hardGatePassed, true);
});

test("unsafe typography values are rejected by the command gate", () => {
  assert.throws(() => applyDesignCommand(candidate(), { type: "set_typography", patch: { headlineColor: "red; color: white" } }), /六位十六进制/);
});
