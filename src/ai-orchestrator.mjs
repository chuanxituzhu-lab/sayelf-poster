import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_PROMPT_LENGTH = 8000;
const BRIDGE_TIMEOUT_MS = 15000;

const PROVIDER_DEFINITIONS = [
  { id: "codex", name: "Codex", executableNames: ["codex"], bridgeEnv: "CODEX_POSTER_BRIDGE_URL", commandEnv: "CODEX_POSTER_COMMAND" },
  { id: "claude-code", name: "Claude Code", executableNames: ["claude"], bridgeEnv: "CLAUDE_POSTER_BRIDGE_URL", commandEnv: "CLAUDE_POSTER_COMMAND" },
  { id: "workbuddy", name: "WorkBuddy", executableNames: ["workbuddy"], bridgeEnv: "WORKBUDDY_POSTER_BRIDGE_URL", commandEnv: "WORKBUDDY_POSTER_COMMAND" }
];

const LOCAL_PROVIDER = {
  id: "local-rules",
  name: "本地规则",
  detected: true,
  controlReady: true,
  mode: "local",
  status: "ready",
  bridgeType: "in-process",
  description: "无需外部平台，使用本地可解释规则完成内容识别和创意机制匹配。"
};

const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();

function requestedProvider(input = {}) {
  return clean(input.assistantProvider || process.env.SAYELF_POSTER_AI_PROVIDER || "auto").toLowerCase();
}

function publicProvider(definition, details = {}) {
  return {
    id: definition.id,
    name: definition.name,
    detected: Boolean(details.detected),
    controlReady: Boolean(details.controlReady),
    mode: details.controlReady ? "assistant" : "local-fallback",
    status: details.controlReady ? "ready" : details.detected ? "detected" : "unavailable",
    bridgeType: details.bridgeType ?? "none",
    description: details.controlReady
      ? "已发现授权桥接，可直接参与内容识别和创意机制匹配。"
      : details.detected
        ? "已发现本地客户端，但尚未配置 Sayelf Poster 桥接；当前使用本地规则。"
        : "未发现本地客户端或授权桥接。"
  };
}

async function findExecutable(names) {
  const lookup = process.platform === "win32" ? "where.exe" : "which";
  for (const name of names) {
    try {
      const result = await execFileAsync(lookup, [name], { timeout: 1200, windowsHide: true, maxBuffer: 8192 });
      const path = String(result.stdout ?? "").split(/\r?\n/).map(value => value.trim()).find(Boolean);
      if (path) return path;
    } catch {
      // A missing optional client is an expected fallback path.
    }
  }
  return "";
}

async function inspectProvider(definition) {
  const bridgeUrl = clean(process.env[definition.bridgeEnv] || process.env.SAYELF_POSTER_AI_BRIDGE_URL);
  const command = clean(process.env[definition.commandEnv] || process.env.SAYELF_POSTER_AI_COMMAND);
  const executablePath = await findExecutable(definition.executableNames);
  const controlReady = Boolean(bridgeUrl || command);
  return publicProvider(definition, {
    detected: Boolean(executablePath || bridgeUrl || command),
    controlReady,
    bridgeType: bridgeUrl ? "http-bridge" : command ? "stdin-command" : executablePath ? "client-detected" : "none"
  });
}

function chooseProvider(providers, preference) {
  if (preference === "local" || preference === "local-rules") return LOCAL_PROVIDER;
  const named = providers.find(provider => provider.id === preference && provider.controlReady);
  if (named) return named;
  if (preference !== "auto") return LOCAL_PROVIDER;
  return providers.find(provider => provider.controlReady) ?? LOCAL_PROVIDER;
}

export async function detectProviders(input = {}) {
  const providers = [];
  for (const definition of PROVIDER_DEFINITIONS) providers.push(await inspectProvider(definition));
  const preference = requestedProvider(input);
  const selected = chooseProvider(providers, preference);
  return {
    requestedProvider: preference,
    autoControl: preference === "auto",
    selected: selected.id,
    fallback: LOCAL_PROVIDER.id,
    providers: [LOCAL_PROVIDER, ...providers]
  };
}

