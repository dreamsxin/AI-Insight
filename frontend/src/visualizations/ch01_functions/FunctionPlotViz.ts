/** FunctionPlotViz - interactive y = wx + b plot.

Users drag sliders for weight (w) and bias (b) to see the line change.
The function line is thick and glowing (a wider semi-transparent line
behind it). A slope triangle shows rise/run labeled "斜率". When sliders
change, the line animates from old to new position (300ms easeInOutCubic).
A moving dot traces along the line to show "for any x, there's a y".
Plain-language labels explain w and b; the equation sits small in a corner.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Line } from "@/canvas/shapes/Line";
import { Circle } from "@/canvas/shapes/Circle";
import { COLORS } from "@/utils/color";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";

export class FunctionPlotViz extends BaseVisualization {
  /** Animated display values (tweened toward the slider targets). */
  private anim = { w: 1, b: 0 };
  /** Moving dot progress along x (0..1), looping. */
  private dotProgress = { val: 0.5 };

  onMount(): void {
    const w0 = this.controls["w"] ?? 1;
    const b0 = this.controls["b"] ?? 0;
    this.anim.w = w0;
    this.anim.b = b0;
    super.resize();
    this.renderPlot();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "run") {
      this.playInputSweep();
      return;
    }
    if (key !== "w" && key !== "b") return;
    this.animateToTarget();
  }

  override resize(): void {
    super.resize();
    this.renderPlot();
  }

  /** Animate w and b from current display values to the slider targets. */
  private animateToTarget(): void {
    this.renderer.clearAnimations();
    this.setVisualizationStatus("idle");
    const targetW = this.controls["w"] ?? 1;
    const targetB = this.controls["b"] ?? 0;
    const tween = new Tween(this.anim, { w: targetW, b: targetB }, 300, Easing.easeInOutCubic);
    tween.onUpdate(() => {
      this.renderPlot();
    });
    this.renderer.addTween(tween);
  }

  /** Render the full plot using the current animW / animB. */
  private renderPlot(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2;
    const scaleX = Math.min(w, h) / 24;
    const scaleY = Math.min(w, h) / 24;

    // Background grid
    this.drawGrid(cx, cy, scaleX, scaleY);

    // Axes
    const xAxis = new Line(0, cy, w, cy);
    xAxis.strokeStyle = COLORS.textDim;
    xAxis.lineWidth = 1;
    this.scene.add(xAxis);

    const yAxis = new Line(cx, 0, cx, h);
    yAxis.strokeStyle = COLORS.textDim;
    yAxis.lineWidth = 1;
    this.scene.add(yAxis);

    // Axis labels
    this.scene.add(this.makeText("x", w - 20, cy - 16, 12, COLORS.textDim));
    this.scene.add(this.makeText("y", cx + 12, 14, 12, COLORS.textDim));

    // Tick marks
    const compact = w < 560;
    const tickStep = compact ? 4 : 2;
    const tickLimit = compact ? 8 : 10;
    for (let i = -tickLimit; i <= tickLimit; i += tickStep) {
      if (i === 0) continue;
      const tx = cx + i * scaleX;
      const tick = new Line(tx, cy - 4, tx, cy + 4);
      tick.strokeStyle = COLORS.textDim;
      tick.lineWidth = 1;
      this.scene.add(tick);
      this.scene.add(this.makeText(String(i), tx, cy + 14, 10, COLORS.textDim));

      const ty = cy - i * scaleY;
      const tickY = new Line(cx - 4, ty, cx + 4, ty);
      tickY.strokeStyle = COLORS.textDim;
      tickY.lineWidth = 1;
      this.scene.add(tickY);
      if (i !== 0) {
        this.scene.add(this.makeText(String(i), cx - 14, ty, 10, COLORS.textDim));
      }
    }

    const wVal = this.anim.w;
    const bVal = this.anim.b;

    // Sample line points
    const pts: { x: number; y: number }[] = [];
    for (let i = -12; i <= 12; i += 0.5) {
      pts.push({ x: cx + i * scaleX, y: cy - (wVal * i + bVal) * scaleY });
    }

    // Glow: wider semi-transparent line behind the main line
    for (let i = 0; i < pts.length - 1; i++) {
      const glow = new Line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      glow.strokeStyle = `rgba(0, 217, 255, 0.25)`;
      glow.lineWidth = 12;
      this.scene.add(glow);
    }
    // Main thick glowing line (4px)
    for (let i = 0; i < pts.length - 1; i++) {
      const seg = new Line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      seg.strokeStyle = COLORS.accent;
      seg.lineWidth = 4;
      this.scene.add(seg);
    }

    // Slope triangle: rise/run at a representative x segment
    this.drawSlopeTriangle(cx, cy, scaleX, scaleY, wVal);

    // Y-intercept point
    const interceptPt = new Circle(cx, cy - bVal * scaleY, 5);
    interceptPt.fillStyle = COLORS.accent3;
    this.scene.add(interceptPt);

    // Moving dot along the line (position recomputed each frame via tween)
    this.drawMovingDot(cx, cy, scaleX, scaleY, wVal, bVal);

    // Equation text - small, in corner
    const eqText = new Text(
      `y = ${wVal.toFixed(1)}x ${bVal >= 0 ? "+" : "-"} ${Math.abs(bVal).toFixed(1)}`,
      w - 16,
      h - 16,
      12,
    );
    eqText.fillStyle = COLORS.accent;
    eqText.fontFamily = "monospace";
    eqText.align = "right";
    this.scene.add(eqText);

    // Plain-language labels
    const wLabel = new Text(`w = 倾斜程度  (${wVal.toFixed(2)})`, 20, h - 50, 13);
    wLabel.align = "left";
    wLabel.fillStyle = COLORS.accent2;
    this.scene.add(wLabel);

    const bLabel = new Text(`b = 起始位置  (${bVal.toFixed(2)})`, 20, h - 28, 13);
    bLabel.align = "left";
    bLabel.fillStyle = COLORS.accent3;
    this.scene.add(bLabel);

    this.renderer.renderOnce();
  }

  /** Right triangle showing rise/run between two x positions, labeled 斜率. */
  private drawSlopeTriangle(
    cx: number,
    cy: number,
    scaleX: number,
    scaleY: number,
    wVal: number,
  ): void {
    const compact = this.width < 560;
    const x0 = compact ? 1 : 2;
    const x1 = compact ? 3 : 5;
    const p0x = cx + x0 * scaleX;
    const p1x = cx + x1 * scaleX;
    const p0y = cy - (wVal * x0) * scaleY;
    const p1y = cy - (wVal * x1) * scaleY;

    // Horizontal leg (run)
    const runLine = new Line(p0x, p0y, p1x, p0y);
    runLine.strokeStyle = `rgba(167, 139, 250, 0.7)`;
    runLine.lineWidth = 2;
    this.scene.add(runLine);

    // Vertical leg (rise)
    const riseLine = new Line(p1x, p0y, p1x, p1y);
    riseLine.strokeStyle = `rgba(249, 115, 22, 0.7)`;
    riseLine.lineWidth = 2;
    this.scene.add(riseLine);

    // Labels
    const runLbl = new Text("横向", (p0x + p1x) / 2, p0y + 12, 10);
    runLbl.fillStyle = COLORS.accent2;
    this.scene.add(runLbl);

    const riseLbl = new Text("升降", p1x + 12, (p0y + p1y) / 2, 10);
    riseLbl.fillStyle = COLORS.accent3;
    this.scene.add(riseLbl);

    const slopeLbl = new Text("斜率", p1x + 10, p1y - 12, 11);
    slopeLbl.fillStyle = COLORS.highlight;
    slopeLbl.fontWeight = "bold";
    this.scene.add(slopeLbl);
  }

  /** Moving dot tracing along the line, looping. */
  private drawMovingDot(
    cx: number,
    cy: number,
    scaleX: number,
    scaleY: number,
    wVal: number,
    bVal: number,
  ): void {
    const range = 10;
    const xVal = -range + this.dotProgress.val * range * 2;
    const yVal = wVal * xVal + bVal;
    const px = cx + xVal * scaleX;
    const py = cy - yVal * scaleY;

    // Glow halo
    const halo = new Circle(px, py, 9);
    halo.fillStyle = `rgba(0, 217, 255, 0.25)`;
    this.scene.add(halo);

    // Core dot
    const dot = new Circle(px, py, 5);
    dot.fillStyle = "#ffffff";
    dot.strokeStyle = COLORS.accent;
    dot.lineWidth = 2;
    this.scene.add(dot);

    // Dropped vertical guide to x-axis
    const guide = new Line(px, py, px, cy);
    guide.strokeStyle = `rgba(255,255,255,0.25)`;
    guide.lineWidth = 1;
    this.scene.add(guide);
  }

  /** Move one input point across the line, then hold the completed frame. */
  private playInputSweep(): void {
    this.renderer.clearAnimations();
    this.dotProgress.val = 0;
    this.setVisualizationStatus("running");
    this.renderPlot();
    const tween = new Tween(this.dotProgress, { val: 1 }, 4000, Easing.linear);
    tween.onUpdate(() => {
      this.renderPlot();
    });
    tween.onComplete(() => {
      this.dotProgress.val = 1;
      this.renderPlot();
      this.setVisualizationStatus("completed");
    });
    this.renderer.addTween(tween);
  }

  private drawGrid(cx: number, cy: number, scaleX: number, scaleY: number): void {
    for (let i = -10; i <= 10; i++) {
      const x = cx + i * scaleX;
      const vLine = new Line(x, 0, x, this.height);
      vLine.strokeStyle = "rgba(255,255,255,0.03)";
      vLine.lineWidth = 1;
      this.scene.add(vLine);

      const y = cy - i * scaleY;
      const hLine = new Line(0, y, this.width, y);
      hLine.strokeStyle = "rgba(255,255,255,0.03)";
      hLine.lineWidth = 1;
      this.scene.add(hLine);
    }
  }

  private makeText(text: string, x: number, y: number, size: number, color: string): Text {
    const t = new Text(text, x, y, size);
    t.fillStyle = color;
    return t;
  }
}
