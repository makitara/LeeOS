# LeeOS (Code)

这里是 LeeOS 的应用代码（Electron + React）。

文档请看：
- `Docs/README.md`

常用命令：
- `npm install`
- `npm run dev`

Home 天气依赖 Electron geolocation。开发或打包前，在 `Code/.env.local` 里配置：
- `VITE_GOOGLE_API_KEY=...`

可直接复制 `Code/.env.example`：
- `cp Code/.env.example Code/.env.local`
