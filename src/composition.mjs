/**
 * Composition & geometry layer (v0.6).
 *
 * Distilled from open-source graphic-design generators (notably greggman/gdp-gen):
 *   - explicit grid geometry: rule-of-thirds, golden split, modular type scale;
 *   - a catalog of *named compositions*, each returning concrete placement
 *     regions (0..1 fractional coordinates) instead of an opaque layout string;
 *   - anchor/alignment metadata so the renderer can place copy deterministically.
 *
 * This module stays rule-based and API-free, matching Sayelf's design boundary.
 * Coordinates are fractions of the poster width/height so they scale to any
 * platform ratio. The renderer multiplies them by real pixel dimensions.
 */

export const GOLDEN = 1.618033988749895;

/** Rule-of-thirds line positions (fractions) along a 0..1 axis. */
export const THIRDS = [1 / 3, 2 / 3];

/** Golden-ratio split point (fraction) from the start of a 0..1 axis. */
export const GOLDEN_SPLIT = 1 / GOLDEN; // ~0.618

/**
 * A modular type scale: `steps` multipliers growing by `ratio`.
 * Common ratios: 1.2 minor third, 1.333 perfect fourth, 1.618 golden.
 * Returns descending sizes (headline first) as fractions of a base unit.
 */
export function modularScale(ratio = 1.333, steps = 4) {
  const out = [];
  for (let i = steps - 1; i >= 0; i -= 1) out.push(Number(ratio ** i));
  return out; // e.g. [2.37, 1.78, 1.33, 1] for ratio 1.333, steps 4
}

/**
 * Named compositions. Each builder receives the platform ratio family and
 * returns fractional regions plus per-role alignment. Regions:
 *   kicker, headline, subheadline, footer (label + cta live in footer band).
 * `imageFocus` hints where the key visual should sit so copy avoids it.
 */
const COMPOSITIONS = {
  "editorial-thirds": {
    id: "editorial-thirds",
    name: "编辑三分",
    nameEn: "Editorial Thirds",
    note: "标题落在左下三分线，图像主体偏右上，形成阅读动线。",
    scaleRatio: 1.333,
    alignment: "left",
    build: () => ({
      kicker: { x: 0.08, y: 0.14, anchor: "start" },
      headline: { x: 0.08, y: 0.62, anchor: "start", maxWidth: 0.72 },
      subheadline: { x: 0.08, y: 0.72, anchor: "start", maxWidth: 0.64 },
      footer: { x: 0.08, y: 0.9, anchor: "start" },
      imageFocus: { x: 0.68, y: 0.34 }
    })
  },
  "golden-hero": {
    id: "golden-hero",
    name: "黄金主视觉",
    nameEn: "Golden Hero",
    note: "标题压在黄金分割线，主体占据上方大景别，适合大片/电影级。",
    scaleRatio: 1.5,
    alignment: "left",
    build: () => ({
      kicker: { x: 0.08, y: 0.12, anchor: "start" },
      headline: { x: 0.08, y: GOLDEN_SPLIT + 0.02, anchor: "start", maxWidth: 0.8 },
      subheadline: { x: 0.08, y: GOLDEN_SPLIT + 0.13, anchor: "start", maxWidth: 0.7 },
      footer: { x: 0.08, y: 0.92, anchor: "start" },
      imageFocus: { x: 0.5, y: 0.32 }
    })
  },
  "centered-bigtype": {
    id: "centered-bigtype",
    name: "居中大字",
    nameEn: "Centered Big Type",
    note: "标题居中放大占据视觉重心，副标题与行动入口上下对称。",
    scaleRatio: 1.618,
    alignment: "middle",
    build: () => ({
      kicker: { x: 0.5, y: 0.16, anchor: "middle" },
      headline: { x: 0.5, y: 0.5, anchor: "middle", maxWidth: 0.86 },
      subheadline: { x: 0.5, y: 0.63, anchor: "middle", maxWidth: 0.72 },
      footer: { x: 0.5, y: 0.9, anchor: "middle" },
      imageFocus: { x: 0.5, y: 0.5 }
    })
  },
  "bottom-anchor": {
    id: "bottom-anchor",
    name: "下方承接",
    nameEn: "Bottom Anchor",
    note: "图像占满上方，文字集中在底部安全带，适合生活方式与竖屏。",
    scaleRatio: 1.25,
    alignment: "left",
    build: () => ({
      kicker: { x: 0.08, y: 0.7, anchor: "start" },
      headline: { x: 0.08, y: 0.8, anchor: "start", maxWidth: 0.84 },
      subheadline: { x: 0.08, y: 0.88, anchor: "start", maxWidth: 0.8 },
      footer: { x: 0.08, y: 0.95, anchor: "start" },
      imageFocus: { x: 0.5, y: 0.3 }
    })
  },
  "z-pattern": {
    id: "z-pattern",
    name: "Z 型动线",
    nameEn: "Z-Pattern",
    note: "kicker 左上、主体右上、标题左下、行动入口右下，贴合扫视顺序。",
    scaleRatio: 1.333,
    alignment: "left",
    build: () => ({
      kicker: { x: 0.08, y: 0.13, anchor: "start" },
      headline: { x: 0.08, y: 0.66, anchor: "start", maxWidth: 0.7 },
      subheadline: { x: 0.08, y: 0.76, anchor: "start", maxWidth: 0.64 },
      footer: { x: 0.92, y: 0.92, anchor: "end" },
      imageFocus: { x: 0.72, y: 0.3 }
    })
  },
  "masthead": {
    id: "masthead",
    name: "刊头横幅",
    nameEn: "Masthead",
    note: "标题贴顶如刊头，适合横向头图与专业信息层级。",
    scaleRatio: 1.2,
    alignment: "left",
    build: () => ({
      kicker: { x: 0.06, y: 0.22, anchor: "start" },
      headline: { x: 0.06, y: 0.5, anchor: "start", maxWidth: 0.66 },
      subheadline: { x: 0.06, y: 0.72, anchor: "start", maxWidth: 0.6 },
      footer: { x: 0.94, y: 0.86, anchor: "end" },
      imageFocus: { x: 0.82, y: 0.5 }
    })
  }
};

