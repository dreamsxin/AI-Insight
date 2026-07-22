/** EncoderDetailViz - one Encoder layer in detail.

Walks through a single encoder layer's data flow with a "step" slider (0-4):
  Step 0: input flowing into Multi-Head Attention
  Step 1: attention output + residual connection + LayerNorm
  Step 2: FFN processing
  Step 3: FFN output + residual + LayerNorm
  Step 4: complete encoder layer

Boxes (Rect) connected by arrows (Arrow) show the data flow; residual
connections are drawn as curved arrows bypassing each sublayer.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Rect } from "@/canvas/shapes/Rect";
import { Arrow } from "@/canvas/shapes/Arrow";
import { Curve } from "@/canvas/shapes/Curve";
import { COLORS } from "@/utils/color";

interface Box {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

const STEP_DESCRIPTIONS = [
  "Step 0: 输入流入多头注意力 (Multi-Head Attention)",
  "Step 1: 注意力输出 + 残差连接 (Add) + LayerNorm",
  "Step 2: 前馈网络处理 (FFN = Linear → ReLU → Linear)",
  "Step 3: FFN 输出 + 残差连接 (Add) + LayerNorm",
  "Step 4: 完整编码器层 (两个子层 + 残差)",
];

export class EncoderDetailViz extends BaseVisualization {
  onMount(): void {
    this.render();
  }

  onControlChange(_key: string, _value: number): void {
    this.render();
  }

  private get step(): number {
    return Math.max(0, Math.min(4, Math.floor(this.controls["step"] ?? 0)));
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const step = this.step;

    // --- Title ---
    const title = new Text("编码器层细节: 子层 + 残差连接", w / 2, 28, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    // --- Step description ---
    const desc = new Text(STEP_DESCRIPTIONS[step], w / 2, 54, 13);
    desc.fillStyle = COLORS.accent2;
    desc.fontFamily = "monospace";
    this.scene.add(desc);

    // Layout: vertical flow centered horizontally.
    const cx = w / 2;
    const bw = Math.min(240, w * 0.5);
    const bh = 40;
    const gap = 56; // vertical gap between box centers

    // Boxes (top to bottom): Input, Attn, Add+Norm1, FFN, Add+Norm2, Output
    const startY = 96;
    const positions = [
      startY,                       // Input
      startY + gap,                 // Multi-Head Attention
      startY + gap * 2,             // Add & Norm (after attention)
      startY + gap * 3,             // Feed Forward
      startY + gap * 4,             // Add & Norm (after FFN)
      startY + gap * 5,             // Output
    ];

    const boxes: Box[] = [
      box("Input (x)", cx, positions[0], bw, bh, COLORS.accent),
      box("Multi-Head Attention", cx, positions[1], bw, bh, COLORS.accent),
      box("Add & Norm", cx, positions[2], bw * 0.7, bh, COLORS.accent2),
      box("Feed Forward (FFN)", cx, positions[3], bw, bh, COLORS.accent3),
      box("Add & Norm", cx, positions[4], bw * 0.7, bh, COLORS.accent2),
      box("Output", cx, positions[5], bw, bh, COLORS.accent),
    ];

    // Determine which boxes are active at the current step.
    const active = activeBoxes(step);

    // Draw boxes
    for (let i = 0; i < boxes.length; i++) {
      this.drawBox(boxes[i], active[i]);
    }

    // Draw downward arrows between consecutive boxes (only up to active region)
    for (let i = 0; i < boxes.length - 1; i++) {
      if (active[i] && active[i + 1]) {
        const a = boxes[i];
        const b = boxes[i + 1];
        const arr = new Arrow(a.x, a.y + a.h / 2, b.x, b.y - b.h / 2, 8);
        arr.strokeStyle = COLORS.accent2;
        arr.lineWidth = 2;
        this.scene.add(arr);
      }
    }

    // --- Residual connection 1: bypass Multi-Head Attention -> Add&Norm1 ---
    if (step >= 1) {
      this.drawResidual(boxes[0], boxes[2], "残差", COLORS.highlight);
    }
    // --- Residual connection 2: bypass FFN -> Add&Norm2 ---
    if (step >= 3) {
      this.drawResidual(boxes[2], boxes[4], "残差", COLORS.highlight);
    }

    // --- Annotations on the right ---
    const annotX = cx + bw / 2 + 60;
    if (step === 1 || step === 4) {
      this.annotate(annotX, positions[2], "x + Attn(x)", COLORS.accent);
    }
    if (step === 3 || step === 4) {
      this.annotate(annotX, positions[4], "y + FFN(y)", COLORS.accent3);
    }

    // --- Formula at the bottom ---
    const formula = new Text(
      "子层输出 = LayerNorm(x + Sublayer(x))",
      w / 2,
      h - 28,
      15,
    );
    formula.fillStyle = COLORS.accent;
    formula.fontFamily = "monospace";
    formula.fontWeight = "bold";
    this.scene.add(formula);

    const hint = new Text(
      step === 4 ? "完整编码器层: 两个子层 + 残差" : "拖动 step 滑块查看逐步数据流",
      w / 2,
      h - 10,
      11,
    );
    hint.fillStyle = COLORS.textDim;
    this.scene.add(hint);

    this.renderer.renderOnce();
  }

  private drawBox(b: Box, active: boolean): void {
    const r = new Rect(b.x, b.y, b.w, b.h, 6);
    r.fillStyle = active ? `${b.color}22` : "rgba(255,255,255,0.03)";
    r.strokeStyle = active ? b.color : COLORS.edge;
    r.lineWidth = active ? 2.5 : 1.2;
    r.opacity = active ? 1 : 0.4;
    this.scene.add(r);

    const lbl = new Text(b.label, b.x, b.y, 12);
    lbl.fillStyle = active ? COLORS.text : COLORS.textDim;
    lbl.fontWeight = active ? "bold" : "normal";
    lbl.opacity = active ? 1 : 0.5;
    this.scene.add(lbl);
  }

  /** Draw a curved residual arrow from box `from` to box `to` on the left side. */
  private drawResidual(from: Box, to: Box, label: string, color: string): void {
    const leftX = from.x - from.w / 2 - 36;
    const startY = from.y;
    const endY = to.y;
    const curve = new Curve(leftX, startY, leftX, endY);
    curve.setControlPoints(leftX - 40, startY, leftX - 40, endY);
    curve.strokeStyle = color;
    curve.lineWidth = 2;
    curve.opacity = 0.9;
    this.scene.add(curve);

    // small arrows: from box to the curve start, and curve end into box
    const inArr = new Arrow(from.x - from.w / 2, from.y, leftX, startY, 6);
    inArr.strokeStyle = color;
    inArr.lineWidth = 1.5;
    inArr.opacity = 0.9;
    this.scene.add(inArr);
    const outArr = new Arrow(leftX, endY, to.x - to.w / 2, to.y, 6);
    outArr.strokeStyle = color;
    outArr.lineWidth = 1.5;
    outArr.opacity = 0.9;
    this.scene.add(outArr);

    const lblTxt = new Text(label, leftX - 46, (startY + endY) / 2, 10);
    lblTxt.fillStyle = color;
    lblTxt.fontWeight = "bold";
    this.scene.add(lblTxt);
  }

  private annotate(x: number, y: number, text: string, color: string): void {
    const t = new Text(text, x, y, 11);
    t.fillStyle = color;
    t.fontFamily = "monospace";
    t.align = "left";
    this.scene.add(t);
  }
}

function box(label: string, x: number, y: number, w: number, h: number, color: string): Box {
  return { label, x, y, w, h, color };
}

/** Which of the 6 boxes are active at each step. */
function activeBoxes(step: number): boolean[] {
  // Indices: 0 Input, 1 Attn, 2 Add&Norm1, 3 FFN, 4 Add&Norm2, 5 Output
  switch (step) {
    case 0:
      return [true, true, false, false, false, false];
    case 1:
      return [true, true, true, false, false, false];
    case 2:
      return [true, true, true, true, false, false];
    case 3:
      return [true, true, true, true, true, false];
    case 4:
    default:
      return [true, true, true, true, true, true];
  }
}
