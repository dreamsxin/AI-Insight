/** Activation functions explained as clickable output gates before showing math. */

import { DrilldownVisualization } from "@/visualizations/DrilldownVisualization";
import { MouseHandler } from "@/canvas/interaction/MouseHandler";
import { Text } from "@/canvas/shapes/Text";
import { Line } from "@/canvas/shapes/Line";
import { Circle } from "@/canvas/shapes/Circle";
import { Rect } from "@/canvas/shapes/Rect";
import { COLORS } from "@/utils/color";
import { colormap, colormapHue } from "@/utils/colormap";
import { lerp, relu, sigmoid, tanh, step, type ActivationFn } from "@/utils/math";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";

interface ActInfo {
  name: string;
  fn: ActivationFn;
  color: string;
  formula: string;
  emoji: string;
  nickname: string;
  metaphor: string;
  rule: string;
  why: string;
}

interface HitRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const ACTIVATION_LIST: ActInfo[] = [
  {
    name: "Step",
    fn: step,
    color: "#ef6a6a",
    formula: "f(x) = x > 0 ? 1 : 0",
    emoji: "🚦",
    nickname: "红绿灯",
    metaphor: "小于等于 0 就关门，大于 0 才开门。",
    rule: "只回答两个结果：关门 0，或者开门 1。",
    why: "适合做明确的是非判断，但变化不够平滑。",
  },
  {
    name: "Sigmoid",
    fn: sigmoid,
    color: "#42c7d4",
    formula: "f(x) = 1 / (1 + e⁻ˣ)",
    emoji: "💡",
    nickname: "亮度旋钮",
    metaphor: "把再大的数字也调进 0% 到 100% 之间。",
    rule: "负数偏暗，正数偏亮，结果永远在 0 到 1。",
    why: "很适合表达概率，例如像不像小猫。",
  },
  {
    name: "ReLU",
    fn: relu,
    color: "#9d8ee7",
    formula: "f(x) = max(0, x)",
    emoji: "🚪",
    nickname: "单向闸门",
    metaphor: "负数被拦下变成 0，正数原样通过。",
    rule: "左边全部压平，右边保持原来的大小。",
    why: "它会把空间折出拐角，让网络不再只能画直线。",
  },
  {
    name: "Tanh",
    fn: tanh,
    color: "#e17b5f",
    formula: "f(x) = tanh(x)",
    emoji: "🕹️",
    nickname: "方向摇杆",
    metaphor: "再大的输入也限制在向左 -1 到向右 +1。",
    rule: "负数向左，正数向右，中间位置表示接近 0。",
    why: "同时保留正负方向，又避免数值无限变大。",
  },
];

const RANGE = 6;
const STEPS = 120;

export class ActivationViz extends DrilldownVisualization {
  private dotProgress = { val: (1 + RANGE) / (RANGE * 2) };
  private morph = { val: 1 };
  private viewTransition = { val: 1 };
  private prevIdx = 2;
  private viewDepth = 0;
  private hitRegions: HitRegion[] = [];

  onMount(): void {
    this.initializeDrilldown("激活函数总览");
    if (!this.mouseHandler) this.mouseHandler = new MouseHandler(this.canvas);
    this.mouseHandler.onClick((x, y) => this.handleClick(x, y));
    this.mouseHandler.onMouseMove((x, y) => this.handleHover(x, y));
    this.dotProgress.val = this.progressForInput(this.controls["x"] ?? 1);
    super.resize();
    this.renderAll();
  }

  override onUnmount(): void {
    this.canvas.style.cursor = "default";
    super.onUnmount();
  }

  onControlChange(key: string, value: number): void {
    if (key === "run") {
      if (this.viewDepth === 0) this.setViewDepth(1, false);
      this.playInputSweep();
      return;
    }
    if (key === "x") {
      this.moveInputTo(value);
      return;
    }
    if (key === "mode") {
      this.setViewDepth(Math.max(1, Math.min(3, Math.round(value) + 1)));
      return;
    }
    if (key === "activation") {
      this.changeActivation(Math.floor(value), this.viewDepth === 0 ? 1 : this.viewDepth);
    }
  }

  override resize(): void {
    super.resize();
    this.renderAll();
  }

  protected override onDrilldownRequest(depth: number): void {
    this.setViewDepth(Math.max(0, Math.min(this.viewDepth, depth)));
  }

