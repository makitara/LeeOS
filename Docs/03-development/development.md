# 开发指南（MVP）

## 启动开发环境
在仓库根目录运行：
- 安装依赖：`npm -C Code install`
- 同时启动 Vite + Electron：`npm -C Code run dev`

如果你已经 `cd Code/` 进入了应用目录，则不需要 `-C Code`：
- `npm install`
- `npm run dev`

## 插件开发（静态插件）
1. 在 `Code/plugins/` 下创建目录：`Code/plugins/<plugin-id>/`
2. 编写 `manifest.json`（`id` 必须与目录名一致）
3. 编写 `index.html`（MVP 默认入口）
4. 重启或刷新应用后，插件会出现在侧边栏

参考示例插件：
- `Code/plugins/com.leeos.diary-heatmap/`

## 插件数据写入
插件不能直接读写硬盘任意路径。需要通过注入的 SDK：
- `window.LeeOS.fs.writeJson('state.json', value)`
- `window.LeeOS.fs.readJson('state.json')`

这些文件会被写入插件的专属数据目录：
- `{userData}/plugin-data/<plugin-id>/`

## 插件收尾验收（建议）
每次插件完成一轮较大改动后，至少执行以下检查：
1. 构建检查：`npm -C Code run build --silent`
2. 关键按钮链路检查：显示 -> 点击 -> 状态变化 -> 数据落盘 -> 视图刷新
3. 失败路径检查：至少覆盖一次“写盘失败/非法输入/能力不可用”

### 写盘失败注入（手测模板）
在插件 DevTools 控制台临时注入：
```js
window.__origWriteText = window.LeeOS.fs.writeText
window.LeeOS.fs.writeText = async () => { throw new Error('Injected write failure') }
```

完成失败路径验证后恢复：
```js
window.LeeOS.fs.writeText = window.__origWriteText
delete window.__origWriteText
```
