/** ScaledDotProductViz - step-by-step scaled dot-product attention.

Uses the transformer attention API to get Q, K, the raw scores, and the final
weights, then walks through the computation in four steps driven by a "step"
slider:
  Step 0: Q and K matrices side by side
  Step 1: Q·Kᵀ (raw dot-product scores)
  Step 2: scores / √dₖ (scaled scores) - shows the division
  Step 3: softmax(scores) -> attention weights (heatmap)

Each step shows its formula. Grid shapes render the matrices; Text shows the
formulas and values.
*/

import { StepSequenceVisualization } from "@/visualizations/StepSequenceVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Grid } from "@/canvas/shapes/Grid";
import { Rect } from "@/canvas/shapes/Rect";
import { Arrow } from "@/canvas/shapes/Arrow";
import { COLORS } from "@/utils/color";
import { transformerAttention } from "@/api/compute";
import type { AttentionResponse } from "@/types/api";

/** Small token sequence (3-dim vectors). */
const SEQUENCE: number[][] = [
  [1, 0, 0],
  [0, 1, 0],
  [0.5, 0.5, 0],
  [1, 1, 0],
  [0, 0, 1],
];

const TOKEN_LABELS = ["A", "B", "C", "D", "E"];

const STEP_FORMULAS = [
  "Step 0: 输入 Q, K (Q = K = 输入序列)",
  "Step 1: 分数 = Q · Kᵀ  (点积)",
  "Step 2: 缩放 = 分数 / √dₖ   (dₖ = 3, √3 ≈ 1.73)",
  "Step 3: 权重 = softmax(缩放分数)",
];

const STEP_SHORT_FORMULAS = [
  "输入矩阵 Q 与 K",
  "Q · Kᵀ 得到相关性分数",
  "分数 ÷ √dₖ，避免 Softmax 饱和",
  "Softmax 得到注意力权重",
];

export class ScaledDotProductViz extends StepSequenceVisualization {
  private apiResponse: AttentionResponse | null = null;
  private loading = false;
  private error: string | null = null;