  private get selectedIndex(): number {
    return Math.max(0, Math.min(ACTIVATION_LIST.length - 1, Math.floor(this.controls["activation"] ?? 2)));
  }

  private get selected(): ActInfo {
    return ACTIVATION_LIST[this.selectedIndex];
  }

  private setViewDepth(depth: number, animate = true): void {
    this.viewDepth = Math.max(0, Math.min(3, depth));
    this.renderer.clearAnimations();
    this.setVisualizationStatus("idle");
    this.viewTransition.val = animate ? 0 : 1;

    if (this.viewDepth === 0) {
      this.setControlValue("mode", 0);
      this.setDrilldownPath(["激活函数总览"]);
    } else {
      const path = ["激活函数总览", `${this.selected.nickname} ${this.selected.name}`];
      if (this.viewDepth >= 2) path.push("内部原理");
      if (this.viewDepth >= 3) path.push("数学曲线");
      this.setControlValue("mode", this.viewDepth - 1);
      this.setDrilldownPath(path);
    }

    this.renderAll();
    if (!animate) return;
    const tween = new Tween(this.viewTransition, { val: 1 }, 420, Easing.easeOutCubic);
    tween.onUpdate(() => this.renderAll());
    this.renderer.addTween(tween);
  }

  private changeActivation(index: number, targetDepth: number): void {
    const next = Math.max(0, Math.min(ACTIVATION_LIST.length - 1, index));
    this.renderer.clearAnimations();
    this.setVisualizationStatus("idle");
    this.morph.val = 0;
    this.setControlValue("activation", next);
    this.viewDepth = Math.max(1, targetDepth);
    this.setViewDepth(this.viewDepth, false);
    const tween = new Tween(this.morph, { val: 1 }, 420, Easing.easeInOutCubic);
    tween.onUpdate(() => this.renderAll());
    tween.onComplete(() => {
      this.prevIdx = next;
    });
    this.renderer.addTween(tween);
  }

  private renderAll(): void {
    this.scene.clear();
    this.hitRegions = [];
    switch (this.viewDepth) {
      case 0:
        this.renderOverview();
        break;
      case 1:
        this.renderStory();
        break;
      case 2:
        this.renderPrinciple();
        break;
      case 3:
      default:
        this.renderMath();
        break;
    }
    this.renderer.renderOnce();
  }

  private renderOverview(): void {
    const w = this.width;
    const h = this.height;
    const compact = w < 560;
    this.drawTitle("先选一个输出闸门", "同一份输入，经过不同闸门会得到不同结果");

    const margin = compact ? 12 : 22;
    const gap = compact ? 9 : 14;
    const top = compact ? 88 : 94;
    const bottom = h - 42;
    const cardW = (w - margin * 2 - gap) / 2;
    const cardH = (bottom - top - gap) / 2;

    ACTIVATION_LIST.forEach((act, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + cardW / 2 + col * (cardW + gap);
      const y = top + cardH / 2 + row * (cardH + gap);
      const selected = index === this.selectedIndex;
      const card = new Rect(x, y, cardW, cardH, 8);
      card.fillStyle = this.translucent(act.color, selected ? 0.2 : 0.1);
      card.strokeStyle = selected ? act.color : COLORS.edge;
      card.lineWidth = selected ? 2 : 1;
      this.scene.add(card);

      const icon = new Text(act.emoji, x, y - cardH * 0.28, compact ? 22 : 27);
      this.scene.add(icon);
      const name = new Text(`${act.nickname} · ${act.name}`, x, y - 4, compact ? 12 : 14);
      name.fillStyle = COLORS.text;
      name.fontWeight = "bold";
      this.scene.add(name);
      const metaphor = new Text(this.shortText(act.metaphor, compact ? 12 : 17), x, y + cardH * 0.2, compact ? 10 : 11);
      metaphor.fillStyle = COLORS.textDim;
      this.scene.add(metaphor);
      const example = new Text(this.exampleText(index), x, y + cardH * 0.38, compact ? 10 : 11);
      example.fillStyle = act.color;
      example.fontFamily = "monospace";
      this.scene.add(example);
      this.hitRegions.push({ id: `activation:${index}`, x, y, width: cardW, height: cardH });
    });

    const hint = new Text("点击一个闸门，放大看看数字怎样通过", w / 2, h - 20, compact ? 11 : 12);
    hint.fillStyle = COLORS.highlight;
    this.scene.add(hint);
  }

