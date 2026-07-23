/** Self-attention taught as a sentence-level clue search before showing matrices. */

import { DrilldownVisualization } from "@/visualizations/DrilldownVisualization";
import { MouseHandler } from "@/canvas/interaction/MouseHandler";
import { Text } from "@/canvas/shapes/Text";
import { Grid } from "@/canvas/shapes/Grid";
import { Rect } from "@/canvas/shapes/Rect";
import { Curve } from "@/canvas/shapes/Curve";
import { GlowNode } from "@/canvas/shapes/GlowNode";
import { Particle } from "@/canvas/shapes/Particle";
import { Arrow } from "@/canvas/shapes/Arrow";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";
import { COLORS } from "@/utils/color";
import { transformerAttention } from "@/api/compute";
import type { AttentionResponse } from "@/types/api";

interface HitRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const SEQUENCE: number[][] = [
  [2, 0, 0],
  [0, 1, 0],
  [0.3, 1.4, 0],
  [1, 0, 0],
  [0.2, 0.4, 1.5],
];

const TOKEN_LABELS = ["小猫", "因为", "饿了", "它", "找食物"];
const TOKEN_DETAILS = ["故事里的主角", "说明原因", "主角的状态", "指回前面的主角", "接下来要做的事"];
const HUE_Q = 180;
const HUE_K = 265;
const HUE_V = 45;

export class SelfAttentionViz extends DrilldownVisualization {
  private apiResponse: AttentionResponse | null = null;
  private loading = false;
  private error: string | null = null;
  private flow = { progress: 0 };
  private viewTransition = { progress: 1 };
  private viewDepth = 0;
  private hitRegions: HitRegion[] = [];

  onMount(): void {
    this.initializeDrilldown("Self-Attention 总览");
    if (!this.mouseHandler) this.mouseHandler = new MouseHandler(this.canvas);
    this.mouseHandler.onClick((x, y) => this.handleClick(x, y));
    this.mouseHandler.onMouseMove((x, y) => this.handleHover(x, y));
    void this.fetchAndRender();
  }

  override onUnmount(): void {
    this.renderer.clearAnimations();
    this.canvas.style.cursor = "default";
    super.onUnmount();
  }

  onControlChange(key: string, value: number): void {
    if (key === "run") {
      if (this.viewDepth === 0) this.setViewDepth(1, false);
      this.playClueSearch();
      return;
    }
    if (key === "focus") {
      this.selectToken(Math.floor(value), this.viewDepth === 0 ? 1 : this.viewDepth);
      return;
    }
    if (key === "mode") {
      this.setViewDepth(Math.max(1, Math.min(3, Math.round(value) + 1)));
    }
  }

  override resize(): void {
    super.resize();
    this.render();
  }

  protected override onDrilldownRequest(depth: number): void {
    this.setViewDepth(Math.max(0, Math.min(this.viewDepth, depth)));
  }

  private get focus(): number {
    const size = this.apiResponse?.weights.length ?? TOKEN_LABELS.length;
    return Math.max(0, Math.min(size - 1, Math.floor(this.controls["focus"] ?? 3)));
  }

  private async fetchAndRender(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.renderLoading();
    try {
      this.apiResponse = await transformerAttention({ sequence: SEQUENCE, causal_mask: false }, this.getAbortSignal());
      this.loading = false;
      this.setVisualizationStatus("idle");
      this.render();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      this.loading = false;
      this.error = error instanceof Error ? error.message : String(error);
      this.setVisualizationStatus("error");
      this.renderError();
    }
  }

  private setViewDepth(depth: number, animate = true): void {
    this.viewDepth = Math.max(0, Math.min(3, depth));
    this.renderer.clearAnimations();
    this.setVisualizationStatus("idle");
    this.viewTransition.progress = animate ? 0 : 1;
    if (this.viewDepth === 0) {
      this.setControlValue("mode", 0);
      this.setDrilldownPath(["Self-Attention 总览"]);
    } else {
      const path = ["Self-Attention 总览", `词语“${TOKEN_LABELS[this.focus]}”`];
      if (this.viewDepth >= 2) path.push("Q / K / V 原理");
      if (this.viewDepth >= 3) path.push("权重矩阵");
      this.setControlValue("mode", this.viewDepth - 1);
      this.setDrilldownPath(path);
    }
    this.render();
    if (!animate) return;
    const tween = new Tween(this.viewTransition, { progress: 1 }, 420, Easing.easeOutCubic);
    tween.onUpdate(() => this.render());
    this.renderer.addTween(tween);
  }

