# Technology Stack（MVP）

## Core
- **Framework**: Electron（Main process + Renderer）
- **Language**: TypeScript（Host/SDK 契约需要可维护与可扩展）
- **Frontend**: React（UI Shell）
- **Build Tool**: Vite（配置简单、构建快）

## Styling
- **CSS**: 目前以自定义 CSS 为主（Tailwind 保留但未重度使用）

## Data
- **Plugin Data（MVP）**: 每个插件一个专属数据目录 `{userData}/plugin-data/<plugin-id>/`，通过 Host API `LeeOS.fs.*` 读写（JSON/Text）。
- **Permissions（MVP）**: `manifest.permissions` 先占位，不做 enforcement。

