const state = { run: null, selected: null, imageDataUrl: "", imageFeatures: {}, library: null, aiProviders: null, designSelection: null };

const $ = selector => document.querySelector(selector);
const form = $("#generate-form");
const promptInput = $("#prompt");
const imageInput = $("#image");
const platformInput = $("#platform");
const toneInput = $("#tone");
const languageInput = $("#language");
const professionalInput = $("#professional");
const TREATMENT_META = {
  original: { name: "保留原图", description: "保留摄影质感，只优化明暗与文字安全区。", operations: ["保留主体", "微调明暗", "预留安全区"] },
  enhance: { name: "主体增强", description: "增强主体与背景层次，让缩略图更醒目。", operations: ["提升对比", "压低干扰", "强化焦点"] },
  duotone: { name: "双色叙事", description: "收束颜色，形成更明确的广告气质。", operations: ["限制色彩", "保留层次", "统一色调"] },
  line_art: { name: "线描转译", description: "提取主体轮廓，转为轻量的线描表达。", operations: ["提取轮廓", "降低纹理", "保留识别度"] },
  comic: { name: "漫画风格", description: "增强边缘与色块关系，让画面更有传播力。", operations: ["增强边缘", "分离色块", "提升色彩"] },
  simple_illustration: { name: "简笔插画", description: "简化细节、统一色块，保留主体轮廓。", operations: ["简化细节", "统一色块", "保留轮廓"] },
  monochrome: { name: "单色印刷", description: "用单色和印刷感建立克制的编辑气质。", operations: ["转为单色", "保留明暗", "加入颗粒感"] },
  cinematic: { name: "电影级调色", description: "压暗环境、强化高光并制造冷暖分离，形成广告大片的镜头感。", operations: ["压暗背景", "强化高光", "冷暖分离", "保留主体"] }
};
const TYPE_PRESETS = {
  editorial: { name: "编辑无衬线", zh: "'Noto Sans SC', 'Microsoft YaHei', Arial, sans-serif", en: "Inter, 'Helvetica Neue', Arial, sans-serif", weight: 700, lineHeight: 1.04 },
  cinematic: { name: "电影窄体", zh: "'Microsoft YaHei', 'Noto Sans SC', Arial, sans-serif", en: "'Arial Narrow', 'Helvetica Neue', Arial, sans-serif", weight: 800, lineHeight: .96 },
  commercial: { name: "商业粗体", zh: "'Noto Sans SC', 'Microsoft YaHei', Arial, sans-serif", en: "Arial, 'Helvetica Neue', sans-serif", weight: 800, lineHeight: 1.02 },
  lifestyle: { name: "生活方式衬线", zh: "'Noto Serif SC', 'Songti SC', SimSun, serif", en: "Georgia, 'Times New Roman', serif", weight: 700, lineHeight: 1.08 },
  experimental: { name: "实验展示体", zh: "'Microsoft YaHei', 'Noto Sans SC', Arial, sans-serif", en: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif", weight: 800, lineHeight: .92 },
  mono: { name: "信息等宽体", zh: "'Noto Sans Mono CJK SC', Consolas, monospace", en: "'IBM Plex Mono', Consolas, monospace", weight: 700, lineHeight: 1.05 }
};

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function setStatus(message) { $("#status").textContent = message; }

function renderAiStatus(providerState) {
  const element = $("#ai-status");
  if (!element) return;
  const sessionProvider = $("#session-provider");
  const providers = providerState?.providers ?? [];
  const selected = providers.find(provider => provider.id === providerState?.selected);
  const detected = providers.find(provider => provider.id !== "local-rules" && provider.detected);
  if (selected?.id === "local-rules") {
    if (sessionProvider) sessionProvider.textContent = "本地规则";
    element.className = detected ? "ai-status fallback" : "ai-status";
    element.textContent = detected
      ? "智能协助：已发现 " + detected.name + "，桥接未配置 · 当前使用本地规则"
      : "智能协助：未检测到已授权平台 · 当前使用本地规则";
  } else if (selected?.controlReady) {
    if (sessionProvider) sessionProvider.textContent = selected.name;
    element.className = "ai-status ready";
    element.textContent = "智能协助：" + selected.name + " · 已接入，生成时自动调用";
  }
}

async function loadAiProviders() {
  try {
    const response = await fetch("/api/ai/providers");
    state.aiProviders = await response.json();
    renderAiStatus(state.aiProviders);
  } catch {
    renderAiStatus(null);
  }
}

function appendSessionMessage(kind, message) {
  const log = $("#session-log");
  if (!log) return;
  const item = document.createElement("div");
  item.className = "session-message " + kind;
  item.textContent = message;
  log.appendChild(item);
  log.scrollTop = log.scrollHeight;
}

function renderDesignSelection() {
  if (!state.designSelection) return;
  $("#session-selection").textContent = "已选择：" + state.designSelection.label + " · " + state.designSelection.text + "（点击只反馈，不修改）";
}

function reportDesignSelection(target) {
  if (!state.selected) return;
  const targetType = target.dataset.designTarget;
  const labels = { image: "图片画面", headline: "主标题", subheadline: "副标题", footer: "行动入口与机制" };
  const text = targetType === "headline"
    ? state.selected.headline
    : targetType === "subheadline"
      ? state.selected.subheadline
      : targetType === "footer"
        ? state.selected.cta
        : state.selected.imageTreatment?.name ?? "当前主视觉";
  const label = labels[targetType] ?? "设计对象";
  state.designSelection = { target: targetType, label, text, candidateId: state.selected.id };
  renderDesignSelection();
  appendSessionMessage("system", "已反馈选择：" + label + "。现在可在会话栏输入修改指令。");
}

function mergeSessionPatch(candidate, patch = {}) {
  const next = { ...candidate };
  if (patch.headline) next.headline = patch.headline;
  if (patch.subheadline) next.subheadline = patch.subheadline;
  if (patch.cta) next.cta = patch.cta;
  if (patch.imageTreatment?.id) {
    const meta = TREATMENT_META[patch.imageTreatment.id] ?? {};
    next.imageTreatment = { ...(candidate.imageTreatment ?? {}), ...meta, ...patch.imageTreatment, automatic: false };
    next.imageEditPlan = {
      ...(candidate.imageEditPlan ?? {}),
      transform: next.imageTreatment,
      operations: next.imageTreatment.operations ?? candidate.imageEditPlan?.operations ?? []
    };
  }
  if (patch.imageEditPlan) {
    next.imageEditPlan = { ...(next.imageEditPlan ?? {}), ...patch.imageEditPlan };
    if (next.imageTreatment) {
      next.imageEditPlan.transform = next.imageTreatment;
      next.imageEditPlan.operations = next.imageTreatment.operations ?? next.imageEditPlan.operations ?? [];
    }
  }
  if (patch.typography) next.typography = { ...(candidate.typography ?? {}), ...patch.typography, automatic: false };
  return next;
}

async function applySessionPatch(patch) {
  const candidate = mergeSessionPatch(state.selected, patch);
  const response = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ candidate })
  });
  const evaluation = await response.json();
  if (!response.ok) throw new Error(evaluation.error || "修改后评分失败");
  candidate.evaluation = evaluation;
  candidate.typography = evaluation.typography ?? candidate.typography;
  const index = state.run.candidates.findIndex(item => item.id === candidate.id);
  if (index >= 0) state.run.candidates[index] = candidate;
  state.selected = candidate;
  if (state.designSelection?.candidateId === candidate.id) {
    if (state.designSelection.target === "headline") state.designSelection.text = candidate.headline;
    if (state.designSelection.target === "subheadline") state.designSelection.text = candidate.subheadline;
    if (state.designSelection.target === "footer") state.designSelection.text = candidate.cta;
    renderDesignSelection();
  }
  renderRun();
}

