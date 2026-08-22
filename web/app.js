const state = { run: null, selected: null, imageDataUrl: "", imageFeatures: {}, library: null, onlineLibrary: null, selectionContext: null };

const $ = selector => document.querySelector(selector);
const form = $("#generate-form");
const promptInput = $("#prompt");
const imageInput = $("#image");
const platformInput = $("#platform");
const toneInput = $("#tone");
const languageInput = $("#language");
const professionalInput = $("#professional");
const PLUGIN_CONNECTIONS = {
  local: {
    text: "npm start",
    message: "本地规则引擎已启用：无需外部 AI，也可以完成生成、评分、渲染与会话命令。"
  },
  codex: {
    text: "[mcp_servers.sayelf-poster]\ncommand = \"node\"\nargs = [\"<ABS_PATH>/src/mcp-server.mjs\"]",
    message: "Codex MCP 配置已复制。将 <ABS_PATH> 替换为仓库绝对路径后即可接入。"
  },
  claude: {
    text: "claude mcp add sayelf-poster -- node <ABS_PATH>/src/mcp-server.mjs",
    message: "Claude Code 接入命令已复制。将 <ABS_PATH> 替换为仓库绝对路径后执行。"
  },
  workbuddy: {
    text: "{\n  \"mcpServers\": {\n    \"sayelf-poster\": {\n      \"command\": \"node\",\n      \"args\": [\"<ABS_PATH>/src/mcp-server.mjs\"]\n    }\n  }\n}",
    message: "WorkBuddy MCP 配置已复制。也可以使用同目录下的 CLI 作为回退接口。"
  },
  canva: {
    message: "Canva 适合做生成后的专业编辑与协作。当前建议先走 SVG / PNG / PDF 交接，再回传 Sayelf 重新评分。"
  },
  figma: {
    message: "Figma 适合做设计系统、视觉审查与结构同步。场景图和质量评分仍以 Sayelf 为主。"
  }
};

const pluginHub = $("#plugin-hub");
const pluginHubResult = $("#plugin-hub-result");
$("#plugin-hub-trigger")?.addEventListener("click", () => pluginHub?.showModal());
pluginHub?.addEventListener("click", event => { if (event.target === pluginHub) pluginHub.close(); });
document.querySelectorAll("[data-plugin-copy]").forEach(button => button.addEventListener("click", async () => {
  const connection = PLUGIN_CONNECTIONS[button.dataset.pluginCopy];
  if (!connection) return;
  if (connection.text) {
    try {
      await navigator.clipboard.writeText(connection.text);
      pluginHubResult.textContent = `${connection.message} 已复制到剪贴板。`;
    } catch {
      pluginHubResult.textContent = `${connection.message} 浏览器未允许自动复制，请从安装指南中手动复制。`;
    }
  } else {
    pluginHubResult.textContent = connection.message;
  }
}));

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

function updateModeHint() {
  $("#mode-hint").textContent = professionalInput.checked ? "专业模式 · 可编辑标题、文案与设计状态" : "自动模式 · 以直接发布为优先";
  $("#edit-panel").classList.toggle("hidden", !professionalInput.checked || !state.selected);
}

function renderSessionContext(context = state.selectionContext) {
  state.selectionContext = context;
  const selection = context?.selection;
  if (!selection) {
    $("#session-selection").textContent = "尚未选择画面元素";
    $("#session-result").textContent = "";
  } else {
    const label = { image: "主视觉图片", headline: "主标题", subheadline: "副标题", cta: "行动入口", kicker: "主题标签", mechanism: "创意机制", shade: "画面遮罩", rule: "强调线", root: "整张海报" }[selection.id] ?? selection.role ?? selection.id;
    $("#session-selection").textContent = `已选：${label} · ${selection.type} · ${selection.editable ? "可编辑" : "只读"}`;
  }
  document.querySelectorAll("[data-node-id]").forEach(node => node.classList.toggle("selected-node", node.dataset.nodeId === selection?.id));
}

