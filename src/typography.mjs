const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// WCAG 2.1 contrast thresholds. Large text (>= ~24px bold display) may use the
// relaxed 3.0 large-text ratio; body/subheadline copy must meet 4.5.
export const AA_NORMAL = 4.5;
export const AA_LARGE = 3.0;
// Muted gold is the default advertising-display color. Keep darker variants
// so automatic matching can preserve readability on lighter images.
export const MATTE_GOLD = "#c4a46a";
export const MATTE_GOLD_DARK = "#806331";
export const MATTE_GOLD_DEEP = "#5f431a";

export const TYPOGRAPHY_PRESETS = {
  editorial: {
    id: "editorial",
    name: "编辑无衬线",
    zhFamily: "'Noto Sans SC', 'Microsoft YaHei', Arial, sans-serif",
    enFamily: "Inter, 'Helvetica Neue', Arial, sans-serif",
    weight: 700,
    tracking: -0.025,
    lineHeight: 1.04
  },
  cinematic: {
    id: "cinematic",
    name: "电影窄体",
    zhFamily: "'Microsoft YaHei', 'Noto Sans SC', Arial, sans-serif",
    enFamily: "'Arial Narrow', 'Helvetica Neue', Arial, sans-serif",
    weight: 800,
    tracking: -0.055,
    lineHeight: 0.96
  },
  commercial: {
    id: "commercial",
    name: "商业粗体",
    zhFamily: "'Noto Sans SC', 'Microsoft YaHei', Arial, sans-serif",
    enFamily: "Arial, 'Helvetica Neue', sans-serif",
    weight: 800,
    tracking: -0.035,
    lineHeight: 1.02
  },
  lifestyle: {
    id: "lifestyle",
    name: "生活方式衬线",
    zhFamily: "'Noto Serif SC', 'Songti SC', SimSun, serif",
    enFamily: "Georgia, 'Times New Roman', serif",
    weight: 700,
    tracking: -0.02,
    lineHeight: 1.08
  },
  experimental: {
    id: "experimental",
    name: "实验展示体",
    zhFamily: "'Microsoft YaHei', 'Noto Sans SC', Arial, sans-serif",
    enFamily: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
    weight: 800,
    tracking: -0.06,
    lineHeight: 0.92
  },
  mono: {
    id: "mono",
    name: "信息等宽体",
    zhFamily: "'Noto Sans Mono CJK SC', Consolas, monospace",
    enFamily: "'IBM Plex Mono', Consolas, monospace",
    weight: 700,
    tracking: -0.01,
    lineHeight: 1.05
  }
};