function updateModeHint() {
  $("#mode-hint").textContent = professionalInput.checked ? "专业模式 · 可编辑标题、文案与设计状态" : "自动模式 · 以直接发布为优先";
  $("#edit-panel").classList.toggle("hidden", !professionalInput.checked || !state.selected);
}

function sampleImageVisuals(image) {
  const canvas = document.createElement("canvas");
  const size = 24;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, size, size);

  const pixels = context.getImageData(0, 0, size, size).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let luminance = 0;
  let minimumLuminance = 1;
  let maximumLuminance = 0;
  let warmth = 0;
  let saturation = 0;
  let leftLuminance = 0;
  let rightLuminance = 0;
  const pixelCount = pixels.length / 4;

  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index] / 255;
    const g = pixels[index + 1] / 255;
    const b = pixels[index + 2] / 255;
    const pixelLuminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const column = (index / 4) % size;

    red += r;
    green += g;
    blue += b;
    luminance += pixelLuminance;
    minimumLuminance = Math.min(minimumLuminance, pixelLuminance);
    maximumLuminance = Math.max(maximumLuminance, pixelLuminance);
    warmth += r - b;
    saturation += maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;
    if (column < size / 2) leftLuminance += pixelLuminance;
    else rightLuminance += pixelLuminance;
  }

  const averageLuminance = luminance / pixelCount;
  const averageWarmth = warmth / pixelCount;
  const averageSaturation = saturation / pixelCount;
  const contrast = maximumLuminance - minimumLuminance;
  const textSide = leftLuminance <= rightLuminance ? "left" : "right";
  const averageColor = [red, green, blue]
    .map(channel => Math.round((channel / pixelCount) * 255).toString(16).padStart(2, "0"))
    .join("");

  return {
    subject: "",
    dominantColor: "#" + averageColor,
    aspectRatio: String(image.naturalWidth) + ":" + String(image.naturalHeight),
    safeTextRegion: textSide === "left" ? "左侧相对较暗，适合主标题" : "右侧相对较暗，适合主标题",
    visualSignals: {
      lighting: averageLuminance < 0.32 ? "dark" : averageLuminance > 0.68 ? "bright" : "balanced",
      palette: averageWarmth > 0.06 ? "warm" : averageWarmth < -0.06 ? "cool" : "neutral",
      contrast: contrast > 0.42 ? "high" : contrast < 0.2 ? "soft" : "medium",
      saturation: averageSaturation > 0.5 ? "vivid" : "restrained",
      textSide
    }
  };
}

