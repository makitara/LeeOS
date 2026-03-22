# Assets & Branding

## Logo
- **Main Icon**: `Code/public/icon.png`（transparent background，用于 App Icon 与 Window Icon）
- **Original Source**: `Docs/04-design/icon-original.png`（带背景的原始版本）

## Design Guidelines
- Icon 体现 “heatmap grid” / “modular blocks”，与 plugin architecture 对齐。
- 新增 UI 组件时，颜色与质感参考 logo：
  - **Primary**: Soft Pastel Blue / Green
  - **Glassmorphism**: translucent backgrounds + blur

## Sidebar Motion & Geometry（Host）
- Sidebar 动效与对齐变量统一定义在 `Code/src/App.css :root`，禁止散落 magic number。
- 收起态几何基准：
  - `collapsed content width = sidebar width - padding*2 - border`
  - 基于同一基准推导 `item padding / icon wrapper / toggle` 位置。
- 动画规则：
  - 按钮位置动画优先单坐标系（只动 `left` 或只动 `right`）。
  - 文本消失优先 `max-width + overflow` 裁切，避免整行瞬移。
- 验收规则（desktop）：
  - 收起后 `toggle`、`active` 蓝框、`icon` 的中心线一致。
  - 展开与收起都不能出现首帧跳变。
