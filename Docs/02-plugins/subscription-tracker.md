# Subscription Tracker（插件规格 / v2）

## 目标
- 本地优先管理订阅（名称、分类、续费节奏、状态、图标、备注）。
- 以卡片看板展示续费进度，支持拖拽排序与拖拽快速分类。
- 保障“保存失败可回滚、失败可见提示”，避免静默数据错乱。

## 插件信息
- `pluginId`: `com.leeos.subscription-tracker`
- 入口：`index.html`（静态插件，运行在 sandboxed iframe）
- 当前版本：`2.0.0`

## 数据（Local First）
插件只允许通过 `LeeOS.fs.*` 访问自己的数据目录：
- `{userData}/plugin-data/com.leeos.subscription-tracker/`

主数据文件：
- `tracker-data.json`

说明文件：
- `README.md`（数据结构说明）

legacy 兼容文件（仅迁移期）：
- `subscriptions.json`
- `categories.json`
- `README.txt`

## 数据结构（`tracker-data.json`）
```json
{
  "schemaVersion": 2,
  "updatedAt": "2026-02-17T12:00:00.000Z",
  "categories": [
    { "id": "cat-xxx", "name": "AI" }
  ],
  "subscriptions": [
    {
      "id": "sub-xxx",
      "name": "ChatGPT Plus",
      "url": "https://chatgpt.com",
      "price": 20,
      "currency": "USD",
      "categoryId": "cat-xxx",
      "status": "active",
      "billingCycle": "monthly",
      "customDays": 30,
      "nextBillingDate": "2026-03-01",
      "iconDataUrl": "",
      "note": ""
    }
  ]
}
```

## 状态口径
- `active`：正常使用
- `expired`：由计算得出（到达/超过 `nextBillingDate`）
- `cancelled`：用户明确取消

说明：
- `expired` 为展示态，不是表单可选值；卡片展示状态与进度条颜色由规则计算。

## 关键交互
- 分类侧栏支持编辑模式（重命名、删除二步确认、拖拽排序）。
- 分类侧栏支持拖入订阅卡进行快速分类。
- 订阅卡板支持卡片互换式拖拽排序（类似桌面图标换位）。
- 点击订阅卡进入编辑弹窗（不再保留卡片内独立编辑按钮）。
- 编辑弹窗进入/退出使用统一过渡动画；`Save/Delete/Cancel/Esc` 共用同一关闭链路。
- 订阅卡板支持卡片编辑/删除（二步确认）。

## 交互与动效补充（2026-02-18）
- 卡片 hover 不再做位移动画，仅保留边框与阴影反馈。
- 分类列表首屏渲染采用 stagger 入场动画（从左到右轻微淡入）。
- 切换分类时，当前激活项执行一次短促 pulse 强调。
- 编辑弹窗入场动画期间触发 `Cancel/Esc` 不丢失，会在入场结束后执行关闭。

## 稳定性与安全门禁（已实现）
- legacy 迁移三态：`ok/missing/invalid`
- 旧文件 `invalid` 时阻断迁移，不写新文件、不清理旧文件
- mutate + save 采用事务式回滚：保存失败恢复内存快照
- 拖拽保存失败时使用独立快照回滚，避免 `dragend` 清空状态导致的竞态
- 失败路径统一插件内提示，不依赖 `window.alert/confirm/prompt`
- 分类下拉改用 DOM API 创建 option，避免字符串拼接注入面

## 图标上传规则
- 允许：`png/jpeg/webp/gif/ico`
- 大小上限：`2MB`
- 存储方式：`iconDataUrl`（base64 data URL）写入 `tracker-data.json`
- 非法格式/超限/读取失败会给出英文错误提示

## 验收建议（手测）
1. 新增订阅：仅 `Name` 必填，其余可空，保存成功。
2. 编辑与删除：删除需二步确认，执行态禁用冲突按钮。
3. 拖拽排序：卡片互换顺滑，松手后顺序可持久化。
4. 拖拽失败注入：写盘失败时出现提示，顺序回滚到拖拽前。
5. legacy 迁移：构造非法 `subscriptions.json`，应显示 `Legacy data is invalid` 且不清理旧文件。