function analyzeImage(file) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      resolve(sampleImageVisuals(image));
      return;
    };
    image.src = URL.createObjectURL(file);
  });
}

imageInput.addEventListener("change", async () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  state.imageDataUrl = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); });
  state.imageFeatures = await analyzeImage(file);
  $("#image-name").textContent = `${file.name} · ${Math.round(file.size / 1024)} KB`;
  setStatus("图片已分析，等待生成");
});

professionalInput.addEventListener("change", updateModeHint);

form.addEventListener("submit", async event => {
  event.preventDefault();
  setStatus("正在分析内容、匹配创意机制并筛选候选…");
  try {
    const response = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: promptInput.value, tone: toneInput.value, language: languageInput.value, platform: platformInput.value, mode: professionalInput.checked ? "professional" : "automatic", imageDataUrl: state.imageDataUrl, imageFeatures: state.imageFeatures }) });
    const run = await response.json();
    if (!response.ok) throw new Error(run.error || "生成失败");
    state.run = run;
    state.selected = run.candidates[0];
    renderRun();
    setStatus("已生成 3 个候选，推荐方案可直接发布");
  } catch (error) {
    setStatus(`生成失败：${error.message}`);
  }
});

function renderRun() {
  const { run, selected } = state;
  $("#preview-empty").classList.add("hidden");
  $("#poster-preview").classList.remove("hidden");
  $("#preview-caption").classList.remove("hidden");
  $("#canvas-size").textContent = `${run.analysis.platform.name} · ${run.analysis.platform.ratio}`;
  $("#candidate-count").textContent = `${run.candidates.indexOf(selected) + 1} / ${run.candidates.length}`;
  const selectedIndex = run.candidates.indexOf(selected);
  $("#library-classification").value = selectedIndex === 0 && selected.evaluation.hardGatePassed ? "publishable" : selectedIndex === 2 ? "experimental" : "refine";
  $("#analysis").className = "analysis";
  const learning = run.analysis.learning;
  const insight = run.analysis.imageInsight;
  const aiProvider = run.analysis.aiProvider;
  if (aiProvider?.status === "used") {
    $("#ai-status").className = "ai-status ready";
    $("#ai-status").textContent = "智能协助：" + aiProvider.name + " · 已自动调用并参与观点提炼";
  } else if (aiProvider?.status === "fallback") {
    $("#ai-status").className = "ai-status fallback";
    $("#ai-status").textContent = "智能协助：" + aiProvider.name + " · 调用失败，已降级本地规则";
  }
  $("#image-insight").innerHTML = insight
    ? "<strong>IMAGE INSIGHT · 核心观点</strong>" + escapeHtml(insight.corePoint) + "<br><span class=\"file-note\">" + escapeHtml(insight.rationale) + "</span>"
    : "";
  const learningText = learning ? `奖项学习记忆 ${escapeHtml(learning.memoryVersion)} · ${learning.sourceCount} 个权威来源 · 命中：${escapeHtml(learning.matchedMechanisms?.map(item => item.name).join("、") || "通用创意机制")}` : "";
  const platformRule = run.analysis.platformRule;
  const platformText = platformRule ? `平台规则：${platformRule.platform} · ${platformRule.ruleStatusLabel ?? platformRule.ruleStatus}` : "";
  $("#analysis").innerHTML = `<strong>${escapeHtml(run.analysis.subject.name)}</strong><br>${escapeHtml(run.analysis.rationale)}<br><span class="file-note">安全区域：${escapeHtml(run.analysis.imageFeatures.safeTextRegion)}</span>${platformText ? `<br><span class="file-note">${escapeHtml(platformText)}</span>` : ""}${learningText ? `<br><span class="file-note">${learningText}</span>` : ""}`;
  $("#candidate-list").innerHTML = run.candidates.map((candidate, index) => `<button class="candidate-item ${candidate.id === selected.id ? "active" : ""}" data-id="${candidate.id}"><span class="candidate-top"><span>${index === 0 ? "推荐发布" : index === 1 ? "稳妥传播" : "个性创意"}</span><span>${candidate.evaluation.level}</span></span><strong>${escapeHtml(candidate.headline)}</strong><small>${escapeHtml(candidate.style.name)} · ${escapeHtml(candidate.mechanism.name)} · 发布分 ${candidate.evaluation.publishScore}</small></button>`).join("");
  document.querySelectorAll(".candidate-item").forEach(item => item.addEventListener("click", () => { state.selected = run.candidates.find(candidate => candidate.id === item.dataset.id); renderRun(); }));
  renderPreview(selected);
  bindPreviewTargets();
  applyTypographyVars(selected);
  renderReview(selected);
  $("#review-panel").classList.remove("hidden");
  $("#edit-headline").value = selected.headline;
  $("#edit-subheadline").value = selected.subheadline;
  $("#edit-remove").value = (selected.imageEditPlan?.remove ?? []).join("、");
  $("#edit-add").value = (selected.imageEditPlan?.add ?? []).join("、");
  $("#edit-treatment").value = selected.imageTreatment?.id ?? "original";
  const typography = selected.typography ?? {};
  $("#edit-font-preset").value = typography.preset ?? "auto";
  $("#edit-font-color").value = /^#[0-9a-f]{6}$/i.test(typography.headlineColor ?? "") ? typography.headlineColor : selected.style.text;
  $("#edit-font-size").value = typography.headlineFontSize ?? 64;
  $("#edit-font-size-value").textContent = String(typography.headlineFontSize ?? 64) + "px";
  $("#edit-letter-spacing").value = typography.letterSpacing ?? -2;
  $("#edit-letter-spacing-value").textContent = String(typography.letterSpacing ?? -2) + "px";
  updateModeHint();
}

