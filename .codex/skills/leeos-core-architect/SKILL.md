---
name: leeos-core-architect
description: LeeOS Host/Core 架构与实现维护技能。用于修改/扩展 Host（Electron main/preload、Renderer shell、协议与 API），并确保 Host 与 Plugins 严格解耦。
---

# LeeOS Core Architect

## 适用场景
- 需要修改 Host：`Code/electron/**`、`Code/src/**`、`Code/vite.config.ts`、`Code/package.json`、Host 暴露的 `window.LeeOS` API。
- 需要新增/收紧安全边界：iframe sandbox、`postMessage` 协议、协议映射（`leeos-plugin://`）、IPC。

## 沟通与对齐（必须）
- 开工前先问清楚：目标、验收标准、范围/非目标、是否允许破坏性改动。
- 如果关键信息缺失，先停下来问，不要边猜边改。

## 不做的事
- 不在 Host 实现业务功能（diary/health/subscription 等）。应拆成插件并交给 `leeos-plugin-vibe`。
- 不修改 `Code/plugins/**`（除非用户明确要求联调）。

## 工作流程（简版）
1. 先判断需求是否属于 Plugin。
2. 对照 `Docs/02-plugins/plugin-standard.md` 做契约对齐。
3. 最小改动、TypeScript strict、安全优先。
4. 提供可复现验证步骤（如 `npm -C Code run lint/build`）。

## Sidebar 动画联动检查（新增，强制）
- 修改 `Code/src/App.css` 的侧边栏动画时，必须把「几何对齐」和「文本消隐」分开设计，禁止一次性混改导致回归。
- 收起态必须满足三条几何不变量（desktop）：
1. `toggle` 中心线与插件 `icon` 中心线一致。
2. 插件 `icon` 在收起后位于侧边栏中轴附近，不出现突然横向跳变。
3. 收起时只允许“侧边栏边界向内收 + 文本裁切消失”，禁止通过 `justify-content` 切换造成整行瞬移。
- 不要混用多个几何基准（`sidebar` 总宽、内容宽、header 可用宽）。必须先定义单一基准：`collapsed content width = sidebar width - padding*2 - border`，再从该基准推导 `icon/toggle/item padding`。
- 遇到 1px 级偏差时，先排查 `box-sizing + border` 对可用宽度的影响，再检查奇偶像素是否导致 0.5px 中心（禁止拍脑袋改 magic number）。
- 文本消隐优先使用 `max-width + overflow` 做自然裁切；仅在明确需求下再叠加 `opacity/transform`。
- 每次改完必须手测两个方向：
1. 展开：图标相对位置稳定，名称渐进出现。
2. 收起：名称按长度自然裁切（长名先裁掉，短名后裁掉），图标和 toggle 无突跳。

## 交付输出格式（便于汇总）
最终输出尽量包含：
- **变更点**：按文件列出改动
- **如何验证**：命令 + 预期结果
- **风险/待确认**：仍需用户确认的点
