import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDesign, generateCandidates, renderSvg } from "../src/core.mjs";

test("generateCandidates returns three scored, publishable candidates", () => {
  const run = generateCandidates({ prompt: "为海边建筑旅居空间制作高级中文封面", platform: "xhs_cover" });
  assert.equal(run.candidates.length, 3);
  assert.equal(run.selectedId, run.candidates[0].id);
  assert.ok(run.analysis.subject.name.includes("建筑") || run.analysis.subject.name.includes("自然"));
  assert.ok(run.candidates.every(candidate => candidate.evaluation.hardGatePassed));
  assert.ok(run.candidates.every(candidate => candidate.evaluation.publishScore >= 78));
});

test("evaluateDesign fails the headline gate when the copy is too long", () => {
  const run = generateCandidates({ prompt: "产品新品宣传", platform: "xhs_cover" });
  const candidate = { ...run.candidates[0], headline: "这是一段明显超过缩略图阅读承载能力的超长中文标题" };
  const evaluation = evaluateDesign(candidate);
  assert.equal(evaluation.hardGatePassed, false);
  assert.equal(evaluation.gates.find(gate => gate.id === "headline-length").passed, false);
});

test("renderSvg produces a self-contained SVG with Chinese copy", () => {
  const run = generateCandidates({ prompt: "建筑展览海报", platform: "poster" });
  const svg = renderSvg(run.candidates[0]);
  assert.match(svg, /^<\?xml/);
  assert.match(svg, /<svg/);
  assert.match(svg, /建筑/);
  assert.doesNotMatch(svg, /活动海报|小红书封面|抖音竖屏封面/);
});

test("image treatment is part of the creative plan and honors explicit style requests", () => {
  const run = generateCandidates({ prompt: "把这张建筑图转成线描风格的中文海报", platform: "poster", removeElements: "路牌、杂物", addElements: "一束光" });
  assert.ok(run.candidates.some(candidate => candidate.imageTreatment.id === "line_art"));
  assert.ok(run.candidates.every(candidate => Array.isArray(candidate.imageEditPlan.operations) && candidate.imageEditPlan.operations.length > 0));
  assert.deepEqual(run.candidates[0].imageEditPlan.remove, ["路牌", "杂物"]);
  assert.deepEqual(run.candidates[0].imageEditPlan.add, ["一束光"]);
  const lineArt = run.candidates.find(candidate => candidate.imageTreatment.id === "line_art");
  assert.match(renderSvg(lineArt), /image-treatment/);
});

test("advertising blockbuster direction changes both style and image treatment", () => {
  const run = generateCandidates({ prompt: "为建筑项目做一张广告大片海报", tone: "广告大片", platform: "poster" });
  assert.ok(run.candidates.every(candidate => candidate.style.id === "cinematic"));
  assert.ok(run.candidates.some(candidate => candidate.imageTreatment.id === "cinematic"));
  assert.ok(run.candidates.some(candidate => candidate.mechanism.id === "cinematic-scale"));
});

test("award learning memory selects a transferable mechanism and exposes provenance", () => {
  const run = generateCandidates({ prompt: "把无障碍功能做成有情绪的中文广告海报", platform: "poster" });
  assert.equal(run.analysis.learning.memoryVersion, "0.5");
  assert.equal(run.analysis.learning.sourceCount, 4);
  assert.ok(run.analysis.learning.matchedMechanisms.some(item => item.id === "function-to-emotion"));
  assert.ok(run.candidates.every(candidate => candidate.mechanism.id === "function-to-emotion"));
  assert.equal(run.candidates[0].evaluation.scores.learningAlignment, 8);
});

test("platform rules shape the canvas and attention gate", () => {
  const run = generateCandidates({ prompt: "3个方法，让你的作品更有记忆点", platform: "douyin_cover" });
  assert.equal(run.analysis.platform.ratio, "9:16");
  assert.equal(run.analysis.platform.width, 1080);
  assert.equal(run.analysis.platformRule.ruleStatus, "official-share-constraints-plus-vertical-preset");
  assert.ok(run.candidates.every(candidate => candidate.evaluation.attentionScore >= 5));
  assert.ok(run.candidates.every(candidate => candidate.evaluation.gates.find(gate => gate.id === "attention-hook")?.passed));
  assert.ok(run.candidates.every(candidate => candidate.evaluation.total <= 100));
});

test("wechat header keeps the operational preset honest", () => {
  const run = generateCandidates({ prompt: "一篇关于建筑与自然的深度文章", platform: "wechat_header" });
  assert.deepEqual([run.analysis.platform.width, run.analysis.platform.height], [900, 383]);
  assert.equal(run.analysis.platformRule.format.verified, false);
  assert.match(run.analysis.platformRule.ruleStatusLabel, /运营预设/);
});

test("generic prompts default to concept before visual style", () => {
  const run = generateCandidates({ prompt: "做一张让作品更有记忆点的中文封面", platform: "xhs_cover" });
  assert.equal(run.analysis.mechanism.id, "concept-before-decoration");
});

