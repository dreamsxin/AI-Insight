/** LossFunctionViz - visualize the gap between prediction and target (MSE).

The prediction and target are drawn as glowing bars (a translucent halo
behind a solid bar). The gap between them is a red pulsing area with a
lightning icon. A thermometer-style loss meter on the side runs green
(low) to red (high). The loss value counts up smoothly when sliders
change. When the gap is large, a blinking "⚠ 差距大！" warning appears.
Plain-language labels: 预测值 / 真实值 / 差距 = 损失.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Rect } from "@/canvas/shapes/Rect";
import { Arrow } from "@/canvas/shapes/Arrow";
import { Line } from "@/canvas/shapes/Line";
import { Circle } from "@/canvas/shapes/Circle";
import { COLORS } from "@/utils/color";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";

export class LossFunctionViz extends BaseVisualization {
  /** Smoothly animated loss value (tweened toward the real loss). */
  private displayLoss = { val: 0 };
  /** Pulsing opacity (0..1) for the gap area, looping. */
  private pulse = { val: 0 };
  /** Blink opacity (0..1) for the warning text, looping. */
  private blink = { val: 0 };
  private realLoss = 0;

  onMount(): void {
    const pred = this.controls["pred"] ?? 5;
    const target = this.controls["target"] ?? 7;
    this.realLoss = Math.pow(pred - target, 2);
    this.displayLoss.val = this.realLoss;
    this.render();
    this.startPulse();
    this.startBlink();
  }

  onControlChange(_key: string, _value: number): void {
    const pred = this.controls["pred"] ?? 5;
    const target = this.controls["target"] ?? 7;
    const newLoss = Math.pow(pred - target, 2);
    this.realLoss = newLoss;
    // Clear any previous loss-display tween to prevent accumulation
    this.renderer.clearAnimations();
    // Animate the displayed loss from its current value to the new one.
    const tween = new Tween(this.displayLoss, { val: newLoss }, 400, Easing.easeOutCubic);
    tween.onUpdate(() => {
      this.render();
    });
    this.renderer.addTween(tween);
    // Restart the looping animations
    this.startPulse();
    this.startBlink();
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;

    const pred = this.controls["pred"] ?? 5;
    const target = this.controls["target"] ?? 7;
    const loss = this.displayLoss.val;

    // Title
    const title = new Text("损失函数 (MSE)", w / 2, 28, 18);
    title.fillStyle = COLORS.text;
    title.fontWeight = "bold";
    this.scene.add(title);

    // Plot area geometry
    const baseY = h - 70;
    const topY = 70;
    const maxVal = 10;
    const plotH = baseY - topY;
    const scale = plotH / maxVal;

    // Y-axis
    const axisX = w * 0.22;
    const yAxis = new Line(axisX, topY - 10, axisX, baseY);
    yAxis.strokeStyle = COLORS.textDim;
    yAxis.lineWidth = 1;
    this.scene.add(yAxis);

    // Baseline
    const baseLine = new Line(axisX, baseY, w - 30, baseY);
    baseLine.strokeStyle = COLORS.textDim;
    baseLine.lineWidth = 1;
    this.scene.add(baseLine);

    // Y-axis ticks
    for (let v = 0; v <= maxVal; v += 2) {
      const y = baseY - v * scale;
      const tick = new Line(axisX - 5, y, axisX, y);
      tick.strokeStyle = COLORS.textDim;
      tick.lineWidth = 1;
      this.scene.add(tick);
      const t = new Text(String(v), axisX - 12, y, 10);
      t.fillStyle = COLORS.textDim;
      t.align = "right";
      this.scene.add(t);
    }

    // Bars
    const barW = 70;
    const predX = w * 0.38;
    const targetX = w * 0.58;
    const predTopY = baseY - pred * scale;
    const targetTopY = baseY - target * scale;

    // Prediction bar - glowing (halo behind)
    const predHalo = new Rect(predX, baseY - (pred * scale) / 2, barW + 16, pred * scale + 16, 10);
    predHalo.fillStyle = `rgba(0, 217, 255, 0.15)`;
    this.scene.add(predHalo);
    const predBar = new Rect(predX, baseY - (pred * scale) / 2, barW, pred * scale, 6);
    predBar.fillStyle = COLORS.accent;
    this.scene.add(predBar);

    // Target bar - glowing
    const targetHalo = new Rect(targetX, baseY - (target * scale) / 2, barW + 16, target * scale + 16, 10);
    targetHalo.fillStyle = `rgba(167, 139, 250, 0.15)`;
    this.scene.add(targetHalo);
    const targetBar = new Rect(targetX, baseY - (target * scale) / 2, barW, target * scale, 6);
    targetBar.fillStyle = COLORS.accent2;
    this.scene.add(targetBar);

    // Gap area: red pulsing + lightning, between the two bar tops
    const gapTop = Math.min(predTopY, targetTopY);
    const gapBottom = Math.max(predTopY, targetTopY);
    const gapSize = gapBottom - gapTop;
    const isLargeGap = gapSize > plotH * 0.25;
    if (gapSize > 0.5) {
      const pulseAlpha = 0.15 + this.pulse.val * 0.35;
      const gap = new Rect(
        (predX + targetX) / 2,
        (gapTop + gapBottom) / 2,
        targetX - predX,
        gapSize,
        0,
      );
      gap.fillStyle = `rgba(239, 68, 68, ${pulseAlpha})`;
      this.scene.add(gap);

      // Gap bracket markers
      const gapLine = new Line(predX - 4, predTopY, targetX + 4, predTopY);
      gapLine.strokeStyle = `rgba(251, 191, 36, 0.5)`;
      gapLine.lineWidth = 1;
      this.scene.add(gapLine);
      const gapLine2 = new Line(predX - 4, targetTopY, targetX + 4, targetTopY);
      gapLine2.strokeStyle = `rgba(251, 191, 36, 0.5)`;
      gapLine2.lineWidth = 1;
      this.scene.add(gapLine2);

      // Distance arrow between tops
      const distX = (predX + targetX) / 2;
      const distArrow = new Arrow(distX, predTopY, distX, targetTopY, 7);
      distArrow.strokeStyle = COLORS.highlight;
      distArrow.lineWidth = 1.5;
      this.scene.add(distArrow);

      // Lightning icon in the gap
      const bolt = new Text("⚡", distX, (gapTop + gapBottom) / 2, 22);
      bolt.fillStyle = COLORS.highlight;
      this.scene.add(bolt);
    }

    // Bar value labels
    const predVal = new Text(pred.toFixed(1), predX, predTopY - 16, 14);
    predVal.fillStyle = COLORS.accent;
    predVal.fontWeight = "bold";
    this.scene.add(predVal);

    const targetVal = new Text(target.toFixed(1), targetX, targetTopY - 16, 14);
    targetVal.fillStyle = COLORS.accent2;
    targetVal.fontWeight = "bold";
    this.scene.add(targetVal);

    // Plain-language bar name labels
    const predLbl = new Text("预测值 ŷ", predX, baseY + 20, 13);
    predLbl.fillStyle = COLORS.accent;
    this.scene.add(predLbl);
    const targetLbl = new Text("真实值 y", targetX, baseY + 20, 13);
    targetLbl.fillStyle = COLORS.accent2;
    this.scene.add(targetLbl);

    // "差距 = 损失" label between bars at the bottom
    const gapLbl = new Text("差距 = 损失", (predX + targetX) / 2, baseY + 20, 12);
    gapLbl.fillStyle = COLORS.highlight;
    this.scene.add(gapLbl);

    // Blinking warning when the gap is large
    if (isLargeGap) {
      const warnAlpha = 0.3 + this.blink.val * 0.7;
      const warn = new Text("⚠ 差距大！", (predX + targetX) / 2, topY + 14, 16);
      warn.fillStyle = `rgba(239, 68, 68, ${warnAlpha})`;
      warn.fontWeight = "bold";
      this.scene.add(warn);
    }

    // Thermometer-style loss meter on the right side
    this.drawThermometer(w, h, topY, baseY, loss, maxVal);

    // Loss value panel (counting up)
    const panelX = w - 175;
    const panelY = 90;
    const panel = new Rect(panelX, panelY, 150, 120, 8);
    panel.fillStyle = COLORS.bgLight;
    panel.strokeStyle = COLORS.edge;
    panel.lineWidth = 1;
    this.scene.add(panel);

    const formulaTitle = new Text("MSE 计算", panelX, panelY - 28, 13);
    formulaTitle.fillStyle = COLORS.textDim;
    this.scene.add(formulaTitle);

    const formula = new Text(`(ŷ - y)²`, panelX, panelY - 8, 13);
    formula.fillStyle = COLORS.text;
    formula.fontFamily = "monospace";
    this.scene.add(formula);

    const diff = new Text(
      `= (${pred.toFixed(1)} - ${target.toFixed(1)})²`,
      panelX,
      panelY + 16,
      12,
    );
    diff.fillStyle = COLORS.textDim;
    diff.fontFamily = "monospace";
    this.scene.add(diff);

    const lossLbl = new Text("损失 Loss", panelX, panelY + 44, 12);
    lossLbl.fillStyle = COLORS.textDim;
    this.scene.add(lossLbl);

    const lossVal = new Text(loss.toFixed(2), panelX, panelY + 70, 26);
    lossVal.fillStyle = COLORS.highlight;
    lossVal.fontWeight = "bold";
    lossVal.fontFamily = "monospace";
    this.scene.add(lossVal);

    // Gradient hint
    const hint = new Text("← 拖动滑块让损失变小", w / 2, h - 22, 12);
    hint.fillStyle = COLORS.textDim;
    this.scene.add(hint);

    this.renderer.renderOnce();
  }

  /** Vertical thermometer: green (low loss) at bottom, red (high) at top. */
  private drawThermometer(
    w: number, h: number, topY: number, baseY: number, loss: number, maxVal: number,
  ): void {
    const tx = w - 30;
    const tubeW = 16;
    const tubeTop = topY;
    const tubeBottom = baseY;
    const tubeH = tubeBottom - tubeTop;

    // Tube outline
    const tube = new Rect(tx, (tubeTop + tubeBottom) / 2, tubeW, tubeH, tubeW / 2);
    tube.fillStyle = "rgba(255,255,255,0.05)";
    tube.strokeStyle = COLORS.textDim;
    tube.lineWidth = 1.5;
    this.scene.add(tube);

    // Fill: height proportional to loss (cap at maxVal^2 for visual)
    const maxLoss = Math.pow(maxVal, 2);
    const fillRatio = Math.max(0, Math.min(1, loss / maxLoss));
    const fillH = tubeH * fillRatio;
    if (fillH > 1) {
      const fillY = tubeBottom - fillH / 2;
      const fill = new Rect(tx, fillY, tubeW - 4, fillH, (tubeW - 4) / 2);
      // green (low) -> red (high): hue 140 -> 0
      const hue = Math.round(140 * (1 - fillRatio));
      fill.fillStyle = `hsl(${hue}, 80%, 55%)`;
      this.scene.add(fill);
    }

    // Bulb at the bottom
    const bulb = new Circle(tx, tubeBottom + 10, tubeW * 0.7);
    const hue = Math.round(140 * (1 - fillRatio));
    bulb.fillStyle = `hsl(${hue}, 80%, 55%)`;
    this.scene.add(bulb);

    // Label
    const lbl = new Text("损失温度计", tx, tubeTop - 14, 11);
    lbl.fillStyle = COLORS.textDim;
    this.scene.add(lbl);
    const lowLbl = new Text("低", tx - 14, tubeBottom, 9);
    lowLbl.fillStyle = COLORS.positive;
    lowLbl.align = "right";
    this.scene.add(lowLbl);
    const highLbl = new Text("高", tx - 14, tubeTop, 9);
    highLbl.fillStyle = COLORS.negative;
    highLbl.align = "right";
    this.scene.add(highLbl);
  }

  /** Looping pulse for the gap area opacity. */
  private startPulse(): void {
    const tween = new Tween(this.pulse, { val: 1 }, 900, Easing.easeInOutCubic);
    tween.onUpdate(() => {
      this.render();
    });
    tween.onComplete(() => {
      tween.reset();
      this.renderer.addTween(tween);
    });
    this.renderer.addTween(tween);
  }

  /** Looping blink for the warning text. */
  private startBlink(): void {
    const tween = new Tween(this.blink, { val: 1 }, 700, Easing.easeInOutCubic);
    tween.onUpdate(() => {
      this.render();
    });
    tween.onComplete(() => {
      tween.reset();
      this.renderer.addTween(tween);
    });
    this.renderer.addTween(tween);
  }
}
