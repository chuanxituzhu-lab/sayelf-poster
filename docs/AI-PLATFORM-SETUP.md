# AI 辅助平台接入指南（MCP + CLI）

Sayelf Poster 提供两种可被 AI 平台调用的接口：

- **MCP 服务器**（推荐）：`src/mcp-server.mjs`，stdio 传输，暴露生成、评分、渲染、素材库、奖项记忆和场景图命令等 16 个结构化工具。
- **CLI**（回退/脚本）：`src/cli.mjs`，适合无 MCP 的平台或 Shell 步骤。

二者共用同一个无 API、可解释、确定性的引擎。

交互式编辑遵循“点击只读、命令修改”：WebUI 点击后由 `inspect_design_context` 返回节点上下文，
再由 `apply_design_command` 执行标题、字体、字距、画面处理、增删元素或对齐命令。没有外部 AI
平台时，WebUI 会用本地规则解析中文命令；接入 Codex、Claude Code 或 WorkBuddy 后，可直接发送结构化命令。

## 0. 前置准备

```bash
git clone --branch main --single-branch https://github.com/chuanxituzhu-lab/sayelf-poster.git
cd sayelf-poster
npm install          # 安装 @modelcontextprotocol/sdk
npm test             # 可选：验证引擎（应为 25 passed）
node src/mcp-server.mjs   # 手动启动确认，stderr 打印 "MCP server ready (stdio)"
```

要求 Node ≥ 20。记下仓库**绝对路径**（下称 `<ABS_PATH>`）。

如本地已有旧 checkout，先执行 `git fetch origin` 和 `git pull --ff-only origin main`，不要从历史分支或旧压缩包启动 WebUI。服务端会对 HTML、JS、CSS 返回 `no-store`，并在资源 URL 上带当前版本号，避免继续引用旧 WebUI。

## 1. Claude Code

在项目根目录创建 `.mcp.json`（或合并到已有文件）：

```json
{
  "mcpServers": {
    "sayelf-poster": {
      "command": "node",
      "args": ["<ABS_PATH>/src/mcp-server.mjs"]
    }
  }
}
```

或用命令行注册：

```bash
claude mcp add sayelf-poster -- node <ABS_PATH>/src/mcp-server.mjs
```

启动 Claude Code 后，工具会以 `sayelf-poster` 前缀出现。仓库内的 `SKILL.md`
也会被识别，便于自动发现能力。建议对话中先让其调用 `list_capabilities`。

## 2. Codex（支持 MCP 的版本）

在 Codex 的 MCP 配置（通常是 `~/.codex/config.toml` 或对应 JSON）中新增：

```toml
[mcp_servers.sayelf-poster]
command = "node"
args = ["<ABS_PATH>/src/mcp-server.mjs"]
```

若你的 Codex 版本使用 JSON 配置，等价写法：

```json
{
  "mcpServers": {
    "sayelf-poster": { "command": "node", "args": ["<ABS_PATH>/src/mcp-server.mjs"] }
  }
}
```

不支持 MCP 的旧版 Codex 可改用 CLI（见第 4 节），把生成/评估/渲染写成可执行步骤。

## 3. WorkBuddy

WorkBuddy 若支持 MCP，配置结构与上面一致（`command` + `args` 指向
`src/mcp-server.mjs`）。若以“工具/技能”方式集成，指向仓库的 `SKILL.md` 作为技能描述，
并允许它执行以下两类动作之一：

- 运行 MCP 服务器并调用工具；或
- 直接执行 CLI 命令（第 4 节），把 `run.json` / `poster.svg` 作为产物回传。

## 4. CLI 回退接口（任意平台通用）

```bash
# 生成（务必带 --out，便于后续评估/渲染复用同一次运行）
node src/cli.mjs generate --prompt "你的创意需求" --platform xhs_cover --out run.json
# 专业模式与图像编辑
node src/cli.mjs generate --prompt "做成线描风格，移除路牌" --platform poster --professional --remove "路牌" --add "一束光" --out run.json
# 评估 / 渲染 / 构图列表 / 记忆
node src/cli.mjs evaluate --file run.json
node src/cli.mjs render   --file run.json --out poster.svg
node src/cli.mjs compositions
node src/cli.mjs memory
```

CLI 以 JSON 打印到 stdout，产物写入指定文件，便于平台捕获。

## 5. 冒烟测试（验证 MCP 链路）

```bash
node scripts/mcp-smoke.mjs
```

该脚本会以 MCP 客户端身份 initialize → tools/list → generate → evaluate →
render，并打印结果，可用于排查平台接入问题。

## 6. 常见问题

- **工具没出现**：确认 `args` 用的是**绝对路径**，且 `npm install` 已完成。
- **stdout 被污染**：MCP 走 stdout，日志一律走 stderr；请勿在引擎里 `console.log`。
- **素材库 20 张上限**：`library_save` 返回上限错误时，先 `library_delete` 或改分类。
- **分数含义**：所有评分为内部启发式，不等同评委打分或获奖承诺。