  private selectToken(index: number, depth: number): void {
    const safeIndex = Math.max(0, Math.min(TOKEN_LABELS.length - 1, index));
    this.setControlValue("focus", safeIndex);
    this.setViewDepth(Math.max(1, depth));
  }

  private playClueSearch(): void {
    if (!this.apiResponse || this.loading) return;
    this.renderer.clearAnimations();
    this.flow.progress = 0;
    this.setVisualizationStatus("running");
    this.render();
    const tween = new Tween(this.flow, { progress: 1 }, 2200, Easing.easeInOutCubic);
    tween.onUpdate(() => this.render());
    tween.onComplete(() => {
      this.flow.progress = 1;
      this.render();
      this.setVisualizationStatus("completed");
    });
    this.renderer.addTween(tween);
  }

  private renderLoading(): void {
    this.scene.clear();
    const text = new Text("正在准备句子里的线索...", this.width / 2, this.height / 2, 15);
    text.fillStyle = COLORS.textDim;
    this.scene.add(text);
    this.renderer.renderOnce();
  }

  private renderError(): void {
    this.scene.clear();
    const text = new Text(`注意力计算失败：${this.error ?? "未知错误"}`, this.width / 2, this.height / 2, 13);
    text.fillStyle = COLORS.negative;
    this.scene.add(text);
    this.renderer.renderOnce();
  }

  private render(): void {
    this.scene.clear();
    this.hitRegions = [];
    if (this.loading || !this.apiResponse) {
      this.renderLoading();
      return;
    }
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
    this.drawTitle("一句话里，每个词都可以回头找线索", "点击一个词，看看它最关注谁");
    const positions = this.tokenPositions(compact ? 138 : h * 0.46);

    positions.forEach((position, index) => {
      if (index > 0) {
        const previous = positions[index - 1];
        const connection = new Arrow(previous.x + previous.width / 2, previous.y, position.x - position.width / 2, position.y, 7);
        connection.strokeStyle = COLORS.edge;
        connection.lineWidth = 1.5;
        this.scene.add(connection);
      }
      const selected = index === this.focus;
      const tile = new Rect(position.x, position.y, position.width, position.height, 8);
      tile.fillStyle = selected ? "rgba(157,142,231,0.18)" : COLORS.bgLight;
      tile.strokeStyle = selected ? COLORS.accent2 : COLORS.edge;
      tile.lineWidth = selected ? 2 : 1;
      this.scene.add(tile);
      const token = new Text(TOKEN_LABELS[index], position.x, position.y - 8, compact ? 12 : 14);
      token.fillStyle = COLORS.text;
      token.fontWeight = "bold";
      this.scene.add(token);
      const detail = new Text(TOKEN_DETAILS[index], position.x, position.y + 15, compact ? 9 : 10);
      detail.fillStyle = COLORS.textDim;
      this.scene.add(detail);
      this.hitRegions.push({ id: `token:${index}`, ...position });
    });

    const sentence = new Text("小猫因为饿了，所以它去找食物。", w / 2, compact ? 280 : h - 88, compact ? 13 : 16);
    sentence.fillStyle = COLORS.highlight;
    sentence.fontWeight = "bold";
    this.scene.add(sentence);
    const hint = new Text("例如“它”需要回头寻找：它指的是谁？", w / 2, compact ? 316 : h - 52, compact ? 11 : 12);
    hint.fillStyle = COLORS.textDim;
    this.scene.add(hint);
  }

