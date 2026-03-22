# Body Metrics（插件规格 / v1）

## 目标
- 手动录入个人身体指标，并按分类快速查看当前值。
- 单指标查看趋势折线图，支持参考区间与图表上下限控制。
- 全程本地存储，不做设备同步、提醒或目标管理。

## 插件信息
- `pluginId`: `com.leeos.body-metrics`
- 入口：`index.html`（静态插件，运行在 sandboxed iframe）
- 当前版本：`1.0.0`

## 数据（Local First）
插件只允许通过 `LeeOS.fs.*` 访问自己的数据目录：
- `{userData}/plugin-data/com.leeos.body-metrics/`

主数据文件：
- `body-metrics-data.json`

## 数据结构（`body-metrics-data.json`）
```json
{
  "version": 1,
  "dominantEye": "left",
  "metrics": {
    "height": [
      { "id": "id-xxx", "date": "2026-02-19", "value": 168 }
    ]
  },
  "metricSettings": {
    "height": {
      "refLow": 160,
      "refHigh": 180,
      "axisMin": 150,
      "axisMax": 190
    },
    "leu": {
      "refState": 0
    }
  }
}
```

说明：
- `metrics.<metricId>[]` 的 `value` 类型由指标定义决定：
  - `number`：数值
  - `binary`：`0`（阴性）/`1`（阳性）
  - `enum`：预定义字符串（如主视眼 `left/right`）
- `metricSettings`：
  - 数值指标支持 `refLow/refHigh/axisMin/axisMax`
  - 二值指标支持 `refState`

## 指标分类
- `whole`：全身（身高、体重、BMI、收缩压、舒张压）
- `eyes`：眼部（主视眼、矫正视力、球镜/柱镜/轴位、左/右瞳距）
- `blood`：血液（血常规 + 生化等）
- `urine`：泌尿（尿常规）

## 关键交互
- 左侧分类，右侧指标卡片；点击卡片打开详情弹窗。
- 详情弹窗内支持：
  - 折线图查看趋势（含悬停值）
  - 配置参考区间与图表上下限（数值指标）
  - 配置参考状态（二值指标）
  - 新增记录、编辑记录、删除记录（二步确认）
  - “Pull latest” 快速回填最近值
- 对于 `autoComputed` 指标（BMI），录入控件锁定，值由身高体重计算。

## 可靠性与校验
- 新增/编辑日期校验：真实日期且不可晚于今天。
- 加载历史数据时会清洗 `date/value`，过滤无效记录。
- 错误提示可见，不依赖 `window.alert/confirm/prompt`。

## 验收建议（手测）
1. 任意数值指标可新增、编辑、删除，列表和卡片即时刷新。
2. 空值/非法值提交会被拦截并提示，不会写入数据文件。
3. 二值指标可切换参考状态，卡片与图点状态颜色同步变化。
4. 修改参考区间后，图表虚线与上下限按规则更新。
