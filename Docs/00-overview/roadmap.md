# Roadmap（路线图）

## 已确认的 MVP 方向
- UI：Sidebar + Detail（一次只打开一个插件）
- Plugin：静态 `index.html` 入口
- Data：每个插件一个专属数据目录（通过 `LeeOS.fs.*` 访问）
- Permissions：`manifest.permissions` 作为能力需求声明（不做权限 enforcement）

## Phase 1：骨架（已完成）
- [x] Electron + Vite + React + TS 基础搭建
- [x] Main 侧插件扫描与列表 API（`LeeOS.plugins.list()`）
- [x] `leeos-plugin://` 协议加载 + iframe sandbox

## Phase 2：MVP 基础能力（进行中）
- [x] Sidebar + Detail Shell
- [x] Host ↔ Plugin `postMessage` request/response 通道
- [x] 插件专属数据目录 + `LeeOS.fs.*`（限制在 `{userData}/plugin-data/<plugin-id>/`）
- [x] UI 细节 polish（sidebar 动画统一、Home 首页信息升级）
- [x] 建立多 Agent 并行开发规范（分支命名、合并顺序、审查门禁）

## Phase 3：首批插件（进行中）
- [x] Diary Heatmap（v1 已完成）
- [x] Subscription Tracker（v2 已完成：侧栏管理、拖拽排序、数据安全与一致性修复）
- [x] Body Metrics（v1 已完成：分类侧栏、指标卡片、趋势图、手动录入、参考区间）
- [x] Item Lifespan（路线调整：取消独立插件，周期管理能力并入 Subscription Tracker）

## Phase 4：打包与扩展（计划中）
- [ ] 打包成 macOS App（MVP 后）
- [ ] 维护“系统已支持能力清单”文档（供插件开发对齐）
- [ ] 插件导出/备份（可选）
- [ ] AI 辅助插件生成流程（可选）