  private renderStory(): void {
    const w = this.width;
    const h = this.height;
    const compact = w < 560;
    const weights = this.apiResponse!.weights[this.focus];
    const focusToken = TOKEN_LABELS[this.focus];
    const question = focusToken === "它" ? "“它”到底指的是谁？" : `“${focusToken}”应该参考哪些词？`;
    this.drawTitle(`${focusToken}正在向整句话寻找线索`, question);

    const qX = w / 2;
    const qY = compact ? 108 : 122;
    const query = new GlowNode(qX, qY, compact ? 19 : 23);
    query.hue = HUE_Q;
    query.intensity = 1;
    query.glowScale = 2.6;
    query.label = focusToken;
    query.labelSize = compact ? 10 : 12;
    this.scene.add(query);

    const rowY = compact ? 225 : h * 0.49;
    const margin = compact ? 26 : 64;
    const spacing = (w - margin * 2) / Math.max(1, TOKEN_LABELS.length - 1);
    for (let index = 0; index < TOKEN_LABELS.length; index++) {
      const x = margin + index * spacing;
      const weight = weights[index] ?? 0;
      const high = weight >= Math.max(...weights) - 0.0001;
      const curve = new Curve(qX, qY + 20, x, rowY - 18);
      const arch = 28 + Math.abs(index - this.focus) * 5;
      curve.setControlPoints(qX, qY + arch, x, rowY - arch);
      curve.strokeStyle = high
        ? `hsla(${HUE_K}, 90%, 72%, ${0.72 + weight * 0.28})`
        : `hsla(${HUE_K}, 65%, 58%, ${0.2 + weight * 0.5})`;
      curve.lineWidth = 1 + weight * (compact ? 7 : 10);
      this.scene.add(curve);

      const progress = Math.min(1, this.flow.progress);
      const [px, py] = this.bezierPoint(qX, qY + 20, qX, qY + arch, x, rowY - arch, x, rowY - 18, progress);
      const particle = new Particle(px, py, px, py, 2.5 + weight * 4, high ? HUE_Q : HUE_K);
      particle.progress = 1;
      particle.opacity = this.getStatus() === "idle" ? 0.35 : 0.35 + progress * 0.65;
      particle.showTrail = false;
      this.scene.add(particle);

      const candidate = new GlowNode(x, rowY, compact ? 15 : 18);
      candidate.hue = HUE_K;
      candidate.intensity = 0.3 + weight * 0.7;
      candidate.glowScale = high ? 2.8 : 1.8;
      candidate.label = TOKEN_LABELS[index];
      candidate.labelSize = compact ? 8 : 10;
      this.scene.add(candidate);
      const percent = new Text(`${Math.round(weight * 100)}%${high ? " ★" : ""}`, x, rowY + (compact ? 29 : 34), compact ? 9 : 10);
      percent.fillStyle = high ? COLORS.highlight : COLORS.textDim;
      percent.fontFamily = "monospace";
      this.scene.add(percent);
    }

    const best = this.bestMatch(weights);
    const summary = new Text(`线索最多来自“${TOKEN_LABELS[best]}”：${TOKEN_DETAILS[best]}`, w / 2, compact ? 316 : h - 108, compact ? 11 : 13);
    summary.fillStyle = COLORS.highlight;
    summary.fontWeight = "bold";
    this.scene.add(summary);
    this.drawDrillButton("拆开看看：Q、K、V 各自做什么", h - 48, "principle");
  }