  private renderStory(): void {
    const w = this.width;
    const h = this.height;
    const compact = w < 560;
    const act = this.selected;
    const input = this.inputForProgress(this.dotProgress.val);
    const output = act.fn(input);
    const t = this.viewTransition.val;
    this.drawTitle(`${act.emoji} ${act.nickname}`, act.metaphor);

    const trackY = compact ? h * 0.46 : h * 0.48;
    const leftX = compact ? 50 : w * 0.14;
    const rightX = compact ? w - 50 : w * 0.86;
    const gateX = w / 2;
    const gateW = compact ? 88 : 136;
    const gateH = compact ? 94 : 116;

    const track = new Line(leftX, trackY, rightX, trackY);
    track.strokeStyle = COLORS.edge;
    track.lineWidth = compact ? 4 : 5;
    track.opacity = t;
    this.scene.add(track);

    this.drawValueStation(leftX, trackY - (compact ? 76 : 92), "进入闸门", input, COLORS.accent, compact);
    this.drawValueStation(rightX, trackY - (compact ? 76 : 92), "出来以后", output, act.color, compact);

    const gate = new Rect(gateX, trackY, gateW, gateH, 8);
    gate.fillStyle = this.translucent(act.color, 0.2);
    gate.strokeStyle = act.color;
    gate.lineWidth = 2.5;
    gate.scale = 0.72 + 0.28 * t;
    gate.opacity = t;
    this.scene.add(gate);
    const gateIcon = new Text(act.emoji, gateX, trackY - 22, compact ? 24 : 30);
    gateIcon.opacity = t;
    this.scene.add(gateIcon);
    const gateLabel = new Text(act.nickname, gateX, trackY + 12, compact ? 12 : 15);
    gateLabel.fillStyle = COLORS.text;
    gateLabel.fontWeight = "bold";
    gateLabel.opacity = t;
    this.scene.add(gateLabel);
    const gateRule = new Text(this.gateDecision(input), gateX, trackY + (compact ? 34 : 40), compact ? 10 : 11);
    gateRule.fillStyle = act.color;
    gateRule.opacity = t;
    this.scene.add(gateRule);

    const travel = this.getTravelProgress();
    const ballX = travel < 0.5
      ? lerp(leftX + 24, gateX - gateW / 2 - 14, travel * 2)
      : lerp(gateX + gateW / 2 + 14, rightX - 24, (travel - 0.5) * 2);
    let ballY = trackY;
    if (travel >= 0.5 && act.name === "ReLU" && input < 0) {
      ballY += Math.sin(Math.min(1, (travel - 0.5) * 2) * Math.PI / 2) * (compact ? 44 : 58);
    } else if (travel >= 0.5 && act.name === "Tanh") {
      ballY -= output * (compact ? 24 : 34);
    }
    const ballRadius = act.name === "Sigmoid" ? 7 + output * 8 : compact ? 11 : 14;
    const halo = new Circle(ballX, ballY, ballRadius + 7);
    halo.fillStyle = this.translucent(act.color, 0.2);
    halo.opacity = t;
    this.scene.add(halo);
    const ball = new Circle(ballX, ballY, ballRadius);
    ball.fillStyle = act.name === "Step" && output === 0 ? COLORS.negative : act.color;
    ball.opacity = act.name === "Sigmoid" ? 0.35 + output * 0.65 : t;
    this.scene.add(ball);
    const ballValue = new Text(travel < 0.5 ? this.formatValue(input) : this.formatValue(output), ballX, ballY, compact ? 9 : 11);
    ballValue.fillStyle = COLORS.text;
    ballValue.fontWeight = "bold";
    this.scene.add(ballValue);

    const result = new Text(this.storyResult(input, output), w / 2, compact ? h - 112 : h - 124, compact ? 12 : 14);
    result.fillStyle = COLORS.text;
    result.fontWeight = "bold";
    this.scene.add(result);
    this.drawDrillButton("拆开闸门，看它真正做了什么", h - 52, "principle");
    this.hitRegions.push({ id: "principle", x: gateX, y: trackY, width: gateW, height: gateH });
  }