async function inspectPreviewNode(nodeId) {
  if (!state.selected) return;
  try {
    const response = await fetch("/api/design-context", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidate: state.selected, nodeId }) });
    const context = await response.json();
    if (!response.ok) throw new Error(context.error || "读取画面上下文失败");
    renderSessionContext(context);
    setStatus("已反馈选中上下文；画面未修改，请通过会话命令继续");
  } catch (error) {
    $("#session-result").textContent = `上下文读取失败：${error.message}`;
  }
}

function analyzeImage(file) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, 1, 1);
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      resolve({ subject: "自动识别图片主体", dominantColor: `#${[r, g, b].map(value => value.toString(16).padStart(2, "0")).join("")}`, aspectRatio: `${image.naturalWidth}:${image.naturalHeight}`, safeTextRegion: "根据主体位置自动推断" });
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
  const learningText = learning ? `奖项学习记忆 ${escapeHtml(learning.memoryVersion)} · ${learning.sourceCount} 个权威来源 · 命中：${escapeHtml(learning.matchedMechanisms?.map(item => item.name).join("、") || "通用创意机制")}` : "";
  const platformRule = run.analysis.platformRule;
  const platformText = platformRule ? `平台规则：${platformRule.platform} · ${platformRule.ruleStatusLabel ?? platformRule.ruleStatus}` : "";
  $("#analysis").innerHTML = `<strong>${escapeHtml(run.analysis.subject.name)}</strong><br>${escapeHtml(run.analysis.rationale)}<br><span class="file-note">安全区域：${escapeHtml(run.analysis.imageFeatures.safeTextRegion)}</span>${platformText ? `<br><span class="file-note">${escapeHtml(platformText)}</span>` : ""}${learningText ? `<br><span class="file-note">${learningText}</span>` : ""}`;
  $("#candidate-list").innerHTML = run.candidates.map((candidate, index) => `<button class="candidate-item ${candidate.id === selected.id ? "active" : ""}" data-id="${candidate.id}"><span class="candidate-top"><span>${index === 0 ? "推荐发布" : index === 1 ? "稳妥传播" : "个性创意"}</span><span>${candidate.evaluation.level}</span></span><strong>${escapeHtml(candidate.headline)}</strong><small>${escapeHtml(candidate.style.name)} · ${escapeHtml(candidate.mechanism.name)} · 发布分 ${candidate.evaluation.publishScore}</small></button>`).join("");
  document.querySelectorAll(".candidate-item").forEach(item => item.addEventListener("click", () => { state.selected = run.candidates.find(candidate => candidate.id === item.dataset.id); renderRun(); }));
  renderPreview(selected);
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
  const imageLayer = candidate.image?.dataUrl ? `<div data-node-id="image" class="poster-image-layer treatment-${escapeHtml(treatmentId)}" style="background-image:url(${candidate.image.dataUrl})"></div>` : "";
  $("#poster-preview").innerHTML = `<div data-node-id="root" class="poster-art theme-${escapeHtml(treatmentId)} ${candidate.image?.dataUrl ? "has-image" : ""}" style="--ratio:${candidate.targetPlatform.ratio.replace(":", "/")};--background:${style.background};--surface:${style.surface};--text:${style.text};--accent:${style.accent};--secondary:${style.secondary};">${imageLayer}<div data-node-id="shade" class="poster-shade"></div><div class="poster-copy"><div data-node-id="rule" class="poster-rule"></div><div data-node-id="kicker" class="poster-kicker">${escapeHtml(candidate.subject.name)}</div><div data-node-id="headline" class="poster-headline">${escapeHtml(candidate.headline)}</div><div data-node-id="subheadline" class="poster-sub">${escapeHtml(candidate.subheadline)}</div><div class="poster-footer"><span data-node-id="mechanism">${escapeHtml(candidate.mechanism.name)}</span><span data-node-id="cta" class="poster-cta">${escapeHtml(candidate.cta)}</span></div></div></div>`;
  $("#preview-caption").textContent = `${candidate.style.name} / ${candidate.mechanism.name} / ${treatment.name ?? TREATMENT_META[treatmentId]?.name ?? "画面处理"} · ${candidate.rationale}`;
  renderSessionContext(state.selectionContext);
}