  private renderPrinciple(): void {
    const w = this.width;
    const h = this.height;
    const compact = w < 560;
    const weights = this.apiResponse!.weights[this.focus];
    const best = this.bestMatch(weights);
    this.drawTitle("把找线索拆成三种卡片", "Q 提问题，K 用来匹配，V 携带真正的信息");

    const qY = compact ? 110 : 126;
    this.drawRoleCard(w / 2, qY, compact ? w - 44 : 360, compact ? 54 : 62, HUE_Q, "Q · 问题卡", `“${TOKEN_LABELS[this.focus]}”正在寻找相关线索`);

    const kLabel = new Text("K · 每个词的线索标签", w / 2, compact ? 170 : 202, compact ? 11 : 13);
    kLabel.fillStyle = COLORS.accent2;
    kLabel.fontWeight = "bold";
    this.scene.add(kLabel);
    const margin = compact ? 18 : 52;
    const tileGap = compact ? 5 : 9;
    const tileW = (w - margin * 2 - tileGap * (TOKEN_LABELS.length - 1)) / TOKEN_LABELS.length;
    const kY = compact ? 212 : 250;
    TOKEN_LABELS.forEach((token, index) => {
      const x = margin + tileW / 2 + index * (tileW + tileGap);
      const tile = new Rect(x, kY, tileW, compact ? 54 : 66, 7);
      tile.fillStyle = index === best ? "rgba(157,142,231,0.2)" : COLORS.bgLight;
      tile.strokeStyle = index === best ? COLORS.highlight : COLORS.edge;
      tile.lineWidth = index === best ? 2 : 1;
      this.scene.add(tile);
      const word = new Text(token, x, kY - 11, compact ? 9 : 11);
      word.fillStyle = COLORS.text;
      word.fontWeight = "bold";
      this.scene.add(word);
      const percent = new Text(`${Math.round(weights[index] * 100)}%`, x, kY + 14, compact ? 9 : 10);
      percent.fillStyle = index === best ? COLORS.highlight : COLORS.textDim;
      percent.fontFamily = "monospace";
      this.scene.add(percent);
    });

    const mergeY = compact ? 306 : 360;
    const from = new Arrow(w * 0.28, mergeY - 28, w * 0.42, mergeY, 7);
    from.strokeStyle = COLORS.accent3;
    from.lineWidth = 2;
    this.scene.add(from);
    const from2 = new Arrow(w * 0.72, mergeY - 28, w * 0.58, mergeY, 7);
    from2.strokeStyle = COLORS.accent3;
    from2.lineWidth = 2;
    this.scene.add(from2);
    this.drawRoleCard(w / 2, mergeY, compact ? w - 64 : 420, compact ? 54 : 64, HUE_V, "V · 真正内容", `把“${TOKEN_LABELS[best]}”等重要内容按比例汇总`);

    this.drawDrillButton("继续放大：查看权重矩阵和公式", h - 46, "math");
  }

  private renderMath(): void {
    const w = this.width;
    const h = this.height;
    const compact = w < 560;
    const data = this.apiResponse!;
    const size = data.weights.length;
    this.drawTitle("把所有词对词的关注程度排成表格", "当前高亮行表示选中的词正在关注谁");

    const cell = Math.min(compact ? 48 : 56, (w - (compact ? 62 : 150)) / size, (h - 170) / size);
    const matrixX = w / 2;
    const matrixY = compact ? 236 : h * 0.53;
    const matrix = new Grid(matrixX, matrixY, data.weights, cell);
    matrix.showValues = true;
    matrix.fontSize = Math.max(9, Math.floor(cell / 3.5));
    matrix.cellGap = 1;
    matrix.valueMin = 0;
    matrix.valueMax = 1;
    this.scene.add(matrix);

    const left = matrixX - (size * cell) / 2;
    const top = matrixY - (size * cell) / 2;
    const row = new Rect(matrixX, top + this.focus * cell + cell / 2, size * cell, cell, 0);
    row.fillStyle = "rgba(233,185,95,0.15)";
    row.strokeStyle = COLORS.highlight;
    row.lineWidth = 2.5;
    this.scene.add(row);
    for (let index = 0; index < size; index++) {
      const topLabel = new Text(TOKEN_LABELS[index], left + index * cell + cell / 2, top - 13, compact ? 8 : 10);
      topLabel.fillStyle = COLORS.textDim;
      this.scene.add(topLabel);
      const sideLabel = new Text(TOKEN_LABELS[index], left - 12, top + index * cell + cell / 2, compact ? 8 : 10);
      sideLabel.fillStyle = index === this.focus ? COLORS.highlight : COLORS.textDim;
      sideLabel.align = "right";
      this.scene.add(sideLabel);
    }

    const formula = new Text("Attention(Q,K,V) = softmax(QKᵀ / √dₖ) · V", w / 2, h - 28, compact ? 10 : 13);
    formula.fillStyle = COLORS.accent2;
    formula.fontFamily = "monospace";
    formula.fontWeight = "bold";
    this.scene.add(formula);
  }

  private drawTitle(titleText: string, subtitleText: string): void {
    const compact = this.width < 560;
    const title = new Text(this.trim(titleText, compact ? 24 : 44), this.width / 2, compact ? 48 : 52, compact ? 14 : 17);
    title.fillStyle = COLORS.text;
    title.fontWeight = "bold";
    this.scene.add(title);
    const subtitle = new Text(this.trim(subtitleText, compact ? 28 : 54), this.width / 2, compact ? 70 : 76, compact ? 10 : 12);
    subtitle.fillStyle = COLORS.textDim;
    this.scene.add(subtitle);
  }

