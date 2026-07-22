/** MultiHeadViz - multiple attention heads running in parallel.

A "heads" slider (1-8) controls how many heads are drawn. Each head renders a
mini attention-weight matrix with its own color, and a deterministic
pseudo-random attention pattern (seedable RNG so the patterns are stable and
vary across heads). The bottom shows the concatenation step that combines all
heads into one vector before a final linear projection.

No API call is needed here - this is a structural/conceptual visualization.
Formula: headᵢ = Attention(QWᵢQ, KWᵢK, VWᵢV)
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Grid } from "@/canvas/shapes/Grid";
import { Rect } from "@/canvas/shapes/Rect";
import { Arrow } from "@/canvas/shapes/Arrow";
import { COLORS } from "@/utils/color";
import { softmax, mulberry32 } from "@/utils/math";

const SEQ_LEN = 5;
const HEAD_COLORS = [
  "#00d9ff",
  "#a78bfa",
  "#f97316",
  "#22c55e",
  "#ef4444",
  "#fbbf24",
  "#ec4899",
  "#38bdf8",
];

export class MultiHeadViz extends BaseVisualization {
  onMount(): void {
    this.render();
  }

  onControlChange(_key: string, _value: number): void {
    this.render();
  }

  private get heads(): number {
    return Math.max(1, Math.min(8, Math.floor(this.controls["heads"] ?? 4)));
  }

  /** Deterministic attention pattern for head h: stable, head-specific. */
  private headWeights(h: number): number[][] {
    const rng = mulberry32(1000 + h * 17);
    const raw: number[][] = [];
    for (let i = 0; i < SEQ_LEN; i++) {
      const row: number[] = [];
      for (let j = 0; j < SEQ_LEN; j++) {
        // Combine a positional bias (attend to nearby tokens) with head-specific noise.
        const positional = 1 / (1 + Math.abs(i - j) * 0.9);
        const noise = rng();
        // Some heads prefer attending to the start, some to the end.
        const bias = h % 2 === 0 ? 1 / (1 + j * 0.5) : 1 / (1 + (SEQ_LEN - 1 - j) * 0.5);
        row.push(positional * 0.5 + noise * 0.3 + bias * 0.4);
      }
      raw.push(softmax(row));
    }
    return raw;
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const numHeads = this.heads;

    // --- Title ---
    const title = new Text("多头注意力: 多个头并行关注不同子空间", w / 2, 30, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    // --- Formula ---
    const formula = new Text("headᵢ = Attention(QWᵢQ, KWᵢK, VWᵢV)", w / 2, 56, 14);
    formula.fillStyle = COLORS.accent2;
    formula.fontFamily = "monospace";
    this.scene.add(formula);

    // Layout heads in a grid of mini matrices.
    const cols = Math.min(numHeads, 4);
    const rows = Math.ceil(numHeads / cols);
    const miniCell = Math.min(16, (h - 240) / (SEQ_LEN * rows));
    const miniW = SEQ_LEN * miniCell;
    const miniH = SEQ_LEN * miniCell;

    const totalW = cols * (miniW + 20) - 20;
    const startX = (w - totalW) / 2 + miniW / 2;
    const startY = 96;

    for (let hd = 0; hd < numHeads; hd++) {
      const r = Math.floor(hd / cols);
      const c = hd % cols;
      const cx = startX + c * (miniW + 20);
      const cy = startY + r * (miniH + 44) + miniH / 2;
      const color = HEAD_COLORS[hd % HEAD_COLORS.length];

      const weights = this.headWeights(hd);
      const grid = new Grid(cx, cy, weights, miniCell);
      grid.cellGap = 1;
      grid.valueMin = 0;
      grid.valueMax = 1;
      this.scene.add(grid);

      // border around the head to color-code it
      const border = new Rect(cx, cy, miniW + 6, miniH + 6, 4);
      border.fillStyle = "transparent";
      border.strokeStyle = color;
      border.lineWidth = 1.5;
      this.scene.add(border);

      const lbl = new Text(`head ${hd + 1}`, cx, cy + miniH / 2 + 14, 11);
      lbl.fillStyle = color;
      lbl.fontWeight = "bold";
      this.scene.add(lbl);
    }

    // --- Concatenation step at the bottom ---
    const concatY = h - 80;
    // arrow from heads area down to concat
    const downArrow = new Arrow(w / 2, startY + rows * (miniH + 44) - 12, w / 2, concatY - 26, 8);
    downArrow.strokeStyle = COLORS.accent2;
    downArrow.lineWidth = 2;
    this.scene.add(downArrow);

    const concatLabel = new Text("Concat → Linear", w / 2, concatY - 14, 14);
    concatLabel.fillStyle = COLORS.accent3;
    concatLabel.fontWeight = "bold";
    this.scene.add(concatLabel);

    // Concatenated output bar: segments colored per head
    const barW = Math.min(420, w - 80);
    const segW = barW / numHeads;
    const barLeft = w / 2 - barW / 2;
    for (let hd = 0; hd < numHeads; hd++) {
      const color = HEAD_COLORS[hd % HEAD_COLORS.length];
      const seg = new Rect(barLeft + hd * segW + segW / 2, concatY + 8, segW - 4, 18, 3);
      seg.fillStyle = color;
      seg.opacity = 0.85;
      seg.strokeStyle = "transparent";
      this.scene.add(seg);
    }

    const outLabel = new Text("MultiHead(Q,K,V) = Concat(head₁,...,headₕ) Wᴼ", w / 2, concatY + 34, 12);
    outLabel.fillStyle = COLORS.textDim;
    outLabel.fontFamily = "monospace";
    this.scene.add(outLabel);

    // --- Bottom hint ---
    const hint = new Text(`当前 ${numHeads} 个头并行  •  每个头关注不同的模式`, w / 2, h - 16, 12);
    hint.fillStyle = COLORS.textDim;
    this.scene.add(hint);

    this.renderer.renderOnce();
  }
}
