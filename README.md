# Sayelf Poster

多语言广告海报的自动生成、平台适配、质量评分、可编辑预览和本地素材库原型。

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
  → WebUI 预览 / SVG 导出
```

## 启动 WebUI

在 `poster-system` 目录运行：

```powershell
npm start
```

打开 `http://localhost:4174`。

WebUI 默认采用自动模式，专业模式可编辑主标题、副标题和图片画面处理方式，并重新评分。

## CLI

```powershell
node src/cli.mjs generate --prompt "为海边建筑旅居空间制作高级中文封面" --platform xhs_cover --out run.json
node src/cli.mjs generate --prompt "做成线描风格，移除路牌，增加一束光" --platform poster --professional --remove "路牌" --add "一束光" --out line-art-run.json
node src/cli.mjs evaluate --file run.json
node src/cli.mjs render --file run.json --out poster.svg
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

## License

MIT License，版权归属 Sayelf，详见 LICENSE。