  private drawRoleCard(x: number, y: number, width: number, height: number, hue: number, titleText: string, detailText: string): void {
    const card = new Rect(x, y, width, height, 8);
    card.fillStyle = `hsla(${hue}, 65%, 30%, 0.16)`;
    card.strokeStyle = `hsl(${hue}, 75%, 62%)`;
    card.lineWidth = 1.5;
    this.scene.add(card);
    const title = new Text(titleText, x, y - height * 0.18, this.width < 560 ? 11 : 13);
    title.fillStyle = COLORS.text;
    title.fontWeight = "bold";
    this.scene.add(title);
    const detail = new Text(this.trim(detailText, this.width < 560 ? 28 : 50), x, y + height * 0.2, this.width < 560 ? 9 : 11);
    detail.fillStyle = COLORS.textDim;
    this.scene.add(detail);
  }

  private drawDrillButton(label: string, y: number, id: string): void {
    const compact = this.width < 560;
    const width = Math.min(compact ? this.width - 34 : 350, this.width - 28);
    const button = new Rect(this.width / 2, y, width, compact ? 34 : 38, 7);
    button.fillStyle = "rgba(66,199,212,0.14)";
    button.strokeStyle = COLORS.accent;
    button.lineWidth = 1.4;
    this.scene.add(button);
    const text = new Text(label, this.width / 2, y, compact ? 10 : 12);
    text.fillStyle = COLORS.accent;
    text.fontWeight = "bold";
    this.scene.add(text);
    this.hitRegions.push({ id, x: this.width / 2, y, width, height: compact ? 34 : 38 });
  }

  private tokenPositions(startY: number): Array<{ x: number; y: number; width: number; height: number }> {
    const compact = this.width < 560;
    if (!compact) {
      const width = Math.min(116, (this.width - 100) / TOKEN_LABELS.length - 8);
      const gap = 10;
      const total = width * TOKEN_LABELS.length + gap * (TOKEN_LABELS.length - 1);
      const startX = (this.width - total) / 2 + width / 2;
      return TOKEN_LABELS.map((_, index) => ({ x: startX + index * (width + gap), y: startY, width, height: 70 }));
    }
    const gap = 8;
    const width = (this.width - 28 - gap * 2) / 3;
    return TOKEN_LABELS.map((_, index) => {
      const row = Math.floor(index / 3);
      const columns = row === 0 ? 3 : 2;
      const rowWidth = width * columns + gap * (columns - 1);
      const rowStart = (this.width - rowWidth) / 2;
      return { x: rowStart + width / 2 + (index % 3) * (width + gap), y: startY + row * 82, width, height: 64 };
    });
  }

  private handleClick(x: number, y: number): void {
    const hit = this.hitRegions.find((region) => Math.abs(x - region.x) <= region.width / 2 && Math.abs(y - region.y) <= region.height / 2);
    if (!hit) return;
    if (hit.id.startsWith("token:")) this.selectToken(Number(hit.id.split(":")[1]), 1);
    else if (hit.id === "principle") this.setViewDepth(2);
    else if (hit.id === "math") this.setViewDepth(3);
  }

  private handleHover(x: number, y: number): void {
    this.canvas.style.cursor = this.hitRegions.some((region) => Math.abs(x - region.x) <= region.width / 2 && Math.abs(y - region.y) <= region.height / 2) ? "pointer" : "default";
  }

  private bestMatch(weights: number[]): number {
    let best = 0;
    for (let index = 1; index < weights.length; index++) if (weights[index] > weights[best]) best = index;
    return best;
  }

  private trim(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1)}…`;
  }

  private bezierPoint(x0: number, y0: number, c1x: number, c1y: number, c2x: number, c2y: number, x1: number, y1: number, t: number): [number, number] {
    const u = 1 - t;
    return [
      u ** 3 * x0 + 3 * u ** 2 * t * c1x + 3 * u * t ** 2 * c2x + t ** 3 * x1,
      u ** 3 * y0 + 3 * u ** 2 * t * c1y + 3 * u * t ** 2 * c2y + t ** 3 * y1,
    ];
  }
}