function renderPreview(candidate) {
  const style = candidate.style;
  const treatment = candidate.imageTreatment ?? TREATMENT_META.original;
  const treatmentId = treatment.id ?? "original";
  const imageLayer = candidate.image?.dataUrl ? `<div class="poster-image-layer treatment-${escapeHtml(treatmentId)}" style="background-image:url(${candidate.image.dataUrl})"></div>` : "";
  $("#poster-preview").innerHTML = `<div class="poster-art theme-${escapeHtml(treatmentId)} ${candidate.image?.dataUrl ? "has-image" : ""}" style="--ratio:${candidate.targetPlatform.ratio.replace(":", "/")};--background:${style.background};--surface:${style.surface};--text:${style.text};--accent:${style.accent};--secondary:${style.secondary};">${imageLayer}<div class="poster-shade"></div><div class="poster-copy"><div class="poster-rule"></div><div class="poster-kicker">${escapeHtml(candidate.subject.name)}</div><div class="poster-headline">${escapeHtml(candidate.headline)}</div><div class="poster-sub">${escapeHtml(candidate.subheadline)}</div><div class="poster-footer"><span>${escapeHtml(candidate.mechanism.name)}</span><span class="poster-cta">${escapeHtml(candidate.cta)}</span></div></div></div>`;
  $("#preview-caption").textContent = `${candidate.style.name} / ${candidate.mechanism.name} / ${treatment.name ?? TREATMENT_META[treatmentId]?.name ?? "画面处理"} · ${candidate.rationale}`;
}

