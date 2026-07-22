/** Matrix multiplication explained as applying several recipes to one input. */

import { StepSequenceVisualization } from "@/visualizations/StepSequenceVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Rect } from "@/canvas/shapes/Rect";
import { Arrow } from "@/canvas/shapes/Arrow";
import { Circle } from "@/canvas/shapes/Circle";
import { COLORS } from "@/utils/color";
import { relu } from "@/utils/math";
import { Easing } from "@/canvas/animation/Easing";

const INPUTS = [0.5, 0.8];
const WEIGHTS = [
  [0.4, -0.7],
  [0.2, 0.9],
  [-0.5, 0.3],
];
const BIASES = [0.1, -0.2, 0.4];
const RECIPE_NAMES = ["配方 A", "配方 B", "配方 C"];

export class MatrixMultViz extends StepSequenceVisualization {
  protected get maxStep(): number {
    return 5;
  }

  protected get transitionDuration(): number {
    return 720;
  }

  onMount(): void {
    this.initializeStepSequence();
    super.resize();
    this.renderStepSequenceFrame();
  }

  onControlChange(key: string, _value: number): void {
    this.handleStepSequenceControl(key);
  }

  override resize(): void {
    super.resize();
    this.renderStepSequenceFrame();
  }

  protected renderStepSequenceFrame(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const compact = w < 560;
    const step = Math.max(0, Math.min(this.maxStep, Math.floor(this.controls["step"] ?? 0)));
    const cell = compact ? 38 : 48;
    const rowGap = compact ? 56 : 66;
    const centerY = Math.min(h * 0.53, h - 170);
    const inputX = compact ? 48 : w * 0.13;
    const recipeX = compact ? w * 0.49 : w * 0.49;
    const outputX = compact ? w - 46 : w * 0.86;
    const movement = Easing.easeInOutCubic(this.stepTransition.progress);
    const z = WEIGHTS.map((row, index) => row[0] * INPUTS[0] + row[1] * INPUTS[1] + BIASES[index]);
    const output = z.map(relu);

    this.addText("同一份输入，交给三张不同配方", w / 2, 26, 18, COLORS.text, true);
    this.addText("专业名称：矩阵乘法  W × x + b", w / 2, 50, 11, COLORS.textDim);
    const stageStart = this.scene.getShapes().length;

    this.addText("两份输入 x", inputX, centerY - rowGap * 1.9, 12, COLORS.accent, true);
    this.drawInput(inputX, centerY - cell * 0.62, cell, "输入 1", INPUTS[0]);
    this.drawInput(inputX, centerY + cell * 0.62, cell, "输入 2", INPUTS[1]);

    this.addText("三张配方 W", recipeX, centerY - rowGap * 1.9, 12, COLORS.accent2, true);
    this.addText("每个数字表示放大或减弱多少", recipeX, centerY - rowGap * 1.58, compact ? 9 : 10, COLORS.textDim);

    for (let row = 0; row < WEIGHTS.length; row++) {
      const y = centerY + (row - 1) * rowGap;
      const active = step === row + 1;
      const recipeWidth = cell * 2 + (compact ? 18 : 24);
      const recipe = new Rect(recipeX, y, recipeWidth, cell, 5);
      recipe.fillStyle = active ? "rgba(233, 185, 95, 0.12)" : COLORS.panel;
      recipe.strokeStyle = active ? COLORS.highlight : COLORS.accent2;
      recipe.lineWidth = active ? 3 : 1;
      this.scene.add(recipe);
      this.addText(RECIPE_NAMES[row], recipeX, y - cell / 2 - 11, compact ? 9 : 10, active ? COLORS.highlight : COLORS.textDim);
      this.addText(`${WEIGHTS[row][0].toFixed(1)}     ${WEIGHTS[row][1].toFixed(1)}`, recipeX, y, compact ? 11 : 12, COLORS.text, true);

      const visible = step >= row + 1 || step >= 4;
      const value = step >= 5 ? z[row] + (output[row] - z[row]) * movement : z[row];
      const result = new Rect(outputX, y, cell, cell, 5);
      result.fillStyle = visible ? COLORS.panel : "transparent";
      result.strokeStyle = step >= 5 ? COLORS.positive : visible ? COLORS.highlight : COLORS.edge;
      result.lineWidth = visible ? 2 : 1;
      this.scene.add(result);
      const revealActiveValue = !active || movement > 0.68;
      this.addText(visible && revealActiveValue ? value.toFixed(2) : "?", outputX, y, compact ? 10 : 12, visible ? COLORS.text : COLORS.textDim, visible);

      if (active) {
        const arrowStart = recipeX + recipeWidth / 2 + 4;
        const arrowEnd = outputX - cell / 2 - 5;
        const arrow = new Arrow(arrowStart, y, arrowStart + (arrowEnd - arrowStart) * movement, y, 7);
        arrow.strokeStyle = COLORS.highlight;
        arrow.lineWidth = 2;
        this.scene.add(arrow);

        const inputYs = [centerY - cell * 0.62, centerY + cell * 0.62];
        if (movement < 0.58) {
          const incoming = movement / 0.58;
          inputYs.forEach((inputY, inputIndex) => {
            const particle = new Circle(
              inputX + (recipeX - recipeWidth / 2 - inputX) * incoming,
              inputY + (y - inputY) * incoming,
              compact ? 3 : 4,
            );
            particle.fillStyle = inputIndex === 0 ? COLORS.accent : COLORS.accent2;
            this.scene.add(particle);
          });
        } else if (movement < 0.94) {
          const outgoing = (movement - 0.58) / 0.42;
          const mixed = new Circle(
            recipeX + (outputX - recipeX) * outgoing,
            y,
            compact ? 4 : 5,
          );
          mixed.fillStyle = COLORS.highlight;
          this.scene.add(mixed);
        }
      }
    }

    if (step === 4 && movement < 0.94) {
      for (let row = 0; row < BIASES.length; row++) {
        const y = centerY + (row - 1) * rowGap;
        const chipX = recipeX + (outputX - recipeX) * movement;
        const chip = new Rect(chipX, y, compact ? 28 : 34, 20, 4);
        chip.fillStyle = COLORS.accent3;
        chip.strokeStyle = "transparent";
        this.scene.add(chip);
        this.addText(`b${row + 1}`, chipX, y, compact ? 8 : 9, COLORS.text, true);
      }
    }

    this.addText(step >= 5 ? "最终输出 a" : "三个结果", outputX, centerY - rowGap * 1.9, 12, step >= 5 ? COLORS.positive : COLORS.highlight, true);

    if (step >= 1 && step <= 3) {
      const row = step - 1;
      const mixed = WEIGHTS[row][0] * INPUTS[0] + WEIGHTS[row][1] * INPUTS[1];
      const y = h - (compact ? 86 : 78);
      this.addText(
        `${RECIPE_NAMES[row]}：两份输入按比例混合，先得到 ${mixed.toFixed(2)}`,
        w / 2,
        y,
        compact ? 10 : 12,
        COLORS.text,
        true,
      );
      this.addText(`再加固定修正 ${BIASES[row].toFixed(1)}，结果是 ${z[row].toFixed(2)}`, w / 2, y + 22, compact ? 10 : 11, COLORS.highlight);
    } else if (step === 4) {
      this.addText("三张配方都算完，再分别加上固定修正 b", w / 2, h - 72, compact ? 10 : 12, COLORS.text, true);
      this.addText("b 就像出厂前的微调，不随这次输入改变", w / 2, h - 50, compact ? 10 : 11, COLORS.textDim);
    } else if (step >= 5) {
      this.addText("最后过一道开关：负数归零，正数保留", w / 2, h - 72, compact ? 10 : 12, COLORS.positive, true);
      this.addText("这个开关的专业名称是 ReLU 激活函数", w / 2, h - 50, compact ? 10 : 11, COLORS.textDim);
    }

    const stepLabels = ["先看输入和三张配方", "计算配方 A", "计算配方 B", "计算配方 C", "加入固定修正", "通过输出开关"];
    this.addText(stepLabels[step], w / 2, h - 18, compact ? 10 : 12, COLORS.textDim);
    this.applyStepTransition(stageStart);
    this.renderer.renderOnce();
  }

  private drawInput(x: number, y: number, size: number, label: string, value: number): void {
    const rect = new Rect(x, y, size, size, 5);
    rect.fillStyle = COLORS.panel;
    rect.strokeStyle = COLORS.accent;
    rect.lineWidth = 2;
    this.scene.add(rect);
    this.addText(value.toFixed(1), x, y, 12, COLORS.text, true);
    this.addText(label, x, y - size / 2 - 10, 9, COLORS.textDim);
  }

  private addText(text: string, x: number, y: number, size: number, color: string, bold = false): void {
    const label = new Text(text, x, y, size);
    label.fillStyle = color;
    label.fontWeight = bold ? "bold" : "normal";
    this.scene.add(label);
  }
}
