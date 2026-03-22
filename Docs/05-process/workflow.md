# 多窗口（多 Agent）协作流程（Skill 驱动）

目标：你主要只和“协调型 Agent”对话，它负责写清需求/拆任务/产出提示词；其它窗口分别用 `core-architect` / `plugin-vibe` 做具体实现；最后用 `code-review-master` 统一审查。

## 角色（技能）分工
- `leeos-orchestrator`：**需求对齐 + 路线/文档总控 + 任务拆解 + 提示词生成 + 汇总交付**
- `leeos-core-architect`：只改 Host/Core（`Code/electron/**`、`Code/src/**`、核心配置）
- `leeos-plugin-vibe`：只改插件（`Code/plugins/**`）
- `leeos-code-review-master`：只做审查报告（默认不改代码）

## 标准节奏（每个任务都按这个来）
1) **对齐（必须）**
- 先回答：要解决什么问题？成功的验收标准是什么？
- 明确：范围/不做什么/风险点/是否允许删改

2) **拆分（协调型 Agent 负责）**
- 把需求拆成 1~N 个子任务：哪些属于 Host，哪些属于插件
- 每个子任务写清：目标、文件范围、验收点、建议命令

3) **执行（各窗口 Agent 负责）**
- 你开窗口选择对应 skill，粘贴协调型 Agent 给的提示词
- 执行完后输出统一的“交付摘要”（见下方输出规范）

4) **审查（Review Master）**
- 你开 `leeos-code-review-master` 窗口
- 将实现窗口的“交付摘要” + `git diff`（或文件列表）粘贴进去
- Review Master 输出报告与行动项（不直接改代码）

插件任务附加门禁（必须）：
- 若本次改动涉及插件内的关键交互（新增按钮、删除/清空/覆盖、弹窗确认），实现 Agent 必须在交付摘要中附带“关键交互自测结果”：
1. 交互入口可见且可触发
2. 状态变化正确（如 `Delete -> Confirm`）
3. 执行后数据与视图一致
4. 失败路径可见（有明确错误提示）
- 对破坏性操作的执行态，必须禁用冲突按钮（避免重复提交、并发冲突或误触）。
- 禁止将 `window.alert/confirm/prompt` 作为破坏性操作的唯一确认机制。

关键录入交互补充门禁：
- 新增按钮若同时绑定 `submit + click`，两条链路必须汇聚到同一个业务函数并有重复提交保护。
- 错误提示位置必须与字段一致：日期错误显示在日期/表单层，数值错误显示在数值输入层。
- 数据加载必须做字段清洗：至少校验 `date` 与 `value` 的类型/取值合法性，禁止静默吞入脏数据。

强制规则（Host 安全相关）：
- 若本次改动包含以下任一文件，必须先过 `leeos-code-review-master` 审查后再合并：
- `Code/electron/main.ts`
- `Code/electron/preload.ts`
- `Code/src/App.tsx`

5) **回收与合并（协调型 Agent 负责）**
- 你把 review 报告贴回协调型 Agent
- 协调型 Agent 决定：修复/调整/更新文档/确认完成

## 输出规范（便于你复制粘贴回协调型 Agent）
所有实现类 skill 的最终输出尽量包含：
- **变更点**：改了什么（按文件列出）
- **如何验证**：1~3 条命令 + 预期结果
- **风险/待确认**：仍不确定的点（必须说清楚）

这样你把输出贴回协调型 Agent，它就能快速汇总与驱动下一步。

## Git 分支与多 Agent 并行规范（新增）

目标：多人/多窗口并行时，降低冲突与回归风险，保证可追溯。

### 1) 基线与保护规则
- 默认基线分支：`main`（如仓库使用 `dev`，则用 `dev` 作为基线）。
- 禁止直接提交到基线分支。
- 每个 Agent 必须在独立功能分支开发。

### 2) 分支命名
- 功能：`feat/<plugin-or-core>-<scope>`
- 修复：`fix/<plugin-or-core>-<scope>`
- 文档：`docs/<scope>`
- 审查任务（可选）：`review/<scope>`

### 3) Agent 开工前标准动作（必须）
1. `git fetch --all`
2. `git checkout main`
3. `git pull --ff-only`
4. `git checkout -b <your-branch-name>`

### 4) 提交流程与粒度
- 小步提交：每个提交只做一类改动（交互、迁移、文案清理分开）。
- 提交信息建议：`<type>(<scope>): <summary>`

### 5) 合并顺序（并行任务）
- 先合并“低耦合、低风险”分支，再合并“高耦合”分支。
- 涉及 Host 安全文件或共享协议时，统一审查后再进基线。

### 6) 冲突处理
- 后合并分支必须先 `rebase` 到最新基线再提合并。
- 只处理自己负责范围内冲突，不顺手修改无关代码。
- 若涉及 Host 安全文件（`Code/electron/main.ts`、`Code/electron/preload.ts`、`Code/src/App.tsx`），必须先通过审查再合并。

### 7) 交付摘要模板（实现 Agent 必填）
- 变更点（按文件）
- 验证步骤（命令 + 预期）
- 风险/待确认
- `git diff --stat`

### 8) 回滚策略
- 单分支回滚优先使用 `git revert <commit>`，禁止破坏性历史改写。
- 回滚后必须补一条“回滚原因 + 影响范围”说明。