  private renderPrinciple(): void {
    const w = this.width;
    const h = this.height;
    const compact = w < 560;
    const act = this.selected;
    this.drawTitle(`${act.nickname}的内部规则`, act.rule);

    const values = [-4, -2, 0, 2, 4];
    const gap = compact ? 5 : 10;
    const margin = compact ? 10 : 28;
    const tileW = (w - margin * 2 - gap * (values.length - 1)) / values.length;
    const centerY = compact ? 128 : 138;
    values.forEach((value, index) => {
      const x = margin + tileW / 2 + index * (tileW + gap);
      const tile = new Rect(x, centerY, tileW, compact ? 64 : 76, 7);
      tile.fillStyle = this.translucent(act.color, 0.11);
      tile.strokeStyle = COLORS.edge;
      this.scene.add(tile);
      const before = new Text(this.formatValue(value), x, centerY - 18, compact ? 11 : 13);
      before.fillStyle = COLORS.textDim;
      before.fontFamily = "monospace";
      this.scene.add(before);
      const arrow = new Text("↓", x, centerY, compact ? 13 : 16);
      arrow.fillStyle = act.color;
      this.scene.add(arrow);
      const after = new Text(this.formatValue(act.fn(value)), x, centerY + 20, compact ? 12 : 15);
      after.fillStyle = act.color;
      after.fontWeight = "bold";
      after.fontFamily = "monospace";
      this.scene.add(after);
    });

    if (act.name === "ReLU") {
      this.drawReluFold(compact ? 16 : 42, compact ? 196 : 218, w - (compact ? 32 : 84), compact ? 128 : 170);
    } else {
      this.drawRuleMeter(compact ? 18 : 60, compact ? 210 : 240, w - (compact ? 36 : 120), compact ? 110 : 140);
    }

    const why = new Text(this.shortText(act.why, compact ? 20 : 34), w / 2, h - 92, compact ? 11 : 13);
    why.fillStyle = COLORS.highlight;
    why.fontWeight = "bold";
    this.scene.add(why);
    this.drawDrillButton("继续放大：查看曲线和公式", h - 48, "math");
  }

  private renderMath(): void {
    const w = this.width;
    const h = this.height;
    const compact = w < 560;
    const act = this.selected;
    this.drawTitle(`${act.name} 的数学曲线`, "拖动输入，观察一个数字如何在曲线上找到输出");

    const x = compact ? 16 : 34;
    const y = compact ? 86 : 92;
    const plotW = w - x * 2;
    const plotH = h - y - (compact ? 32 : 38);
    this.drawMathPlot(x, y, plotW, plotH, act, this.selectedIndex);
  }

  private drawTitle(titleText: string, subtitleText: string): void {
    const compact = this.width < 560;
    const title = new Text(titleText, this.width / 2, compact ? 48 : 52, compact ? 15 : 18);
    title.fillStyle = COLORS.text;
    title.fontWeight = "bold";
    this.scene.add(title);
    const subtitle = new Text(this.shortText(subtitleText, compact ? 25 : 48), this.width / 2, compact ? 70 : 76, compact ? 10 : 12);
    subtitle.fillStyle = COLORS.textDim;
    this.scene.add(subtitle);
  }

  private drawValueStation(x: number, y: number, label: string, value: number, color: string, compact: boolean): void {
    const box = new Rect(x, y, compact ? 78 : 108, compact ? 54 : 64, 7);
    box.fillStyle = this.translucent(color, 0.1);
    box.strokeStyle = color;
    box.lineWidth = 1.2;
    this.scene.add(box);
    const caption = new Text(label, x, y - (compact ? 14 : 17), compact ? 10 : 11);
    caption.fillStyle = COLORS.textDim;
    this.scene.add(caption);
    const number = new Text(this.formatValue(value), x, y + (compact ? 9 : 11), compact ? 17 : 22);
    number.fillStyle = color;
    number.fontWeight = "bold";
    number.fontFamily = "monospace";
    this.scene.add(number);
  }