function buildAssistantRequest(input, provider) {
  const imageFeatures = input.imageFeatures ?? {};
  const request = {
    task: "sayelf-poster.content-analysis",
    provider: provider.id,
    prompt: clean(input.prompt).slice(0, MAX_PROMPT_LENGTH),
    context: {
      goal: clean(input.goal),
      tone: clean(input.tone),
      language: clean(input.language) || "auto",
      platform: clean(input.platform) || "xhs_cover",
      imageFeatures: {
        subject: clean(imageFeatures.subject),
        dominantColor: clean(imageFeatures.dominantColor),
        aspectRatio: clean(imageFeatures.aspectRatio),
        safeTextRegion: clean(imageFeatures.safeTextRegion),
        visualSignals: imageFeatures.visualSignals ?? {}
      }
    },
    instructions: "识别内容 / Prompt 的真实意图，提炼一句可用于海报封面的核心观点，并匹配一个创意机制。Prompt 中明确的主张、标题、文案和表达要求必须优先。只返回 JSON，不要返回 Markdown。",
    outputSchema: {
      corePoint: "string",
      imageSummary: "string",
      mechanismId: "string",
      headlineVariants: ["string", "string", "string"],
      rationale: "string"
    }
  };
  if (process.env.SAYELF_POSTER_SHARE_IMAGE === "1" && input.imageDataUrl) {
    request.context.imageDataUrl = String(input.imageDataUrl);
  }
  return request;
}

function parseJsonOutput(value) {
  const text = clean(value).replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  if (!text) throw new Error("empty-assistant-response");
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("invalid-assistant-json");
  }
}

export function normalizeAssistantResult(payload = {}) {
  const value = payload.analysis ?? payload.result ?? payload.output ?? payload;
  const headlineVariants = Array.isArray(value.headlineVariants)
    ? value.headlineVariants.map(clean).filter(Boolean).slice(0, 3)
    : [];
  const result = {
    corePoint: clean(value.corePoint || value.keyMessage || value.claim),
    imageSummary: clean(value.imageSummary || value.summary || value.description),
    mechanismId: clean(value.mechanismId || value.creativeMechanismId),
    headlineVariants,
    rationale: clean(value.rationale || value.reason),
    confidence: Number.isFinite(Number(value.confidence)) ? Number(value.confidence) : null
  };
  if (!result.corePoint && !result.imageSummary && !result.mechanismId && !result.headlineVariants.length) {
    throw new Error("empty-assistant-analysis");
  }
  return result;
}

