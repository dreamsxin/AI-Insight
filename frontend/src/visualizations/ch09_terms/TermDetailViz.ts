/** TermDetailViz - shows detailed information for a single AI term.

A "term_id" slider (0-99) selects which term to display. fetchTerm(id)
retrieves the term's details, which are rendered with a large zh name, the
English name, a category badge, a one-line short description, and a detailed
explanation panel. A "正在加载..." message is shown while fetching.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Rect } from "@/canvas/shapes/Rect";
import { Line } from "@/canvas/shapes/Line";
import { COLORS } from "@/utils/color";
import { fetchTerm } from "@/api/compute";
import type { Term } from "@/types/api";

/** Category -> color mapping (shared convention with TermGridViz). */
const CATEGORY_COLOR: Record<string, string> = {
  基础概念: COLORS.accent,
  模型架构: COLORS.accent2,
  训练技术: COLORS.accent3,
  推理部署: COLORS.positive,
  应用生态: COLORS.highlight,
};

export class TermDetailViz extends BaseVisualization {
  private term: Term | null = null;
  private loading = false;
  /** Last term id we requested, to avoid rendering stale responses. */
  private lastRequestedId = -1;
  private errorMsg: string | null = null;

  onMount(): void {
    void this.fetchAndRender();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "term_id") {
      void this.fetchAndRender();
    }
  }

  private get termId(): number {
    const v = Math.floor(this.controls["term_id"] ?? 0);
    return Math.max(0, Math.min(99, v));
  }

  private async fetchAndRender(): Promise<void> {
    const id = this.termId;
    // Mark loading and show the placeholder immediately.
    this.loading = true;
    this.errorMsg = null;
    this.term = null;
    this.lastRequestedId = id;
    this.renderLoading(id);
    try {
      const term = await fetchTerm(id);
      // Ignore stale responses.
      if (this.lastRequestedId !== id) return;
      this.term = term;
      this.loading = false;
      this.render();
    } catch (err) {
      if (this.lastRequestedId !== id) return;
      this.loading = false;
      this.errorMsg = err instanceof Error ? err.message : String(err);
      this.renderError();
    }
  }

  private renderLoading(id: number): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const t = new Text(`正在加载术语 #${id}...`, w / 2, h / 2, 16);
    t.fillStyle = COLORS.textDim;
    this.scene.add(t);
    this.renderer.renderOnce();
  }

  private renderError(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const t = new Text(`API 错误: ${this.errorMsg ?? "未知错误"}`, w / 2, h / 2, 14);
    t.fillStyle = COLORS.negative;
    this.scene.add(t);
    this.renderer.renderOnce();
  }

  private render(): void {
    this.scene.clear();
    if (this.loading) {
      this.renderLoading(this.termId);
      return;
    }
    if (this.errorMsg) {
      this.renderError();
      return;
    }
    if (!this.term) {
      this.renderLoading(this.termId);
      return;
    }

    const w = this.width;
    const h = this.height;
    const term = this.term;
    const padX = 48;

    // --- Term id header ---
    const idText = new Text(`术语 #${term.id}`, padX, 32, 12);
    idText.fillStyle = COLORS.textDim;
    idText.align = "left";
    this.scene.add(idText);

    const idRange = new Text("0 — 99", w - padX, 32, 12);
    idRange.fillStyle = COLORS.textDim;
    idRange.align = "right";
    this.scene.add(idRange);

    // --- Large zh name ---
    const nameY = 70;
    const name = new Text(term.zh, padX, nameY, 34);
    name.fillStyle = COLORS.text;
    name.fontWeight = "bold";
    name.align = "left";
    this.scene.add(name);

    // --- English name ---
    const en = new Text(term.en, padX, nameY + 34, 16);
    en.fillStyle = COLORS.accent;
    en.fontFamily = "monospace";
    en.align = "left";
    this.scene.add(en);

    // --- Category badge ---
    const badgeY = nameY + 66;
    const catColor = CATEGORY_COLOR[term.category] ?? COLORS.edge;
    const badge = new Rect(padX + 56, badgeY, 112, 28, 14);
    badge.fillStyle = catColor;
    badge.opacity = 0.22;
    badge.strokeStyle = catColor;
    badge.lineWidth = 1.5;
    this.scene.add(badge);
    const badgeText = new Text(term.category, padX + 56, badgeY, 13);
    badgeText.fillStyle = catColor;
    badgeText.fontWeight = "bold";
    this.scene.add(badgeText);

    const catLabel = new Text("分类:", padX, badgeY, 12);
    catLabel.fillStyle = COLORS.textDim;
    catLabel.align = "left";
    this.scene.add(catLabel);

    // --- Short description ---
    const shortY = badgeY + 50;
    const shortLabel = new Text("简介", padX, shortY, 13);
    shortLabel.fillStyle = COLORS.highlight;
    shortLabel.fontWeight = "bold";
    shortLabel.align = "left";
    this.scene.add(shortLabel);

    const shortText = new Text(term.short, padX, shortY + 24, 15);
    shortText.fillStyle = COLORS.text;
    shortText.align = "left";
    this.scene.add(shortText);

    // --- Divider ---
    const divY = shortY + 54;
    const divider = new Line(padX, divY, w - padX, divY);
    divider.strokeStyle = "rgba(255,255,255,0.1)";
    divider.lineWidth = 1;
    this.scene.add(divider);

    // --- Detail panel ---
    const detailLabel = new Text("详细解释", padX, divY + 22, 13);
    detailLabel.fillStyle = COLORS.accent2;
    detailLabel.fontWeight = "bold";
    detailLabel.align = "left";
    this.scene.add(detailLabel);

    const panelTop = divY + 44;
    const panelH = h - panelTop - 30;
    const panel = new Rect(w / 2, panelTop + panelH / 2, w - padX * 2, panelH, 10);
    panel.fillStyle = "rgba(255,255,255,0.03)";
    panel.strokeStyle = "rgba(255,255,255,0.08)";
    panel.lineWidth = 1;
    this.scene.add(panel);

    // Wrap the detail text into lines that fit the panel width.
    const innerW = w - padX * 2 - 32;
    const lines = wrapText(term.detail, innerW, 15);
    const lineH = 22;
    const startY = panelTop + 22;
    const maxLines = Math.max(1, Math.floor((panelH - 44) / lineH));
    const shown = lines.slice(0, maxLines);
    shown.forEach((line, i) => {
      const lt = new Text(line, padX + 16, startY + i * lineH, 15);
      lt.fillStyle = COLORS.text;
      lt.align = "left";
      this.scene.add(lt);
    });
    if (lines.length > maxLines) {
      const more = new Text(`… (共 ${lines.length} 行)`, padX + 16, startY + maxLines * lineH, 12);
      more.fillStyle = COLORS.textDim;
      more.align = "left";
      this.scene.add(more);
    }

    this.renderer.renderOnce();
  }
}

/** Greedy word-wrap of `text` into lines no wider than maxWidthPx.

We approximate character width using a monospace-ish estimate of
~fontSize*0.6 px per CJK char and ~fontSize*0.55 per ASCII char. Since the
backend text is mostly Chinese with some ASCII, this is a reasonable heuristic
that avoids needing a Canvas measureText call.
*/
function wrapText(text: string, maxWidthPx: number, fontSize: number): string[] {
  const lines: string[] = [];
  const chars = Array.from(text);
  let current = "";
  let currentWidth = 0;
  for (const ch of chars) {
    if (ch === "\n") {
      lines.push(current);
      current = "";
      currentWidth = 0;
      continue;
    }
    const isCJK = ch.charCodeAt(0) > 0x2e80;
    const cw = isCJK ? fontSize * 1.0 : fontSize * 0.55;
    if (currentWidth + cw > maxWidthPx && current.length > 0) {
      lines.push(current);
      current = ch;
      currentWidth = cw;
    } else {
      current += ch;
      currentWidth += cw;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}
