import crypto from "node:crypto";
import { AWARD_LEARNING_MEMORY, getLearningMatches, getLearningMemorySummary } from "./learning-memory.mjs";
import { buildTypographyPlan, refreshTypographyPlan, MATTE_GOLD } from "./typography.mjs";
import { buildCompositionPlan, listCompositions } from "./composition.mjs";
import { buildSceneGraph, inspectSceneContext } from "./scene-graph.mjs";

export { listCompositions, buildSceneGraph, inspectSceneContext, inspectSceneContext as inspectDesignContext };

export const PLATFORM_PROFILES = {
  xhs_cover: {
    id: "xhs_cover",
    name: "小红书封面",
    ratio: "3:4",
    width: 900,
    height: 1200,
    guidance: "缩略图先读标题，再读画面；适合单一焦点和短标题。"
  },
  wechat_header: {
    id: "wechat_header",
    name: "公众号头图",
    ratio: "2.35:1",
    width: 900,
    height: 383,
    guidance: "横向阅读，标题必须在小尺寸预览下保持清晰。"
  },
  video_cover: {
    id: "video_cover",
    name: "短视频封面",
    ratio: "16:9",
    width: 1280,
    height: 720,
    guidance: "三秒理解主题，主体与标题要形成强对比。"
  },
  douyin_cover: {
    id: "douyin_cover",
    name: "抖音竖屏封面",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    guidance: "三秒理解主题，标题不超过两行，主体避开界面遮挡区域。"
  },
  instagram_feed: {
    id: "instagram_feed",
    name: "Instagram Feed",
    ratio: "4:5",
    width: 1080,
    height: 1350,
    guidance: "优先使用竖幅画面，保证主体和短标题在移动端首屏清晰。"
  },
  instagram_story: {
    id: "instagram_story",
    name: "Instagram Story / Reel",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    guidance: "为全屏竖幅设计，重要文字避开顶部与底部界面区域。"
  },
  youtube_thumbnail: {
    id: "youtube_thumbnail",
    name: "YouTube Thumbnail",
    ratio: "16:9",
    width: 1280,
    height: 720,
    guidance: "缩略图优先，使用高对比主体和一句可读主张。"
  },
  tiktok_cover: {
    id: "tiktok_cover",
    name: "TikTok Cover",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    guidance: "竖屏首帧快速说明主题，文字避开界面安全区。"
  },
  linkedin_post: {
    id: "linkedin_post",
    name: "LinkedIn Post",
    ratio: "1.91:1",
    width: 1200,
    height: 627,
    guidance: "适合专业观点、案例和数据型内容，保持横向信息层级清楚。"
  },
  pinterest_pin: {
    id: "pinterest_pin",
    name: "Pinterest Pin",
    ratio: "2:3",
    width: 1000,
    height: 1500,
    guidance: "使用可保存、可复用的视觉主题，文字与主体保持长图安全区。"
  },
  poster: {
    id: "poster",
    name: "活动海报",
    ratio: "3:4",
    width: 900,
    height: 1200,
    guidance: "允许更完整的信息层级，但活动对象和行动入口必须明确。"
  }
};

export const STYLE_PROFILES = {
  editorial: {
    id: "editorial",
    name: "当代编辑风",
    mood: "克制、理性、有杂志感",
    background: "#102a43",
    surface: "#173f5f",
    text: "#f6f4ef",
    accent: "#f6a04d",
    secondary: "#a8c7d8",
    font: "Arial, 'Microsoft YaHei', sans-serif",
    layout: "left-copy",
    creativeBase: 23,
    copy: "画面留白与短句形成节奏，让主体成为观点。"
  },
  lifestyle: {
    id: "lifestyle",
    name: "生活方式风",
    mood: "温暖、松弛、容易亲近",
    background: "#f2eadf",
    surface: "#e4d2bd",
    text: "#2f241d",
    accent: "#cf6f45",
    secondary: "#766353",
    font: "Arial, 'Microsoft YaHei', sans-serif",
    layout: "bottom-copy",
    creativeBase: 20,
    copy: "把场景转化为一种可以被向往的生活片段。"
  },
  commercial: {
    id: "commercial",
    name: "商业聚焦风",
    mood: "直接、醒目、有行动力",
    background: "#101010",
    surface: "#272727",
    text: "#ffffff",
    accent: "#ffcf33",
    secondary: "#c5c5c5",
    font: "Arial, 'Microsoft YaHei', sans-serif",
    layout: "right-product",
    creativeBase: 19,
    copy: "用强对比和清晰卖点，减少理解成本。"
  },
  experimental: {
    id: "experimental",
    name: "实验创意风",
    mood: "大胆、错位、具有探索感",
    background: "#25104a",
    surface: "#492278",
    text: "#f8f3ff",
    accent: "#c5ff3c",
    secondary: "#dab9ff",
    font: "Arial, 'Microsoft YaHei', sans-serif",
    layout: "offset-copy",
    creativeBase: 25,
    copy: "让标题和主体产生一次有控制的意外关系。"
  },
  cinematic: {
    id: "cinematic",
    name: "广告大片风",
    mood: "戏剧、电影、强叙事",
    background: "#0a1422",
    surface: "#1e3042",
    text: "#fff8ed",
    accent: "#e77b3a",
    secondary: "#d8c6ad",
    font: "Arial, 'Microsoft YaHei', sans-serif",
    layout: "cinematic-hero",
    creativeBase: 25,
    copy: "用电影级光影、尺度和一句主张，让画面先制造情绪。"
  }
};

export const IMAGE_TREATMENTS = {
  original: {
    id: "original",
    name: "保留原图",
    description: "保留原始摄影质感，只做曝光、对比度和安全区域优化。",
    operations: ["保留主体", "微调明暗", "为文字预留安全区域"]
  },
  enhance: {
    id: "enhance",
    name: "主体增强",
    description: "增强主体与背景的层次，让画面在缩略图下更醒目。",
    operations: ["提升主体对比", "压低干扰细节", "强化视觉焦点"]
  },
  duotone: {
    id: "duotone",
    name: "双色叙事",
    description: "把画面收束为主色与强调色，形成更明确的广告气质。",
    operations: ["限制色彩数量", "保留明暗层次", "统一品牌色倾向"]
  },
  line_art: {
    id: "line_art",
    name: "线描转译",
    description: "提取主体轮廓，转为更轻、更平面的线描表达。",
    operations: ["提取轮廓", "降低纹理噪声", "保留主体识别度"]
  },
  comic: {
    id: "comic",
    name: "漫画风格",
    description: "增强边缘和色块关系，把摄影画面转成更有传播力的漫画视觉。",
    operations: ["增强边缘", "分离色块", "提升色彩表现"]
  },
  simple_illustration: {
    id: "simple_illustration",
    name: "简笔插画",
    description: "简化细节、统一色块，保留主体动作和识别轮廓。",
    operations: ["简化细节", "统一色块", "保留主体轮廓"]
  },
  monochrome: {
    id: "monochrome",
    name: "单色印刷",
    description: "使用单色和颗粒感建立更克制的编辑与印刷气质。",
    operations: ["转为单色", "保留高光阴影", "加入轻微印刷质感"]
  },
  cinematic: {
    id: "cinematic",
    name: "电影级调色",
    description: "压暗环境、强化高光并制造冷暖分离，让主视觉拥有广告大片的镜头感。",
    operations: ["压暗背景", "强化高光", "冷暖分离", "保留主体纹理"]
  }
};

