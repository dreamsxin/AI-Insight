/** MatrixMultViz - visualize W·x + b matrix multiplication step by step.

A fixed single-layer example is used (a hidden layer of 3 neurons with 2
inputs) so the matrices fit nicely. The "step" slider (0-5) drives which
computation phase is shown:

  Step 0: Show all matrices labeled (x, W, b)
  Step 1-3: Highlight row i of W and compute the dot product for output element i
  Step 4: Show the final z vector and apply activation (ReLU) -> a
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Line } from "@/canvas/shapes/Line";
import { Rect } from "@/canvas/shapes/Rect";
import { Arrow } from "@/canvas/shapes/Arrow";
import { Grid } from "@/canvas/shapes/Grid";
import { COLORS } from "@/utils/color";
import { relu } from "@/utils/math";

const INPUTS = [0.5, 0.8];
// W is [3 x 2]: 3 outputs, 2 inputs
const WEIGHTS = [
  [0.4, -0.7],
  [0.2, 0.9],
  [-0.5, 0.3],
];
const BIASES = [0.1, -0.2, 0.4];

export class MatrixMultViz extends BaseVisualization {
  onMount(): void {
    this.render();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "step") this.render();
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const step = Math.floor(this.controls["step"] ?? 0);

    const title = new Text("矩阵乘法: a = f(W·x + b)", w / 2, 28, 18);
    title.fillStyle = COLORS.text;
    title.fontWeight = "bold";
    this.scene.add(title);

    // Layout: x column (left), W grid (center), result column (right)
    const cellSize = 56;
    const cy = h / 2;
    const xX = w * 0.16;
    const wX = w * 0.5;
    const aX = w * 0.84;

    // ----- x vector (2 x 1) -----
    this.drawVector(INPUTS, xX, cy, cellSize, "x", COLORS.accent);

    // ----- W matrix (3 x 2) -----
    const wGrid = new Grid(wX, cy, WEIGHTS, cellSize);
    wGrid.showValues = true;
    wGrid.fontSize = 13;
    wGrid.cellGap = 2;
    this.scene.add(wGrid);
    const wLabel = new Text("W", wX, cy - cellSize * 2 - 8, 16);
    wLabel.fillStyle = COLORS.accent2;
    wLabel.fontWeight = "bold";
    this.scene.add(wLabel);

    // ----- b vector (3 x 1) shown small below W -----
    const bCY = cy + cellSize * 2 + 24;
    this.drawVector(BIASES, wX, bCY, cellSize * 0.55, "b", COLORS.accent3);

    // ----- result column -----
    // z = W·x + b
    const z = WEIGHTS.map((row, i) =>
      row.reduce((s, wv, j) => s + wv * INPUTS[j], 0) + BIASES[i],
    );
    const a = z.map(relu);

    const arrows = [
      new Arrow(xX + cellSize, cy, wX - cellSize * 1.2, cy, 8),
      new Arrow(wX + cellSize, cy, aX - cellSize, cy, 8),
    ];
    for (const arr of arrows) {
      arr.strokeStyle = COLORS.textDim;
      arr.lineWidth = 1.5;
      this.scene.add(arr);
    }

    const resultLabel = new Text("结果", aX, cy - cellSize * 2 - 8, 16);
    resultLabel.fillStyle = COLORS.highlight;
    resultLabel.fontWeight = "bold";
    this.scene.add(resultLabel);

    switch (step) {
      case 0:
        this.drawStep0(w, h, aX, cy, cellSize);
        break;
      case 1:
      case 2:
      case 3:
        this.drawDotStep(step - 1, xX, wX, cy, cellSize, aX);
        break;
      case 4:
        this.drawStep4(w, h, aX, cy, cellSize, z, a);
        break;
      case 5:
        this.drawStep5(w, h, aX, cy, cellSize, z, a);
        break;
      default:
        break;
    }

    // Step indicator
    const stepNames = [
      "步骤 0: 展示矩阵",
      "步骤 1: 计算第1行点积",
      "步骤 2: 计算第2行点积",
      "步骤 3: 计算第3行点积",
      "步骤 4: 加偏置并求和",
      "步骤 5: 应用激活函数",
    ];
    const idx = Math.min(step, stepNames.length - 1);
    const stepText = new Text(stepNames[idx], w / 2, h - 24, 13);
    stepText.fillStyle = COLORS.textDim;
    this.scene.add(stepText);

    this.renderer.renderOnce();
  }

  private drawStep0(w: number, h: number, aX: number, cy: number, cellSize: number): void {
    const desc = new Text("观察矩阵 W (3×2)、输入向量 x (2×1) 和偏置 b (3×1)", w / 2, h - 50, 13);
    desc.fillStyle = COLORS.text;
    this.scene.add(desc);

    // Result placeholder
    this.drawResultPlaceholder(aX, cy, cellSize);
  }

  private drawDotStep(
    row: number,
    xX: number,
    wX: number,
    cy: number,
    cellSize: number,
    aX: number,
  ): void {
    // Highlight row `row` of W and the corresponding x elements, show dot product.
    const rowOffsetY = -(WEIGHTS.length * cellSize) / 2 + row * cellSize;

    // Highlight the active row of W
    const rowRect = new Rect(wX, cy + rowOffsetY + cellSize / 2, cellSize * 2, cellSize, 6);
    rowRect.fillStyle = "transparent";
    rowRect.strokeStyle = COLORS.highlight;
    rowRect.lineWidth = 3;
    this.scene.add(rowRect);

    // Highlight all x cells (both are used in the dot product)
    const xOffsetY = -(INPUTS.length * cellSize) / 2;
    for (let j = 0; j < INPUTS.length; j++) {
      const xRect = new Rect(
        xX,
        cy + xOffsetY + j * cellSize + cellSize / 2,
        cellSize,
        cellSize,
        6,
      );
      xRect.fillStyle = "transparent";
      xRect.strokeStyle = COLORS.highlight;
      xRect.lineWidth = 2;
      this.scene.add(xRect);
    }

    // Compute partial dot product
    const wRow = WEIGHTS[row];
    const dot =
      wRow[0] * INPUTS[0] + wRow[1] * INPUTS[1];
    const z_i = dot + BIASES[row];

    // Formula text
    const formulaY = cy + cellSize * 2 + 14;
    const formula = new Text(
      `z${row + 1} = (${wRow[0].toFixed(1)})(${INPUTS[0]}) + (${wRow[1].toFixed(1)})(${INPUTS[1]}) = ${dot.toFixed(2)}`,
      this.width / 2,
      formulaY,
      13,
    );
    formula.fillStyle = COLORS.accent;
    formula.fontFamily = "monospace";
    this.scene.add(formula);

    const biasLine = new Text(
      `+ b${row + 1} = ${BIASES[row].toFixed(1)}  →  z${row + 1} = ${z_i.toFixed(2)}`,
      this.width / 2,
      formulaY + 20,
      13,
    );
    biasLine.fillStyle = COLORS.accent3;
    biasLine.fontFamily = "monospace";
    this.scene.add(biasLine);

    // Show the computed value in the result column
    this.drawPartialResult(aX, cy, cellSize, row, z_i);

    // Arrow from highlighted W row to result cell
    const arr = new Arrow(
      wX + cellSize,
      cy + rowOffsetY + cellSize / 2,
      aX - cellSize / 2,
      cy + rowOffsetY + cellSize / 2,
      7,
    );
    arr.strokeStyle = COLORS.highlight;
    arr.lineWidth = 2;
    this.scene.add(arr);
  }

  private drawStep4(w: number, h: number, aX: number, cy: number, cellSize: number, z: number[], _a: number[]): void {
    // Show full z vector = W·x + b
    this.drawVector(z, aX, cy, cellSize, "z", COLORS.highlight);

    const desc = new Text("加权求和后加上偏置 b，得到中间值向量 z", w / 2, h - 50, 13);
    desc.fillStyle = COLORS.text;
    this.scene.add(desc);

    const zLabel = new Text("z = W·x + b", aX, cy - cellSize * 2 - 8, 16);
    zLabel.fillStyle = COLORS.highlight;
    zLabel.fontWeight = "bold";
    this.scene.add(zLabel);
  }

  private drawStep5(w: number, h: number, aX: number, cy: number, cellSize: number, z: number[], a: number[]): void {
    // Apply activation: a = f(z) = ReLU(z)
    this.drawVector(a, aX, cy, cellSize, "a", COLORS.positive);

    const desc = new Text("应用激活函数 f(z) = ReLU(z) = max(0, z)，得到输出 a", w / 2, h - 50, 13);
    desc.fillStyle = COLORS.text;
    this.scene.add(desc);

    const aLabel = new Text("a = f(z)", aX, cy - cellSize * 2 - 8, 16);
    aLabel.fillStyle = COLORS.positive;
    aLabel.fontWeight = "bold";
    this.scene.add(aLabel);

    // Show comparison z -> a for clarity
    const compY = h - 70;
    const comp = new Text(
      `z = [${z.map((v) => v.toFixed(2)).join(", ")}]  →  a = [${a.map((v) => v.toFixed(2)).join(", ")}]`,
      w / 2,
      compY,
      12,
    );
    comp.fillStyle = COLORS.textDim;
    comp.fontFamily = "monospace";
    this.scene.add(comp);
  }

  /** Draw a vertical vector with a label. */
  private drawVector(
    values: number[],
    cx: number,
    cy: number,
    cellSize: number,
    label: string,
    color: string,
  ): void {
    const offset = -(values.length * cellSize) / 2;
    for (let i = 0; i < values.length; i++) {
      const rect = new Rect(cx, cy + offset + i * cellSize + cellSize / 2, cellSize - 4, cellSize - 4, 4);
      rect.fillStyle = COLORS.panel;
      rect.strokeStyle = color;
      rect.lineWidth = 1.5;
      this.scene.add(rect);
      const val = new Text(values[i].toFixed(2), cx, cy + offset + i * cellSize + cellSize / 2, 13);
      val.fillStyle = COLORS.text;
      val.fontFamily = "monospace";
      this.scene.add(val);
    }
    const lbl = new Text(label, cx, cy + offset - 16, 16);
    lbl.fillStyle = color;
    lbl.fontWeight = "bold";
    this.scene.add(lbl);
  }

  /** Placeholder cells while no result is computed yet. */
  private drawResultPlaceholder(cx: number, cy: number, cellSize: number): void {
    const offset = -(WEIGHTS.length * cellSize) / 2;
    for (let i = 0; i < WEIGHTS.length; i++) {
      const rect = new Rect(cx, cy + offset + i * cellSize + cellSize / 2, cellSize - 4, cellSize - 4, 4);
      rect.fillStyle = "transparent";
      rect.strokeStyle = COLORS.textDim;
      rect.lineWidth = 1;
      this.scene.add(rect);
      const q = new Text("?", cx, cy + offset + i * cellSize + cellSize / 2, 14);
      q.fillStyle = COLORS.textDim;
      this.scene.add(q);
    }
  }

  /** Show result column with only the active row filled in. */
  private drawPartialResult(
    cx: number,
    cy: number,
    cellSize: number,
    activeRow: number,
    value: number,
  ): void {
    const offset = -(WEIGHTS.length * cellSize) / 2;
    for (let i = 0; i < WEIGHTS.length; i++) {
      const isActive = i === activeRow;
      const rect = new Rect(cx, cy + offset + i * cellSize + cellSize / 2, cellSize - 4, cellSize - 4, 4);
      rect.fillStyle = isActive ? COLORS.panel : "transparent";
      rect.strokeStyle = isActive ? COLORS.highlight : COLORS.textDim;
      rect.lineWidth = isActive ? 2 : 1;
      this.scene.add(rect);
      const txt = isActive
        ? new Text(value.toFixed(2), cx, cy + offset + i * cellSize + cellSize / 2, 13)
        : new Text("?", cx, cy + offset + i * cellSize + cellSize / 2, 14);
      txt.fillStyle = isActive ? COLORS.highlight : COLORS.textDim;
      txt.fontFamily = "monospace";
      this.scene.add(txt);
    }
  }
}
