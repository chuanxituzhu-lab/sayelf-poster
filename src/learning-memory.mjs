import fs from "node:fs";

const memoryUrl = new URL("../data/award-learning-memory.json", import.meta.url);
export const AWARD_LEARNING_MEMORY = JSON.parse(fs.readFileSync(memoryUrl, "utf8"));

function normalize(value = "") {
  return String(value).toLowerCase().replace(/[\r\n\t]+/g, " ").trim();
}

export function getLearningMatches(text = "") {
  const source = normalize(text);
  return AWARD_LEARNING_MEMORY.mechanisms
    .map(item => ({
      item,
      score: item.keywords.reduce((total, keyword) => total + (source.includes(normalize(keyword)) ? 1 : 0), 0)
    }))
    .filter(result => result.score >= (result.item.matchThreshold ?? 1))
    .sort((a, b) => (b.score - a.score) || (b.item.base - a.item.base));
}

export function getLearningMemorySummary(text = "") {
  const matches = getLearningMatches(text);
  return {
    memoryVersion: AWARD_LEARNING_MEMORY.memoryVersion,
    curatedAt: AWARD_LEARNING_MEMORY.curatedAt,
    sourceCount: AWARD_LEARNING_MEMORY.sources.length,
    mechanismCount: AWARD_LEARNING_MEMORY.mechanisms.length,
    principleCount: AWARD_LEARNING_MEMORY.principles.length,
    attentionModel: AWARD_LEARNING_MEMORY.attentionModel,
    typographyModel: AWARD_LEARNING_MEMORY.typographyModel,
    awardFramework: AWARD_LEARNING_MEMORY.awardFramework,
    platformRules: AWARD_LEARNING_MEMORY.platformRules.map(rule => ({
      id: rule.id,
      platform: rule.platform,
      ruleStatus: rule.ruleStatus,
      format: rule.format,
      officialUrls: rule.officialUrls ?? []
    })),
    sources: AWARD_LEARNING_MEMORY.sources.map(source => ({ id: source.id, authority: source.authority, region: source.region, type: source.type })),
    matchedMechanisms: matches.slice(0, 3).map(({ item, score }) => ({ id: item.id, name: item.name, score, sourceTags: item.sourceTags })),
    evolutionRules: AWARD_LEARNING_MEMORY.evolutionRules
  };
}