function bindPreviewTargets() {
  const posterArt = $(".poster-art");
  if (!posterArt) return;
  posterArt.dataset.designTarget = "image";
  posterArt.querySelector(".poster-headline").dataset.designTarget = "headline";
  posterArt.querySelector(".poster-sub").dataset.designTarget = "subheadline";
  posterArt.querySelector(".poster-footer").dataset.designTarget = "footer";
}

function applyTypographyVars(candidate) {
  const typography = candidate.typography ?? {};
  const posterArt = $(".poster-art");
  if (!posterArt) return;
  const variables = {
    "--headline-font": typography.fontFamily ?? candidate.style.font,
    "--headline-weight": typography.fontWeight ?? 800,
    "--headline-size": String(typography.previewHeadlineSize ?? 56) + "px",
    "--headline-line": typography.lineHeight ?? 1.06,
    "--headline-tracking": typography.letterSpacingCss ?? "-2px",
    "--headline-color": typography.headlineColor ?? candidate.style.text,
    "--secondary-color": typography.secondaryColor ?? candidate.style.secondary,
    "--accent-color": typography.accentColor ?? candidate.style.accent,
    "--kicker-size": String(typography.kickerFontSize ?? 13) + "px",
    "--sub-size": String(typography.subheadlineFontSize ?? 18) + "px",
    "--copy-align": typography.alignment ?? "left"
  };
  Object.entries(variables).forEach(([property, value]) => posterArt.style.setProperty(property, value));
}

function renderReview(candidate) {
  const evaluation = candidate.evaluation;
  const treatment = candidate.imageTreatment ?? TREATMENT_META.original;
  const treatmentMeta = TREATMENT_META[treatment.id] ?? treatment;
  const editPlan = candidate.imageEditPlan ?? {};
  const typography = evaluation.typography ?? candidate.typography;
  $("#total-score").textContent = `${evaluation.total}`;
  const removeText = (editPlan.remove ?? []).join("、") || "无";
  const addText = (editPlan.add ?? []).join("、") || "无";
  $("#image-treatment").innerHTML = `<div class="treatment-heading"><span>IMAGE TREATMENT</span><strong>${escapeHtml(treatmentMeta.name ?? "保留原图")}</strong></div><p>${escapeHtml(treatment.description ?? treatmentMeta.description ?? "按传播需求处理图片画面。")}</p><div class="treatment-ops">${(treatment.operations ?? treatmentMeta.operations ?? []).map(operation => `<span>${escapeHtml(operation)}</span>`).join("")}</div><div class="treatment-plan"><div><b>移除</b>${escapeHtml(removeText)}</div><div><b>增加</b>${escapeHtml(addText)}</div></div>`;
  $("#typography-review").innerHTML = typography ? "<div class=\"type-heading\"><span>TYPE FIT · " + escapeHtml(typography.presetName ?? "自动匹配") + "</span><strong>" + String(typography.score ?? 0) + "/100</strong></div><p>" + escapeHtml(typography.rationale ?? "字体与整体画面、平台安全区和阅读路径自动匹配。") + "</p><div class=\"type-meta\"><span>" + escapeHtml(typography.fontFamily ?? "系统字体") + "</span><span>" + String(typography.headlineFontSize ?? "—") + "px · 字距 " + escapeHtml(typography.letterSpacingCss ?? "—") + " · 对比 " + String(typography.contrastRatio ?? "—") + ":1</span></div><div class=\"treatment-ops\">" + (typography.signals ?? []).map(signal => "<span>" + escapeHtml(signal) + "</span>").join("") + "</div>" : "";
  const scoreLabels = { taskFit: "任务适配", creative: "创意机制", differentiation: "记忆差异", craft: "视觉执行", localization: candidate.language === "en" ? "English context" : "中文语境", effectiveness: "传播可用", learningAlignment: "奖项迁移" };
  const scoreMax = { taskFit: 15, creative: 25, differentiation: 15, craft: 20, localization: 10, effectiveness: 15, learningAlignment: 8 };
  $("#score-list").innerHTML = Object.entries(evaluation.scores).map(([key, value]) => `<div class="score-row"><span>${scoreLabels[key] ?? key}</span><b>${value}</b><div class="bar"><i style="width:${Math.min(100, value / scoreMax[key] * 100)}%"></i></div></div>`).join("");
  const bridge = evaluation.awardComparison;
  $("#award-bridge").innerHTML = bridge ? `<div class="award-heading"><span>AWARD BRIDGE · ${escapeHtml(bridge.modelVersion)}</span><b>创新 ${bridge.innovationIndex}</b></div><div class="award-score-row"><span>${escapeHtml(bridge.international.label)}</span><strong>${bridge.international.score}</strong><small>${escapeHtml(bridge.international.readiness)}</small></div><div class="award-score-row"><span>${escapeHtml(bridge.china.label)}</span><strong>${bridge.china.score}</strong><small>${escapeHtml(bridge.china.readiness)}</small></div><div class="file-note">内部启发式对标，不等同于真实评委评分。</div>` : "";
  $("#gate-list").innerHTML = evaluation.gates.map(gate => `<div class="gate ${gate.passed ? "ok" : ""}">${escapeHtml(gate.label)}</div>`).join("");
  $("#review-note").textContent = `${evaluation.recommendation} · 发布分 ${evaluation.publishScore} · 创意分 ${evaluation.creativeScore} · 吸睛分 ${evaluation.attentionScore}/10`;
}

