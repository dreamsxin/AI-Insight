/** ActivationViz - compare activation function curves side by side.

A glowing dot slides along the x-axis (looping). At its x position a
vertical line rises to the curve and a horizontal line crosses to the
y-axis, where the output is shown as a big number whose color reflects the
value (via colormap). Each function gets an emoji + nickname. When
switching functions the curve morphs from old points to new points.
Formula text sits small in a corner.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Line } from "@/canvas/shapes/Line";
import { Circle } from "@/canvas/shapes/Circle";
import { COLORS } from "@/utils/color";
import { colormap, colormapHue } from "@/utils/colormap";
import { relu, sigmoid, tanh, step, type ActivationFn } from "@/utils/math";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";

interface ActInfo {
  name: string;
  fn: ActivationFn;
  color: string;
  formula: string;
  emoji: string;
  nickname: string;
}

const ACTIVATION_LIST: ActInfo[] = [
  { name: "Step", fn: step, color: "#ef4444", formula: "f(x) = x > 0 ? 1 : 0", emoji: "🚦", nickname: "红绿灯" },
  { name: "Sigmoid", fn: sigmoid, color: "#00d9ff", formula: "f(x) = 1 / (1 + e⁻ˣ)", emoji: "📊", nickname: "概率计" },
  { name: "ReLU", fn: relu, color: "#a78bfa", formula: "f(x) = max(0, x)", emoji: "✂️", nickname: "砍负数" },
  { name: "Tanh", fn: tanh, color: "#f97316", formula: "f(x) = tanh(x)", emoji: "🔄", nickname: "弹簧" },
];

const RANGE = 6; // x from -6 to 6
const STEPS = 120;

export class ActivationViz extends BaseVisualization {
  /** Moving dot x-progress (0..1) across the plot range, looping. */
  private dotProgress = { val: 0 };
  /** Morph progress (0..1) between previous and current curve. */
  private morph = { val: 1 };
  private prevIdx = 2;
  /** Cached main plot geometry so the dot tween can redraw cheaply. */
  private mainPlot = { x: 0, y: 0, w: 0, h: 0 };

  onMount(): void {
    this.renderAll();
    this.startMovingDot();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "activation") {
      // this.prevIdx still holds the previously-rendered index (the "from"
      // curve). controls["activation"] already reflects the new selection.
      this.morph.val = 0;
      this.renderAll();
      const tween = new Tween(this.morph, { val: 1 }, 400, Easing.easeInOutCubic);
      tween.onUpdate(() => {
        this.renderAll();
      });
      tween.onComplete(() => {
        this.prevIdx = Math.floor(this.controls["activation"] ?? 2);
      });
      this.renderer.addTween(tween);
    }
  }

  /** Get current + previous curve sampled points in screen space (for main plot). */
  private sampleCurves(
    cx: number, cy: number, scaleX: number, scaleY: number,
  ): { cur: { x: number; y: number }[]; prev: { x: number; y: number }[] } {
    const curIdx = Math.floor(this.controls["activation"] ?? 2);
    const curFn = (ACTIVATION_LIST[curIdx] ?? ACTIVATION_LIST[2]).fn;
    const prevFn = (ACTIVATION_LIST[this.prevIdx] ?? ACTIVATION_LIST[2]).fn;
    const cur: { x: number; y: number }[] = [];
    const prev: { x: number; y: number }[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const xVal = -RANGE + (2 * RANGE * i) / STEPS;
      cur.push({ x: cx + xVal * scaleX, y: cy - curFn(xVal) * scaleY });
      prev.push({ x: cx + xVal * scaleX, y: cy - prevFn(xVal) * scaleY });
    }
    return { cur, prev };
  }

  private renderAll(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;

    const selectedIdx = Math.floor(this.controls["activation"] ?? 2);
    const selected = ACTIVATION_LIST[selectedIdx] ?? ACTIVATION_LIST[2];

    // Layout: large plot for selected + small thumbnails for others
    const mainPlotH = h * 0.62;
    const thumbH = (h - mainPlotH) / 2;
    const thumbW = (w - 40) / 2;

    // Main plot
    this.mainPlot = { x: 20, y: 10, w: w - 40, h: mainPlotH - 10 };
    this.drawMainPlot(
      this.mainPlot.x, this.mainPlot.y, this.mainPlot.w, this.mainPlot.h,
      selected, selectedIdx,
    );

    // Thumbnails
    for (let i = 0; i < ACTIVATION_LIST.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const tx = 20 + col * thumbW;
      const ty = mainPlotH + 10 + row * thumbH;
      const act = ACTIVATION_LIST[i];
      const isActive = i === selectedIdx;
      this.drawThumbnail(tx, ty, thumbW - 10, thumbH - 10, act, isActive);
    }

    // NOTE: prevIdx is intentionally NOT updated here; it tracks the "from"
    // curve during a morph and is advanced only on morph completion.

    this.renderer.renderOnce();
  }

  private drawMainPlot(
    x: number, y: number, w: number, h: number,
    selected: ActInfo, selectedIdx: number,
  ): void {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const scaleX = (w - 40) / (RANGE * 2);
    const scaleY = (h - 30) / 4;
    this.mainPlot = { x, y, w, h };

    // Title with emoji + nickname
    const title = new Text(
      `${selected.emoji} ${selected.name} · ${selected.nickname}`,
      cx, y + 22, 17,
    );
    title.fillStyle = COLORS.text;
    title.fontWeight = "bold";
    this.scene.add(title);

    // Axes
    const xAxis = new Line(x + 10, cy, x + w - 10, cy);
    xAxis.strokeStyle = COLORS.textDim;
    xAxis.lineWidth = 1;
    this.scene.add(xAxis);

    const yAxis = new Line(cx, y + 40, cx, y + h - 15);
    yAxis.strokeStyle = COLORS.textDim;
    yAxis.lineWidth = 1;
    this.scene.add(yAxis);

    // Sample current + previous curves, blend by morph value
    const { cur, prev } = this.sampleCurves(cx, cy, scaleX, scaleY);
    const t = this.morph.val;
    const pts = cur.map((p, i) => ({
      x: p.x,
      y: prev[i].y + (p.y - prev[i].y) * t,
    }));

    // Glow behind curve
    for (let i = 0; i < pts.length - 1; i++) {
      const glow = new Line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      glow.strokeStyle = this.translucent(selected.color, 0.2);
      glow.lineWidth = 10;
      this.scene.add(glow);
    }
    // Curve
    for (let i = 0; i < pts.length - 1; i++) {
      const seg = new Line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      seg.strokeStyle = selected.color;
      seg.lineWidth = 3;
      this.scene.add(seg);
    }

    // Moving input dot
    const xVal = -RANGE + this.dotProgress.val * RANGE * 2;
    const outVal = selected.fn(xVal);
    const dotX = cx + xVal * scaleX;
    const dotY = cy - outVal * scaleY;

    // Vertical line from x-axis up to the curve
    const vLine = new Line(dotX, cy, dotX, dotY);
    vLine.strokeStyle = `rgba(255,255,255,0.35)`;
    vLine.lineWidth = 1.5;
    this.scene.add(vLine);

    // Horizontal line from curve to y-axis
    const hLine = new Line(dotX, dotY, cx, dotY);
    hLine.strokeStyle = `rgba(255,255,255,0.35)`;
    hLine.lineWidth = 1.5;
    this.scene.add(hLine);

    // Output big number on the y-axis, colored by value via colormap
    const normOut = Math.max(0, Math.min(1, (outVal + 1) / 2)); // map [-1,1]->[0,1]
    const outColor = colormap(normOut);
    const outHue = colormapHue(normOut);

    // Glow halo behind number
    const halo = new Circle(cx, dotY, 16);
    halo.fillStyle = this.translucent(outColor, 0.25);
    this.scene.add(halo);

    const bigNum = new Text(outVal.toFixed(2), cx + 32, dotY, 22);
    bigNum.fillStyle = outColor;
    bigNum.fontWeight = "bold";
    bigNum.fontFamily = "monospace";
    this.scene.add(bigNum);

    // Input dot on x-axis (glowing)
    const dotHalo = new Circle(dotX, cy, 10);
    dotHalo.fillStyle = this.translucent(selected.color, 0.3);
    this.scene.add(dotHalo);
    const dot = new Circle(dotX, cy, 6);
    dot.fillStyle = "#ffffff";
    dot.strokeStyle = `hsl(${outHue}, 90%, 65%)`;
    dot.lineWidth = 2;
    this.scene.add(dot);

    // Formula - small, in corner
    const formula = new Text(selected.formula, x + w - 12, y + h - 10, 11);
    formula.fillStyle = COLORS.textDim;
    formula.fontFamily = "monospace";
    formula.align = "right";
    this.scene.add(formula);

    // Axis labels
    const xLbl = new Text("x", x + w - 12, cy - 10, 11);
    xLbl.fillStyle = COLORS.textDim;
    this.scene.add(xLbl);
    const yLbl = new Text("f(x)", cx + 14, y + 36, 11);
    yLbl.fillStyle = COLORS.textDim;
    this.scene.add(yLbl);
  }

  private drawThumbnail(
    x: number, y: number, w: number, h: number,
    act: ActInfo, isActive: boolean,
  ): void {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const scaleX = (w - 20) / (RANGE * 2);
    const scaleY = (h - 20) / 4;

    // Border
    const top = new Line(x, y, x + w, y);
    top.strokeStyle = isActive ? COLORS.accent : "rgba(255,255,255,0.1)";
    top.lineWidth = isActive ? 2 : 1;
    this.scene.add(top);

    // Axes
    const xAxis = new Line(x + 6, cy, x + w - 6, cy);
    xAxis.strokeStyle = COLORS.textDim;
    xAxis.lineWidth = 1;
    this.scene.add(xAxis);
    const yAxis = new Line(cx, y + 6, cx, y + h - 6);
    yAxis.strokeStyle = COLORS.textDim;
    yAxis.lineWidth = 1;
    this.scene.add(yAxis);

    // Curve
    for (let i = 0; i < STEPS; i++) {
      const x0 = -RANGE + (2 * RANGE * i) / STEPS;
      const x1 = -RANGE + (2 * RANGE * (i + 1)) / STEPS;
      const p0x = cx + x0 * scaleX;
      const p0y = cy - act.fn(x0) * scaleY;
      const p1x = cx + x1 * scaleX;
      const p1y = cy - act.fn(x1) * scaleY;
      const seg = new Line(p0x, p0y, p1x, p1y);
      seg.strokeStyle = act.color;
      seg.lineWidth = 2;
      this.scene.add(seg);
    }

    // Label with emoji
    const lbl = new Text(`${act.emoji} ${act.name}`, cx, y + 12, 11);
    lbl.fillStyle = isActive ? COLORS.text : act.color;
    lbl.fontWeight = isActive ? "bold" : "normal";
    this.scene.add(lbl);
  }

  /** Convert a hex/hsl color to a translucent rgba string with the given alpha. */
  private translucent(color: string, alpha: number): string {
    if (color.startsWith("#")) {
      const m = color.replace("#", "");
      const r = parseInt(m.substring(0, 2), 16);
      const g = parseInt(m.substring(2, 4), 16);
      const b = parseInt(m.substring(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    // hsl / hsla passthrough: inject alpha
    if (color.startsWith("hsla")) {
      return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
    }
    if (color.startsWith("hsl")) {
      return color.replace("hsl", "hsla").replace(")", `, ${alpha})`);
    }
    return color;
  }

  /** Looping tween that moves the dot along x and redraws. */
  private startMovingDot(): void {
    const tween = new Tween(this.dotProgress, { val: 1 }, 5000, Easing.linear);
    tween.onUpdate(() => {
      this.renderAll();
    });
    tween.onComplete(() => {
      tween.reset();
      this.renderer.addTween(tween);
    });
    this.renderer.addTween(tween);
  }
}