$("#poster-preview").addEventListener("click", event => {
  const node = event.target.closest("[data-node-id]");
  if (!node) return;
  event.stopPropagation();
  inspectPreviewNode(node.dataset.nodeId);
});

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
    "--poster-text-color": typography.headlineColor ?? candidate.style.text,
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

async function loadOnlineLibrary() {
  try {
    const response = await fetch("/api/online-library");
    state.onlineLibrary = await response.json();
    renderOnlineLibrary();
  } catch (error) {
    $("#online-library-summary").textContent = `线上灵感库读取失败：${error.message}`;
  }
}

function renderOnlineLibrary() {
  if (!state.onlineLibrary) return;
  const items = state.onlineLibrary.items ?? [];
  $("#online-library-count").textContent = `${items.length} / ${state.onlineLibrary.limit ?? 10}`;
  $("#online-library-summary").textContent = items.length
    ? `已保存 ${items.length} 个线上范本：只沉淀来源、观察与可迁移机制。`
    : "保存官方来源链接与可迁移创意机制，不复制获奖原作。";
  $("#online-library-list").innerHTML = items.length
    ? items.map(item => `<article class="online-library-item"><div class="online-library-top"><span>${escapeHtml(item.authority ?? "线上来源")}</span><button type="button" data-online-library-delete="${escapeHtml(item.id)}" aria-label="删除线上范本">×</button></div><a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a><small>${escapeHtml(item.category ?? "未分类")} · ${escapeHtml(item.region ?? "unknown")}</small><p>${escapeHtml(item.transfer ?? "")}</p></article>`).join("")
    : `<div class="empty-copy">点击后导入 5 个已学习的奖项范本。</div>`;
  document.querySelectorAll("[data-online-library-delete]").forEach(button => button.addEventListener("click", async () => {
    const response = await fetch(`/api/online-library/items/${encodeURIComponent(button.dataset.onlineLibraryDelete)}`, { method: "DELETE" });
    if (!response.ok) return setStatus("线上范本删除失败");
    setStatus("线上范本已移除");
    await loadOnlineLibrary();
  }));
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

$("#seed-online-library").addEventListener("click", async () => {
  const button = $("#seed-online-library");
  button.disabled = true;
  try {
    const response = await fetch("/api/online-library/seed-award-references", { method: "POST" });
    const result = await response.json();
    if (!response.ok) return setStatus(result.error || "线上范本导入失败");
    setStatus(`已导入 ${result.added} 个优秀广告范本，线上灵感库最多保存 10 个`);
    state.onlineLibrary = result;
    renderOnlineLibrary();
  } finally {
    button.disabled = false;
  }
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

$("#apply-session-command").addEventListener("click", async () => {
  if (!state.selected) return setStatus("请先生成一张海报");
  const text = $("#session-command").value.trim();
  if (!text) return setStatus("请先输入会话命令");
  const targetId = state.selectionContext?.selection?.id && state.selectionContext.selection.id !== "root" ? state.selectionContext.selection.id : undefined;
  const button = $("#apply-session-command");
  button.disabled = true;
  $("#session-result").textContent = "正在通过命令门应用并重新评分…";
  try {
    const response = await fetch("/api/design-command", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidate: state.selected, text, targetId, source: "webui-session" }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "设计命令未应用");
    state.selected = result.candidate;
    const index = state.run.candidates.findIndex(item => item.id === result.candidate.id);
    if (index >= 0) state.run.candidates[index] = result.candidate;
    $("#session-command").value = "";
    renderRun();
    renderSessionContext(result.context);
    $("#session-result").textContent = `已应用：${result.command.type} · ${result.evaluation.hardGatePassed ? "质量门槛通过" : "已更新，仍需优化"}`;
    setStatus("会话命令已应用，画面已重新评分");
  } catch (error) {
    $("#session-result").textContent = `命令未应用：${error.message}`;
    setStatus("会话命令未应用");
  } finally {
    button.disabled = false;
  }
});

updateModeHint();
loadLibrary();
loadOnlineLibrary();
