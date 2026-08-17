# Sayelf Poster

多语言广告海报的自动生成、平台适配、质量评分、可编辑场景图、AI 会话控制和本地素材库原型。

当前版本先实现一条可运行的本地垂直切片：

```text
图片 / Prompt
  → 内容与平台分析
  → 创意机制和风格匹配
  → 图片处理计划：裁切 / 增强 / 扩图 / 风格转换
  → 生成 3 个候选
  → 硬性门槛 + 质量评分
  → 国际 / 中国广告奖项启发式对标
  → 20 张本地素材库 + 三类候选归档
  → 负熵记录：把结果、机制、评分和下一步调整沉淀为可复用记忆
  → 可编辑场景图 / WebUI 预览 / SVG 导出
```

## 启动 WebUI

在 `poster-system` 目录运行：

```powershell
npm start
```

打开 `http://localhost:4174`。

WebUI 默认采用自动模式，专业模式可编辑主标题、副标题和图片画面处理方式，并重新评分。

## AI 辅助平台接口（MCP / CLI / Skill）

系统封装了统一的技能接口，便于 Codex、Claude Code、WorkBuddy 等 AI 平台安装调用，
底层与 CLI、WebUI 共用同一个无 API、确定性的引擎。

- **MCP 服务器（推荐）**：`node src/mcp-server.mjs`（stdio 传输），暴露生成、评分、渲染、
  `inspect_design_context`（只读选中上下文）和 `apply_design_command`（唯一修改入口），
  以及素材库、奖项学习记忆等结构化工具。
- **CLI 回退**：`node src/cli.mjs …`，适合无 MCP 的平台或脚本步骤。
- **Skill 发现**：仓库根目录的 `SKILL.md` 供 Claude 系平台自动识别能力；
  `.mcp.json.example` 为可直接复制的 Claude Code 配置。

安装与各平台配置见 `docs/AI-PLATFORM-SETUP.md`。快速验证 MCP 链路：

```bash
npm install
npm test               # 引擎回归
node scripts/mcp-smoke.mjs   # MCP 端到端冒烟
```

典型调用流程：`generate_poster {prompt, platform, outFile}` →
`evaluate_poster {file}` → `render_poster {file, outFile}` →
`library_save {file, classification}`。

## CLI

```powershell
node src/cli.mjs generate --prompt "为海边建筑旅居空间制作高级中文封面" --platform xhs_cover --out run.json
node src/cli.mjs generate --prompt "做成线描风格，移除路牌，增加一束光" --platform poster --professional --remove "路牌" --add "一束光" --out line-art-run.json
node src/cli.mjs evaluate --file run.json
node src/cli.mjs render --file run.json --out poster.svg
node src/cli.mjs compositions
node src/cli.mjs memory
```

支持的平台：`xhs_cover`、`wechat_header`、`video_cover`、`douyin_cover`、`poster`、`instagram_feed`、`instagram_story`、`youtube_thumbnail`、`tiktok_cover`、`linkedin_post`、`pinterest_pin`。

海报语言可选择自动识别、中文或 English。YouTube、TikTok、LinkedIn、Pinterest 的官方规格会标记为已核验；Instagram 当前公开帮助入口无法稳定读取统一像素硬门槛，系统将其标记为运营预设并要求发布前查看平台预览。

## 本地素材库

生成后可将当前候选存入本地素材库，最多 20 张，默认按三类归档：`可直接发布`、`候选优化`、`实验探索`。素材和递归日志保存在 `data/material-library.json`，预览通过本地 API 提供；每次归档都会记录平台、机制、奖项对标分、硬门槛状态、秩序分和下一步调整建议。

负熵不是物理学承诺，而是本系统的工作原则：将一张不确定的生成结果压缩成结构化、可复用、可比较的设计资产，降低下一轮生成的不确定性。

## 质量对标

`award-bridge-v0.5` 将每张候选分别与国际广告奖项关注的概念、文案、艺术指导、字体与排版、媒介、影响和差异性，以及中国广告评价体系关注的创意质量、传播效果、本土语境、创新、社会责任和合规做启发式比对。它用于内部筛选和递归升级，不等同于评委真实评分或获奖承诺。

## 测试

```powershell
npm test
```

## 设计边界

当前生成器使用本地可解释规则，保证无 API Key 时也能运行。WebUI 已提供原图、主体增强、双色、线描、漫画、简笔插画、单色印刷和电影级调色的预览处理；“广告大片”方向会同步切换创意机制、视觉风格和画面处理。后续接入视觉模型或图像生成模型时，应实现 `transform_image` Provider，并保持 `design.json`、评分引擎和 WebUI 不变。

奖项学习记忆保存在 `data/award-learning-memory.json`（当前 v0.5），从 D&AD、Cannes Lions、中国广告协会 / 中国国际广告节·中国广告长城奖及海外平台官方规格中提炼可迁移机制。字体模块新增 Type Fit v0.5：自动匹配字体角色、字号、字重、行高、字距、颜色对比和平台安全区，并把字体可读性纳入自动发布门槛与奖项桥接。系统只存来源、观察和规则，不复制具体获奖作品；平台尺寸若未被官方当前文档确认，会标注为运营预设并要求发布前查看平台裁切预览。后续升级需经过正向样例、反例和回归测试。

当输入没有明确风格信号时，系统优先采用“概念先行”作为默认机制；明确提出“广告大片 / 电影级”后才会切换到电影级尺度，避免先套风格再找创意。

## 构图与几何层（v0.6）

在参考多个开源图形海报生成器（尤其是 greggman/gdp-gen 的构图/几何/排版分层思路）后，系统蒸馏出一个规则化、无 API 的 `composition` 模块（`src/composition.mjs`）：

- 显式几何：三分线、黄金分割、模块化字号阶（modular scale），替代原先零散的字号系数。
- 命名构图库：`编辑三分 / 黄金主视觉 / 居中大字 / 下方承接 / Z 型动线 / 刊头横幅`，每个构图返回以 0..1 分数坐标表示的 kicker、标题、副标题、footer 放置区与对齐方式，SVG 渲染器据此确定文字锚点，而不再使用硬编码坐标。
- 平台约束优先：横向比例（2.35:1、1.91:1、16:9）强制使用刊头横幅；竖屏优先下方承接；电影级/大片优先黄金主视觉。
- 同一轮三个候选获得不同构图，既保持差异又稳定可复现。运行 `node src/cli.mjs compositions` 查看全部构图。

对比度阈值同步对齐 WCAG：大号展示型标题可落在大文本 3.0 的可读区间并参与创意/奖项打分，但自动发布硬门槛仍要求正文/副标题达到 4.5（AA_NORMAL）。

## Canva 机制融合（v0.7）

系统吸收 GitHub 上开源设计编辑器的可迁移机制，但不复制 Canva 私有实现、代码或作品：

- `src/scene-graph.mjs` 为每张海报建立语义节点：图片、遮罩、强调线、标题、副标题、机制标签和行动入口。
- WebUI 点击节点只产生选中上下文，不会直接改图；会话栏或 MCP 的 `apply_design_command` 才能修改。
- 文字、字体颜色、字号、字距、画面处理、增删元素和对齐方式均通过安全命令更新，然后重新评分并重建场景图。
- `editHistory` 保留最近 20 次结构化操作，为后续 Codex、Claude Code、WorkBuddy 协作和递归进化提供操作记录。
- 当前仍以本地规则和 SVG 为基础；未来可在不改变设计数据、评分引擎和命令协议的前提下接入 Fabric.js、图像模型或协作服务。

## License

MIT License，版权归属 Sayelf，详见 LICENSE。