  private drawDrillButton(label: string, y: number, id: string): void {
    const compact = this.width < 560;
    const width = Math.min(compact ? this.width - 34 : 340, this.width - 28);
    const button = new Rect(this.width / 2, y, width, compact ? 34 : 38, 7);
    button.fillStyle = this.translucent(COLORS.accent, 0.14);
    button.strokeStyle = COLORS.accent;
    button.lineWidth = 1.4;
    this.scene.add(button);
    const text = new Text(label, this.width / 2, y, compact ? 11 : 12);
    text.fillStyle = COLORS.accent;
    text.fontWeight = "bold";
    this.scene.add(text);
    this.hitRegions.push({ id, x: this.width / 2, y, width, height: compact ? 34 : 38 });
  }

  private drawReluFold(x: number, y: number, width: number, height: number): void {
    const act = this.selected;
    const left = x + 10;
    const right = x + width - 10;
    const cx = (left + right) / 2;
    const baseY = y + height * 0.68;
    const scaleX = (right - left) / 9;
    const scaleY = height / 8;
    const fold = this.viewTransition.val;

    const label = new Text("一张直纸被 ReLU 从中间折出拐角", this.width / 2, y + 8, this.width < 560 ? 11 : 13);
    label.fillStyle = act.color;
    label.fontWeight = "bold";
    this.scene.add(label);

    for (let depth = -2; depth <= 2; depth++) {
      let previous: { x: number; y: number } | null = null;
      for (let i = 0; i <= 24; i++) {
        const input = -4 + (8 * i) / 24;
        const linearOutput = input;
        const foldedOutput = relu(input);
        const output = lerp(linearOutput, foldedOutput, fold);
        const px = cx + input * scaleX + depth * 6;
        const py = baseY - output * scaleY - depth * 5;
        if (previous) {
          const line = new Line(previous.x, previous.y, px, py);
          line.strokeStyle = depth === 0 ? act.color : this.translucent(act.color, 0.34);
          line.lineWidth = depth === 0 ? 2.5 : 1;
          this.scene.add(line);
        }
        previous = { x: px, y: py };
      }
    }
    for (let input = -4; input <= 4; input += 1) {
      const output = lerp(input, relu(input), fold);
      const frontX = cx + input * scaleX - 12;
      const frontY = baseY - output * scaleY + 10;
      const backX = cx + input * scaleX + 12;
      const backY = baseY - output * scaleY - 10;
      const line = new Line(frontX, frontY, backX, backY);
      line.strokeStyle = this.translucent(act.color, 0.28);
      line.lineWidth = 1;
      this.scene.add(line);
    }

    const hinge = new Circle(cx, baseY, 5);
    hinge.fillStyle = COLORS.highlight;
    this.scene.add(hinge);
    const zero = new Text("0：折叠位置", cx + 12, baseY + 16, 10);
    zero.fillStyle = COLORS.highlight;
    zero.align = "left";
    this.scene.add(zero);
  }

  private drawRuleMeter(x: number, y: number, width: number, height: number): void {
    const act = this.selected;
    const cx = x + width / 2;
    const cy = y + height / 2;
    if (act.name === "Step") {
      const left = new Rect(cx - width * 0.23, cy, width * 0.4, height * 0.52, 7);
      left.fillStyle = this.translucent(COLORS.negative, 0.16);
      left.strokeStyle = COLORS.negative;
      this.scene.add(left);
      const right = new Rect(cx + width * 0.23, cy, width * 0.4, height * 0.52, 7);
      right.fillStyle = this.translucent(COLORS.positive, 0.16);
      right.strokeStyle = COLORS.positive;
      this.scene.add(right);
      this.addCenteredText("x ≤ 0：关门 0", left.x, cy, 12, COLORS.negative);
      this.addCenteredText("x > 0：开门 1", right.x, cy, 12, COLORS.positive);
      return;
    }
    if (act.name === "Sigmoid") {
      const count = 8;
      for (let i = 0; i < count; i++) {
        const value = i / (count - 1);
        const px = x + width * (0.08 + 0.84 * value);
        const bulb = new Circle(px, cy, 8 + value * 7);
        bulb.fillStyle = act.color;
        bulb.opacity = 0.18 + value * 0.82;
        this.scene.add(bulb);
      }
      this.addCenteredText("很暗 0", x + 28, cy + 34, 10, COLORS.textDim);
      this.addCenteredText("很亮 1", x + width - 28, cy + 34, 10, COLORS.textDim);
      return;
    }

    const axis = new Line(x + 20, cy, x + width - 20, cy);
    axis.strokeStyle = act.color;
    axis.lineWidth = 4;
    this.scene.add(axis);
    const current = act.fn(this.controls["x"] ?? 1);
    const markerX = lerp(x + 20, x + width - 20, (current + 1) / 2);
    const marker = new Circle(markerX, cy, 13);
    marker.fillStyle = act.color;
    this.scene.add(marker);
    this.addCenteredText("向左 -1", x + 32, cy + 30, 10, COLORS.textDim);
    this.addCenteredText("中间 0", cx, cy + 30, 10, COLORS.textDim);
    this.addCenteredText("向右 +1", x + width - 32, cy + 30, 10, COLORS.textDim);
  }