$("#poster-preview").addEventListener("click", event => {
  const target = event.target.closest("[data-design-target]");
  if (!target) return;
  reportDesignSelection(target);
});
$("#image-treatment").addEventListener("click", () => reportDesignSelection({ dataset: { designTarget: "image" } }));
$("#typography-review").addEventListener("click", () => reportDesignSelection({ dataset: { designTarget: "headline" } }));

$("#session-form").addEventListener("submit", async event => {
  event.preventDefault();
  const instruction = $("#session-command").value.trim();
  if (!instruction) return setStatus("请先输入会话文字指令");
  if (!state.selected) return setStatus("请先生成并选择一个候选方案");
  appendSessionMessage("user", instruction);
  $("#session-command").value = "";
  const submit = event.submitter;
  if (submit) submit.disabled = true;
  setStatus("会话栏正在分析修改意图…");
  try {
    const response = await fetch("/api/session/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        instruction,
        selection: state.designSelection,
        candidate: state.selected,
        assistantProvider: state.aiProviders?.selected ?? "auto"
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "会话指令失败");
    if (result.aiProvider?.name) $("#session-provider").textContent = result.aiProvider.status === "fallback" ? result.aiProvider.name + " → 本地规则" : result.aiProvider.name;
    appendSessionMessage("assistant", result.message || "已完成分析。");
    if (Object.keys(result.patch ?? {}).length) {
      await applySessionPatch(result.patch);
      setStatus("会话修改已应用，并已重新评分");
    } else {
      setStatus("会话已反馈，但没有应用修改");
    }
  } catch (error) {
    appendSessionMessage("assistant", "修改未应用：" + error.message);
    setStatus("会话修改失败：" + error.message);
  } finally {
    if (submit) submit.disabled = false;
  }
});

