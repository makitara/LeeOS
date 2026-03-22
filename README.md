# LeeOS

LeeOS 是一个 macOS-only 的“插件控制台”（Plugin Console）：Host 提供壳、首页与受控 API，核心业务功能以插件形式运行在 sandboxed iframe 中。

## 快速开始

- 安装依赖：`npm -C Code install`
- 启动开发：`npm -C Code run dev`
- 打包态冒烟：`npm -C Code run smoke:mac`

提示：如果你已经在 `Code/` 目录里，直接运行 `npm run dev`。

## 文档

从 `Docs/README.md` 开始阅读：

- `Docs/00-overview/project-manifest.md`：项目是什么
- `Docs/01-architecture/architecture.md`：Electron/Host/Plugin 架构
- `Docs/02-plugins/plugin-standard.md`：插件标准与 API
- `Docs/03-development/development.md`：开发指南