  private drawMathPlot(x: number, y: number, w: number, h: number, selected: ActInfo, selectedIdx: number): void {
    const cx = x + w / 2;
    const isRelu = selectedIdx === 2;
    const cy = isRelu ? y + h - 38 : y + h / 2 + 4;
    const scaleX = (w - 46) / (RANGE * 2);
    const scaleY = isRelu ? (h - 84) / 6.4 : (h - 84) / 2.6;

    const xAxis = new Line(x + 8, cy, x + w - 8, cy);
    xAxis.strokeStyle = COLORS.textDim;
    xAxis.lineWidth = 1;
    this.scene.add(xAxis);
    const yAxis = new Line(cx, y + 8, cx, y + h - 16);
    yAxis.strokeStyle = COLORS.textDim;
    yAxis.lineWidth = 1;
    this.scene.add(yAxis);

    const { cur, prev } = this.sampleCurves(cx, cy, scaleX, scaleY);
    const points = cur.map((point, index) => ({
      x: point.x,
      y: lerp(prev[index].y, point.y, this.morph.val),
    }));
    for (let i = 0; i < points.length - 1; i++) {
      const glow = new Line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
      glow.strokeStyle = this.translucent(selected.color, 0.18);
      glow.lineWidth = 9;
      this.scene.add(glow);
      const segment = new Line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
      segment.strokeStyle = selected.color;
      segment.lineWidth = 3;
      this.scene.add(segment);
    }

    const input = this.inputForProgress(this.dotProgress.val);
    const output = selected.fn(input);
    const dotX = cx + input * scaleX;
    const dotY = cy - output * scaleY;
    const vertical = new Line(dotX, cy, dotX, dotY);
    vertical.strokeStyle = "rgba(255,255,255,0.35)";
    vertical.lineWidth = 1.5;
    this.scene.add(vertical);
    const horizontal = new Line(dotX, dotY, cx, dotY);
    horizontal.strokeStyle = "rgba(255,255,255,0.35)";
    horizontal.lineWidth = 1.5;
    this.scene.add(horizontal);

    const normOut = Math.max(0, Math.min(1, (output + 1) / 2));
    const outputColor = colormap(normOut);
    const halo = new Circle(dotX, dotY, 12);
    halo.fillStyle = this.translucent(outputColor, 0.28);
    this.scene.add(halo);
    const dot = new Circle(dotX, dotY, 6);
    dot.fillStyle = "#ffffff";
    dot.strokeStyle = `hsl(${colormapHue(normOut)}, 90%, 65%)`;
    dot.lineWidth = 2;
    this.scene.add(dot);

    const values = new Text(`输入 ${this.formatValue(input)}  →  输出 ${this.formatValue(output)}`, x + 10, y + 18, this.width < 560 ? 11 : 13);
    values.fillStyle = selected.color;
    values.align = "left";
    values.fontWeight = "bold";
    this.scene.add(values);
    const formula = new Text(selected.formula, x + w - 10, y + h - 10, this.width < 560 ? 10 : 12);
    formula.fillStyle = COLORS.textDim;
    formula.fontFamily = "monospace";
    formula.align = "right";
    this.scene.add(formula);
  }

  private sampleCurves(cx: number, cy: number, scaleX: number, scaleY: number): { cur: { x: number; y: number }[]; prev: { x: number; y: number }[] } {
    const currentFn = this.selected.fn;
    const previousFn = (ACTIVATION_LIST[this.prevIdx] ?? ACTIVATION_LIST[2]).fn;
    const cur: { x: number; y: number }[] = [];
    const prev: { x: number; y: number }[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const input = -RANGE + (2 * RANGE * i) / STEPS;
      cur.push({ x: cx + input * scaleX, y: cy - currentFn(input) * scaleY });
      prev.push({ x: cx + input * scaleX, y: cy - previousFn(input) * scaleY });
    }
    return { cur, prev };
  }

