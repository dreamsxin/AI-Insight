/** EmbeddingPipelineViz - shows the Token -> ID -> Embedding pipeline.

A "step" slider (0-3) reveals successive stages:
  0: tokens only (colored boxes with text)
  1: Token -> ID mapping (arrows from tokens to integer IDs in boxes)
  2: ID -> Embedding (arrows from IDs to vector rows shown as small colored grids)
  3: complete pipeline with all three stages connected.

Embedding vectors are deterministic (seeded) pseudo-random values rendered as a
row of small colored squares via the Grid shape. The formula
"embedding = E[token_id]" is shown at the bottom.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Rect } from "@/canvas/shapes/Rect";
import { Arrow } from "@/canvas/shapes/Arrow";
import { Line } from "@/canvas/shapes/Line";
import { Grid } from "@/canvas/shapes/Grid";
import { COLORS } from "@/utils/color";
import { mulberry32 } from "@/utils/math";

interface PipelineToken {
  text: string;
  id: number;
  color: string;
}

const TOKEN_PALETTE: string[] = [
  COLORS.accent,
  COLORS.accent2,
  COLORS.accent3,
  COLORS.positive,
];

/** Fixed sample tokens and their (hardcoded) token IDs. */
const PIPELINE_TOKENS: PipelineToken[] = [
  { text: "今天", id: 42, color: TOKEN_PALETTE[0] },
  { text: "天气", id: 173, color: TOKEN_PALETTE[1] },
  { text: "真", id: 7, color: TOKEN_PALETTE[2] },
  { text: "好", id: 219, color: TOKEN_PALETTE[3] },
];

/** Dimensionality of each embedding vector. */
const EMBED_DIM = 8;

export class EmbeddingPipelineViz extends BaseVisualization {
  onMount(): void {
    this.render();
  }

  onControlChange(_key: string, _value: number): void {
    this.render();
  }

  private get step(): number {
    const v = Math.floor(this.controls["step"] ?? 0);
    return Math.max(0, Math.min(3, v));
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const step = this.step;

    // --- Title ---
    const title = new Text("嵌入流程: Token → ID → 向量", w / 2, 30, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    const stepLabels = [
      "步骤 1: 分词得到 Token",
      "步骤 2: Token 映射为 ID",
      "步骤 3: ID 查表得到嵌入向量",
      "完整流程",
    ];
    const subtitle = new Text(stepLabels[step], w / 2, 56, 13);
    subtitle.fillStyle = COLORS.highlight;
    this.scene.add(subtitle);

    // --- Layout: three columns ---
    // col1 = tokens, col2 = IDs, col3 = embeddings.
    const tokens = PIPELINE_TOKENS;
    const n = tokens.length;
    const rowH = 64;
    const startY = 120;
    const col1X = w * 0.18;
    const col2X = w * 0.46;
    const col3X = w * 0.78;

    const col1Label = new Text("Token", col1X, startY - 32, 13);
    col1Label.fillStyle = COLORS.textDim;
    this.scene.add(col1Label);
    const col2Label = new Text("ID", col2X, startY - 32, 13);
    col2Label.fillStyle = COLORS.textDim;
    this.scene.add(col2Label);
    const col3Label = new Text("Embedding", col3X, startY - 32, 13);
    col3Label.fillStyle = COLORS.textDim;
    this.scene.add(col3Label);

    // Draw vertical stage dividers so each column is visually grouped.
    if (step >= 1) {
      const div1 = makeVLine((col1X + col2X) / 2, startY - 50, startY + n * rowH);
      this.scene.add(div1);
    }
    if (step >= 2) {
      const div2 = makeVLine((col2X + col3X) / 2, startY - 50, startY + n * rowH);
      this.scene.add(div2);
    }

    tokens.forEach((tok, i) => {
      const y = startY + i * rowH;

      // --- Stage 1: token box (always shown) ---
      const tokBox = new Rect(col1X, y, 90, 40, 8);
      tokBox.fillStyle = tok.color;
      tokBox.opacity = 0.18;
      tokBox.strokeStyle = tok.color;
      tokBox.lineWidth = 2;
      this.scene.add(tokBox);
      const tokText = new Text(tok.text, col1X, y, 16);
      tokText.fillStyle = tok.color;
      tokText.fontWeight = "bold";
      this.scene.add(tokText);

      // --- Stage 2: ID box (shown when step >= 1) ---
      if (step >= 1) {
        const idArrow = new Arrow(col1X + 48, y, col2X - 52, y, 7);
        idArrow.strokeStyle = COLORS.accent2;
        idArrow.lineWidth = 1.5;
        this.scene.add(idArrow);

        const idBox = new Rect(col2X, y, 80, 40, 8);
        idBox.fillStyle = "rgba(167, 139, 250, 0.12)";
        idBox.strokeStyle = COLORS.accent2;
        idBox.lineWidth = 2;
        this.scene.add(idBox);
        const idText = new Text(String(tok.id), col2X, y, 18);
        idText.fillStyle = COLORS.accent2;
        idText.fontFamily = "monospace";
        idText.fontWeight = "bold";
        this.scene.add(idText);
      }

      // --- Stage 3: embedding grid (shown when step >= 2) ---
      if (step >= 2) {
        const embArrow = new Arrow(col2X + 44, y, col3X - embWidth() / 2 - 6, y, 7);
        embArrow.strokeStyle = COLORS.positive;
        embArrow.lineWidth = 1.5;
        this.scene.add(embArrow);

        const vec = this.embeddingFor(tok.id);
        // Grid expects a 2D array; render as a single row.
        const grid = new Grid(col3X, y, [vec], 14);
        grid.cellGap = 1;
        grid.valueMin = -1;
        grid.valueMax = 1;
        this.scene.add(grid);

        // Magnitude label beside the vector.
        const magText = new Text(
          `‖·‖=${this.magnitude(vec).toFixed(2)}`,
          col3X,
          y + 28,
          10,
        );
        magText.fillStyle = COLORS.textDim;
        magText.fontFamily = "monospace";
        this.scene.add(magText);
      }
    });

    // --- Formula / note at the bottom ---
    const noteY = Math.max(h - 50, startY + n * rowH + 30);
    const formula = new Text("embedding = E[token_id]", w / 2, noteY, 14);
    formula.fillStyle = COLORS.highlight;
    formula.fontFamily = "monospace";
    formula.fontWeight = "bold";
    this.scene.add(formula);

    this.renderer.renderOnce();
  }

  /** Deterministic embedding vector for a token id (seeded pseudo-random in [-1, 1]). */
  private embeddingFor(id: number): number[] {
    const rng = mulberry32(id * 2654435761);
    const vec: number[] = [];
    for (let i = 0; i < EMBED_DIM; i++) {
      vec.push(rng() * 2 - 1);
    }
    return vec;
  }

  private magnitude(vec: number[]): number {
    let s = 0;
    for (const v of vec) s += v * v;
    return Math.sqrt(s);
  }
}

/** Width of an embedding grid row (helper kept outside the class). */
function embWidth(): number {
  return EMBED_DIM * 14;
}

/** Build a faint vertical divider line. */
function makeVLine(x: number, y1: number, y2: number): Line {
  const ln = new Line(x, y1, x, y2);
  ln.strokeStyle = "rgba(255,255,255,0.06)";
  ln.lineWidth = 1;
  return ln;
}