const HORIZONTAL_RATIOS = new Set(["2.35:1", "1.91:1", "16:9"]);
const TALL_RATIOS = new Set(["9:16", "2:3", "4:5"]);

/**
 * Choose a composition deterministically from style, mechanism, platform and a
 * candidate index, so the three candidates in a run stay distinct but stable.
 */
export function pickComposition({ styleId, mechanismId, platformRatio, index = 0 } = {}) {
  // Hard platform constraints first.
  if (HORIZONTAL_RATIOS.has(platformRatio)) return COMPOSITIONS.masthead;

  const preferred = [];
  if (styleId === "cinematic") preferred.push("golden-hero", "centered-bigtype", "z-pattern");
  else if (styleId === "experimental") preferred.push("z-pattern", "centered-bigtype", "editorial-thirds");
  else if (styleId === "lifestyle") preferred.push("bottom-anchor", "editorial-thirds", "golden-hero");
  else if (styleId === "commercial") preferred.push("centered-bigtype", "z-pattern", "bottom-anchor");
  else preferred.push("editorial-thirds", "golden-hero", "bottom-anchor");

  if (mechanismId === "cinematic-scale") preferred.unshift("golden-hero");
  if (mechanismId === "direct-value") preferred.unshift("centered-bigtype");
  if (TALL_RATIOS.has(platformRatio)) preferred.unshift("bottom-anchor");

  const ordered = [...new Set(preferred)];
  const id = ordered[index % ordered.length] ?? "editorial-thirds";
  return COMPOSITIONS[id] ?? COMPOSITIONS["editorial-thirds"];
}

/** Public catalog for docs / UI / tests. */
export function listCompositions() {
  return Object.values(COMPOSITIONS).map(({ id, name, nameEn, note }) => ({ id, name, nameEn, note }));
}

/**
 * Build a full composition plan for a candidate: resolved regions, a modular
 * type-scale (as multipliers), and a bilingual name.
 */
export function buildCompositionPlan({ styleId, mechanismId, platformRatio, language = "zh", index = 0 } = {}) {
  const comp = pickComposition({ styleId, mechanismId, platformRatio, index });
  const scale = modularScale(comp.scaleRatio, 4); // [headline, sub, kicker/footer, base]
  const regions = comp.build();
  return {
    modelVersion: "composition-v0.6",
    id: comp.id,
    name: language === "en" ? comp.nameEn : comp.name,
    note: comp.note,
    alignment: comp.alignment,
    scaleRatio: comp.scaleRatio,
    typeScale: { headline: scale[0], subheadline: scale[2], kicker: scale[3], footer: scale[3] },
    regions
  };
}

export { COMPOSITIONS };
