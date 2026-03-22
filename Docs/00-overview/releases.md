# Releases（里程碑）

只记录会影响后续开发判断的里程碑；细粒度变更请直接查看 git 历史。

## v0.1.0 baseline（2026-02-23）
- Host：
  - Sidebar + Detail Shell
  - `leeos-plugin://` 协议加载、iframe sandbox、Host ↔ Plugin `postMessage` 通道
  - `LeeOS.fs.*`、`openDir()`、`openFile()` 与 plugin-data 路径/符号链接防护
  - Home 首页信息卡片与地理位置/天气链路
- Plugins：
  - `com.leeos.diary-heatmap` v1
  - `com.leeos.subscription-tracker` v2
  - `com.leeos.body-metrics` v1
- Docs / Process：
  - 插件标准、插件规格、多 Agent 协作流程文档已建立