  private handleClick(x: number, y: number): void {
    const hit = this.hitRegions.find((region) => this.contains(region, x, y));
    if (!hit) return;
    if (hit.id.startsWith("activation:")) {
      this.changeActivation(Number(hit.id.split(":")[1]), 1);
    } else if (hit.id === "principle") {
      this.setViewDepth(2);
    } else if (hit.id === "math") {
      this.setViewDepth(3);
    }
  }

  private handleHover(x: number, y: number): void {
    this.canvas.style.cursor = this.hitRegions.some((region) => this.contains(region, x, y)) ? "pointer" : "default";
  }

  private contains(region: HitRegion, x: number, y: number): boolean {
    return Math.abs(x - region.x) <= region.width / 2 && Math.abs(y - region.y) <= region.height / 2;
  }

  private playInputSweep(): void {
    this.renderer.clearAnimations();
    this.morph.val = 1;
    this.prevIdx = this.selectedIndex;
    this.dotProgress.val = 0;
    this.setControlValue("x", -RANGE);
    this.setVisualizationStatus("running");
    this.renderAll();
    const tween = new Tween(this.dotProgress, { val: 1 }, 4200, Easing.linear);
    tween.onUpdate(() => {
      this.setControlValue("x", Number(this.inputForProgress(this.dotProgress.val).toFixed(1)));
      this.renderAll();
    });
    tween.onComplete(() => {
      this.dotProgress.val = 1;
      this.setControlValue("x", RANGE);
      this.renderAll();
      this.setVisualizationStatus("completed");
    });
    this.renderer.addTween(tween);
  }

  private moveInputTo(value: number): void {
    this.renderer.clearAnimations();
    this.setVisualizationStatus("idle");
    const tween = new Tween(this.dotProgress, { val: this.progressForInput(value) }, 280, Easing.easeOutCubic);
    tween.onUpdate(() => this.renderAll());
    this.renderer.addTween(tween);
  }

  private getTravelProgress(): number {
    if (this.getStatus() !== "running") return 0.42;
    const cycles = this.dotProgress.val * 5;
    return cycles - Math.floor(cycles);
  }

  private gateDecision(input: number): string {
    switch (this.selected.name) {
      case "Step":
        return input > 0 ? "开门" : "关门";
      case "Sigmoid":
        return `${Math.round(this.selected.fn(input) * 100)}% 亮度`;
      case "ReLU":
        return input < 0 ? "拦下并归零" : "原样放行";
      case "Tanh":
      default:
        return this.selected.fn(input) < 0 ? "向左" : "向右";
    }
  }

  private storyResult(input: number, output: number): string {
    return `输入 ${this.formatValue(input)}，经过${this.selected.nickname}后变成 ${this.formatValue(output)}`;
  }

  private exampleText(index: number): string {
    const examples = ["-2→0   2→1", "-2→0.12   2→0.88", "-2→0   2→2", "-2→-0.96   2→0.96"];
    return examples[index];
  }

  private addCenteredText(text: string, x: number, y: number, size: number, color: string): void {
    const label = new Text(text, x, y, size);
    label.fillStyle = color;
    label.fontWeight = "bold";
    this.scene.add(label);
  }

  private formatValue(value: number): string {
    if (Math.abs(value) < 0.005) return "0";
    if (Math.abs(value - Math.round(value)) < 0.005) return String(Math.round(value));
    return value.toFixed(2);
  }

  private shortText(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return `${text.slice(0, Math.max(1, maxChars - 1))}…`;
  }

  private translucent(color: string, alpha: number): string {
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      const red = parseInt(hex.slice(0, 2), 16);
      const green = parseInt(hex.slice(2, 4), 16);
      const blue = parseInt(hex.slice(4, 6), 16);
      return `rgba(${red},${green},${blue},${alpha})`;
    }
    return color;
  }

  private progressForInput(value: number): number {
    return Math.max(0, Math.min(1, (value + RANGE) / (RANGE * 2)));
  }

  private inputForProgress(progress: number): number {
    return -RANGE + Math.max(0, Math.min(1, progress)) * RANGE * 2;
  }
}
