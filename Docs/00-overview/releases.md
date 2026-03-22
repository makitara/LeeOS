# Releases（发布记录）

## 2026-02-22
- feat(host): Home 首页重做（系统化信息布局）
  - 欢迎卡片升级（`Hello Lee` + 英文时间）
  - 天气卡片升级（实时天气、刷新、动态背景）
  - 去除多余信息块，保留更聚焦的首页信息密度
- fix(host): 定位与天气链路稳定性
  - 主进程补齐 geolocation 权限处理（Host 允许、插件不放行）
  - 天气请求与错误文案统一，失败路径可见
  - 反向地理解析增强并优化定位展示策略
- polish(host): Sidebar 动画与几何对齐重构
  - 收起/展开按钮改为单坐标系动画，消除首帧跳变
  - 收起态文本按长度自然裁切（长名先裁、短名后裁）
  - 变量化侧边栏几何参数（宽度、padding、icon/toggle 尺寸）
  - 修复收起态 active 蓝框与 icon 中心偏移（纳入 border 计算）
- docs: 开发规范更新
  - `leeos-core-architect` 增加 Sidebar 动画联动检查与几何不变量

## 2026-02-21
- feat(plugin): `com.leeos.body-metrics` v1
  - 分类式指标管理（全身 / 眼部 / 血液 / 泌尿）
  - 指标卡片 + 详情弹窗 + 手动录入/编辑/删除（二步确认）
  - 趋势图支持悬停值、参考区间虚线、图表上下限配置与自动扩展
  - 二值指标（阴/阳）支持配置参考状态并参与状态着色
- fix(plugin): 录入与数据稳定性
  - 修复新增按钮触发链路，统一点击与提交行为
  - 新增与编辑统一日期校验（真实日期 + 非未来）
  - 加强加载清洗：按指标类型清洗 `value`，过滤无效历史数据
  - 修复错误提示可见性与输入框内提示行为
- docs: 插件文档与流程同步
  - 新增 `Docs/02-plugins/body-metrics.md`
  - 更新 `roadmap.md` 的插件阶段状态
  - 更新 `workflow.md` 的关键交互收尾检查项

## 2026-02-18
- polish(plugin): `com.leeos.subscription-tracker` 交互与动效细化
  - 点击整张卡片进入编辑，移除卡片内独立编辑按钮
  - 编辑弹窗改为统一入场/退出过渡动画
  - 卡片 hover 去除位移，仅保留边框与阴影反馈
  - 分类侧栏新增首屏 stagger 入场与激活项 pulse 动效
- fix(plugin): 编辑关闭链路一致性
  - `Save/Delete/Cancel/Esc` 统一走同一关闭逻辑
  - 修复弹窗入场动画期间 `Cancel/Esc` 可能被忽略的问题（关闭请求排队执行）

## 2026-02-17
- feat(plugin): `com.leeos.subscription-tracker` v2
  - 重做分类管理交互（编辑模式、重命名、二步删除、拖拽排序）
  - 卡片支持互换式拖拽与拖入分类快速归类
  - 编辑器支持图标上传（格式/大小校验）与默认图标策略
  - 状态与进度展示统一（`active / expired / cancelled`）
- fix(plugin): 数据安全与一致性
  - legacy 迁移改为 `ok/missing/invalid` 三态，`invalid` 阻断覆盖与清理
  - mutate + save 路径加入事务化回滚
  - 拖拽落盘失败支持独立快照回滚并给出插件内可见错误提示
  - 去除关键路径对 `window.alert/confirm/prompt` 依赖
- docs: 文档门禁与插件规格同步
  - workflow 补齐“执行态禁用冲突按钮”门禁
  - 新增 `Docs/02-plugins/subscription-tracker.md`

## 2026-02-11
- feat(plugin): `com.leeos.diary-heatmap` v1
  - 基于 `entries/YYYY-MM-DD.md` 渲染 GitHub 风格 heatmap
  - frontmatter `mood: 1..5` 色阶；缺失/非法按 `3`
  - Tooltip 英文日期 + mood 文案
- feat(host): 新增 `LeeOS.fs.openDir()` 并加强 Host ↔ Plugin 安全边界
  - `postMessage` origin/source 校验
  - plugin-data 路径 realpath / symlink 绕过防护
