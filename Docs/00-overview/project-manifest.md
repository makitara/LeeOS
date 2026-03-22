# Project Manifest

## Core Philosophy
1. **Platform Specific**: 只服务 macOS，避免 cross-platform 负担。
2. **Loose Coupling**: Host 以“壳”与平台能力为主；需要独立演进的功能由 Plugins 承载。
3. **Vibe Coding Oriented**:
   - 文档与标准清晰，方便 Codex 读与生成。
   - 以严格标准保证 Plugin 可被自动生成且可运行。
   - 追求简单架构而非复杂抽象。
4. **Local First**:
   - 核心数据默认只存本地。
   - 允许少量只读外部信息请求，但不引入云端账号或远端持久化依赖。

## Application Nature（你确认的形态）
- 一个“插件控制台”（Plugin Console）：左侧选择插件，右侧显示插件详情（Sidebar + Detail）。
- Host 可包含 Home 首页等壳层信息卡片；核心业务功能仍优先做成插件。
- 插件运行在 sandboxed iframe 内，Host 负责加载与提供受控 API。
- **Micro-kernel architecture**：Host 提供 Window + API；Plugins 提供 UI + Logic。

## MVP Decisions（已对齐）
- UI：Sidebar + Detail（一次只打开一个插件）
- Plugin：静态 `index.html` 入口（MVP 不做插件构建系统）
- Data：每个插件一个专属数据目录 `{userData}/plugin-data/<plugin-id>/`，通过 `LeeOS.fs.*` 访问
- Permissions：`manifest.permissions` 先占位（暂不生效）