function parseHex(value, fallback = "#102a43") {
  const match = String(value ?? "").match(/^#?([0-9a-f]{6})$/i);
  if (!match) return parseHex(fallback, "#102a43");
  const hex = match[1];
  return [0, 2, 4].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
}

function relativeLuminance(value) {
  return parseHex(value).map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

export function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return Number(((light + 0.05) / (dark + 0.05)).toFixed(2));
}

export function scoreTypographyPlan(plan = {}) {
  let score = 100;
  const ratio = Number(plan.contrastRatio ?? 0);
  // Headline copy is large display type, so the WCAG large-text floor (3.0)
  // is an acceptable-but-flagged band; subheadline copy still needs 4.5.
  if (ratio >= 7) score += 0;
  else if (ratio >= AA_NORMAL) score -= 4;
  else if (ratio >= AA_LARGE) score -= 12;
  else score -= 25;
  if (Number(plan.headlineLineCount ?? 1) > 2) score -= 18;
  if (Number(plan.headlineLength ?? 0) > Number(plan.maxHeadlineChars ?? 18)) score -= 7;
  if (Number(plan.letterSpacing ?? 0) < -4 || Number(plan.letterSpacing ?? 0) > 6) score -= 8;
  if (plan.overflowRisk) score -= 15;
  return clamp(Math.round(score), 0, 100);
}

function chooseTextColor(style = {}, imageFeatures = {}) {
  const background = imageFeatures.dominantColor || style.background || "#102a43";
  const matteGold = [MATTE_GOLD, MATTE_GOLD_DARK, MATTE_GOLD_DEEP]
    .map(headline => ({ headline, contrast: contrastRatio(headline, background) }))
    .find(candidate => candidate.contrast >= AA_NORMAL);
  if (matteGold) {
    return {
      headline: matteGold.headline,
      secondary: style.secondary || "#c5c5c5",
      background,
      contrast: matteGold.contrast,
      headlineTone: "matte-gold"
    };
  }
  const preferred = style.text || "#ffffff";
  const preferredContrast = contrastRatio(preferred, background);
  if (preferredContrast >= 4.5) return { headline: preferred, secondary: style.secondary || "#c5c5c5", background, contrast: preferredContrast, headlineTone: "auto" };
  const lightContrast = contrastRatio("#ffffff", background);
  const darkContrast = contrastRatio("#111111", background);
  const headline = lightContrast >= darkContrast ? "#ffffff" : "#111111";
  return { headline, secondary: headline === "#ffffff" ? "#d9dedc" : "#3f4546", background, contrast: Math.max(lightContrast, darkContrast), headlineTone: "auto" };
}

function pickPreset(styleId, mechanismId) {
  if (styleId === "cinematic") return TYPOGRAPHY_PRESETS.cinematic;
  if (styleId === "experimental") return TYPOGRAPHY_PRESETS.experimental;
  if (styleId === "lifestyle") return TYPOGRAPHY_PRESETS.lifestyle;
  if (mechanismId === "proof-of-impact" || mechanismId === "platform-as-idea") return TYPOGRAPHY_PRESETS.mono;
  if (styleId === "commercial") return TYPOGRAPHY_PRESETS.commercial;
  return TYPOGRAPHY_PRESETS.editorial;
}

function getSafeArea(platformId) {
  if (["douyin_cover", "instagram_story", "tiktok_cover"].includes(platformId)) return { top: 0.13, right: 0.08, bottom: 0.19, left: 0.08, label: "避开顶部与底部界面遮挡区" };
  if (["wechat_header", "linkedin_post", "youtube_thumbnail", "video_cover"].includes(platformId)) return { top: 0.16, right: 0.08, bottom: 0.16, left: 0.08, label: "横幅中心安全区" };
  return { top: 0.09, right: 0.08, bottom: 0.12, left: 0.08, label: "移动端缩略图安全区" };
}

export function buildTypographyPlan({ input = {}, platform = {}, style = {}, mechanism = {}, imageFeatures = {}, headline = "", subheadline = "", composition = null } = {}) {
  const language = input.language === "en" ? "en" : "zh";
  const preset = pickPreset(style.id, mechanism.id);
  const family = language === "en" ? preset.enFamily : preset.zhFamily;
  const width = platform.width || 900;
  const height = platform.height || 1200;
  const shortSide = Math.min(width, height);
  const headlineLength = [...String(headline)].length;
  const subheadlineLength = [...String(subheadline)].length;
  const maxHeadlineChars = platform.ratio === "1.91:1" ? 16 : language === "en" ? 18 : 14;
  const lineCount = Math.max(1, Math.ceil(headlineLength / maxHeadlineChars));
  const densityPenalty = headlineLength > maxHeadlineChars ? 0.82 : 1;
  const horizontalPenalty = platform.ratio === "1.91:1" || platform.ratio === "2.35:1" ? 0.78 : 1;
  // Modular type scale from the composition (distilled from gdp-gen). The
  // headline base is modulated by the composition ratio so bolder layouts
  // (golden-hero, centered-bigtype) legitimately run larger type.
  const typeScale = composition?.typeScale ?? { headline: 1, subheadline: 0.3 / 0.085, kicker: 0.24 / 0.085, footer: 0.23 / 0.085 };
  const scaleBoost = clamp(0.9 + (Number(composition?.scaleRatio ?? 1.333) - 1.333) * 0.12, 0.85, 1.12);
  const headlineFontSize = clamp(Math.round(shortSide * 0.085 * densityPenalty * horizontalPenalty * scaleBoost), 34, 128);
  const subScaleUnit = headlineFontSize / (typeScale.headline || 1);
  const subheadlineFontSize = clamp(Math.round(subScaleUnit * (typeScale.subheadline || 1) * 0.42), 14, 34);
  const kickerFontSize = clamp(Math.round(subScaleUnit * (typeScale.kicker || 1) * 0.34), 12, 26);
  const footerFontSize = clamp(Math.round(subScaleUnit * (typeScale.footer || 1) * 0.32), 12, 26);
  const letterSpacing = Number((headlineFontSize * preset.tracking).toFixed(1));
  const safeArea = getSafeArea(platform.id);
  const colors = chooseTextColor(style, imageFeatures);
  const contrast = colors.contrast;
  const overflowRisk = lineCount > 2 || subheadlineLength > 52;
  const signals = [];
  if (colors.headlineTone === "matte-gold") signals.push("主标题采用哑金色并按画面明度自动匹配");
  if (contrast >= 7) { signals.push("文字与主色形成高对比"); }
  else if (contrast >= 4.5) { signals.push("文字对比达到可读门槛"); }
  else { signals.push("文字与背景对比不足"); }
  if (lineCount <= 2) signals.push("标题控制在两行以内");
  else { signals.push("标题行数过多"); }
  if (headlineLength <= maxHeadlineChars) signals.push("标题密度适合缩略图");
  else signals.push("标题超过单行建议密度");
  if (letterSpacing >= -4 && letterSpacing <= 6) signals.push("字距保持可读与有节奏");
  else signals.push("字距偏离建议范围");
  if (overflowRisk) signals.push("副标题或标题存在溢出风险");
  if (safeArea.bottom >= 0.16) signals.push("平台底部界面区已避让");
  return {
    modelVersion: "type-fit-v0.5",
    automatic: true,
    language,
    preset: preset.id,
    presetName: preset.name,
    fontFamily: family,
    fontWeight: preset.weight,
    headlineFontSize,
    previewHeadlineSize: Math.max(24, Math.round(headlineFontSize * Math.min(1, 620 / width))),
    subheadlineFontSize,
    kickerFontSize,
    footerFontSize,
    lineHeight: preset.lineHeight,
    letterSpacing,
    letterSpacingCss: `${letterSpacing}px`,
    headlineColor: colors.headline,
    headlineTone: colors.headlineTone,
    secondaryColor: colors.secondary,
    accentColor: style.accent || "#f6a04d",
    backgroundColor: colors.background,
    contrastRatio: contrast,
    passesContrastFloor: contrast >= AA_NORMAL,
    alignment: composition?.alignment ?? "left",
    maxHeadlineChars,
    headlineLineCount: lineCount,
    safeArea,
    overflowRisk,
    headlineLength,
    score: scoreTypographyPlan({ contrastRatio: contrast, headlineLineCount: lineCount, headlineLength, maxHeadlineChars, letterSpacing, overflowRisk }),
    signals,
    rationale: language === "en"
      ? `${preset.name} with ${contrast >= 4.5 ? "readable contrast" : "contrast repair"}, ${Math.abs(letterSpacing)}px tracking and a ${safeArea.label.toLowerCase()}.`
      : `匹配${preset.name}，对比度 ${contrast}，字距 ${letterSpacing}px，并采用${safeArea.label}。`
  };
}

export function refreshTypographyPlan(plan = {}) {
  const language = plan.language === "en" ? "en" : "zh";
  const contrast = contrastRatio(plan.headlineColor, plan.backgroundColor);
  const lineCount = Number(plan.headlineLineCount ?? 1);
  const headlineLength = Number(plan.headlineLength ?? 0);
  const maxHeadlineChars = Number(plan.maxHeadlineChars ?? 18);
  const letterSpacing = Number(plan.letterSpacing ?? 0);
  const safeArea = plan.safeArea ?? { bottom: 0, label: "平台安全区" };
  const signals = [];
  if (contrast >= 7) signals.push("文字与主色形成高对比");
  else if (contrast >= 4.5) signals.push("文字对比达到可读门槛");
  else signals.push("文字与背景对比不足");
  if (lineCount <= 2) signals.push("标题控制在两行以内");
  else signals.push("标题行数过多");
  if (headlineLength <= maxHeadlineChars) signals.push("标题密度适合缩略图");
  else signals.push("标题超过单行建议密度");
  if (letterSpacing >= -4 && letterSpacing <= 6) signals.push("字距保持可读与有节奏");
  else signals.push("字距偏离建议范围");
  if (plan.overflowRisk) signals.push("副标题或标题存在溢出风险");
  if (safeArea.bottom >= 0.16) signals.push("平台底部界面区已避让");
  return {
    ...plan,
    contrastRatio: contrast,
    passesContrastFloor: contrast >= AA_NORMAL,
    score: scoreTypographyPlan({ ...plan, contrastRatio: contrast }),
    signals,
    rationale: language === "en"
      ? String(plan.presetName ?? "Editorial") + " with " + (contrast >= 4.5 ? "readable contrast" : "contrast repair") + ", " + Math.abs(letterSpacing) + "px tracking and a " + String(safeArea.label ?? "platform safe area").toLowerCase() + "."
      : "匹配" + String(plan.presetName ?? "自动字体方案") + "，对比度 " + contrast + "，字距 " + letterSpacing + "px，并采用" + String(safeArea.label ?? "平台安全区") + "。"
  };
}
