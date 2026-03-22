---
name: leeos-code-review-master
description: LeeOS 代码审查技能（安全/架构优先）。用于对 Host/Plugins 变更做严格 review，重点关注 IPC 安全、协议映射、XSS 与 Host/Plugin 解耦；默认只输出报告不改代码。
---

# LeeOS Code Review Master

## 默认行为
- 默认只输出审查报告，不改代码（除非用户明确要求“顺手修复”）。

## 沟通与对齐（必须）
- 先确认 review 范围（文件列表或 `git diff`）。
- 如果缺少上下文（目标/威胁模型/验收标准），先问清楚再给结论。

## 检查重点（必须覆盖）
- `postMessage`：source/origin 校验、消息格式校验、超时与错误码。
- 协议映射：路径穿越、资源访问边界、HTML 注入点。
- Electron 安全：`contextIsolation`、`sandbox`、`nodeIntegration`、preload 暴露面。
- 架构：Host 是否混入业务逻辑、插件是否越权访问 Host 内部实现。

## 报告格式（建议）
- **Critical Issues**（必须立刻修）
- **Security Notes**（威胁模型/边界）
- **Code Quality**（可维护性/重复）
- **Action Items**（按处理方标注：Core/Plugin）
