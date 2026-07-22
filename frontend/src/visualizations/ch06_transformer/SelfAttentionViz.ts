/** SelfAttentionViz - interactive self-attention (Q, K, V) from the backend.

Calls the transformer attention API with a small token sequence, then draws:
  - Q nodes as "question balls" (GlowNode with "?" label)
  - K nodes as "answer balls" (GlowNode with a different hue)
  - V nodes as "content balls"
  - When focus changes, PARTICLES flow from Q to matching K nodes (thickness = weight)
  - High-weight connections GLOW
  - The matrix is kept but made smaller, with the visual metaphor centered

A "focus" slider selects which query position to highlight.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Grid } from "@/canvas/shapes/Grid";
import { Rect } from "@/canvas/shapes/Rect";
import { Curve } from "@/canvas/shapes/Curve";
import { GlowNode } from "@/canvas/shapes/GlowNode";
import { Particle } from "@/canvas/shapes/Particle";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";
import { COLORS } from "@/utils/color";
import { transformerAttention } from "@/api/compute";
import type { AttentionResponse } from "@/types/api";

/** Small token sequence with 3-dim vectors. */
const SEQUENCE: number[][] = [
  [1, 0, 0],
  [0, 1, 0],
  [0.5, 0.5, 0],
  [1, 1, 0],
  [0, 0, 1],
];

const TOKEN_LABELS = ["A", "B", "C", "D", "E"];

/** Hue per role: Q=cyan, K=purple, V=amber. */
const HUE_Q = 180;
const HUE_K = 265;
const HUE_V = 45;

export class SelfAttentionViz extends BaseVisualization {
  private apiResponse: AttentionResponse | null = null;
  private loading = false;
  private error: string | null = null;
  /** Shared state: flowing particles progress 0->1 (looped). */
  private flow = { progress: 0 };
  private flowGen = 0;

  onMount(): void {
    void this.fetchAndRender();
  }

  onControlChange(_key: string, _value: number): void {
    // The focus slider only affects local rendering; no re-fetch needed.
    if (this.apiResponse) this.startFlowLoop();
    this.render();
  }

  onUnmount(): void {
    this.renderer.clearAnimations();
  }

  private get focus(): number {
    const f = Math.floor(this.controls["focus"] ?? 0);
    const n = this.apiResponse ? this.apiResponse.weights.length : SEQUENCE.length;
    return Math.max(0, Math.min(n - 1, f));
  }

  private async fetchAndRender(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.renderLoading();
    try {
      const resp = await transformerAttention({ sequence: SEQUENCE, causal_mask: false });
      this.apiResponse = resp;
      this.loading = false;
      this.startFlowLoop();
      this.render();
    } catch (err) {
      this.loading = false;
      this.error = err instanceof Error ? err.message : String(err);
      this.setVisualizationStatus("error");
      this.renderError();
    }
  }

  /** Loop the flowing particles forever. */
  private startFlowLoop(): void {
    const gen = ++this.flowGen;
    this.renderer.clearAnimations();
    this.setVisualizationStatus("running");
    this.flow.progress = 0;
    const tw = new Tween(this.flow, { progress: 1 }, 1600, Easing.linear);
    tw.onUpdate(() => this.render());
    tw.onComplete(() => {
      if (gen !== this.flowGen) return;
      tw.reset();
      this.renderer.addTween(tw);
    });
    this.renderer.addTween(tw);
  }