  onMount(): void {
    this.initializeStepSequence();
    void this.fetchAndRender();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "run" && !this.apiResponse) {
      if (!this.loading) void this.fetchAndRender(true);
      return;
    }
    if (!this.handleStepSequenceControl(key)) this.renderStepSequenceFrame();
  }

  protected get maxStep(): number {
    return 3;
  }

  protected canPlayStepSequence(): boolean {
    return this.apiResponse !== null && !this.loading;
  }

  private get step(): number {
    return Math.max(0, Math.min(3, Math.floor(this.controls["step"] ?? 0)));
  }

  private async fetchAndRender(playAfterLoad = false): Promise<void> {
    this.loading = true;
    this.error = null;
    if (playAfterLoad) this.setVisualizationStatus("idle");
    this.renderLoading();
    try {
      const resp = await transformerAttention({ sequence: SEQUENCE, causal_mask: false });
      this.apiResponse = resp;
      this.loading = false;
      this.renderStepSequenceFrame();
      if (playAfterLoad) this.playStepSequence();
    } catch (err) {
      this.loading = false;
      this.error = err instanceof Error ? err.message : String(err);
      this.setVisualizationStatus("error");
      this.renderError();
    }
  }

  private renderLoading(): void {
    this.scene.clear();
    const t = new Text("正在计算...", this.width / 2, this.height / 2, 16);
    t.fillStyle = COLORS.textDim;
    this.scene.add(t);
    this.renderer.renderOnce();
  }

  private renderError(): void {
    this.scene.clear();
    const msg = this.error ?? "未知错误";
    const t = new Text(`API 错误: ${msg}`, this.width / 2, this.height / 2, 14);
    t.fillStyle = COLORS.negative;
    this.scene.add(t);
    this.renderer.renderOnce();
  }

  protected renderStepSequenceFrame(): void {
    this.scene.clear();
    if (!this.apiResponse) {
      this.renderLoading();
      return;
    }

    const w = this.width;
    const h = this.height;
    const data = this.apiResponse;
    const step = this.step;
    const n = data.q.length;

    // --- Title ---
    const title = new Text("缩放点积注意力: 逐步计算", w / 2, 30, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    // --- Step formula banner ---
    const banner = new Rect(w / 2, 60, Math.min(620, w - 40), 30, 6);
    banner.fillStyle = "rgba(0, 217, 255, 0.08)";
    banner.strokeStyle = COLORS.accent;
    banner.lineWidth = 1;
    this.scene.add(banner);
    const formula = new Text(w < 500 ? STEP_SHORT_FORMULAS[step] : STEP_FORMULAS[step], w / 2, 60, w < 500 ? 11 : 14);
    formula.fillStyle = COLORS.accent;
    formula.fontFamily = "monospace";
    formula.fontWeight = "bold";
    this.scene.add(formula);

    // Master formula at the very bottom
    const master = new Text("softmax(QKᵀ/√dₖ)·V", w / 2, h - 18, 15);
    master.fillStyle = COLORS.accent2;
    master.fontFamily = "monospace";
    master.fontWeight = "bold";
    this.scene.add(master);
    const transitionStart = this.scene.count;

    const cellSize = Math.min(34, (h - 200) / n, (w * 0.2) / n);

    switch (step) {
      case 0:
        this.renderStep0(data, cellSize, w, h);
        break;
      case 1:
        this.renderStep1(data, cellSize, w, h);
        break;
      case 2:
        this.renderStep2(data, cellSize, w, h);
        break;
      case 3:
        this.renderStep3(data, cellSize, w, h);
        break;
    }

    this.applyStepTransition(transitionStart);
    this.renderer.renderOnce();
  }

  // Step 0: Q and K side by side
  private renderStep0(data: AttentionResponse, cellSize: number, w: number, h: number): void {
    const qCx = w * 0.28;
    const kCx = w * 0.72;
    const cy = h * 0.5 + 10;

    this.drawMatrix(qCx, cy, data.q, cellSize, "Q (查询)", TOKEN_LABELS);
    this.drawMatrix(kCx, cy, data.k, cellSize, "K (键)", TOKEN_LABELS);

    const eq = new Text("=  (Q 和 K 暂时相同)", w / 2, cy, 13);
    eq.fillStyle = COLORS.textDim;
    eq.fontFamily = "monospace";
    this.scene.add(eq);
  }

  // Step 1: Q · Kᵀ = scores
  private renderStep1(data: AttentionResponse, cellSize: number, w: number, h: number): void {
    const qCx = w * 0.16;
    const scoreCx = w * 0.62;
    const cy = h * 0.5 + 10;

    // Q on the left (compact)
    this.drawMatrix(qCx, cy, data.q, cellSize, "Q", TOKEN_LABELS);

    // scores in the center-right
    const scores = data.scores;
    const grid = new Grid(scoreCx, cy, scores, cellSize);
    grid.showValues = true;
    grid.fontSize = Math.max(9, Math.floor(cellSize / 3.4));
    grid.cellGap = 1;
    this.scene.add(grid);

    const sLabel = new Text("Q · Kᵀ = 分数", scoreCx, cy + (scores.length * cellSize) / 2 + 20, 13);
    sLabel.fillStyle = COLORS.accent3;
    this.scene.add(sLabel);

    // Kᵀ label hint above scores
    const ktHint = new Text("Kᵀ (转置)", scoreCx, cy - (scores.length * cellSize) / 2 - 14, 11);
    ktHint.fillStyle = COLORS.textDim;
    this.scene.add(ktHint);

    // arrow Q -> scores
    const arrow = new Arrow(
      qCx + (data.q[0].length * cellSize) / 2 + 6,
      cy,
      scoreCx - (scores.length * cellSize) / 2 - 6,
      cy,
      8,
    );
    arrow.strokeStyle = COLORS.accent2;
    arrow.lineWidth = 2;
    this.scene.add(arrow);

    const op = new Text("·", (qCx + scoreCx) / 2, cy - 14, 18);
    op.fillStyle = COLORS.accent2;
    op.fontWeight = "bold";
    this.scene.add(op);
  }

  // Step 2: scores / √dₖ
  private renderStep2(data: AttentionResponse, cellSize: number, w: number, h: number): void {
    const scoresCx = w * 0.28;
    const scaledCx = w * 0.72;
    const cy = h * 0.5 + 10;
    const dk = data.q[0].length;
    const scale = Math.sqrt(dk);

    const scores = data.scores;
    // Scaled scores = scores / sqrt(dk)
    const scaled: number[][] = scores.map((row) => row.map((v) => v / scale));

    this.drawMatrix(scoresCx, cy, scores, cellSize, "分数 (Q·Kᵀ)", TOKEN_LABELS);
    this.drawMatrix(scaledCx, cy, scaled, cellSize, `缩放 (÷√${dk}=${scale.toFixed(2)})`, TOKEN_LABELS);

    // arrow with division symbol
    const arrow = new Arrow(
      scoresCx + (scores.length * cellSize) / 2 + 6,
      cy,
      scaledCx - (scaled.length * cellSize) / 2 - 6,
      cy,
      8,
    );
    arrow.strokeStyle = COLORS.accent2;
    arrow.lineWidth = 2;
    this.scene.add(arrow);

    const op = new Text(`÷ √dₖ`, (scoresCx + scaledCx) / 2, cy - 16, 14);
    op.fillStyle = COLORS.highlight;
    op.fontWeight = "bold";
    op.fontFamily = "monospace";
    this.scene.add(op);

    // Why-scale note
    const note = new Text(
      "缩放防止点积过大导致 softmax 饱和 (梯度消失)",
      w / 2,
      h - 44,
      12,
    );
    note.fillStyle = COLORS.textDim;
    this.scene.add(note);
  }

  // Step 3: softmax -> attention weights
  private renderStep3(data: AttentionResponse, cellSize: number, w: number, h: number): void {
    const scoresCx = w * 0.28;
    const weightsCx = w * 0.72;
    const cy = h * 0.5 + 10;
    const dk = data.q[0].length;
    const scale = Math.sqrt(dk);

    // scaled scores on the left
    const scaled: number[][] = data.scores.map((row) => row.map((v) => v / scale));
    this.drawMatrix(scoresCx, cy, scaled, cellSize, "缩放分数", TOKEN_LABELS);

    // weights on the right (heatmap, [0,1])
    const grid = new Grid(weightsCx, cy, data.weights, cellSize);
    grid.showValues = true;
    grid.fontSize = Math.max(9, Math.floor(cellSize / 3.4));
    grid.cellGap = 1;
    grid.valueMin = 0;
    grid.valueMax = 1;
    this.scene.add(grid);

    const wLabel = new Text("权重 = softmax(...)", weightsCx, cy + (data.weights.length * cellSize) / 2 + 20, 13);
    wLabel.fillStyle = COLORS.positive;
    this.scene.add(wLabel);

    const arrow = new Arrow(
      scoresCx + (scaled.length * cellSize) / 2 + 6,
      cy,
      weightsCx - (data.weights.length * cellSize) / 2 - 6,
      cy,
      8,
    );
    arrow.strokeStyle = COLORS.accent2;
    arrow.lineWidth = 2;
    this.scene.add(arrow);

    const op = new Text("softmax", (scoresCx + weightsCx) / 2, cy - 16, 14);
    op.fillStyle = COLORS.positive;
    op.fontWeight = "bold";
    op.fontFamily = "monospace";
    this.scene.add(op);

    // row-sums-equals-one check label
    const note = new Text("每行之和 = 1 (概率分布)", w / 2, h - 44, 12);
    note.fillStyle = COLORS.textDim;
    this.scene.add(note);
  }

  private drawMatrix(
    cx: number,
    cy: number,
    mat: number[][],
    cellSize: number,
    title: string,
    labels: string[],
  ): void {
    const grid = new Grid(cx, cy, mat, cellSize);
    grid.showValues = true;
    grid.fontSize = Math.max(9, Math.floor(cellSize / 3.4));
    grid.cellGap = 1;
    this.scene.add(grid);

    const lbl = new Text(title, cx, cy - (mat.length * cellSize) / 2 - 16, 13);
    lbl.fillStyle = COLORS.text;
    this.scene.add(lbl);

    const left = cx - (mat[0].length * cellSize) / 2;
    for (let i = 0; i < mat.length; i++) {
      const rl = new Text(labels[i] ?? String(i), left - 14, cy - (mat.length * cellSize) / 2 + i * cellSize + cellSize / 2, 10);
      rl.fillStyle = COLORS.textDim;
      this.scene.add(rl);
    }
  }
}