async function invokeHttpBridge(url, request, normalizer = normalizeAssistantResult) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal
    });
    if (!response.ok) throw new Error("assistant-http-" + response.status);
    return normalizer(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

function invokeCommandBridge(command, request, normalizer = normalizeAssistantResult) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [];
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(reject, new Error("assistant-command-timeout"));
    }, BRIDGE_TIMEOUT_MS);
    child.stdout.on("data", chunk => stdout.push(chunk));
    child.stderr.on("data", () => {});
    child.on("error", error => finish(reject, error));
    child.on("close", code => {
      if (code !== 0) return finish(reject, new Error("assistant-command-exit-" + code));
      try {
        finish(resolve, normalizer(parseJsonOutput(Buffer.concat(stdout).toString("utf8"))));
      } catch (error) {
        finish(reject, error);
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

async function invokeProviderRequest(provider, request, normalizer = normalizeAssistantResult) {
  const definition = PROVIDER_DEFINITIONS.find(item => item.id === provider.id);
  if (!definition) throw new Error("unsupported-assistant-provider");
  const bridgeUrl = clean(process.env[definition.bridgeEnv] || process.env.SAYELF_POSTER_AI_BRIDGE_URL);
  const command = clean(process.env[definition.commandEnv] || process.env.SAYELF_POSTER_AI_COMMAND);
  if (bridgeUrl) return invokeHttpBridge(bridgeUrl, request, normalizer);
  if (command) return invokeCommandBridge(command, request, normalizer);
  throw new Error("assistant-bridge-not-configured");
}

async function invokeProvider(provider, input) {
  return invokeProviderRequest(provider, buildAssistantRequest(input, provider));
}

const SESSION_TREATMENTS = new Set(["original", "enhance", "duotone", "line_art", "comic", "simple_illustration", "monochrome", "cinematic"]);

function listValues(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).slice(0, 8);
  return clean(value).split(/[，,、]/).map(clean).filter(Boolean).slice(0, 8);
}

function normalizeSessionPatch(value = {}) {
  const patch = {};
  if (clean(value.headline)) patch.headline = clean(value.headline).slice(0, 80);
  if (clean(value.subheadline)) patch.subheadline = clean(value.subheadline).slice(0, 140);
  if (clean(value.cta)) patch.cta = clean(value.cta).slice(0, 40);
  const treatment = value.imageTreatment ?? {};
  const treatmentId = clean(value.imageTreatmentId || treatment.id);
  if (SESSION_TREATMENTS.has(treatmentId)) patch.imageTreatment = { id: treatmentId };
  const editPlan = value.imageEditPlan ?? {};
  const remove = listValues(value.removeElements ?? editPlan.remove);
  const add = listValues(value.addElements ?? editPlan.add);
  if (remove.length || add.length) patch.imageEditPlan = { remove, add };
  const typographyValue = value.typography ?? {};
  const typography = {};
  for (const key of ["preset", "presetName", "fontFamily", "headlineColor", "headlineFontSize", "letterSpacing", "letterSpacingCss", "fontWeight", "lineHeight"]) {
    if (typographyValue[key] !== undefined && typographyValue[key] !== null) typography[key] = typographyValue[key];
  }
  if (Object.keys(typography).length) patch.typography = typography;
  return patch;
}

export function normalizeSessionResult(payload = {}) {
  const value = payload.command ?? payload.result ?? payload.output ?? payload;
  const patch = normalizeSessionPatch(value.patch ?? value.designPatch ?? value);
  return {
    message: clean(value.message || value.reply || value.rationale) || (Object.keys(patch).length ? "已生成设计修改补丁。" : "已收到指令，但没有生成可应用的修改。"),
    patch
  };
}

function localSessionCommand(input = {}) {
  const instruction = clean(input.instruction);
  const commandValue = value => clean(value).replace(/^[“「"']+|[”」"']+$/gu, "");
  const patch = {};
  const headlineMatch = instruction.match(/(?:主标题|标题)(?:改为|改成|换成|修改为|调整为)[：:\s]*[“「"]?(.+?)[”」"]?(?=[，,；;。]|$)/u);
  const subheadlineMatch = instruction.match(/(?:副标题|副文案)(?:改为|改成|换成|修改为|调整为)[：:\s]*[“「"]?(.+?)[”」"]?(?=[，,；;。]|$)/u);
  const ctaMatch = instruction.match(/(?:行动入口|按钮文案|CTA)(?:改为|改成|换成)[：:\s]*[“「"]?(.+?)[”」"]?(?=[，,；;。]|$)/iu);
  if (headlineMatch?.[1]) patch.headline = commandValue(headlineMatch[1]);
  if (subheadlineMatch?.[1]) patch.subheadline = commandValue(subheadlineMatch[1]);
  if (ctaMatch?.[1]) patch.cta = commandValue(ctaMatch[1]);

  const treatmentRules = [
    [/线描|线稿/u, "line_art"],
    [/漫画|动漫/u, "comic"],
    [/简笔|简约插画/u, "simple_illustration"],
    [/电影级|电影感|广告大片/u, "cinematic"],
    [/双色|双色叙事/u, "duotone"],
    [/单色|黑白|印刷感/u, "monochrome"],
    [/主体增强|增强主体/u, "enhance"],
    [/保留原图|原图/u, "original"]
  ];
  const treatmentRule = treatmentRules.find(([pattern]) => pattern.test(instruction));
  if (treatmentRule) patch.imageTreatment = { id: treatmentRule[1] };

  const removeMatch = instruction.match(/(?:移除|删除|去掉)(?:画面中的|画面)?[：:\s]*(.+?)(?:。|$)/u);
  const addMatch = instruction.match(/(?:增加|添加|加入)(?:画面中的|画面)?[：:\s]*(.+?)(?:。|$)/u);
  if (removeMatch?.[1]) patch.imageEditPlan = { ...(patch.imageEditPlan ?? {}), remove: listValues(removeMatch[1]) };
  if (addMatch?.[1]) patch.imageEditPlan = { ...(patch.imageEditPlan ?? {}), add: listValues(addMatch[1]) };

  const colorMatch = instruction.match(/(?:字体颜色|文字颜色|标题颜色)(?:改为|换成)[：:\s]*(#[0-9a-f]{6})/iu);
  const sizeMatch = instruction.match(/(?:字号|标题大小)(?:改为|调整为)[：:\s]*(\d{2,3})\s*(?:px|像素)?/iu);
  const spacingMatch = instruction.match(/(?:字距|字间距)(?:改为|调整为)[：:\s]*(-?\d+(?:\.\d+)?)\s*(?:px)?/iu);
  if (colorMatch?.[1] || sizeMatch?.[1] || spacingMatch?.[1]) {
    patch.typography = {};
    if (colorMatch?.[1]) patch.typography.headlineColor = colorMatch[1];
    if (sizeMatch?.[1]) patch.typography.headlineFontSize = Number(sizeMatch[1]);
    if (spacingMatch?.[1]) {
      patch.typography.letterSpacing = Number(spacingMatch[1]);
      patch.typography.letterSpacingCss = spacingMatch[1] + "px";
    }
  }

  const changed = Object.keys(patch);
  return {
    message: changed.length
      ? "本地规则已按文字指令更新：" + changed.join("、") + "。点击画面只会反馈选择，不会直接修改内容。"
      : "本地规则已收到指令，但未识别到具体修改项；请明确写出“标题改为”“改成线描”“移除”“增加”等动作。",
    patch
  };
}

function buildSessionRequest(input, provider) {
  const candidate = input.candidate ?? {};
  return {
    task: "sayelf-poster.design-command",
    provider: provider.id,
    instruction: clean(input.instruction).slice(0, 4000),
    selection: input.selection ?? null,
    currentDesign: {
      headline: clean(candidate.headline),
      subheadline: clean(candidate.subheadline),
      cta: clean(candidate.cta),
      imageTreatment: { id: clean(candidate.imageTreatment?.id) },
      imageEditPlan: {
        remove: listValues(candidate.imageEditPlan?.remove),
        add: listValues(candidate.imageEditPlan?.add)
      },
      typography: candidate.typography ?? {}
    },
    instructions: "根据用户文字指令生成可应用的海报设计补丁。只允许修改标题、副标题、CTA、图片处理、画面增删元素和字体排版。点击选择信息只是上下文，不能自动修改。只返回 JSON。",
    outputSchema: {
      message: "string",
      patch: {
        headline: "string",
        subheadline: "string",
        cta: "string",
        imageTreatmentId: "original|enhance|duotone|line_art|comic|simple_illustration|monochrome|cinematic",
        imageEditPlan: { remove: ["string"], add: ["string"] },
        typography: "object"
      }
    }
  };
}

export async function prepareSessionCommand(input = {}) {
  const detection = await detectProviders(input);
  const localInput = { ...input, aiProvider: undefined, aiDetection: undefined };
  if (detection.selected === LOCAL_PROVIDER.id) {
    return {
      ...localSessionCommand(localInput),
      aiProvider: providerRunStatus(LOCAL_PROVIDER, "local"),
      aiDetection: detection
    };
  }
  const selected = detection.providers.find(provider => provider.id === detection.selected);
  try {
    const result = await invokeProviderRequest(selected, buildSessionRequest(input, selected), normalizeSessionResult);
    return {
      ...normalizeSessionResult(result),
      aiProvider: providerRunStatus(selected, "used"),
      aiDetection: detection
    };
  } catch (error) {
    return {
      ...localSessionCommand(localInput),
      aiProvider: providerRunStatus(selected, "fallback", error.message === "assistant-bridge-not-configured" ? "桥接未配置" : "协助平台调用失败"),
      aiDetection: detection
    };
  }
}

function providerRunStatus(provider, status, fallbackReason = "") {
  return {
    id: provider.id,
    name: provider.name,
    mode: status === "used" ? "assistant" : "local",
    status,
    control: status === "used" ? "automatic" : status === "fallback" ? "fallback" : "in-process",
    fallbackReason
  };
}

export async function prepareGeneration(rawInput = {}) {
  const detection = await detectProviders(rawInput);
  if (detection.selected === LOCAL_PROVIDER.id) {
    return {
      ...rawInput,
      aiProvider: providerRunStatus(LOCAL_PROVIDER, "local"),
      aiDetection: detection
    };
  }
  const selected = detection.providers.find(provider => provider.id === detection.selected);
  try {
    const aiAnalysis = await invokeProvider(selected, rawInput);
    return {
      ...rawInput,
      aiAnalysis,
      aiProvider: providerRunStatus(selected, "used"),
      aiDetection: detection
    };
  } catch (error) {
    return {
      ...rawInput,
      aiProvider: providerRunStatus(selected, "fallback", error.message === "assistant-bridge-not-configured" ? "桥接未配置" : "协助平台调用失败"),
      aiDetection: detection
    };
  }
}