export const CREATIVE_MECHANISMS = [
  {
    id: "negative-space",
    name: "留白聚焦",
    description: "把画面中的空处变成标题和观点的空间。",
    keywords: ["留白", "安静", "建筑", "海", "山", "高级", "极简", "克制"],
    base: 23
  },
  {
    id: "contrast",
    name: "冷暖反差",
    description: "用色彩、情绪或尺度的反差制造第一眼记忆点。",
    keywords: ["反差", "夜", "霓虹", "新品", "促销", "大胆", "冲击", "未来"],
    base: 22
  },
  {
    id: "scene-desire",
    name: "场景欲望",
    description: "把产品或地点转译成用户想要进入的生活场景。",
    keywords: ["旅行", "咖啡", "生活", "度假", "体验", "温暖", "松弛", "美食"],
    base: 21
  },
  {
    id: "direct-value",
    name: "价值直达",
    description: "让卖点、利益或行动入口在最短路径内被看懂。",
    keywords: ["产品", "价格", "折扣", "购买", "活动", "报名", "限时", "新品"],
    base: 20
  },
  {
    id: "text-image-tension",
    name: "图文错位",
    description: "让标题不只是说明画面，而是给画面增加第二层含义。",
    keywords: ["故事", "电影", "人文", "展览", "艺术", "观点", "诗意", "实验"],
    base: 24
  },
  {
    id: "cinematic-scale",
    name: "电影级尺度",
    description: "用大景别、强光影和一句主张，把普通画面提升为广告大片的情绪入口。",
    keywords: ["大片", "广告感", "电影", "史诗", "镜头", "戏剧", "大片感", "高级质感"],
    base: 25
  },
  ...AWARD_LEARNING_MEMORY.mechanisms
];

const SUBJECT_RULES = [
  { id: "building", name: "建筑 / 空间", keywords: ["建筑", "空间", "房子", "民宿", "酒店", "海岸", "山海", "室内", "展馆"] },
  { id: "product", name: "产品 / 商品", keywords: ["产品", "商品", "新品", "购买", "折扣", "价格", "品牌", "包装", "咖啡", "美食"] },
  { id: "person", name: "人物 / 肖像", keywords: ["人物", "肖像", "人像", "演员", "模特", "采访", "人物故事"] },
  { id: "event", name: "活动 / 现场", keywords: ["活动", "展览", "发布会", "演出", "论坛", "报名", "现场", "节日"] },
  { id: "landscape", name: "自然 / 风景", keywords: ["风景", "自然", "旅行", "山", "海", "森林", "湖", "日落", "天空"] }
];

const DEFAULT_HEADLINES = {
  building: ["住进风景里", "让空间，重新靠近自然", "与海保持距离，与自己靠近一点"],
  product: ["把好东西，留给今天", "新品登场，刚好是现在", "让每一次选择，都有理由"],
  person: ["看见一个人的另一面", "把故事，留在镜头之外", "今天，听他好好说话"],
  event: ["现在，去现场", "一场值得到场的发生", "让灵感，准时抵达"],
  landscape: ["去看更大的世界", "风景之外，还有新的自己", "把今天交给远方"]
};

const GENERIC_HEADLINES = ["让内容，先被看见", "把想法，变成一张海报", "今天值得被认真表达"];
const EN_HEADLINES = ["Make Ideas Visible", "One Clear Idea", "Worth the Scroll"];
const EN_SUBHEADLINES = ["A clear visual idea, built for the feed", "One strong thought, made easy to remember", "Designed to be understood at a glance"];
const EN_SUBJECT_NAMES = {
  building: "Architecture / Space",
  product: "Product / Brand",
  person: "People / Portrait",
  event: "Event / Live Moment",
  landscape: "Nature / Landscape",
  general: "Creative Content"
};
const EN_MECHANISM_NAMES = {
  "negative-space": "Focused Negative Space",
  contrast: "Warm / Cool Contrast",
  "scene-desire": "Scene of Desire",
  "direct-value": "Direct Value",
  "text-image-tension": "Text–Image Tension",
  "cinematic-scale": "Cinematic Scale",
  "concept-before-decoration": "Concept Before Decoration",
  "function-to-emotion": "Function into Experience",
  "brand-truth": "Brand Truth",
  "platform-as-idea": "Platform as Idea",
  "human-connection": "Human Connection",
  "local-context": "Local Context",
  "proof-of-impact": "Proof of Impact"
};
const EN_MECHANISM_DESCRIPTIONS = {
  "negative-space": "Turn empty space into the place where the headline and point of view become visible.",
  contrast: "Use a warm/cool, emotional or scale contrast to create a first-glance memory point.",
  "scene-desire": "Translate a product or place into a life scene the audience wants to enter.",
  "direct-value": "Make the benefit, offer or next action understandable in the shortest path.",
  "text-image-tension": "Let the headline add a second meaning instead of merely describing the image.",
  "cinematic-scale": "Use scale, light and one clear statement to turn an ordinary scene into a cinematic emotional entry point.",
  "concept-before-decoration": "Start with a repeatable central idea, then let copy, image treatment and layout prove it.",
  "function-to-emotion": "Turn a feature or friction point into a visible, felt and usable experience.",
  "brand-truth": "Make the product’s irreplaceable truth drive the story.",
  "platform-as-idea": "Let the publishing platform and user behaviour become part of the idea.",
  "human-connection": "Build memory through a specific human relationship or emotion.",
  "local-context": "Use a culturally specific context without copying a surface style.",
  "proof-of-impact": "Bind the promise to a verifiable action, result, data point or scene."
};

export const LANGUAGE_PROFILES = {
  auto: { id: "auto", name: "自动识别" },
  zh: { id: "zh", name: "中文" },
  en: { id: "en", name: "English" }
};

function inferLanguage(input = {}) {
  if (input.language === "en" || input.language === "zh") return input.language;
  const text = [input.prompt, input.goal, input.headline, input.subheadline].filter(Boolean).join(" ");
  if (/[一-鿿]/.test(text)) return "zh";
  return /[A-Za-z]{3,}/.test(text) ? "en" : "zh";
}

