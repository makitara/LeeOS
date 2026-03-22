# AGENTS（协作规范）

LeeOS 采用“Host 极简 + Plugins 承载业务”的协作方式：Host 负责窗口/加载/安全边界/API；业务功能全部做成插件，避免 Host 逐步腐化成大杂烩。

## 总原则
- **严格解耦**：Host 不写业务逻辑；业务只进 `Code/plugins/**`。
- **安全优先**：插件运行在 sandboxed iframe；插件能力只能通过 Host API 获得。
- **本地优先**：默认只存本地数据（不引入云端依赖）。
- **中文沟通**：默认用中文输出结论、关键依据与可复现步骤；不展示详细隐式推理链。

## 目录与职责
- Host（Electron + UI Shell）
  - Main / Preload：`Code/electron/`
  - Renderer（Sidebar + Detail）：`Code/src/`
  - 文档：`Docs/`
- Plugins（业务功能）
  - `Code/plugins/<plugin-id>/`（仅放插件代码与静态资源）
  - 插件数据目录：`{userData}/plugin-data/<plugin-id>/`（由 Host 管理，插件通过 `LeeOS.fs.*` 访问）

## 技能（Codex Skills）
本仓库提供项目内 skills（用于让 Codex 在不同任务下保持边界清晰）：
- `.codex/skills/leeos-orchestrator/`：需求对齐/任务拆分/路线与文档总控（推荐作为你的主对话窗口）
- `.codex/skills/leeos-core-architect/`：只改 Host（`Code/electron/**`、`Code/src/**`、核心配置）
- `.codex/skills/leeos-plugin-vibe/`：只改插件（`Code/plugins/**`）
- `.codex/skills/leeos-code-review-master/`：只做审查报告（默认不改代码）

## 规范入口
- 插件标准：`Docs/02-plugins/plugin-standard.md`
- 技术栈与决策：`Docs/01-architecture/tech-stack.md`、`Docs/00-overview/project-manifest.md`
- 路线图：`Docs/00-overview/roadmap.md`
- 协作流程：`Docs/05-process/workflow.md`