$("#download-svg").addEventListener("click", async () => {
  if (!state.selected) return;
  const response = await fetch("/api/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidate: state.selected }) });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.selected.id}.svg`;
  link.click();
  URL.revokeObjectURL(url);
});

async function loadLibrary() {
  try {
    const response = await fetch("/api/library");
    state.library = await response.json();
    renderLibrary();
  } catch (error) {
    $("#evolution-summary").textContent = `素材库读取失败：${error.message}`;
  }
}

function renderLibrary() {
  if (!state.library) return;
  const filter = $("#library-filter").value;
  const items = (state.library.items ?? []).filter(item => filter === "all" || item.classification === filter);
  const evolution = state.library.evolution ?? {};
  $("#library-count").textContent = `${evolution.itemCount ?? 0} / ${evolution.limit ?? 20}`;
  $("#evolution-summary").textContent = evolution.itemCount
    ? `负熵进化：秩序分 ${evolution.averageOrderScore} · 国际 ${evolution.averageInternationalAwardScore} · 中国 ${evolution.averageChinaAwardScore} · 已沉淀 ${evolution.mechanismCount} 个机制`
    : "负熵进化：等待第一张素材归档。";
  $("#library-list").innerHTML = items.length ? items.map(item => `<article class="library-item"><img src="/api/library/items/${encodeURIComponent(item.id)}/preview" alt="" loading="lazy" /><div class="library-item-copy"><div class="library-item-top"><span>${escapeHtml({ publishable: "可直接发布", refine: "候选优化", experimental: "实验探索" }[item.classification] ?? item.classification)}</span><button type="button" data-library-delete="${escapeHtml(item.id)}" aria-label="删除素材">×</button></div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.platform.name)} · ${escapeHtml(item.platform.ratio)} · 发布 ${item.evaluation.publishScore} · 秩序 ${item.negativeEntropy.orderScore}</small></div></article>`).join("") : `<div class="empty-copy">这个分类还没有素材。</div>`;
  document.querySelectorAll("[data-library-delete]").forEach(button => button.addEventListener("click", async () => {
    const response = await fetch(`/api/library/items/${encodeURIComponent(button.dataset.libraryDelete)}`, { method: "DELETE" });
    if (!response.ok) return setStatus("删除素材失败");
    setStatus("素材已从本地库移除");
    await loadLibrary();
  }));
}

$("#library-filter").addEventListener("change", renderLibrary);
$("#edit-font-size").addEventListener("input", event => { $("#edit-font-size-value").textContent = String(event.target.value) + "px"; });
$("#edit-letter-spacing").addEventListener("input", event => { $("#edit-letter-spacing-value").textContent = String(event.target.value) + "px"; });

$("#save-library").addEventListener("click", async () => {
  if (!state.selected) return;
  const response = await fetch("/api/library/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidate: state.selected, classification: $("#library-classification").value, source: "generated" }) });
  const result = await response.json();
  if (!response.ok) return setStatus(result.error || "素材归档失败");
  setStatus("已归档到本地素材库，下一轮会把它作为可复用记忆");
  await loadLibrary();
});

$("#select-recommend").addEventListener("click", () => { if (state.selected) setStatus(`已采用“${state.selected.headline}”，可继续下载或进入专业编辑`); });

$("#apply-edit").addEventListener("click", async () => {
  if (!state.selected) return;
  const treatmentId = $("#edit-treatment").value;
  const treatmentMeta = TREATMENT_META[treatmentId];
  const remove = $("#edit-remove").value.split(/[，,、]/).map(value => value.trim()).filter(Boolean);
  const add = $("#edit-add").value.split(/[，,、]/).map(value => value.trim()).filter(Boolean);
  const baseTypography = state.selected.typography ?? {};
  const requestedPreset = $("#edit-font-preset").value;
  const preset = TYPE_PRESETS[requestedPreset === "auto" ? (baseTypography.preset ?? "editorial") : requestedPreset] ?? TYPE_PRESETS.editorial;
  const headlineFontSize = Number($("#edit-font-size").value);
  const letterSpacing = Number($("#edit-letter-spacing").value);
  const fontFamily = state.selected.language === "en" ? preset.en : preset.zh;
  const typography = { ...baseTypography, automatic: false, preset: requestedPreset === "auto" ? (baseTypography.preset ?? "editorial") : requestedPreset, presetName: preset.name, fontFamily, fontWeight: preset.weight, lineHeight: preset.lineHeight, headlineFontSize, previewHeadlineSize: Math.max(24, Math.round(headlineFontSize * Math.min(1, 620 / (state.selected.targetPlatform?.width ?? 900)))), letterSpacing, letterSpacingCss: String(letterSpacing) + "px", headlineColor: $("#edit-font-color").value };
  const candidate = { ...state.selected, headline: $("#edit-headline").value, subheadline: $("#edit-subheadline").value, typography, imageTreatment: { id: treatmentId, name: treatmentMeta.name, description: treatmentMeta.description, operations: treatmentMeta.operations, automatic: false }, imageEditPlan: { ...(state.selected.imageEditPlan ?? {}), remove, add, transform: { id: treatmentId, name: treatmentMeta.name, description: treatmentMeta.description, operations: treatmentMeta.operations, automatic: false }, operations: treatmentMeta.operations } };
  const response = await fetch("/api/evaluate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidate }) });
  candidate.evaluation = await response.json();
  candidate.typography = candidate.evaluation.typography ?? candidate.typography;
  state.selected = candidate;
  const index = state.run.candidates.findIndex(item => item.id === candidate.id);
  state.run.candidates[index] = candidate;
  renderRun();
  setStatus(candidate.evaluation.hardGatePassed ? "修改已应用，质量检查通过" : "修改已应用，但存在需要自动修复的门槛问题");
});

updateModeHint();
loadAiProviders();
loadLibrary();