function localizeSubject(subject, language) {
  return language === "en" ? { ...subject, name: EN_SUBJECT_NAMES[subject.id] ?? EN_SUBJECT_NAMES.general } : subject;
}

function localizeMechanism(mechanism, language) {
  if (language !== "en") return mechanism;
  return {
    ...mechanism,
    name: EN_MECHANISM_NAMES[mechanism.id] ?? mechanism.name,
    description: EN_MECHANISM_DESCRIPTIONS[mechanism.id] ?? mechanism.description
  };
}

function cleanText(value = "") {
  return String(value).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function lower(value = "") {
  return cleanText(value).toLowerCase();
}

function hash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 8);
}

function tokens(value) {
  return lower(value).split(/[\s,，。.!！?？、/|]+/).filter(Boolean);
}

function scoreKeywords(text, keywords) {
  const source = lower(text);
  return keywords.reduce((score, keyword) => score + (source.includes(lower(keyword)) ? 1 : 0), 0);
}

function getPlatformRule(platformId) {
  return AWARD_LEARNING_MEMORY.platformRules?.find(rule => rule.id === platformId) ?? null;
}

const RULE_STATUS_LABELS = {
  "official-behavior-rules-plus-internal-format-preset": "官方行为规则 + 系统适配预设",
  "operational-preset-not-currently-officially-verified": "运营预设，发布前以平台预览为准",
  "official-share-constraints-plus-vertical-preset": "官方分享约束 + 竖屏适配预设",
  "official-platform-spec": "官方平台规格",
  "official-ad-constraints-plus-vertical-preset": "官方广告约束 + 竖屏适配预设",
  "internal-cross-platform-preset": "跨平台系统预设",
  "award-and-ad-compliance-profile": "广告奖项与合规规则"
};

function scoreAttention(candidate, platformRule) {
  const headline = cleanText(candidate.headline);
  const length = [...headline].length;
  let score = 0;
  const signals = [];
  if (length >= 4 && length <= 14) {
    score += 3;
    signals.push("标题短而完整");
  } else if (length <= 18) {
    score += 2;
    signals.push("标题可缩略图阅读");
  }
  if (/[0-9一二三四五六七八九十]|[？?!！]/.test(headline) || ["为什么", "如何", "别", "真正", "第一", "清单", "避坑", "原来", "住进", "去看", "让"].some(word => headline.includes(word))) {
    score += 2;
    signals.push("存在结果、冲突或提问入口");
  }
  if (candidate.style?.id === "experimental" || candidate.style?.id === "cinematic") {
    score += 1;
    signals.push("视觉风格有第一眼差异");
  }
  if (candidate.mechanism?.id && candidate.mechanism.id !== "direct-value") {
    score += 1;
    signals.push("标题与创意机制形成关系");
  }
  if (candidate.imageEditPlan?.preserve?.length) {
    score += 1;
    signals.push("主视觉焦点明确");
  }
  if (cleanText(candidate.cta).length <= 8) {
    score += 1;
    signals.push("行动入口短而清楚");
  }
  if (platformRule?.id === "douyin_cover" && length <= 10) {
    score += 1;
    signals.push("适合竖屏三秒理解");
  }
  if (platformRule?.id === "wechat_header" && length <= 18) {
    score += 1;
    signals.push("适合横幅消息流阅读");
  }
  return { score: Math.min(10, score), signals };
}

