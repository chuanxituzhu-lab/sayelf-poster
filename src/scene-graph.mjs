/**
 * A small, renderer-neutral scene graph for Sayelf Poster.
 *
 * This is the Canva-derived part of the system: the poster is represented as
 * editable semantic nodes instead of a flattened preview. The graph remains
 * deterministic and dependency-free so the existing SVG renderer, WebUI and
 * MCP server can share it.
 */

export const SCENE_GRAPH_VERSION = "0.1";

const regionBounds = (region = {}, width = 0.84, height = 0.14) => ({
  x: Number(region.x ?? 0.08),
  y: Number(region.y ?? 0.5) - height / 2,
  width,
  height
});

function textNode({ id, role, text, region, typography, color, editable = true, fontSize, weight, letterSpacing }) {
  return {
    id,
    type: "text",
    role,
    zIndex: 20,
    visible: true,
    editable,
    bounds: regionBounds(region, region?.anchor === "middle" ? 0.72 : 0.84, role === "headline" ? 0.2 : 0.1),
    anchor: region?.anchor ?? "start",
    content: { text: String(text ?? "") },
    style: {
      fontFamily: typography?.fontFamily,
      fontSize: fontSize ?? typography?.headlineFontSize,
      fontWeight: weight ?? typography?.fontWeight,
      lineHeight: typography?.lineHeight,
      letterSpacing: letterSpacing ?? typography?.letterSpacing,
      color: color ?? typography?.headlineColor
    },
    supportedCommands: ["set_text", "set_typography"]
  };
}
export function buildSceneGraph(candidate = {}) {
  const width = Number(candidate.targetPlatform?.width ?? 900);
  const height = Number(candidate.targetPlatform?.height ?? 1200);
  const style = candidate.style ?? {};
  const typography = candidate.typography ?? {};
  const regions = candidate.composition?.regions ?? candidate.layout?.regions ?? {
    kicker: { x: 0.07, y: 0.18, anchor: "start" },
    headline: { x: 0.07, y: 0.39, anchor: "start" },
    subheadline: { x: 0.07, y: 0.48, anchor: "start" },
    footer: { x: 0.07, y: 0.88, anchor: "start" }
  };
  const imageTreatment = candidate.imageTreatment ?? { id: "original" };
  const imageSource = candidate.image?.dataUrl || candidate.image?.path || "";
  const kicker = regions.kicker ?? {};
  const headline = regions.headline ?? {};
  const subheadline = regions.subheadline ?? {};
  const footer = regions.footer ?? {};
  const textColor = typography.headlineColor ?? style.text;
  const secondaryColor = typography.secondaryColor ?? textColor;
  const accentColor = typography.accentColor ?? textColor;
  const ruleX = kicker.anchor === "middle" ? 0.46 : Number(kicker.x ?? 0.07);

  const nodes = [
    {
      id: "image",
      type: "image",
      role: "background-image",
      zIndex: 0,
      visible: Boolean(imageSource),
      editable: true,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      content: { source: imageSource, alt: candidate.image?.alt ?? "" },
      style: { treatment: imageTreatment.id ?? "original", opacity: 0.82 },
      supportedCommands: ["set_image_treatment", "set_image_edit_plan"]
    },
    {
      id: "background",
      type: "shape",
      role: "background-fill",
      zIndex: 1,
      visible: !imageSource,
      editable: false,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      style: { fill: style.background }
    },
    {
      id: "shade",
      type: "shape",
      role: "image-shade",
      zIndex: 10,
      visible: true,
      editable: true,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      style: { fill: style.background, opacity: 0.58 },
      supportedCommands: ["set_style"]
    },
    {
      id: "rule",
      type: "shape",
      role: "accent-rule",
      zIndex: 30,
      visible: true,
      editable: true,
      bounds: { x: ruleX, y: Number(kicker.y ?? 0.18) - 0.04, width: 0.08, height: 0.004 },
      style: { fill: accentColor },
      supportedCommands: ["set_style"]
    },
    textNode({ id: "kicker", role: "kicker", text: candidate.subject?.name, region: kicker, typography, color: secondaryColor, fontSize: typography.kickerFontSize, weight: 600, letterSpacing: 3 }),
    textNode({ id: "headline", role: "headline", text: candidate.headline, region: headline, typography, color: textColor }),
    textNode({ id: "subheadline", role: "subheadline", text: candidate.subheadline, region: subheadline, typography, color: secondaryColor, fontSize: typography.subheadlineFontSize, weight: 500, letterSpacing: Math.max(-0.5, Number(typography.letterSpacing ?? 0) * 0.4) }),
    textNode({ id: "mechanism", role: "mechanism-label", text: candidate.mechanism?.name, region: footer, typography, color: textColor, fontSize: typography.footerFontSize, weight: 500 }),
    textNode({ id: "cta", role: "cta", text: candidate.cta, region: { ...footer, x: 0.93, anchor: "end" }, typography, color: accentColor, fontSize: typography.footerFontSize, weight: 700 })
  ];

  return {
    version: SCENE_GRAPH_VERSION,
    candidateId: candidate.id ?? null,
    canvas: {
      width,
      height,
      ratio: candidate.targetPlatform?.ratio ?? `${width}:${height}`,
      platform: candidate.targetPlatform?.id ?? "poster"
    },
    root: { id: "root", type: "group", role: "poster", zIndex: 0 },
    nodes,
    editableNodeIds: nodes.filter(node => node.editable).map(node => node.id),
    commandPolicy: "click_is_read_only_command_is_mutating"
  };
}

function supportedCommands(node) {
  if (node?.supportedCommands?.length) return node.supportedCommands;
  if (node?.type === "text") return ["set_text", "set_typography"];
  return ["set_style"];
}

export function inspectSceneContext(candidate = {}, nodeId = "root") {
  const graph = buildSceneGraph(candidate);
  const node = graph.nodes.find(item => item.id === nodeId) ?? graph.root;
  const exists = node.id === nodeId;
  return {
    graphVersion: graph.version,
    candidateId: graph.candidateId,
    selection: {
      id: node.id,
      type: node.type,
      role: node.role,
      exists,
      editable: node.editable !== false,
      bounds: node.bounds ?? null,
      content: node.content ?? {},
      style: node.style ?? {},
      supportedCommands: supportedCommands(node)
    },
    canvas: graph.canvas,
    warnings: node.id === "image"
      ? ["当前无 API 图像生成器：修改会先沉淀为画面处理计划，并由预览滤镜表达。"]
      : [],
    policy: graph.commandPolicy
  };
}