  private renderLoading(): void {
    this.scene.clear();
    const t = new Text("正在计算注意力...", this.width / 2, this.height / 2, 16);
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

  private render(): void {
    this.scene.clear();
    if (!this.apiResponse) {
      this.renderLoading();
      return;
    }

    const w = this.width;
    const h = this.height;
    const data = this.apiResponse;
    const n = data.weights.length;
    const focus = this.focus;

    if (w < 460) {
      this.renderCompact(data, n, focus);
      return;
    }

    // --- Title ---
    const title = new Text("自注意力: Attention(Q, K, V)", w / 2, 26, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    // --- Plain-language role labels ---
    const roles = new Text("Q = 提问者   •   K = 回答者   •   V = 内容   •   匹配度高的被采纳", w / 2, 50, 13);
    roles.fillStyle = COLORS.highlight;
    this.scene.add(roles);

    // --- Formula ---
    const formula = new Text("Attention(Q,K,V) = softmax(QKᵀ/√dₖ)·V", w / 2, 72, 13);
    formula.fillStyle = COLORS.accent2;
    formula.fontFamily = "monospace";
    this.scene.add(formula);

    // --- Layout: the Q/K/V metaphor in the center, small matrix at the bottom ---
    const centerX = w / 2;
    const centerY = h * 0.42;

    const ballR = 18;
    const qColX = w * 0.28;
    const kColX = w * 0.72;
    const qNodeY = centerY;
    const kRowSpacing = Math.min(44, (h * 0.5) / Math.max(1, n));
    const kTopY = centerY - ((n - 1) * kRowSpacing) / 2;

    // --- Q column (question balls) ---
    const qNode = new GlowNode(qColX, qNodeY, ballR);
    qNode.intensity = 1;
    qNode.hue = HUE_Q;
    qNode.label = "?";
    qNode.labelSize = 16;
    qNode.glowScale = 3;
    this.scene.add(qNode);

    const qLabel = new Text(`Q = "${TOKEN_LABELS[focus]}"`, qColX, qNodeY + ballR + 22, 13);
    qLabel.fillStyle = COLORS.accent;
    qLabel.fontWeight = "bold";
    this.scene.add(qLabel);

    const qRole = new Text("提问者", qColX, qNodeY + ballR + 40, 11);
    qRole.fillStyle = COLORS.textDim;
    this.scene.add(qRole);

    // --- K column (answer balls) ---
    for (let j = 0; j < n; j++) {
      const ky = kTopY + j * kRowSpacing;
      const wt = data.weights[focus][j];
      const isHigh = wt > 0.25;

      // Connection curve from Q to this K
      const curve = new Curve(qColX + ballR, qNodeY, kColX - ballR, ky);
      const midX = (qColX + kColX) / 2;
      const arch = 30 + Math.abs(j - (n - 1) / 2) * 10;
      curve.setControlPoints(midX, qNodeY - arch, midX, ky - arch);
      curve.strokeStyle = isHigh
        ? `hsla(${HUE_K}, 90%, 70%, ${0.5 + wt * 0.5})`
        : `hsla(${HUE_K}, 60%, 55%, ${0.2 + wt * 0.4})`;
      curve.lineWidth = 0.5 + wt * 8;
      this.scene.add(curve);

      // Flowing particle along the connection (thickness = weight)
      const prog = (this.flow.progress + j * 0.2) % 1;
      const [px, py] = this.bezierPoint(
        qColX + ballR, qNodeY,
        midX, qNodeY - arch,
        midX, ky - arch,
        kColX - ballR, ky,
        prog,
      );
      const particle = new Particle(px, py, px, py, 2.5 + wt * 3, isHigh ? HUE_Q : HUE_K);
      particle.progress = 1;
      particle.opacity = 0.3 + wt * 0.7;
      particle.showTrail = false;
      this.scene.add(particle);

      // K node (glows brighter if high-weight match)
      const kNode = new GlowNode(kColX, ky, ballR);
      kNode.intensity = 0.3 + wt * 0.7;
      kNode.hue = HUE_K;
      kNode.glowScale = 2 + wt * 2;
      kNode.label = TOKEN_LABELS[j];
      kNode.labelSize = 14;
      this.scene.add(kNode);

      // Weight label
      const wtLbl = new Text(`${(wt * 100).toFixed(0)}%`, kColX + ballR + 30, ky, 11);
      wtLbl.fillStyle = isHigh ? COLORS.highlight : COLORS.textDim;
      wtLbl.fontFamily = "monospace";
      wtLbl.align = "left";
      this.scene.add(wtLbl);

      // "Adopted" marker for high-weight matches
      if (isHigh) {
        const adopt = new Text("★ 采纳", kColX + ballR + 64, ky, 11);
        adopt.fillStyle = COLORS.positive;
        adopt.fontWeight = "bold";
        adopt.align = "left";
        this.scene.add(adopt);
      }
    }

    const kLabel = new Text("K (回答者)", kColX, kTopY - ballR - 24, 13);
    kLabel.fillStyle = COLORS.accent2;
    kLabel.fontWeight = "bold";
    this.scene.add(kLabel);

    // --- V column: a compact vertical stack of content balls on the far right ---
    const vColX = w * 0.92;
    const vTopY = centerY - ((n - 1) * kRowSpacing) / 2;
    for (let j = 0; j < n; j++) {
      const vy = vTopY + j * kRowSpacing;
      const vNode = new GlowNode(vColX, vy, ballR * 0.7);
      vNode.intensity = 0.4 + data.weights[focus][j] * 0.6;
      vNode.hue = HUE_V;
      vNode.glowScale = 1.8;
      vNode.label = TOKEN_LABELS[j];
      vNode.labelSize = 11;
      this.scene.add(vNode);
    }
    const vLabel = new Text("V (内容)", vColX, vTopY - ballR * 0.7 - 24, 13);
    vLabel.fillStyle = COLORS.accent3;
    vLabel.fontWeight = "bold";
    this.scene.add(vLabel);

    // --- Compact attention weight matrix (smaller, at the bottom) ---
    const matCell = Math.min(26, (w * 0.5) / n);
    const matCx = w / 2;
    const matY = h - 96;

    const attnGrid = new Grid(matCx, matY, data.weights, matCell);
    attnGrid.showValues = true;
    attnGrid.fontSize = Math.max(8, Math.floor(matCell / 3.4));
    attnGrid.cellGap = 1;
    attnGrid.valueMin = 0;
    attnGrid.valueMax = 1;
    this.scene.add(attnGrid);

    const matLabel = new Text("注意力权重矩阵 (softmax)", matCx, matY - (n * matCell) / 2 - 16, 12);
    matLabel.fillStyle = COLORS.text;
    this.scene.add(matLabel);

    // Highlight the focused query row
    const matLeft = matCx - (n * matCell) / 2;
    const rowTop = matY - (n * matCell) / 2 + focus * matCell;
    const rowHL = new Rect(matCx, rowTop + matCell / 2, n * matCell, matCell);
    rowHL.fillStyle = "rgba(251, 191, 36, 0.18)";
    rowHL.strokeStyle = COLORS.highlight;
    rowHL.lineWidth = 2.5;
    this.scene.add(rowHL);

    // Column/row labels for the matrix
    for (let j = 0; j < n; j++) {
      const lbl = new Text(TOKEN_LABELS[j], matLeft + j * matCell + matCell / 2, matY - (n * matCell) / 2 - 6, 9);
      lbl.fillStyle = COLORS.textDim;
      this.scene.add(lbl);
    }
    for (let i = 0; i < n; i++) {
      const lbl = new Text(TOKEN_LABELS[i], matLeft - 10, matY - (n * matCell) / 2 + i * matCell + matCell / 2, 9);
      lbl.fillStyle = COLORS.textDim;
      lbl.align = "right";
      this.scene.add(lbl);
    }

    // --- Bottom hint ---
    const hint = new Text(
      `Query #${focus} = "${TOKEN_LABELS[focus]}"  •  粗线/发光 = 高匹配度  •  ★ = 被采纳的回答`,
      w / 2,
      h - 18,
      12,
    );
    hint.fillStyle = COLORS.textDim;
    this.scene.add(hint);

    this.renderer.renderOnce();
  }

  /** Compact composition for narrow screens: one query, one candidate row, one matrix. */
  private renderCompact(data: AttentionResponse, n: number, focus: number): void {
    const w = this.width;
    const h = this.height;
    const weights = data.weights[focus] ?? [];
    const title = new Text("自注意力 Q → K / V", w / 2, 22, 15);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    const qLabel = new Text(`Q = "${TOKEN_LABELS[focus]}"`, w / 2, 48, 12);
    qLabel.fillStyle = COLORS.text;
    this.scene.add(qLabel);

    const qX = w / 2;
    const qY = 82;
    const qNode = new GlowNode(qX, qY, 17);
    qNode.hue = HUE_Q;
    qNode.intensity = 1;
    qNode.glowScale = 2.5;
    qNode.label = "?";
    qNode.labelSize = 14;
    this.scene.add(qNode);

    const candidateLabel = new Text("K / V 候选", w / 2, 121, 11);
    candidateLabel.fillStyle = COLORS.textDim;
    this.scene.add(candidateLabel);

    const rowY = 164;
    const left = 24;
    const spacing = (w - left * 2) / Math.max(1, n - 1);
    for (let j = 0; j < n; j++) {
      const weight = weights[j] ?? 0;
      const isHigh = weight > 0.25;
      const x = left + j * spacing;
      const curve = new Curve(qX, qY + 18, x, rowY - 15);
      curve.setControlPoints(qX, 112, x, 132);
      curve.strokeStyle = isHigh
        ? `hsla(${HUE_K}, 90%, 70%, ${0.5 + weight * 0.5})`
        : `hsla(${HUE_K}, 60%, 55%, ${0.2 + weight * 0.4})`;
      curve.lineWidth = 0.5 + weight * 6;
      this.scene.add(curve);

      const prog = (this.flow.progress + j * 0.2) % 1;
      const particle = new Particle(qX, qY + 18, x, rowY - 15, 2 + weight * 2, isHigh ? HUE_Q : HUE_K);
      particle.progress = prog;
      particle.opacity = 0.3 + weight * 0.7;
      this.scene.add(particle);

      const node = new GlowNode(x, rowY, 14);
      node.hue = HUE_K;
      node.intensity = 0.35 + weight * 0.65;
      node.glowScale = isHigh ? 2.5 : 1.8;
      node.label = TOKEN_LABELS[j];
      node.labelSize = 11;
      this.scene.add(node);

      const weightLabel = new Text(`${(weight * 100).toFixed(0)}%${isHigh ? " ★" : ""}`, x, rowY + 31, 9);
      weightLabel.fillStyle = isHigh ? COLORS.highlight : COLORS.textDim;
      weightLabel.fontFamily = "monospace";
      this.scene.add(weightLabel);
    }

    const matrixCell = Math.min(24, (w - 40) / n);
    const matrixX = w / 2;
    const matrixY = 306;
    const matrix = new Grid(matrixX, matrixY, data.weights, matrixCell);
    matrix.showValues = true;
    matrix.fontSize = 8;
    matrix.cellGap = 1;
    matrix.valueMin = 0;
    matrix.valueMax = 1;
    this.scene.add(matrix);

    const matrixLabel = new Text("注意力权重", matrixX, matrixY - (n * matrixCell) / 2 - 14, 11);
    matrixLabel.fillStyle = COLORS.textDim;
    this.scene.add(matrixLabel);

    const matrixLeft = matrixX - (n * matrixCell) / 2;
    const rowTop = matrixY - (n * matrixCell) / 2 + focus * matrixCell;
    const rowHighlight = new Rect(matrixX, rowTop + matrixCell / 2, n * matrixCell, matrixCell);
    rowHighlight.fillStyle = "rgba(233, 185, 95, 0.18)";
    rowHighlight.strokeStyle = COLORS.highlight;
    rowHighlight.lineWidth = 2;
    this.scene.add(rowHighlight);

    for (let j = 0; j < n; j++) {
      const topLabel = new Text(TOKEN_LABELS[j], matrixLeft + j * matrixCell + matrixCell / 2, matrixY - (n * matrixCell) / 2 - 4, 8);
      topLabel.fillStyle = COLORS.textDim;
      this.scene.add(topLabel);
      const sideLabel = new Text(TOKEN_LABELS[j], matrixLeft - 8, matrixY - (n * matrixCell) / 2 + j * matrixCell + matrixCell / 2, 8);
      sideLabel.fillStyle = COLORS.textDim;
      sideLabel.align = "right";
      this.scene.add(sideLabel);
    }

    const hint = new Text(`Query #${focus} · 粗线 = 高匹配度`, w / 2, h - 14, 10);
    hint.fillStyle = COLORS.textDim;
    this.scene.add(hint);
    this.renderer.renderOnce();
  }

  /** Evaluate a cubic bezier at parameter t, returning [x, y]. */
  private bezierPoint(
    x0: number, y0: number,
    c1x: number, c1y: number,
    c2x: number, c2y: number,
    x1: number, y1: number,
    t: number,
  ): [number, number] {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    const x = uuu * x0 + 3 * uu * t * c1x + 3 * u * tt * c2x + ttt * x1;
    const y = uuu * y0 + 3 * uu * t * c1y + 3 * u * tt * c2y + ttt * y1;
    return [x, y];
  }
}
