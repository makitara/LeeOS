# LeeOS Plugin Standard（v1 / MVP）

目标：让插件 **好写、好生成、好隔离**。Host 只做壳与 API；业务逻辑全部进入 Plugins。

## 目录结构（代码）
每个插件是一个文件夹：
- **Dev**: `~/Documents/LeeOS/Code/plugins/<plugin-id>/`
- **Prod**: `{userData}/plugins/<plugin-id>/`

最小结构（MVP）：
```
<plugin-id>/
├── manifest.json
├── index.html          # 默认入口（iframe 加载）
└── icon.svg            # 可选
```

说明：
- MVP 只支持 **静态 HTML 插件**：`index.html` 内可直接写 `<script>`。
- 插件可以放任意静态资源（图片/CSS/JS），Host 会通过 `leeos-plugin://` 加载。

## 插件数据目录（重要）
每个插件拥有一个专属数据目录（与插件代码分离）：
- `{userData}/plugin-data/<plugin-id>/`

插件 **不能** 直接读写硬盘任意路径；只能通过 Host 提供的 `LeeOS.fs.*` API 访问自己的数据目录。

## `manifest.json` 规范
硬性规则：
- `id` 必须是字符串，且 **必须与文件夹名一致**
- `name`/`version` 必须存在
- `entry` 默认 `index.html`

示例：
```json
{
  "id": "com.demo.hello",
  "name": "Hello Demo",
  "version": "1.0.0",
  "description": "Minimal iframe demo plugin.",
  "icon": "icon.svg",
  "entry": "index.html",
  "permissions": []
}
```

`permissions`：
- 目前是 **占位字段（不生效）**，用于未来 Host 做能力控制（类似手机权限）。

## Host API（注入到插件 iframe）
Host 会在加载插件 `index.html` 时注入 `window.LeeOS`。

### `LeeOS.plugins.list()`
返回已安装插件清单（用于插件间联动/调试）。

### `LeeOS.fs.*`（访问插件数据目录）
所有路径都是“相对路径”，并且会被限制在 `{userData}/plugin-data/<plugin-id>/` 内：
- `LeeOS.fs.readText(path)`
- `LeeOS.fs.writeText(path, content)`
- `LeeOS.fs.readJson(path)`
- `LeeOS.fs.writeJson(path, value)`
- `LeeOS.fs.readDir(path = '.')`
- `LeeOS.fs.delete(path)`
- `LeeOS.fs.openDir(path = '.')`
- `LeeOS.fs.openFile(path)`
- `LeeOS.fs.capabilities()`

安全限制（硬性）：
- `path` 只能解析到 `{userData}/plugin-data/<plugin-id>/` 下，禁止通过 `../` 等方式越界。
- 越界/非法路径会被拒绝；`openDir()` 在失败时返回 `false`（不会把未处理异常抛到插件侧）。

`LeeOS.fs.openDir(path)`：
- 作用：打开系统文件管理器并定位到该目录（macOS Finder / Windows Explorer）。
- 返回：`Promise<boolean>`，成功 `true`，失败 `false`。
- 备注：若目录不存在，Host 会创建该目录后再尝试打开。

`LeeOS.fs.capabilities()`：
- 返回：`Promise<{ openDir: boolean, openFile: boolean }>`（用于能力探测）。

示例（写入并读回 JSON）：
```js
await window.LeeOS.fs.writeJson('state.json', { lastOpenedAt: new Date().toISOString() })
const state = await window.LeeOS.fs.readJson('state.json')
console.log(state)
```

示例（打开插件数据子目录）：
```js
const ok = await window.LeeOS.fs.openDir('entries')
console.log('openDir ok?', ok)
```

示例（打开插件数据文件）：
```js
const ok = await window.LeeOS.fs.openFile('entries/2026-02-22.md')
console.log('openFile ok?', ok)
```

## Iframe 消息协议（底层实现）
插件通过 `postMessage` 与 Host 通信。

### Ping / Pong
```js
window.parent.postMessage({ type: 'LeeOS:ping', pluginId: '<id>' }, '*')
```

Host 回复：
```js
{ type: 'LeeOS:pong', version: 'x.y.z' }
```

### Request / Response
```js
window.parent.postMessage({
  type: 'LeeOS:request',
  pluginId: '<id>',
  requestId: 'uuid-or-any-unique',
  method: 'LeeOS.fs.readJson',
  params: { path: 'state.json' }
}, '*')
```

Host 回复：
```js
{ type: 'LeeOS:response', requestId: '...', ok: true, data: { ... } }
```

错误码（MVP）：
- `ERR_UNSUPPORTED_METHOD`
- `ERR_REQUEST_FAILED`
- `ERR_REQUEST_TIMEOUT`

## 关键交互与可靠性门禁（MVP 必须）
- 破坏性操作（删除/清空/覆盖）不得把 `window.alert/confirm/prompt` 作为唯一交互。
- 破坏性操作必须提供插件内可见的二步确认（示例：`Delete -> Confirm`）。
- 破坏性操作执行中必须禁用冲突按钮，避免重复提交和并发误触。
- 失败路径必须可见：用户能在插件界面看到明确错误提示，不允许静默失败。
- 对“内存变更 + 持久化”路径，必须保证一致性（推荐事务化：保存失败恢复到操作前快照）。
- 数据迁移需区分 `missing` 与 `invalid`，`invalid` 时禁止自动覆盖与清理旧文件。
