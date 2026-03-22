# Diary Heatmap（插件规格 / MVP）

## 目标
- 独立插件，以 GitHub contributions 风格展示每天的 “mood heatmap”（1..5）。
- 数据来源为 `entries/YYYY-MM-DD.md`；日期由文件名决定；mood 来自 frontmatter。
- 本期不做点击交互、不做筛选/导出/同步。

## 插件信息
- `pluginId`: `com.leeos.diary-heatmap`
- 入口：`index.html`（静态插件，运行在 sandboxed iframe）

## 数据（Local First）
插件只允许通过 `LeeOS.fs.*` 访问自己的数据目录：
- `{userData}/plugin-data/com.leeos.diary-heatmap/`

### 目录结构
```
plugin-data/com.leeos.diary-heatmap/
└── entries/
    ├── 2026-02-09.md
    └── 2026-02-10.md
```

### 文件命名约定
- 单文件代表一天：`entries/YYYY-MM-DD.md`
- 判定“当天有日记”：文件存在即可（会读取 md 头部 frontmatter 解析 mood）
- frontmatter 规则：
  - `mood` 仅接受整数 `1..5`
  - `mood` 缺失或非法：按 `3`（Neutral）

示例：
```md
---
mood: 4
---
今天状态不错
```

## 视图与口径
### Year 视图（默认）
- GitHub 风格热力图：按“周”为列（从左到右），每列 7 格。
- **周起始日：周一**（Monday-first），固定且全局一致。
- 色阶：mood `1..5`（并显示 legend）。
- Tooltip：英文日期（en-US）+ mood 文案（例如 `Feb 9, 2026 · Mood: Good (4/5)`）。

### Month 视图
- 允许简化实现（例如月历格子），只要：
  - 能切换到 Month
  - 能清晰看到当月哪些天有日记

### 年份切换
- 年份下拉覆盖：`2025..当前年`，并合并 `entries/` 文件名解析出的年份集合。

## 主题与样式
- 必须跟随系统主题（至少 `prefers-color-scheme`）。
- 推荐在插件内定义与 Host 接近的 CSS tokens（避免依赖 Host 文件路径）。

## 迁移步骤（你已有 md 日记）
1) 把旧日记按日期重命名为 `YYYY-MM-DD.md`。
2) 放入：`{userData}/plugin-data/com.leeos.diary-heatmap/entries/`
3) 打开插件并切换年份/视图验证。
