const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();

const trimPoint = value => clean(value).replace(/[“”"'「」]/g, "").replace(/[。！？!?]+$/u, "").slice(0, 60);

function extractPromptDirection(prompt = "") {
  const text = clean(prompt);
  const patterns = [
    /(?:核心观点|核心主张|主张|主标题|标题|文案|表达)[：:\s]+[“「"]?([^”」"\n。！？!?]{2,60})/u,
    /(?:核心是|重点是|希望表达|想表达)[：:\s]+([^。\n！？!?]{2,60})/u
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return trimPoint(match[1]);
  }
  return "";
}

function visualMood(imageFeatures = {}) {
  const signals = imageFeatures.visualSignals ?? {};
  const lighting = signals.lighting ?? "";
  const palette = signals.palette ?? "";
  const contrast = signals.contrast ?? "";
  const parts = [];
  if (lighting === "dark") parts.push("低照度");
  else if (lighting === "bright") parts.push("明亮");
  if (palette === "cool") parts.push("冷色调");
  else if (palette === "warm") parts.push("暖色调");
  if (contrast === "high") parts.push("强反差");
  else if (contrast === "soft") parts.push("柔和层次");
  return parts;
}

function defaultPoint(subjectId, prompt, language = "zh") {
  const text = clean(prompt);
  const coast = /海|海边|海岸|潮汐|山海|coast|ocean|sea/i.test(text);
  const cinematic = /大片|广告感|电影|cinematic|blockbuster|hero/i.test(text);
  if (language === "en") {
    if (subjectId === "building" && coast) return cinematic ? "Let architecture become a cinematic encounter between people and the sea" : "Let space come closer to nature";
    if (subjectId === "building") return "Space is not a container; it is a way back to connection";
    if (subjectId === "landscape") return coast ? "Turn the view into a life you can enter" : "Let nature reset the scale of everyday life";
    if (subjectId === "product") return "Make the product's real value instantly felt";
    if (subjectId === "person") return "Let one real person leave a lasting feeling";
    if (subjectId === "event") return "Turn a moment into a place worth joining";
    return cinematic ? "Let the image create emotion before the message arrives" : "Make the real relationship in the image the reason to look";
  }
  if (subjectId === "building" && coast) return cinematic ? "让建筑成为海与人的电影级相遇" : "让空间重新靠近自然";
  if (subjectId === "building") return "空间不只是容器，也是人与环境重新连接的入口";
  if (subjectId === "landscape") return coast ? "把风景变成可以进入的生活" : "让自然成为生活的另一种尺度";
  if (subjectId === "product") return "把产品的真实价值变成一眼可感的体验";
  if (subjectId === "person") return "让一个真实的人，留下值得记住的情绪";
  if (subjectId === "event") return "让一次发生，变成值得参与的现场";
  return cinematic ? "让画面先制造情绪，再让观点被看见" : "让画面中的真实关系成为传播入口";
}

function shortHeadline(point, language = "zh") {
  const value = trimPoint(point);
  if (!value) return language === "en" ? "See it differently" : "看见另一种可能";
  const parts = value.split(/[，,：:；;—–-]/u).map(clean).filter(Boolean);
  const candidate = parts[0] || value;
  return [...candidate].length <= 18 ? candidate : [...candidate].slice(0, 16).join("") + "…";
}

function headlineVariants({ point, subjectId, prompt, language }) {
  const primary = shortHeadline(point, language);
  if (language === "en") {
    return [primary, subjectId === "building" ? "Space, reframed" : "Make it memorable", "A point of view worth seeing"];
  }
  const alternatives = {
    building: ["让空间，重新靠近自然", "住进风景里", "建筑与海，重新相遇"],
    landscape: ["把风景带回生活", "去自然里，重新呼吸", "风景不止被观看"],
    product: ["好产品，自己会说话", "把价值变得可感", "日常，也值得被看见"],
    person: ["先看见这个人", "真实，自有分量", "留下一个人的光"],
    event: ["现场，正在发生", "来现场，遇见新连接", "让发生值得参与"],
    general: ["让观点被看见", "先让画面说话", "看见另一种可能"]
  };
  const fallback = alternatives[subjectId] ?? alternatives.general;
  const promptHasDirection = Boolean(extractPromptDirection(prompt));
  return promptHasDirection ? [primary, fallback[1], fallback[2]] : [fallback[0], primary, fallback[1]];
}

export function summarizeImageInsight({ input = {}, subject = {}, language = "zh" } = {}) {
  const imageFeatures = input.imageFeatures ?? {};
  const aiAnalysis = input.aiAnalysis ?? {};
  const prompt = clean(input.prompt);
  const promptDirection = extractPromptDirection(prompt);
  const providedPoint = trimPoint(aiAnalysis.corePoint ?? imageFeatures.corePoint ?? imageFeatures.keyMessage ?? imageFeatures.imageSummary);
  const mood = visualMood(imageFeatures);
  const corePoint = promptDirection || providedPoint || defaultPoint(subject.id, prompt, language);
  const moodText = mood.length ? "，并呈现" + mood.join("、") + "的视觉信号" : "";
  const summary = trimPoint(aiAnalysis.imageSummary ?? imageFeatures.summary ?? imageFeatures.description)
    || (language === "en"
      ? "The image presents " + (subject.name || "a visual scene") + " as a clear emotional and spatial entry point" + (mood.length ? ", with " + mood.join(", ") + " visual signals." : ".")
      : "画面以" + (subject.name || "当前视觉内容") + "为主体，形成可被感知的情绪与关系入口" + moodText + "。");
  const aiHeadlines = Array.isArray(aiAnalysis.headlineVariants) ? aiAnalysis.headlineVariants.map(trimPoint).filter(Boolean).slice(0, 3) : [];
  const source = promptDirection ? "prompt-directed" : aiAnalysis.corePoint || aiAnalysis.imageSummary ? "assistant-platform" : providedPoint ? "provided-vision-analysis" : "local-visual-signals";
  const confidence = promptDirection ? 0.98 : aiAnalysis.corePoint || aiAnalysis.imageSummary ? (aiAnalysis.confidence ?? 0.9) : providedPoint ? 0.88 : imageFeatures.visualSignals ? 0.66 : 0.52;
  return {
    modelVersion: "image-insight-v0.1",
    source,
    confidence,
    promptPriority: true,
    corePoint,
    summary,
    headlineVariants: promptDirection || !aiHeadlines.length ? headlineVariants({ point: corePoint, subjectId: subject.id, prompt, language }) : aiHeadlines,
    evidence: [
      promptDirection ? "Prompt 核心表达优先" : "",
      aiAnalysis.corePoint || aiAnalysis.imageSummary ? "已使用 AI 协助平台分析" : "",
      providedPoint ? "已使用外部视觉分析摘要" : "",
      ...mood
    ].filter(Boolean),
    rationale: promptDirection
      ? "已将 Prompt 中的核心表达作为封面观点，再用图片主体和视觉信号完成压缩。"
      : aiAnalysis.rationale || (aiAnalysis.corePoint || aiAnalysis.imageSummary)
        ? aiAnalysis.rationale || "AI 协助平台已提炼图片观点，并匹配创意机制。"
      : "先从图片主体与视觉信号提炼观点，再压缩为封面标题和副标题。"
  };
}
