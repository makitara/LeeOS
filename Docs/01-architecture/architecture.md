# 架构概览（Electron / Host / Plugins）

这份文档用于帮助不熟悉 Electron/前端的读者理解 LeeOS 的整体结构。

## Electron 的三层（最重要）
可以把 Electron 想成一个桌面应用，但内部有三块：

1) **Main（主进程）**
- 文件：`Code/electron/main.ts`
- 能力：开窗口、访问本地文件系统、注册自定义协议、做安全边界
- 类比：应用的“系统层/后端”

2) **Renderer（渲染进程）**
- 文件：`Code/src/*`
- 能力：UI（React）与用户交互
- 类比：应用的“前端页面”

3) **Preload（桥接层）**
- 文件：`Code/electron/preload.ts`
- 能力：把 Main 的少量能力安全地暴露给 Renderer（例如 `window.LeeOS.*`）
- 类比：一座“受控的桥”

## Host / Plugin 的边界
- **Host**：LeeOS 应用本体（Main + Preload + Renderer UI Shell）
- **Plugin**：被 Host 加载的功能模块（在 iframe 内运行的静态网页）

原则：
- Host 负责壳层体验、插件加载与平台能力；需要独立演进的业务模块进入 `Code/plugins/**`
- Home 首页等壳层信息卡片可以留在 Host，但不要侵入插件边界与数据边界
- Plugin 不能直接调用 Node/Electron；只能通过 Host 提供的 API

## 插件如何被加载（简化流程）
1. Main 从插件目录读取 `manifest.json`，形成插件列表（`LeeOS.plugins.list()`）
2. Renderer 展示侧边栏（Sidebar），用户点击后加载插件入口 `leeos-plugin://<plugin-id>/index.html`
3. 插件运行在 sandboxed iframe 内，Host 在 HTML 中注入 `window.LeeOS` SDK
4. 插件通过 `postMessage` 发请求，Renderer 转发给 Host API，再把结果回传给插件

## 插件数据目录（与插件代码分离）
插件代码目录（安装/更新）：
- Dev：`~/Documents/LeeOS/Code/plugins/<plugin-id>/`
- Prod：`{userData}/plugins/<plugin-id>/`

插件数据目录（运行时写入）：
- `{userData}/plugin-data/<plugin-id>/`

插件只能通过 `LeeOS.fs.*` 访问自己的数据目录，Host 会阻止路径穿越（避免插件读写到别的地方）。
