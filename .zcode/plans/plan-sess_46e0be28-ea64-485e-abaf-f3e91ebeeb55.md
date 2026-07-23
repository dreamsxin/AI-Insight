# 为训练可视化添加测试功能

## 目标
训练完成后，用户需要能测试模型的分类能力：
- **LiveTrainViz（2D 分类）**：在决策边界图上点击任意位置，网络即时分类并显示结果
- **DigitClassifyViz（数字识别）**：在 8×8 像素格上手写数字，网络即时识别

两个功能都**纯前端计算**，无需调用后端 API -- 复用已有的前端前向传播代码（`updateDecisionBoundary` / `updateTestSample` 中的 matmul 循环）。

---

## 一、LiveTrainViz - 点击测试分类

### 交互方式
用户在决策边界热力图（左下角）上**点击任意位置**，网络用当前权重对点击坐标做前向传播，显示：
1. 一个**标记圆点**出现在点击位置（颜色=分类结果）
2. 在决策边界上方显示**分类结果文字**："分类: 类别A (概率 0.87)"

### 实现
1. **`onMount()` 中注册 MouseHandler**（当前未使用）：
   ```ts
   if (!this.mouseHandler) this.mouseHandler = new MouseHandler(this.canvas);
   this.mouseHandler.onClick((x, y) => this.handleBoundaryClick(x, y));
   ```

2. **新增 `handleBoundaryClick(mx, my)`**：
   - 检查点击是否落在 boundary 正方形内（`|mx-cx| <= halfSize && |my-cy| <= halfSize`）
   - 如果不在范围内，忽略
   - **画布坐标 → 数据坐标**（逆映射，已有公式）：
     ```ts
     const dataX = xMid + ((mx - cx) / halfSize) * xHalf;
     const dataY = yMid - ((my - cy) / halfSize) * yHalf;
     ```
   - **前端前向传播**：`a = [dataX, dataY]`，复用 `updateDecisionBoundary` 中的循环（tanh 隐藏层 + sigmoid 输出）
   - 输出值 > 0.5 = 类别1，否则 = 类别0；概率 = sigmoid 输出值
   - 调用 `showTestPoint(mx, my, prob)` 在画布上绘制标记

3. **新增 `showTestPoint(x, y, prob)`**：
   - 用一个 `"test"` scene 层，每次点击 `scene.clear("test")` 后重画
   - 一个 `Circle`（半径 5）颜色由 prob 决定（>0.5=红/类别1，<0.5=青/类别0）
   - 一个 `Text` 显示 "类别A 概率 0.87"，放在点击点上方
   - `renderer.renderOnce()`

4. **需要保存 boundary 几何信息**供 click handler 使用：
   - 新增字段 `private boundaryGeom = { cx: 0, cy: 0, halfSize: 0 }`
   - 在 `buildBoundaryPanel()` 末尾保存

5. **训练/重置时清除测试点**：`resetTraining()` 和 `loadDataset()` 中 `scene.clear("test")`

### 不改动的部分
- 训练循环、模型保存/加载、决策边界热力图逻辑全部不变
- 不新增控件（点击是画布交互，不需要控件栏按钮）

---

## 二、DigitClassifyViz - 手写数字识别

### 交互方式
在 8×8 像素格（左上角）上**拖动鼠标手写**数字，松开后网络用当前权重做前向传播，输出概率柱状图实时更新。

### 实现
1. **`onMount()` 中注册 MouseHandler**：
   ```ts
   if (!this.mouseHandler) this.mouseHandler = new MouseHandler(this.canvas);
   this.mouseHandler.onMouseDown((x, y) => this.startDraw(x, y));
   this.mouseHandler.onMouseMove((x, y) => this.draw(x, y));
   this.mouseHandler.onMouseUp(() => this.endDraw());
   ```

2. **新增手写状态字段**：
   ```ts
   private isDrawing = false;
   private drawPixels: number[][] = [];  // 8×8 手写像素值 0..1
   private drawingMode = false;  // true=手写模式, false=浏览数据集模式
   ```

3. **新增 `segmented` 控件**切换"数据集浏览 / 手写测试"模式：
   - chapters.py 中 p5 追加控件：`ControlConfig(key="mode", label="输入方式", type=SEGMENTED, options=["数据集样本", "手写测试"], default=0)`
   - `onControlChange("mode")` → 切换 `drawingMode`，清空像素格，更新显示

4. **画布坐标 → 像素格映射**（`startDraw` / `draw`）：
   - 检查鼠标是否在 pixelGrid 正方形内
   - 计算 `(row, col)`：`col = floor((mx - (cx - size/2)) / cellSize)`，`row = floor((my - (cy - size/2)) / cellSize)`
   - 在 `drawPixels[row][col]` 写入 1.0，**同时写入相邻格子**（用高斯衰减模拟笔触粗细：中心 1.0，相邻 0.5）
   - 更新 `pixelGrid.values = drawPixels`
   - 如果 `drawingMode` 且有训练权重，即时前向传播更新概率柱

5. **`endDraw()`**：`isDrawing = false`，做最终前向传播 + `renderer.renderOnce()`

6. **"清除"按钮**：chapters.py 中追加 `ControlConfig(key="clear", label="清空画板", type=BUTTON)` → 清零 `drawPixels`，更新 pixelGrid，重置概率柱

7. **模式切换时**：
   - 切到"手写测试"：清空 drawPixels，pixelGrid 全黑，概率柱归零，predLabel = "预测: -"
   - 切回"数据集样本"：恢复 `test_sample` 控件显示数据集样本

8. **手写模式下隐藏 `test_sample` 控件**：通过 `disabled_while_running` 不合适（那是给训练用的），改用 group 控制 -- 实际上 ControlsPanel 没有"条件隐藏"功能，所以 test_sample 控件始终显示但只在数据集模式下生效。手写模式下点击 test_sample 无效果（或自动切回数据集模式）。

### 前向传播复用
`updateTestSample()` 中的前向传播循环完全可复用 -- 只需把 `pixels` 数组从 `drawPixels.flat()` 构造即可。抽取一个 `classifyDigit(pixels: number[])` 方法供两条路径调用。

---

## 三、chapters.py 控件变更

### p4（LiveTrainViz）
**无新增控件** -- 点击交互不需要控件栏按钮。

可选：在 description/content 中加一句提示"训练完成后，点击左下角决策边界图任意位置测试分类"。

### p5（DigitClassifyViz）
追加 2 个控件（放在 `run` 按钮之后、`test_sample` 之前）：
```python
ControlConfig(key="mode", label="输入方式", type=ControlType.SEGMENTED,
    options=["数据集样本", "手写测试"], default=0, group="测试"),
ControlConfig(key="clear", label="清空画板", type=ControlType.BUTTON, default=0,
    group="测试"),
```

---

## 四、实施顺序

1. **LiveTrainViz.ts**：注册 MouseHandler → handleBoundaryClick → showTestPoint → 保存 boundaryGeom → 训练/重置时清除
2. **DigitClassifyViz.ts**：注册 MouseHandler → startDraw/draw/endDraw → 画布→像素映射 → 抽取 classifyDigit → mode 切换 → clear 按钮
3. **chapters.py**：p5 追加 mode + clear 控件；p4/p5 的 content 加测试提示
4. **验证**：tsc + vitest + pytest

## 不做的事
- 不调用后端 API 做推理（纯前端前向传播，零延迟）
- 不改动训练循环、模型保存/加载逻辑
- 不改动 Grid/MouseHandler 等基础设施
- 不新增 shape 类型（用 Circle + Text 组合显示测试结果）
