---
name: sayelf-poster
description: >-
  Generate, score, and render multilingual advertising posters and social-media
  covers from a text prompt — fully rule-based and API-free. Use whenever a user
  wants a poster, 小红书/公众号/抖音/Instagram/TikTok/YouTube/LinkedIn/Pinterest cover,
  campaign key visual, or wants to evaluate/benchmark a poster design against
  award heuristics. Exposes generation, evaluation, SVG rendering, a named
  composition library, WCAG typography scoring, and a 20-slot material library.
---

# Sayelf Poster skill

An offline, deterministic poster engine. No API keys, no network calls — the same
engine backs the CLI, the WebUI, and the MCP server. Prefer the MCP interface when
your platform supports it; fall back to the CLI otherwise.

## When to use

- "做一张小红书封面 / 海报 / 公众号头图 / 短视频封面"
- "generate an Instagram / TikTok / YouTube / LinkedIn / Pinterest cover"
- "评估/打分这张海报设计" or "对标广告奖项"
- Iterating: generate → evaluate → render → archive to the material library.

## Two interfaces

### A. MCP (recommended for Claude Code / Codex / any MCP client)

Start the server (stdio transport):

```bash
node src/mcp-server.mjs        # or: npm run mcp
```

Register it with your client (see `docs/AI-PLATFORM-SETUP.md` for Claude Code,
Codex, and WorkBuddy config snippets). Tools exposed:

| Tool | Purpose |
| --- | --- |
| `list_capabilities` | Discovery: platforms, styles, treatments, languages, compositions. Call first. |
| `generate_poster` | 3 scored candidates from a prompt; can write full run to `outFile`. |
| `evaluate_poster` | Re-score a saved run/candidate (gates, publish/creative, award bridge). |
| `render_poster` | Render a candidate to SVG (returns markup and/or writes a file). |
| `list_compositions` / `list_platforms` | Enumerate named layouts / platform specs. |
| `get_award_memory` | Award-learning memory, optionally matched to a query. |
| `library_list` / `library_save` / `library_delete` | Manage the 20-slot material library. |

Typical flow: `generate_poster {prompt, platform, outFile}` →
`evaluate_poster {file}` → `render_poster {file, outFile}` →
`library_save {file, classification}`.

### B. CLI (fallback / scripting / WorkBuddy shell steps)

```bash
node src/cli.mjs generate --prompt "为海边建筑旅居空间制作高级中文封面" --platform xhs_cover --out run.json
node src/cli.mjs evaluate --file run.json
node src/cli.mjs render   --file run.json --out poster.svg
node src/cli.mjs compositions
node src/cli.mjs memory
```

Platforms: `xhs_cover, wechat_header, video_cover, douyin_cover, poster,
instagram_feed, instagram_story, youtube_thumbnail, tiktok_cover, linkedin_post,
pinterest_pin`. Language: `auto | zh | en`.

## Notes for the agent

- Always pass `outFile` on `generate_poster` so `evaluate_poster` / `render_poster`
  can act on the same run.
- `professional: true` unlocks style/layout/treatment overrides; default is automatic.
- Scores are internal heuristics, not a jury verdict or an award guarantee.
- The material library caps at 20 items; `library_save` returns 409-style errors when full.