test("English mode uses overseas platform dimensions and award bridge", () => {
  const run = generateCandidates({ prompt: "Create a cinematic architecture thumbnail for a global audience", language: "en", platform: "youtube_thumbnail" });
  assert.equal(run.analysis.language, "en");
  assert.equal(run.analysis.platform.ratio, "16:9");
  assert.equal(run.analysis.platformRule.format.verified, true);
  assert.match(run.candidates[0].headline, /[A-Za-z]/);
  assert.match(run.candidates[0].cta, /Learn more/);
  assert.ok(run.candidates.every(candidate => candidate.evaluation.awardComparison.international.score >= 0));
  assert.ok(run.candidates.every(candidate => candidate.evaluation.awardComparison.china.score >= 0));
});

test("Pinterest and LinkedIn profiles stay explicit about official format status", () => {
  const pinterest = generateCandidates({ prompt: "A saveable travel guide", language: "en", platform: "pinterest_pin" });
  const linkedin = generateCandidates({ prompt: "A data-led brand case study", language: "en", platform: "linkedin_post" });
  assert.equal(pinterest.analysis.platformRule.format.verified, true);
  assert.equal(pinterest.analysis.platform.width, 1000);
  assert.equal(linkedin.analysis.platformRule.format.verified, true);
  assert.equal(linkedin.analysis.platform.height, 627);
});

test("typography fit adapts to language, platform and award bridge", () => {
  const run = generateCandidates({ prompt: "Create a cinematic architecture thumbnail for a global audience", language: "en", platform: "youtube_thumbnail" });
  const candidate = run.candidates[0];
  assert.equal(candidate.typography.language, "en");
  assert.ok(candidate.typography.fontFamily.length > 0);
  assert.ok(candidate.typography.headlineFontSize > 0);
  assert.ok(candidate.typography.contrastRatio >= 4.5);
  assert.equal(candidate.evaluation.typographyScore, candidate.typography.score);
  assert.ok(candidate.evaluation.awardComparison.dimensions.typography >= 0);
});

test("professional typography override is recalculated before the readability gate", () => {
  const run = generateCandidates({ prompt: "建筑展览海报", platform: "poster" });
  const candidate = {
    ...run.candidates[0],
    typography: {
      ...run.candidates[0].typography,
      automatic: false,
      headlineColor: "#777777",
      backgroundColor: "#ffffff",
      letterSpacing: -6,
      letterSpacingCss: "-6px"
    }
  };
  const evaluation = evaluateDesign(candidate);
  assert.equal(evaluation.typography.contrastRatio, 4.48);
  assert.equal(evaluation.gates.find(gate => gate.id === "typography-readable").passed, false);
});

test("image insight distills the core point and prompt overrides conflicting visual analysis", () => {
  const run = generateCandidates({
    prompt: "为海边建筑做封面，核心观点：住进风景，而不是逃离生活",
    platform: "poster",
    imageFeatures: {
      subject: "海边建筑",
      corePoint: "不要错过这栋房子",
      visualSignals: { lighting: "dark", palette: "cool", contrast: "high" }
    }
  });
  assert.equal(run.analysis.imageInsight.source, "prompt-directed");
  assert.equal(run.analysis.imageInsight.corePoint, "住进风景，而不是逃离生活");
  assert.ok(run.analysis.imageInsight.evidence.includes("Prompt 核心表达优先"));
  assert.equal(run.analysis.imageFeatures.visualSignals.palette, "cool");
  assert.equal(run.candidates[0].headline, "住进风景");
  assert.equal(run.candidates[0].subheadline, "住进风景，而不是逃离生活");
});

test("English image insight stays in English when Prompt has no explicit headline", () => {
  const run = generateCandidates({
    prompt: "Create an architecture image for a calm coastal retreat",
    language: "en",
    platform: "youtube_thumbnail"
  });
  assert.match(run.analysis.imageInsight.corePoint, /[A-Za-z]/);
  assert.match(run.candidates[0].headline, /[A-Za-z]/);
});

test("assistant mechanism is accepted while Prompt still owns the core point", () => {
  const run = generateCandidates({
    prompt: "为海边建筑做封面，核心观点：住进风景，而不是逃离生活",
    platform: "poster",
    aiAnalysis: {
      corePoint: "AI 建议的另一条观点",
      mechanismId: "scene-desire",
      headlineVariants: ["AI 标题", "AI 备选", "AI 第三版"]
    },
    aiProvider: { id: "codex", name: "Codex", mode: "assistant", status: "used" }
  });
  assert.equal(run.analysis.aiProvider.id, "codex");
  assert.equal(run.analysis.mechanism.id, "scene-desire");
  assert.equal(run.analysis.imageInsight.corePoint, "住进风景，而不是逃离生活");
  assert.equal(run.candidates[0].headline, "住进风景");
});