function pickSubject(input) {
  const text = [input.prompt, input.subject, input.imageFeatures?.subject].filter(Boolean).join(" ");
  const ranked = SUBJECT_RULES.map(rule => ({ rule, score: scoreKeywords(text, rule.keywords) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score ? ranked[0].rule : { id: "general", name: "综合内容", keywords: [] };
}

function pickMechanism(input, subject) {
  const text = [input.prompt, input.goal, input.tone, subject.name].filter(Boolean).join(" ");
  if (text.includes("大片") || text.includes("广告感") || text.includes("史诗") || text.includes("电影级") || /\b(blockbuster|cinematic|film|hero campaign|advertising film)\b/i.test(text)) {
    return CREATIVE_MECHANISMS.find(item => item.id === "cinematic-scale");
  }
  const learned = getLearningMatches(text);
  if (learned[0]) return learned[0].item;
  const ranked = CREATIVE_MECHANISMS.map(item => ({ item, score: scoreKeywords(text, item.keywords) }))
    .sort((a, b) => (b.score - a.score) || (b.item.base - a.item.base));
  return ranked[0]?.score > 0
    ? ranked[0].item
    : CREATIVE_MECHANISMS.find(item => item.id === "concept-before-decoration") ?? CREATIVE_MECHANISMS[0];
}

function pickStyle(input, subject, index) {
  const text = [input.prompt, input.goal, input.tone, subject.name].filter(Boolean).join(" ");
  const toneStyle = input.tone.includes("大片") || text.includes("广告感") || text.includes("电影级") || /\b(blockbuster|cinematic|film)\b/i.test(text) ? "cinematic"
    : input.tone.includes("高级") || /\b(editorial|premium|minimal)\b/i.test(text) ? "editorial"
    : input.tone.includes("温暖") || /\b(warm|lifestyle|soft)\b/i.test(text) ? "lifestyle"
      : input.tone.includes("直接") || /\b(direct|bold|clear)\b/i.test(text) ? "commercial"
        : input.tone.includes("大胆") || /\b(experimental|unexpected)\b/i.test(text) ? "experimental"
          : "";
  const preferred = subject.id === "building" || subject.id === "landscape"
    ? ["editorial", "experimental", "lifestyle", "commercial"]
    : subject.id === "product"
      ? ["commercial", "lifestyle", "editorial", "experimental"]
      : subject.id === "event"
        ? ["experimental", "commercial", "editorial", "lifestyle"]
        : ["editorial", "lifestyle", "experimental", "commercial"];
  const requested = Object.keys(STYLE_PROFILES).find(styleId => text.includes(styleId));
  const styleId = toneStyle || requested || preferred[index % preferred.length];
  return STYLE_PROFILES[styleId];
}

function buildCopy(input, subject, index) {
  const explicit = cleanText(input.headline);
  if (explicit) return explicit;
  if (input.language === "en") return EN_HEADLINES[index % EN_HEADLINES.length];
  const source = DEFAULT_HEADLINES[subject.id] ?? GENERIC_HEADLINES;
  return source[index % source.length];
}

function buildSubheadline(input, subject, mechanism, style) {
  const explicit = cleanText(input.subheadline);
  if (explicit) return explicit;
  if (input.language === "en") return EN_SUBHEADLINES[(subject.id.length + subject.id.charCodeAt(0)) % EN_SUBHEADLINES.length];
  const goal = cleanText(input.goal);
  if (goal) return goal.length > 52 ? `${goal.slice(0, 50)}…` : goal;
  const defaults = {
    building: "在风、岩石与潮汐之间，重新定义当代旅居",
    product: "把日常的好，做得更值得被看见",
    person: "一段关于人、时间与当下的真实记录",
    event: "在现场，遇见新的灵感与连接",
    landscape: "把风景留给眼睛，把时间还给自己",
    general: "一张海报，先让想法被看见"
  };
  return defaults[subject.id] ?? defaults.general;
}

function pickImageTreatment(input, subject, style, index) {
  const text = [input.prompt, input.goal, input.tone].filter(Boolean).join(" ");
  const explicit = text.includes("线描") || text.includes("线稿") ? "line_art"
    : text.includes("漫画") || text.includes("动漫") ? "comic"
      : text.includes("简笔") || text.includes("插画") ? "simple_illustration"
        : text.includes("黑白") || text.includes("单色") || text.includes("印刷") ? "monochrome"
            : text.includes("双色") || text.includes("双调") ? "duotone"
              : text.includes("大片") || text.includes("广告感") || text.includes("电影级") ? "cinematic"
            : "";
  const automatic = index === 0 ? "original"
    : index === 1 ? "enhance"
      : explicit || (style.id === "cinematic" ? "cinematic" : subject.id === "building" || subject.id === "landscape" || style.id === "experimental" ? "duotone" : "enhance");
  const treatment = IMAGE_TREATMENTS[explicit || automatic] ?? IMAGE_TREATMENTS.original;
  return { ...treatment, automatic: !explicit };
}

function compactInput(input = {}) {
  const language = inferLanguage(input);
  return {
    prompt: cleanText(input.prompt),
    goal: cleanText(input.goal),
    tone: cleanText(input.tone),
    subject: cleanText(input.subject),
    headline: cleanText(input.headline),
    subheadline: cleanText(input.subheadline),
    cta: cleanText(input.cta) || "了解更多",
    removeElements: cleanText(input.removeElements),
    addElements: cleanText(input.addElements),
    platform: PLATFORM_PROFILES[input.platform] ? input.platform : "xhs_cover",
    language,
    mode: input.mode === "professional" ? "professional" : "automatic",
    imageDataUrl: input.imageDataUrl || "",
    imagePath: cleanText(input.imagePath),
    imageFeatures: input.imageFeatures || {}
  };
}

export function analyzeInput(rawInput = {}) {
  const input = compactInput(rawInput);
  const subject = pickSubject(input);
  const localizedSubject = localizeSubject(subject, input.language);
  const mechanism = localizeMechanism(pickMechanism(input, subject), input.language);
  const platform = PLATFORM_PROFILES[input.platform];
  const platformRule = getPlatformRule(input.platform);
  const learning = getLearningMemorySummary([input.prompt, input.goal, input.tone, subject.name].filter(Boolean).join(" "));
  return {
    language: input.language,
    subject: { id: localizedSubject.id, name: localizedSubject.name },
    mechanism: { id: mechanism.id, name: mechanism.name, description: mechanism.description },
    platform,
    platformRule: platformRule ? {
      id: platformRule.id,
      platform: platformRule.platform,
      ruleStatus: platformRule.ruleStatus,
      ruleStatusLabel: RULE_STATUS_LABELS[platformRule.ruleStatus] ?? platformRule.ruleStatus,
      format: platformRule.format,
      hardRules: platformRule.hardRules,
      attentionRules: platformRule.attentionRules,
      officialUrls: platformRule.officialUrls ?? []
    } : null,
    learning,
    imageFeatures: {
      subject: input.imageFeatures.subject || localizedSubject.name,
      dominantColor: input.imageFeatures.dominantColor || "#173f5f",
      aspectRatio: input.imageFeatures.aspectRatio || "unknown",
      safeTextRegion: input.imageFeatures.safeTextRegion || "自动推断"
    },
    rationale: input.language === "en"
      ? `Identified as ${localizedSubject.name}. Recommended “${mechanism.name}” because ${mechanism.description}`
      : `识别为${localizedSubject.name}，推荐“${mechanism.name}”，因为${mechanism.description}`
  };
}

function makeCandidate(input, analysis, index) {
  const style = pickStyle(input, { id: analysis.subject.id, name: analysis.subject.name }, index);
  const mechanismBase = CREATIVE_MECHANISMS.find(item => item.id === analysis.mechanism.id) ?? CREATIVE_MECHANISMS[0];
  const mechanism = localizeMechanism(mechanismBase, input.language);
  const imageTreatment = pickImageTreatment(input, { id: analysis.subject.id, name: analysis.subject.name }, style, index);
  const headline = buildCopy(input, { id: analysis.subject.id, name: analysis.subject.name }, index);
  const subheadline = buildSubheadline(input, { id: analysis.subject.id, name: analysis.subject.name }, mechanism, style);
  const composition = buildCompositionPlan({ styleId: style.id, mechanismId: mechanism.id, platformRatio: analysis.platform?.ratio, language: input.language, index });
  const typography = buildTypographyPlan({ input, platform: analysis.platform, style, mechanism, imageFeatures: analysis.imageFeatures, headline, subheadline, composition });
  const id = `poster-${hash([input.prompt, input.platform, style.id, mechanism.id, index].join("|"))}`;
  const candidate = {
    id,
    version: "0.7",
    language: input.language,
    subject: analysis.subject,
    targetPlatform: analysis.platform,
    platformRule: analysis.platformRule,
    imageFeatures: analysis.imageFeatures,
    headline,
    subheadline,
    cta: input.language === "en" && input.cta === "了解更多" ? "Learn more" : input.cta,
    image: {
      dataUrl: input.imageDataUrl,
      path: input.imagePath,
      alt: input.language === "en" ? `${analysis.subject.name} key visual` : `${analysis.subject.name}主视觉`
    },
    style: {
      id: style.id,
      name: style.name,
      mood: style.mood,
      background: style.background,
      surface: style.surface,
      text: style.text,
      accent: style.accent,
      secondary: style.secondary,
      font: style.font
    },
    layout: {
      id: composition.id,
      name: composition.name,
      note: composition.note,
      alignment: composition.alignment,
      regions: composition.regions,
      safeTextRegion: analysis.imageFeatures.safeTextRegion,
      imageTreatment: index === 0 ? "保留主视觉，使用轻微遮罩" : index === 1 ? "局部放大，增强焦点" : "分割画面，制造节奏"
    },
    composition,
    imageTreatment,
    typography,
    imageEditPlan: {
      preserve: [analysis.subject.name],
      remove: input.removeElements ? input.removeElements.split(/[，,、]/).map(cleanText).filter(Boolean) : [],
      add: input.addElements ? input.addElements.split(/[，,、]/).map(cleanText).filter(Boolean) : [],
      transform: imageTreatment,
      operations: imageTreatment.operations,
      crop: analysis.imageFeatures.safeTextRegion
    },
    mechanism: {
      id: mechanism.id,
      name: mechanism.name,
      description: mechanism.description,
      sourceTags: mechanism.sourceTags ?? []
    },
    learning: analysis.learning,
    editable: {
      headline: true,
      subheadline: true,
      cta: true,
      imageTreatment: input.mode === "professional",
      style: input.mode === "professional",
      layout: input.mode === "professional"
    },
    rationale: `${style.copy} ${mechanism.description}`
  };
  candidate.sceneGraph = buildSceneGraph(candidate);
  candidate.evaluation = evaluateDesign(candidate, input);
  candidate.typography = candidate.evaluation.typography ?? candidate.typography;
  candidate.sceneGraph = buildSceneGraph(candidate);
  return candidate;
}

export function evaluateDesign(candidate, input = {}) {
  const platform = PLATFORM_PROFILES[candidate.targetPlatform?.id] ?? PLATFORM_PROFILES.xhs_cover;
  const platformRule = getPlatformRule(candidate.targetPlatform?.id);
  const composition = candidate.composition ?? buildCompositionPlan({ styleId: candidate.style?.id, mechanismId: candidate.mechanism?.id, platformRatio: platform?.ratio, language: candidate.language ?? input.language });
  const automaticTypography = buildTypographyPlan({ input: { ...input, language: candidate.language ?? input.language }, platform, style: candidate.style, mechanism: candidate.mechanism, imageFeatures: { ...(candidate.imageFeatures ?? {}), ...(input.imageFeatures ?? {}) }, headline: candidate.headline, subheadline: candidate.subheadline, composition });
  const typography = candidate.typography?.automatic === false
    ? refreshTypographyPlan({
        ...automaticTypography,
        ...Object.fromEntries(["preset", "presetName", "fontFamily", "fontWeight", "headlineFontSize", "previewHeadlineSize", "subheadlineFontSize", "kickerFontSize", "footerFontSize", "lineHeight", "letterSpacing", "letterSpacingCss", "headlineColor", "secondaryColor", "accentColor", "backgroundColor", "alignment"].filter(key => candidate.typography[key] !== undefined).map(key => [key, candidate.typography[key]])),
        automatic: false
      })
    : automaticTypography;
  const headlineLength = [...cleanText(candidate.headline)].length;
  const subheadlineLength = [...cleanText(candidate.subheadline)].length;
  const attention = scoreAttention(candidate, platformRule);
  const gates = [
    { id: "copy-present", label: "文字内容完整", passed: headlineLength > 0 && subheadlineLength > 0 },
    { id: "headline-length", label: "标题适合缩略图阅读", passed: headlineLength <= 18 },
    { id: "subheadline-length", label: "副标题密度可控", passed: subheadlineLength <= 52 },
    { id: "cta-present", label: "行动入口明确", passed: cleanText(candidate.cta).length > 0 },
    { id: "layout-safe", label: "存在文字安全区域", passed: Boolean(candidate.layout?.safeTextRegion) },
    { id: "platform-ready", label: "平台规格已确定", passed: Boolean(platform?.ratio) },
    { id: "structured", label: "设计保持可编辑结构", passed: Boolean(candidate.style?.id && candidate.layout?.id) },
    { id: "typography-readable", label: "字体层级、对比与安全区合格", passed: Number(typography?.score ?? 0) >= 70 && typography?.passesContrastFloor !== false },
    { id: "attention-hook", label: "封面具备第一眼入口", passed: attention.score >= 5 }
  ];
  const hardGatePassed = gates.every(gate => gate.passed);
  const styleBase = STYLE_PROFILES[candidate.style?.id]?.creativeBase ?? 18;
  const mechanismBase = CREATIVE_MECHANISMS.find(item => item.id === candidate.mechanism?.id)?.base ?? 18;
  const memoryMechanism = CREATIVE_MECHANISMS.find(item => item.id === candidate.mechanism?.id);
  const learningAlignment = memoryMechanism?.sourceTags?.length ? 8 : 6;
  const taskFit = platform.id === candidate.targetPlatform?.id ? 14 : 10;
  const creative = Math.min(25, Math.round((styleBase + mechanismBase) / 2));
  const differentiation = candidate.style?.id === "experimental" ? 14 : 12;
  const craft = hardGatePassed ? 17 : 11;
  const localization = candidate.language === "en"
    ? (/[A-Za-z]/.test(candidate.headline) ? 9 : 6)
    : (/[\u4e00-\u9fff]/.test(candidate.headline) ? 9 : 6);
  const effectivenessBase = headlineLength <= 14 && cleanText(candidate.cta).length <= 8 ? 13 : 10;
  const effectiveness = Math.min(15, effectivenessBase + (attention.score >= 8 ? 2 : attention.score >= 6 ? 1 : 0));
  const scores = {
    taskFit,
    creative,
    differentiation,
    craft,
    localization,
    effectiveness,
    learningAlignment
  };
  const rawTotal = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const total = Math.min(100, rawTotal);
  const publishScore = Math.round((taskFit / 15) * 20 + (craft / 20) * 25 + (localization / 10) * 15 + (effectiveness / 15) * 40);
  const creativeScore = Math.round((creative / 25) * 45 + (differentiation / 15) * 25 + (craft / 20) * 15 + (learningAlignment / 8) * 15);
  const awardComparison = compareAwardSystems(candidate, { ...scores, rawTotal }, { platformRule, hardGatePassed, attention, typography });
  const level = hardGatePassed && total >= 80 ? (creativeScore >= 82 ? "L3" : total >= 86 ? "L2" : "L1") : "未通过";
  return {
    hardGatePassed,
    gates,
    scores,
    attentionScore: attention.score,
    attentionSignals: attention.signals,
    typography,
    typographyScore: typography.score,
    total,
    publishScore,
    creativeScore,
    awardComparison,
    level,
    recommendation: hardGatePassed && publishScore >= 78 && attention.score >= 5 ? "可直接发布" : "需要自动修复后再发布"
  };
}

function compareAwardSystems(candidate, scores, context) {
  const mechanismId = candidate.mechanism?.id;
  const impactMechanisms = new Set(["function-to-emotion", "brand-truth", "human-connection", "proof-of-impact", "platform-as-idea"]);
  const writing = Math.min(20, (cleanText(candidate.headline).length <= 14 ? 16 : cleanText(candidate.headline).length <= 18 ? 11 : 6) + (cleanText(candidate.subheadline).length <= 42 ? 4 : 1));
  const concept = mechanismId && mechanismId !== "direct-value" ? 18 : 11;
  const artDirection = Math.min(20, Math.round((scores.creative / 25) * 12) + (candidate.imageTreatment?.id !== "original" ? 4 : 2) + (candidate.style?.id === "experimental" || candidate.style?.id === "cinematic" ? 4 : 2));
  const media = Math.min(20, (context.platformRule?.format?.verified ? 15 : 11) + Math.round(context.attention.score / 2));
  const impact = impactMechanisms.has(mechanismId) ? 18 : 12;
  const craft = Math.min(20, Math.round((scores.craft / 20) * 16) + (context.hardGatePassed ? 4 : 1));
  const compliance = context.hardGatePassed ? 15 : 7;
  const typography = Math.min(20, Math.round((context.typography?.score ?? 70) / 100 * 20));
  const internationalScore = Math.round(
    (concept / 20) * 18 + (writing / 20) * 13 + (artDirection / 20) * 17 + (typography / 20) * 15 + (media / 20) * 12 + (impact / 20) * 10 + (craft / 20) * 8 + (scores.differentiation / 15) * 7
  );
  const chinaScore = Math.round(
    (concept / 20) * 14 + (writing / 20) * 10 + (artDirection / 20) * 14 + (typography / 20) * 14 + (media / 20) * 10 + (impact / 20) * 14 + (craft / 20) * 10 + (scores.effectiveness / 15) * 8 + (scores.localization / 10) * 4 + (compliance / 15) * 2
  );
  const innovationSignals = [
    mechanismId && mechanismId !== "direct-value",
    mechanismId === "platform-as-idea",
    candidate.style?.id === "experimental" || candidate.style?.id === "cinematic",
    candidate.imageTreatment?.id && candidate.imageTreatment.id !== "original",
    candidate.mechanism?.sourceTags?.length >= 2,
    context.typography?.preset && context.typography.preset !== "editorial"
  ].filter(Boolean).length;
  const readiness = score => score >= 85 ? "接近奖项评审线" : score >= 75 ? "具备入围基础" : "需要继续递归优化";
  return {
    modelVersion: "award-bridge-v0.5",
    disclaimer: "这是基于公开奖项原则的内部启发式对标，不等同于评委真实打分。",
    dimensions: { concept, writing, artDirection, typography, media, impact, craft, compliance },
    international: { label: "国际广告奖项对标", score: internationalScore, threshold: 85, gap: Math.max(0, 85 - internationalScore), readiness: readiness(internationalScore) },
    china: { label: "中国广告奖项对标", score: chinaScore, threshold: 85, gap: Math.max(0, 85 - chinaScore), readiness: readiness(chinaScore) },
    innovationIndex: Math.round((innovationSignals / 6) * 100)
  };
}

export function generateCandidates(rawInput = {}) {
  const input = compactInput(rawInput);
  const analysis = analyzeInput(input);
  const candidates = [0, 1, 2].map(index => makeCandidate(input, analysis, index));
  candidates.sort((a, b) => {
    const publishDelta = b.evaluation.publishScore - a.evaluation.publishScore;
    return publishDelta || b.evaluation.total - a.evaluation.total;
  });
  return {
    specVersion: "0.7",
    generatedAt: new Date().toISOString(),
    input,
    analysis,
    selectedId: candidates[0]?.id,
    candidates
  };
}

const COLOR_ALIASES = {
  "哑金": MATTE_GOLD,
  "哑金色": MATTE_GOLD,
  "磨砂金": MATTE_GOLD,
  "matte gold": MATTE_GOLD,
  "白色": "#ffffff",
  "黑色": "#111111"
};

function commandColor(text) {
  const hex = String(text).match(/#[0-9a-f]{6}\b/i)?.[0];
  if (hex) return hex;
  const alias = Object.keys(COLOR_ALIASES).find(key => String(text).toLowerCase().includes(key.toLowerCase()));
  return alias ? COLOR_ALIASES[alias] : null;
}

function commandValue(text, pattern) {
  const match = String(text).match(pattern);
  return match?.[1]?.replace(/[“”"「」].*$/u, "").replace(/[。！!；;]+$/u, "").trim() ?? "";
}

/**
 * Convert a short natural-language instruction into the safe command shape
 * consumed by applyDesignCommand. External AI clients may skip this parser and
 * send the structured command directly.
 */
export function parseDesignCommand(rawCommand = {}, context = {}) {
  if (rawCommand && typeof rawCommand === "object" && !Array.isArray(rawCommand)) return { ...rawCommand };
  const text = cleanText(rawCommand);
  const selectedId = context.selection?.id && context.selection.id !== "root" ? context.selection.id : "headline";
  if (!text) throw new Error("设计命令不能为空");

  const textTarget = /副标题|subheadline/i.test(text) ? "subheadline" : /行动入口|按钮|cta/i.test(text) ? "cta" : "headline";
  const copy = commandValue(text, /(?:主标题|标题|副标题|行动入口|按钮|headline|subheadline|cta).*?(?:改为|改成|修改为|换成|设置为)\s*[“"「]?(.+?)\s*[”"」]?$/iu);
  if (copy) return { type: "set_text", targetId: textTarget, value: copy };

  const color = commandColor(text);
  if (color && /字体|文字|颜色|色彩|哑金|matte gold/i.test(text)) {
    return {
      type: "set_typography",
      targetId: selectedId,
      patch: { headlineColor: color, secondaryColor: color, accentColor: color },
      rationale: color === MATTE_GOLD ? "将所有可见文字统一为哑金色" : "更新可见文字颜色"
    };
  }

  const fontSize = text.match(/(?:字号|字体大小|font size)\s*(?:改为|改成|设置为|为)?\s*(\d{2,3})\s*(?:px|像素)?/iu)?.[1];
  if (fontSize) return { type: "set_typography", targetId: selectedId, patch: { headlineFontSize: Number(fontSize) } };

  const letterSpacing = text.match(/(?:字距|字间距|letter spacing)\s*(?:改为|改成|设置为|为)?\s*(-?\d+(?:\.\d+)?)\s*(?:px|像素)?/iu)?.[1];
  if (letterSpacing) return { type: "set_typography", targetId: selectedId, patch: { letterSpacing: Number(letterSpacing) } };

  const treatmentMap = [
    ["线描", "line_art"], ["线稿", "line_art"], ["漫画", "comic"], ["动漫", "comic"],
    ["简笔", "simple_illustration"], ["插画", "simple_illustration"], ["黑白", "monochrome"],
    ["单色", "monochrome"], ["双色", "duotone"], ["双调", "duotone"], ["电影级", "cinematic"],
    ["广告大片", "cinematic"], ["主体增强", "enhance"], ["原图", "original"]
  ];
  const treatment = treatmentMap.find(([label]) => text.includes(label));
  if (treatment && /画面|图片|图像|风格|调色|处理|改成|变成/.test(text)) {
    return { type: "set_image_treatment", treatmentId: treatment[1] };
  }

  const remove = commandValue(text, /(?:移除|删除|去掉|remove)\s*[：:]?\s*(.+)$/iu);
  if (remove) return { type: "set_image_edit_plan", remove: remove.split(/[，,、]/).map(cleanText).filter(Boolean) };
  const add = commandValue(text, /(?:增加|添加|加入|补充|add)\s*[：:]?\s*(.+)$/iu);
  if (add) return { type: "set_image_edit_plan", add: add.split(/[，,、]/).map(cleanText).filter(Boolean) };

  if (/居中|center/i.test(text)) return { type: "set_layout", patch: { alignment: "center" } };
  if (/左对齐|左侧|left/i.test(text)) return { type: "set_layout", patch: { alignment: "left" } };
  if (/右对齐|右侧|right/i.test(text)) return { type: "set_layout", patch: { alignment: "right" } };
  throw new Error(`暂不支持这条自然语言设计命令：${text}`);
}

function normalizeCommandPatch(patch = {}) {
  const allowed = ["preset", "presetName", "fontFamily", "fontWeight", "headlineFontSize", "letterSpacing", "headlineColor", "secondaryColor", "accentColor", "lineHeight", "alignment"];
  const normalized = Object.fromEntries(allowed.filter(key => patch[key] !== undefined).map(key => [key, patch[key]]));
  for (const key of ["headlineColor", "secondaryColor", "accentColor"]) {
    if (normalized[key] !== undefined) {
      const color = commandColor(normalized[key]);
      if (!color) throw new Error(`${key} 必须是六位十六进制颜色或受支持的颜色名称`);
      normalized[key] = color;
    }
  }
  const bounded = (value, min, max, label) => {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`${label} 必须是数字`);
    return Math.min(max, Math.max(min, number));
  };
  if (normalized.headlineFontSize !== undefined) normalized.headlineFontSize = bounded(normalized.headlineFontSize, 24, 160, "字号");
  if (normalized.letterSpacing !== undefined) normalized.letterSpacing = bounded(normalized.letterSpacing, -8, 12, "字距");
  if (normalized.fontWeight !== undefined) normalized.fontWeight = bounded(normalized.fontWeight, 100, 900, "字重");
  if (normalized.lineHeight !== undefined) normalized.lineHeight = bounded(normalized.lineHeight, 0.7, 1.6, "行高");
  if (normalized.fontFamily !== undefined) normalized.fontFamily = cleanText(normalized.fontFamily).replace(/[;{}]/g, "").slice(0, 180);
  return normalized;
}

function updateLayout(candidate, alignment) {
  if (!["left", "center", "right"].includes(alignment)) throw new Error("布局对齐方式只能是 left、center 或 right");
  const composition = structuredClone(candidate.composition ?? {});
  const regions = structuredClone(composition.regions ?? candidate.layout?.regions ?? {});
  const x = alignment === "center" ? 0.5 : alignment === "right" ? 0.93 : 0.07;
  for (const key of ["kicker", "headline", "subheadline"]) regions[key] = { ...(regions[key] ?? {}), x, anchor: alignment === "center" ? "middle" : alignment === "right" ? "end" : "start" };
  composition.alignment = alignment;
  composition.regions = regions;
  candidate.composition = composition;
  candidate.layout = { ...(candidate.layout ?? {}), alignment, regions };
}

/**
 * Apply only allow-listed, semantic design commands. This is the mutation gate
 * for the WebUI session bar and Codex/Claude Code/WorkBuddy integrations.
 */
export function applyDesignCommand(candidate = {}, rawCommand = {}, options = {}) {
  const context = inspectSceneContext(candidate, options.targetId ?? rawCommand?.targetId ?? "root");
  const command = parseDesignCommand(rawCommand, context);
  const updated = structuredClone(candidate);
  const targetId = command.targetId ?? context.selection.id;

  switch (command.type) {
    case "set_text": {
      if (!["headline", "subheadline", "cta"].includes(targetId)) throw new Error("文字命令只能修改主标题、副标题或行动入口");
      updated[targetId] = cleanText(command.value);
      if (!updated[targetId]) throw new Error("文字内容不能为空");
      break;
    }
    case "set_typography": {
      const patch = normalizeCommandPatch(command.patch);
      if (!Object.keys(patch).length) throw new Error("没有可应用的字体或排版属性");
      updated.typography = { ...(updated.typography ?? {}), ...patch, automatic: false };
      break;
    }
    case "set_image_treatment": {
      const treatment = IMAGE_TREATMENTS[command.treatmentId];
      if (!treatment) throw new Error(`未知画面处理方式：${command.treatmentId}`);
      updated.imageTreatment = { ...treatment, automatic: false };
      updated.imageEditPlan = { ...(updated.imageEditPlan ?? {}), transform: { ...treatment, automatic: false }, operations: treatment.operations };
      break;
    }
    case "set_image_edit_plan": {
      const plan = updated.imageEditPlan ?? {};
      if (command.add !== undefined) plan.add = Array.isArray(command.add) ? command.add.map(cleanText).filter(Boolean) : [cleanText(command.add)].filter(Boolean);
      if (command.remove !== undefined) plan.remove = Array.isArray(command.remove) ? command.remove.map(cleanText).filter(Boolean) : [cleanText(command.remove)].filter(Boolean);
      updated.imageEditPlan = plan;
      break;
    }
    case "set_layout":
      updateLayout(updated, command.patch?.alignment ?? command.alignment);
      break;
    case "set_style": {
      const color = commandColor(command.patch?.color ?? command.patch?.fill);
      if (!color) throw new Error("样式命令目前需要提供 color 或 fill");
      updated.typography = { ...(updated.typography ?? {}), headlineColor: color, secondaryColor: color, accentColor: color, automatic: false };
      break;
    }
    default:
      throw new Error(`不允许的设计命令类型：${command.type}`);
  }

  updated.evaluation = evaluateDesign(updated, { language: updated.language });
  updated.typography = updated.evaluation.typography ?? updated.typography;
  updated.sceneGraph = buildSceneGraph(updated);
  updated.editHistory = [...(updated.editHistory ?? []), {
    type: command.type,
    targetId,
    source: options.source ?? "design-command",
    command
  }].slice(-20);
  return {
    candidate: updated,
    command,
    context: inspectSceneContext(updated, targetId),
    evaluation: updated.evaluation
  };
}

function escapeXml(value = "") {
  return String(value).replace(/[<>&'"]/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[char]));
}

export function renderSvg(candidate) {
  const width = candidate.targetPlatform?.width ?? 900;
  const height = candidate.targetPlatform?.height ?? 1200;
  const style = candidate.style ?? STYLE_PROFILES.editorial;
  const treatmentId = candidate.imageTreatment?.id ?? "original";
  const typographyBase = candidate.typography ?? buildTypographyPlan({ input: { language: candidate.language }, platform: candidate.targetPlatform, style, mechanism: candidate.mechanism, headline: candidate.headline, subheadline: candidate.subheadline });
  const typography = { ...typographyBase, secondaryColor: typographyBase.headlineColor ?? style.text, accentColor: typographyBase.headlineColor ?? style.text };
  const imageHref = candidate.image?.dataUrl;
  const image = imageHref
    ? `<image href="${escapeXml(imageHref)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" opacity="0.82"/>`
    : `<rect x="0" y="0" width="${width}" height="${height}" fill="${style.background}"/><circle cx="${width * 0.76}" cy="${height * 0.3}" r="${Math.min(width, height) * 0.28}" fill="${style.accent}" opacity="0.72"/><path d="M0 ${height * 0.78} C${width * 0.25} ${height * 0.56}, ${width * 0.55} ${height * 0.9}, ${width} ${height * 0.62} L${width} ${height} L0 ${height} Z" fill="${style.surface}"/>`;
  const treatmentFilter = treatmentId === "line_art"
    ? `<filter id="image-treatment"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="2.1" intercept="-.45"/><feFuncG type="linear" slope="2.1" intercept="-.45"/><feFuncB type="linear" slope="2.1" intercept="-.45"/></feComponentTransfer></filter>`
    : treatmentId === "monochrome"
      ? `<filter id="image-treatment"><feColorMatrix type="saturate" values="0"/></filter>`
      : treatmentId === "duotone"
        ? `<filter id="image-treatment"><feColorMatrix type="matrix" values=".25 .25 .25 0 0.05 .18 .18 .18 0 0.12 .4 .4 .4 0 0.2 0 0 0 1 0"/></filter>`
        : treatmentId === "comic"
          ? `<filter id="image-treatment"><feComponentTransfer><feFuncR type="discrete" tableValues=".08 .35 .72 1"/><feFuncG type="discrete" tableValues=".08 .35 .72 1"/><feFuncB type="discrete" tableValues=".08 .35 .72 1"/></feComponentTransfer></filter>`
          : `<filter id="image-treatment"><feComponentTransfer><feFuncR type="linear" slope="1.12"/><feFuncG type="linear" slope="1.12"/><feFuncB type="linear" slope="1.12"/></feComponentTransfer></filter>`;
  const gradient = `<linearGradient id="shade" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${style.background}" stop-opacity="0.88"/><stop offset="0.72" stop-color="${style.background}" stop-opacity="0.12"/><stop offset="1" stop-color="#000000" stop-opacity="0.55"/></linearGradient>`;

  // Composition-driven placement (v0.6). Falls back to editorial-thirds geometry
  // so older saved candidates still render.
  const regions = candidate.composition?.regions ?? candidate.layout?.regions ?? {
    kicker: { x: 0.07, y: 0.18, anchor: "start" },
    headline: { x: 0.07, y: 0.39, anchor: "start" },
    subheadline: { x: 0.07, y: 0.48, anchor: "start" },
    footer: { x: 0.07, y: 0.88, anchor: "start" }
  };
  const anchorAttr = anchor => (anchor === "middle" ? ' text-anchor="middle"' : anchor === "end" ? ' text-anchor="end"' : "");
  const px = (region, axis) => (axis === "x" ? width : height) * (region?.[axis] ?? 0);
  const font = escapeXml(typography.fontFamily ?? style.font);
  const kicker = regions.kicker ?? { x: 0.07, y: 0.18, anchor: "start" };
  const head = regions.headline ?? { x: 0.07, y: 0.39, anchor: "start" };
  const sub = regions.subheadline ?? { x: 0.07, y: 0.48, anchor: "start" };
  const foot = regions.footer ?? { x: 0.07, y: 0.88, anchor: "start" };
  const footerRightX = width * 0.93;
  const barX = kicker.anchor === "middle" ? width * 0.46 : px(kicker, "x");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>${gradient}${treatmentFilter}</defs>
  <g filter="url(#image-treatment)">${image}</g>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#shade)"/>
  <rect x="${barX}" y="${px(kicker, "y") - height * 0.04}" width="${width * 0.08}" height="4" fill="${style.accent}"/>
  <text x="${px(kicker, "x")}" y="${px(kicker, "y")}"${anchorAttr(kicker.anchor)} fill="${escapeXml(typography.secondaryColor ?? style.secondary)}" font-family="${font}" font-size="${typography.kickerFontSize ?? Math.max(18, width * 0.022)}" font-weight="600" letter-spacing="3">${escapeXml(candidate.subject?.name ?? "视觉海报")}</text>
  <text x="${px(head, "x")}" y="${px(head, "y")}"${anchorAttr(head.anchor)} fill="${escapeXml(typography.headlineColor ?? style.text)}" font-family="${font}" font-size="${typography.headlineFontSize ?? Math.max(42, width * 0.075)}" font-weight="${typography.fontWeight ?? 700}" letter-spacing="${typography.letterSpacing ?? 0}">${escapeXml(candidate.headline)}</text>
  <text x="${px(sub, "x")}" y="${px(sub, "y")}"${anchorAttr(sub.anchor)} fill="${escapeXml(typography.secondaryColor ?? style.secondary)}" font-family="${font}" font-size="${typography.subheadlineFontSize ?? Math.max(18, width * 0.025)}" letter-spacing="${Math.max(-0.5, (typography.letterSpacing ?? 0) * 0.4)}">${escapeXml(candidate.subheadline)}</text>
  <line x1="${width * 0.07}" y1="${px(foot, "y") - height * 0.04}" x2="${width * 0.93}" y2="${px(foot, "y") - height * 0.04}" stroke="${style.secondary}" stroke-opacity="0.5"/>
  <text x="${width * 0.07}" y="${px(foot, "y")}" fill="${escapeXml(typography.headlineColor ?? style.text)}" font-family="${font}" font-size="${typography.footerFontSize ?? Math.max(18, width * 0.022)}">${escapeXml(candidate.mechanism?.name ?? "创意表达")}</text>
  <text x="${footerRightX}" y="${px(foot, "y")}" text-anchor="end" fill="${escapeXml(typography.accentColor ?? style.accent)}" font-family="${font}" font-size="${typography.footerFontSize ?? Math.max(18, width * 0.022)}" font-weight="700">${escapeXml(candidate.cta ?? "了解更多")}</text>
</svg>`;
}

export function summarizeRun(run) {
  return {
    selectedId: run.selectedId,
    analysis: run.analysis,
    candidates: run.candidates.map(candidate => ({
      id: candidate.id,
      headline: candidate.headline,
      style: candidate.style.name,
      mechanism: candidate.mechanism.name,
      evaluation: candidate.evaluation
    }))
  };
}
