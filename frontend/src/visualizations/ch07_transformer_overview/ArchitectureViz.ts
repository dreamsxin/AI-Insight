/** ArchitectureViz - full Transformer (Encoder + Decoder) block diagram.

Draws the encoder stack on the left and the decoder stack on the right as
Rect blocks connected by Arrows. A "focus" slider (0-8) highlights a specific
component with a bright border while dimming the rest, and shows a description
of the focused component at the bottom.

Components:
  0: Input Embedding
  1: Positional Encoding
  2: Encoder Multi-Head Attention
  3: Encoder FFN
  4: Output Embedding
  5: Decoder Masked Attention
  6: Decoder Cross Attention
  7: Decoder FFN
  8: Linear + Softmax output
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Rect } from "@/canvas/shapes/Rect";
import { Arrow } from "@/canvas/shapes/Arrow";
import { Line } from "@/canvas/shapes/Line";
import { COLORS } from "@/utils/color";

interface Block {
  label: string;
  sub: string;
  x: number; // center x
  y: number; // center y
  w: number;
  h: number;
  color: string;
}

const DESCRIPTIONS: string[] = [
  "输入嵌入: 将 token 映射为稠密向量 (查找表)",
  "位置编码: 为嵌入注入顺序信息 (正弦/余弦)",
  "编码器多头注意力: 每个位置关注整个序列",
  "编码器前馈网络 (FFN): 两层线性 + 激活 (ReLU)",
  "输出嵌入: 目标序列的 token 嵌入 (训练时右移一位)",
  "解码器掩码注意力: 防止关注未来位置 (因果掩码)",
  "解码器交叉注意力: Query 来自解码器, K/V 来自编码器输出",
  "解码器前馈网络 (FFN): 对每个位置做非线性变换",
  "线性 + Softmax: 映射到词表概率分布",
];

const ACCENT = COLORS.accent;
const ACCENT2 = COLORS.accent2;
const ACCENT3 = COLORS.accent3;

// (accent colors are applied per-block via the `color` field)
void ACCENT;
void ACCENT2;
void ACCENT3;

export class ArchitectureViz extends BaseVisualization {
  onMount(): void {
    this.render();
  }

  onControlChange(_key: string, _value: number): void {
    this.render();
  }

  private get focus(): number {
    return Math.max(0, Math.min(8, Math.floor(this.controls["focus"] ?? 0)));
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const focus = this.focus;

    // --- Title ---
    const title = new Text("Transformer 整体架构 (Encoder + Decoder)", w / 2, 28, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    // Layout: encoder stack on the left, decoder stack on the right.
    const encX = w * 0.27;
    const decX = w * 0.73;
    const blockW = Math.min(200, w * 0.22);
    const blockH = 38;
    const gap = 12;

    // Encoder column (bottom to top): Embedding, PosEnc, Nx[Attn, FFN]
    const encBlocks: Block[] = [
      block("Input\nEmbedding", encX, 0, blockW, blockH, ACCENT),
      block("+ Positional\nEncoding", encX, 0, blockW, blockH, ACCENT2),
      block("Multi-Head\nAttention", encX, 0, blockW, blockH, ACCENT),
      block("Feed\nForward", encX, 0, blockW, blockH, ACCENT3),
    ];
    // Decoder column (bottom to top): Output Embedding, PosEnc, Nx[MaskedAttn, CrossAttn, FFN]
    const decBlocks: Block[] = [
      block("Output\nEmbedding", decX, 0, blockW, blockH, ACCENT),
      block("+ Positional\nEncoding", decX, 0, blockW, blockH, ACCENT2),
      block("Masked\nAttention", decX, 0, blockW, blockH, ACCENT),
      block("Cross\nAttention", decX, 0, blockW, blockH, ACCENT),
      block("Feed\nForward", decX, 0, blockW, blockH, ACCENT3),
    ];

    // Vertically position blocks: data flows bottom -> top.
    const top = 78;
    const bottom = h - 120;
    const encCount = encBlocks.length;
    const decCount = decBlocks.length;
    const encSpan = (encCount - 1) * (blockH + gap);
    const decSpan = (decCount - 1) * (blockH + gap);
    const encStartY = bottom - encSpan; // first (bottom) block center
    const decStartY = bottom - decSpan;
    for (let i = 0; i < encCount; i++) {
      encBlocks[i].y = encStartY + i * (blockH + gap);
    }
    for (let i = 0; i < decCount; i++) {
      decBlocks[i].y = decStartY + i * (blockH + gap);
    }

    // Map focus index -> block index in each column.
    // 0: Input Embedding (enc 0)
    // 1: Pos Enc (enc 1)
    // 2: Enc Attn (enc 2)
    // 3: Enc FFN (enc 3)
    // 4: Output Embedding (dec 0)
    // 5: Dec Masked Attn (dec 2)
    // 6: Dec Cross Attn (dec 3)
    // 7: Dec FFN (dec 4)
    // 8: Linear+Softmax (separate, top of decoder)
    const focusedEnc = [0, 1, 2, 3].includes(focus) ? focus : -1;
    const focusedDec = focus === 4 ? 0 : focus === 5 ? 2 : focus === 6 ? 3 : focus === 7 ? 4 : -1;

    // --- Draw column headers ---
    const encHeader = new Text("Encoder  ×N", encX, top - 36, 14);
    encHeader.fillStyle = COLORS.accent;
    encHeader.fontWeight = "bold";
    this.scene.add(encHeader);
    const decHeader = new Text("Decoder  ×N", decX, top - 36, 14);
    decHeader.fillStyle = COLORS.accent2;
    decHeader.fontWeight = "bold";
    this.scene.add(decHeader);

    // --- Draw encoder blocks ---
    this.drawColumn(encBlocks, focusedEnc, focus);
    // arrows between encoder blocks (bottom to top)
    for (let i = 0; i < encBlocks.length - 1; i++) {
      this.drawArrow(encBlocks[i], encBlocks[i + 1], focus >= 0 && focus <= 3 ? 1 : 0.4);
    }

    // --- Draw decoder blocks ---
    this.drawColumn(decBlocks, focusedDec, focus);
    for (let i = 0; i < decBlocks.length - 1; i++) {
      this.drawArrow(decBlocks[i], decBlocks[i + 1], focus >= 4 && focus <= 7 ? 1 : 0.4);
    }

    // --- Nx repeat bracket on each column ---
    this.drawNxBracket(encBlocks, "×N");
    this.drawNxBracket(decBlocks, "×N");

    // --- Cross-attention connection: encoder top -> decoder cross attention (dec index 3) ---
    const encTop = encBlocks[encBlocks.length - 1];
    const crossBlock = decBlocks[3];
    const crossArrow = new Arrow(
      encTop.x + encTop.w / 2,
      encTop.y,
      crossBlock.x - crossBlock.w / 2,
      crossBlock.y,
      8,
    );
    crossArrow.strokeStyle = focus === 6 ? COLORS.highlight : COLORS.accent2;
    crossArrow.lineWidth = focus === 6 ? 3 : 1.5;
    crossArrow.opacity = focus === 6 ? 1 : 0.5;
    this.scene.add(crossArrow);
    const kVlbl = new Text("K, V", (encTop.x + crossBlock.x) / 2, crossBlock.y - 14, 10);
    kVlbl.fillStyle = COLORS.accent2;
    kVlbl.fontFamily = "monospace";
    kVlbl.opacity = focus === 6 ? 1 : 0.5;
    this.scene.add(kVlbl);

    // --- Output block: Linear + Softmax (focus 8) above decoder ---
    const outY = decBlocks[decBlocks.length - 1].y + (blockH + gap);
    const outBlock = block("Linear\n+ Softmax", decX, outY, blockW, blockH, ACCENT3);
    this.drawBlock(outBlock, focus === 8);
    const outArrow = new Arrow(
      decBlocks[decBlocks.length - 1].x,
      decBlocks[decBlocks.length - 1].y - decBlocks[decBlocks.length - 1].h / 2,
      outBlock.x,
      outBlock.y + outBlock.h / 2,
      8,
    );
    outArrow.strokeStyle = focus === 8 ? COLORS.highlight : COLORS.accent3;
    outArrow.lineWidth = focus === 8 ? 3 : 1.5;
    outArrow.opacity = focus === 8 ? 1 : 0.5;
    this.scene.add(outArrow);

    // Output probabilities label
    const probLbl = new Text("输出概率", outBlock.x, outBlock.y - outBlock.h / 2 - 18, 12);
    probLbl.fillStyle = focus === 8 ? COLORS.highlight : COLORS.textDim;
    this.scene.add(probLbl);
    const probArrow = new Arrow(outBlock.x, outBlock.y - outBlock.h / 2, outBlock.x, outBlock.y - outBlock.h / 2 - 14, 7);
    probArrow.strokeStyle = focus === 8 ? COLORS.highlight : COLORS.accent3;
    probArrow.lineWidth = focus === 8 ? 2 : 1;
    probArrow.opacity = focus === 8 ? 1 : 0.5;
    this.scene.add(probArrow);

    // --- Input/Output side labels ---
    const inLbl = new Text("输入序列", encBlocks[0].x, encBlocks[0].y + encBlocks[0].h / 2 + 18, 11);
    inLbl.fillStyle = COLORS.textDim;
    this.scene.add(inLbl);
    const tgtInLbl = new Text("输出序列 (右移)", decBlocks[0].x, decBlocks[0].y + decBlocks[0].h / 2 + 18, 11);
    tgtInLbl.fillStyle = COLORS.textDim;
    this.scene.add(tgtInLbl);

    // --- Bottom description for the focused component ---
    const descBar = new Rect(w / 2, h - 56, Math.min(680, w - 40), 44, 8);
    descBar.fillStyle = "rgba(0, 217, 255, 0.06)";
    descBar.strokeStyle = focus >= 0 ? COLORS.highlight : COLORS.edge;
    descBar.lineWidth = 1.5;
    this.scene.add(descBar);

    const compName = new Text(`组件 #${focus}: ${componentName(focus)}`, w / 2, h - 68, 13);
    compName.fillStyle = COLORS.highlight;
    compName.fontWeight = "bold";
    this.scene.add(compName);

    const desc = new Text(DESCRIPTIONS[focus], w / 2, h - 46, 12);
    desc.fillStyle = COLORS.text;
    this.scene.add(desc);

    this.renderer.renderOnce();
  }

  private drawColumn(blocks: Block[], focusedIdx: number, _focus: number): void {
    for (let i = 0; i < blocks.length; i++) {
      const isFocused = i === focusedIdx;
      this.drawBlock(blocks[i], isFocused);
    }
  }

  private drawBlock(b: Block, focused: boolean): void {
    const r = new Rect(b.x, b.y, b.w, b.h, 6);
    r.fillStyle = focused ? "rgba(251, 191, 36, 0.18)" : "rgba(255,255,255,0.04)";
    r.strokeStyle = focused ? COLORS.highlight : b.color;
    r.lineWidth = focused ? 3 : 1.5;
    r.opacity = focused ? 1 : 0.7;
    this.scene.add(r);

    const lbl = new Text(b.label, b.x, b.y, 12);
    lbl.fillStyle = focused ? COLORS.highlight : COLORS.text;
    lbl.fontWeight = focused ? "bold" : "normal";
    lbl.opacity = focused ? 1 : 0.75;
    this.scene.add(lbl);
  }

  private drawArrow(a: Block, b: Block, opacity: number): void {
    const arr = new Arrow(
      a.x,
      a.y - a.h / 2,
      b.x,
      b.y + b.h / 2,
      7,
    );
    arr.strokeStyle = COLORS.accent2;
    arr.lineWidth = 1.5;
    arr.opacity = opacity;
    this.scene.add(arr);
  }

  /** Draw a "×N" repeat bracket to the right of a column of blocks. */
  private drawNxBracket(blocks: Block[], label: string): void {
    const first = blocks[0];
    const last = blocks[blocks.length - 1];
    const x = last.x + last.w / 2 + 16;
    const topY = last.y - last.h / 2;
    const botY = first.y + first.h / 2;
    const line = new Line(x, topY, x, botY);
    line.strokeStyle = COLORS.textDim;
    line.lineWidth = 1;
    line.opacity = 0.6;
    this.scene.add(line);
    // small ticks
    const t1 = new Line(x, topY, x - 5, topY);
    t1.strokeStyle = COLORS.textDim; t1.lineWidth = 1; t1.opacity = 0.6;
    this.scene.add(t1);
    const t2 = new Line(x, botY, x - 5, botY);
    t2.strokeStyle = COLORS.textDim; t2.lineWidth = 1; t2.opacity = 0.6;
    this.scene.add(t2);
    const lbl = new Text(label, x + 14, (topY + botY) / 2, 12);
    lbl.fillStyle = COLORS.accent;
    lbl.fontWeight = "bold";
    this.scene.add(lbl);
  }
}

function block(label: string, x: number, y: number, w: number, h: number, color: string): Block {
  return { label, sub: "", x, y, w, h, color };
}

function componentName(focus: number): string {
  const names = [
    "Input Embedding",
    "Positional Encoding",
    "Encoder Multi-Head Attention",
    "Encoder FFN",
    "Output Embedding",
    "Decoder Masked Attention",
    "Decoder Cross Attention",
    "Decoder FFN",
    "Linear + Softmax",
  ];
  return names[focus] ?? "";
}
