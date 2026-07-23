/** TermGridViz - shows AI terms arranged in clusters by category.

Terms are arranged in CLUSTERS (one per category), each with a GLOWING center
label (the category name). Terms are small GlowNodes colored by category. The
selected category cluster stays bright while others fade. A search box (an
HTML input overlaid on the canvas) dims non-matching terms. Clicking a term
node opens a detail panel overlay (drawn on the canvas) showing the full term
record plus clickable related terms in the same category.

Controls:
  - "filter" select (来自 backend): 全部 / 基础概念 / 模型架构 / 训练技术 /
    推理部署 / 应用生态. Selects which category cluster is highlighted.
  - search input (HTML overlay): dims terms whose zh/en names do not match.
  - click: opens detail panel with related-term navigation.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { MouseHandler } from "@/canvas/interaction/MouseHandler";
import { Text } from "@/canvas/shapes/Text";
import { Rect } from "@/canvas/shapes/Rect";
import { GlowNode } from "@/canvas/shapes/GlowNode";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";
import { COLORS } from "@/utils/color";
import { lerp } from "@/utils/math";
import { fetchTerms, fetchTerm } from "@/api/compute";
import type { Term } from "@/types/api";

/** Category -> color + hue mapping. */
const CATEGORY_INFO: Record<string, { color: string; hue: number }> = {
  基础概念: { color: COLORS.accent, hue: 180 },
  模型架构: { color: COLORS.accent2, hue: 265 },
  训练技术: { color: COLORS.accent3, hue: 25 },
  推理部署: { color: COLORS.positive, hue: 120 },
  应用生态: { color: COLORS.highlight, hue: 45 },
};

const FILTER_OPTIONS: string[] = [
  "全部",
  "基础概念",
  "模型架构",
  "训练技术",
  "推理部署",
  "应用生态",
];

const CATEGORIES = Object.keys(CATEGORY_INFO);

/** Node radius for a term in the cluster ring. */
const TERM_NODE_RADIUS = 16;
/** Node radius for a related-term chip in the detail panel. */
const RELATED_NODE_RADIUS = 10;

/** A clickable term hit target, independent of visual opacity. */
interface TermHit {
  term: Term;
  x: number;
  y: number;
  radius: number;
  width?: number;
  height?: number;
}

/** A clickable related-term chip target in the detail panel. */
interface RelatedHit {
  term: Term;
  x: number;
  y: number;
  radius: number;
}

export class TermGridViz extends BaseVisualization {
  private terms: Term[] = [];
  private loading = true;
  private loaded = false;
  /** Cluster center positions keyed by category. */
  private clusterCenters: Record<string, { x: number; y: number }> = {};
  /** Animated per-cluster opacity (for fade in/out). */
  private clusterOpacity: Record<string, number> = {};
  /** Animated per-cluster scale (selected expands). */
  private clusterScale: Record<string, number> = {};
  /** Animated per-term intensity (pop-in). */
  private termIntensity: number[] = [];
  /** Progress from overview clusters to the selected category grid. */
  private focusProgress = 0;
  private animGen = 0;

  /** HTML search input overlaid on the canvas. */
  private searchInput: HTMLInputElement | null = null;
  /** Current search text (lowercased). */
  private searchText = "";

  /** Live hit targets for term nodes (recomputed each render). */
  private termHits: TermHit[] = [];
  /** Live hit targets for related-term chips in the detail panel. */
  private relatedHits: RelatedHit[] = [];
  /** Hit target for the detail panel close button. */
  private closeHit: { x: number; y: number; radius: number } | null = null;

  /** The term whose detail panel is currently open (null = no panel). */
  private selectedTerm: Term | null = null;
  /** Full detail record fetched for the selected term. */
  private detailTerm: Term | null = null;
  /** True while the detail panel is loading full details. */
  private detailLoading = false;
  /** Last term id requested for details, to ignore stale responses. */
  private detailRequestedId = -1;
  /** Animated panel reveal progress (0..1). */
  private panelReveal = 0;

  onMount(): void {
    // Set up the mouse handler for term-node clicks.
    if (!this.mouseHandler) {
      this.mouseHandler = new MouseHandler(this.canvas);
    }
    this.mouseHandler.onClick((x, y) => this.handleClick(x, y));
    this.mouseHandler.onMouseMove((x, y) => this.handleHover(x, y));

    // Create the search input overlay (HTML element inside the container).
    this.searchInput = document.createElement("input");
    this.searchInput.type = "text";
    this.searchInput.placeholder = "搜索术语...";
    this.searchInput.setAttribute("aria-label", "搜索术语");
    this.searchInput.style.cssText =
      "position:absolute;top:8px;right:8px;z-index:10;width:180px;padding:6px 10px;" +
      "background:rgba(22,27,34,0.9);color:#f2f5f7;border:1px solid #4b5664;border-radius:6px;" +
      "font-size:13px;outline:none;box-sizing:border-box;";
    this.searchInput.addEventListener("input", () => {
      this.searchText = this.searchInput!.value.toLowerCase();
      this.render();
    });
    this.container.appendChild(this.searchInput);

    if (!this.loaded) {
      void this.fetchAndRender();
    } else {
      this.computeClusterLayout();
      this.animateIntro();
    }
  }

  override onTextChange(_key: string, text: string): void {
    this.searchText = text.toLowerCase();
    this.render();
  }

  onControlChange(_key: string, _value: number): void {
    this.animateFilter();
  }

  override onUnmount(): void {
    this.searchInput?.remove();
    this.searchInput = null;
    this.cancelRequests();
    this.renderer.clearAnimations();
  }

  private get filterIndex(): number {
    const v = Math.floor(this.controls["filter"] ?? 0);
    return Math.max(0, Math.min(FILTER_OPTIONS.length - 1, v));
  }

  private get selectedFilter(): string {
    return FILTER_OPTIONS[this.filterIndex];
  }

  private async fetchAndRender(): Promise<void> {
    this.loading = true;
    this.renderLoading();
    try {
      const terms = await fetchTerms(this.getAbortSignal());
      this.terms = terms;
      this.loading = false;
      this.loaded = true;
      this.computeClusterLayout();
      this.animateIntro();
    } catch (err) {
      // Aborted requests (navigation/unmount) are expected; ignore them.
      if (err instanceof DOMException && err.name === "AbortError") return;
      this.loading = false;
      this.renderError(err);
    }
  }

  /** Compute cluster centers in a pentagon-ish arrangement. */
  private computeClusterLayout(): void {
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2 + 10;
    const radius = Math.min(w, h) * 0.32;
    this.clusterCenters = {};
    for (let i = 0; i < CATEGORIES.length; i++) {
      // Pentagon arrangement: angle offset so the first cluster is at the top.
      const angle = -Math.PI / 2 + (i / CATEGORIES.length) * Math.PI * 2;
      this.clusterCenters[CATEGORIES[i]] = {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      };
    }
    // Initialize opacity/scale state.
    for (const cat of CATEGORIES) {
      if (!(cat in this.clusterOpacity)) this.clusterOpacity[cat] = 0;
      if (!(cat in this.clusterScale)) this.clusterScale[cat] = 1;
    }
  }

  /** Intro animation: fade clusters in. */
  private animateIntro(): void {
    const gen = ++this.animGen;
    this.renderer.clearAnimations();
    this.termIntensity = this.terms.map(() => 0);
    for (const cat of CATEGORIES) {
      this.clusterOpacity[cat] = 0;
    }
    this.render();

    CATEGORIES.forEach((cat, ci) => {
      const state = { v: 0 };
      const tw = new Tween(state, { v: 1 }, 500, Easing.easeOutCubic);
      tw.setDelay(ci * 80);
      tw.onUpdate(() => {
        this.clusterOpacity[cat] = state.v;
        this.render();
      });
      this.renderer.addTween(tw);
    });

    // Pop term intensities in.
    this.terms.forEach((_, i) => {
      const state = { v: 0 };
      const tw = new Tween(state, { v: 1 }, 400, Easing.easeOutBack);
      tw.setDelay(300 + i * 12);
      tw.onUpdate(() => {
        this.termIntensity[i] = state.v;
        this.render();
      });
      this.renderer.addTween(tw);
    });
    void gen;
  }

  /** Filter animation: move the selected category into a readable centered grid. */
  private animateFilter(): void {
    const filter = this.selectedFilter;
    const isFocused = filter !== "全部";
    this.renderer.clearAnimations();

    // Starting a new category focus from the overview gives the selected group
    // a clear journey into the center instead of swapping layouts in place.
    if (isFocused) this.focusProgress = 0;
    const focusState = { v: this.focusProgress };
    const focusTween = new Tween(focusState, { v: isFocused ? 1 : 0 }, 520, Easing.easeInOutCubic);
    focusTween.onUpdate(() => {
      this.focusProgress = focusState.v;
      this.render();
    });
    this.renderer.addTween(focusTween);

    for (const cat of CATEGORIES) {
      const targetOpacity = filter === "全部" || filter === cat ? 1 : 0;
      const targetScale = filter === cat ? 1.18 : 1;
      const state = { o: this.clusterOpacity[cat] ?? 0, s: this.clusterScale[cat] ?? 1 };
      const tw = new Tween(state, { o: targetOpacity, s: targetScale }, 450, Easing.easeInOutCubic);
      tw.onUpdate(() => {
        this.clusterOpacity[cat] = state.o;
        this.clusterScale[cat] = state.s;
        this.render();
      });
      this.renderer.addTween(tw);
    }
    this.render();
  }

  /** Position a term in the selected category's readable grid. */
  private getFocusGridPosition(index: number, total: number): { x: number; y: number; cellW: number; cellH: number } {
    const w = this.width;
    const h = this.height;
    const compact = w < 560;
    const minCellW = compact ? 82 : 108;
    const columns = Math.max(2, Math.min(total, Math.floor((w - 28) / minCellW)));
    const rows = Math.ceil(total / columns);
    const gridLeft = 14;
    const gridRight = w - 14;
    const cellW = (gridRight - gridLeft) / columns;
    const top = 98;
    const bottom = h - 58;
    const cellH = Math.max(29, Math.min(compact ? 38 : 58, (bottom - top) / Math.max(1, rows)));
    const gridHeight = cellH * rows;
    const offsetY = Math.max(0, ((bottom - top) - gridHeight) / 2);
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      x: gridLeft + cellW * (col + 0.5),
      y: top + offsetY + cellH * (row + 0.5),
      cellW,
      cellH,
    };
  }

  /** Whether a term matches the current search text. */
  private termMatchesSearch(term: Term): boolean {
    if (!this.searchText) return true;
    return (
      term.zh.toLowerCase().includes(this.searchText) ||
      term.en.toLowerCase().includes(this.searchText)
    );
  }

  private renderLoading(): void {
    this.scene.clear();
    const t = new Text("正在加载术语...", this.width / 2, this.height / 2, 16);
    t.fillStyle = COLORS.textDim;
    this.scene.add(t);
    this.renderer.renderOnce();
  }

  private renderError(err: unknown): void {
    this.scene.clear();
    const msg = err instanceof Error ? err.message : String(err);
    const t = new Text(`API 错误: ${msg}`, this.width / 2, this.height / 2, 14);
    t.fillStyle = COLORS.negative;
    this.scene.add(t);
    this.renderer.renderOnce();
  }

  private render(): void {
    this.scene.clear();
    if (this.loading) {
      this.renderLoading();
      return;
    }

    // Reset hit lists each frame; they are repopulated as nodes are drawn.
    this.termHits = [];

    const w = this.width;
    const h = this.height;
    const filter = this.selectedFilter;
    const searching = this.searchText.length > 0;

    // --- Title ---
    const compact = w < 560;
    const title = new Text(
      compact ? "AI 术语图谱" : "AI 术语图谱 (按类别聚类)",
      compact ? 16 : w / 2,
      28,
      compact ? 16 : 18,
    );
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    if (compact) title.align = "left";
    this.scene.add(title);

    // --- Group terms by category ---
    const byCat: Record<string, Term[]> = {};
    for (const cat of CATEGORIES) byCat[cat] = [];
    this.terms.forEach((term) => {
      if (byCat[term.category]) byCat[term.category].push(term);
    });

    // Global term index lookup for intensity state.
    const termIndex = new Map<Term, number>();
    this.terms.forEach((t, i) => termIndex.set(t, i));

    const focused = filter !== "全部";

    // --- Draw each cluster ---
    for (const cat of CATEGORIES) {
      const center = this.clusterCenters[cat];
      if (!center) continue;
      const info = CATEGORY_INFO[cat];
      const opacity = this.clusterOpacity[cat] ?? 0;
      const scale = this.clusterScale[cat] ?? 1;
      if (opacity <= 0.01) continue;

      const isSelected = filter === cat;
      const isFaded = filter !== "全部" && !isSelected;

      const terms = byCat[cat];
      const selectedTerms = byCat[filter] ?? [];
      const termList = isSelected && focused ? selectedTerms : terms;

      // Glowing center label (the category name).
      const centerX = isSelected && focused ? lerp(center.x, w / 2, this.focusProgress) : center.x;
      const centerY = isSelected && focused ? lerp(center.y, 68, this.focusProgress) : center.y;
      if (isSelected && focused) {
        const headerW = lerp(60, compact ? 88 : 104, this.focusProgress);
        const headerH = lerp(32, 36, this.focusProgress);
        const header = new Rect(centerX, centerY, headerW, headerH, 8);
        header.fillStyle = `hsla(${info.hue}, 70%, 28%, 0.42)`;
        header.strokeStyle = info.color;
        header.lineWidth = 1.5;
        header.opacity = opacity;
        this.scene.add(header);

        const headerLabel = new Text(cat, centerX, centerY, compact ? 12 : 13);
        headerLabel.fillStyle = COLORS.text;
        headerLabel.fontWeight = "bold";
        headerLabel.opacity = opacity;
        this.scene.add(headerLabel);
      } else {
        const centerNode = new GlowNode(centerX, centerY, 30);
        centerNode.intensity = isSelected ? 1 : isFaded ? 0.3 : 0.7;
        centerNode.hue = info.hue;
        centerNode.glowScale = isSelected ? 3.5 : 2.5;
        centerNode.label = cat;
        centerNode.labelSize = 11;
        centerNode.opacity = opacity;
        this.scene.add(centerNode);
      }

      // Overview terms use a compact ring. Focused terms move into a centered
      // grid with larger labels so the selected category can be read at a glance.
      const ringR = 58 * scale;
      termList.forEach((term, i) => {
        const angle = (i / Math.max(1, termList.length)) * Math.PI * 2;
        const overviewX = center.x + Math.cos(angle) * ringR;
        const overviewY = center.y + Math.sin(angle) * ringR;
        const focusPosition = isSelected && focused
          ? this.getFocusGridPosition(i, termList.length)
          : null;
        const layoutT = isSelected && focused ? this.focusProgress : 0;
        const tx = focusPosition ? lerp(overviewX, focusPosition.x, layoutT) : overviewX;
        const ty = focusPosition ? lerp(overviewY, focusPosition.y, layoutT) : overviewY;
        const idx = termIndex.get(term) ?? 0;
        const intensity = this.termIntensity[idx] ?? 0;
        if (intensity <= 0.001) return;

        const matchesSearch = this.termMatchesSearch(term);
        // A term is dimmed if the search filter excludes it.
        const searchDimmed = searching && !matchesSearch;

        const focusedTile = isSelected && focused;
        const tileOpacity = focusedTile ? opacity * Math.max(0.08, this.focusProgress) : 0;
        let hitWidth: number | undefined;
        let hitHeight: number | undefined;
        if (focusedTile) {
          const tileW = Math.max(52, focusPosition!.cellW - (w < 560 ? 8 : 12));
          const tileH = Math.max(25, focusPosition!.cellH - (w < 560 ? 5 : 8));
          hitWidth = tileW;
          hitHeight = tileH;
          const tile = new Rect(tx, ty, tileW, tileH, 8);
          tile.fillStyle = `hsla(${info.hue}, 70%, 28%, ${0.34 * tileOpacity})`;
          tile.strokeStyle = info.color;
          tile.lineWidth = 1;
          tile.opacity = tileOpacity * intensity * (searchDimmed ? 0.3 : 1);
          this.scene.add(tile);

          const maxChars = Math.max(4, Math.floor(tileW / (w < 560 ? 10.5 : 11.5)));
          const labelSize = w < 560 ? 10.5 : 12;
          const labelLines = splitTermLabel(term.zh, maxChars);
          labelLines.forEach((line, lineIndex) => {
            const lineY = ty + (lineIndex - (labelLines.length - 1) / 2) * (labelSize + 2);
            const focusLabel = new Text(line, tx, lineY, labelSize);
            focusLabel.fillStyle = COLORS.text;
            focusLabel.opacity = tileOpacity * intensity * (searchDimmed ? 0.38 : 1);
            focusLabel.fontWeight = "bold";
            this.scene.add(focusLabel);
          });
        }

        if (!focusedTile) {
          const node = new GlowNode(tx, ty, TERM_NODE_RADIUS);
          const baseIntensity = isSelected ? 0.9 : isFaded ? 0.25 : 0.55;
          node.intensity = (searchDimmed ? baseIntensity * 0.25 : baseIntensity) * intensity;
          node.hue = info.hue;
          node.glowScale = isSelected ? 2.6 : 2;
          node.opacity = opacity * (searchDimmed ? 0.4 : 1);
          this.scene.add(node);

          // Abbreviated term label in overview mode.
          const abbr = abbreviate(term.zh, 3);
          const lbl = new Text(abbr, tx, ty + 24, 9);
          lbl.fillStyle = isSelected ? COLORS.text : COLORS.textDim;
          lbl.opacity = opacity * intensity * (searchDimmed ? 0.4 : 1);
          lbl.fontWeight = isSelected ? "bold" : "normal";
          this.scene.add(lbl);
        }

        // Register a hit target for click-to-detail. Only register terms that
        // are visible enough to interact with (not search-dimmed out).
        if (!searchDimmed) {
          this.termHits.push({
            term,
            x: tx,
            y: ty,
            radius: TERM_NODE_RADIUS,
            width: hitWidth,
            height: hitHeight,
          });
        }
      });
    }

    // --- Legend ---
    const legendY = h - 42;
    let lx = 40;
    for (const cat of focused ? [filter] : CATEGORIES) {
      const info = CATEGORY_INFO[cat];
      const dot = new GlowNode(lx + 6, legendY, 6);
      dot.intensity = 0.8;
      dot.hue = info.hue;
      dot.glowScale = 2;
      this.scene.add(dot);
      const lab = new Text(cat, lx + 18, legendY, 11);
      lab.fillStyle = cat === filter ? COLORS.highlight : COLORS.text;
      lab.align = "left";
      lab.fontWeight = cat === filter ? "bold" : "normal";
      this.scene.add(lab);
      lx += 18 + cat.length * 12 + 22;
    }

    // --- Count + note ---
    const searchMatchCount = searching
      ? this.terms.filter((t) => this.termMatchesSearch(t)).length
      : this.terms.length;
    const countVisible = filter === "全部"
      ? searchMatchCount
      : this.terms.filter((t) => t.category === filter && (!searching || this.termMatchesSearch(t))).length;
    const countText = new Text(
      searching ? `匹配 ${countVisible} / ${this.terms.length} 个术语` : `共 ${countVisible} 个术语`,
      w - 40,
      legendY,
      11,
    );
    countText.fillStyle = searching ? COLORS.accent : COLORS.highlight;
    countText.fontWeight = "bold";
    countText.align = "right";
    this.scene.add(countText);

    const noteText = searching
      ? "搜索匹配的术语保持高亮 · 点击术语查看详情"
      : filter === "全部"
        ? "术语按类别聚类排布 · 点击术语查看详情"
        : `已聚焦: ${filter} · 其它类别已隐藏 · 点击术语查看详情`;
    const note = new Text(noteText, w / 2, h - 18, 12);
    note.fillStyle = COLORS.textDim;
    this.scene.add(note);

    // --- Detail panel overlay ---
    if (this.selectedTerm) {
      this.renderDetailPanel();
    }

    this.renderer.renderOnce();
  }

  /** Draw the semi-transparent backdrop + detail card on the canvas. */
  private renderDetailPanel(): void {
    const w = this.width;
    const h = this.height;
    const term = this.selectedTerm!;
    const info = CATEGORY_INFO[term.category] ?? { color: COLORS.edge, hue: 200 };
    const reveal = this.panelReveal;

    // Reset related-term hit targets each panel render.
    this.relatedHits = [];
    this.closeHit = null;

    // --- Semi-transparent backdrop covering the full canvas ---
    const backdrop = new Rect(w / 2, h / 2, w, h, 0);
    backdrop.fillStyle = `rgba(8,10,14,${0.55 * reveal})`;
    backdrop.opacity = reveal;
    this.scene.add(backdrop);

    // --- Detail card ---
    const cardW = Math.min(480, w - 48);
    const cardH = Math.min(420, h - 64);
    const cardX = w / 2;
    const cardY = h / 2;

    const card = new Rect(cardX, cardY, cardW, cardH, 12);
    card.fillStyle = "#161b22";
    card.strokeStyle = info.color;
    card.lineWidth = 1.5;
    card.opacity = reveal;
    this.scene.add(card);

    const padX = cardX - cardW / 2 + 24;
    let cy = cardY - cardH / 2 + 30;

    // --- Close button (top-right of card) ---
    const closeX = cardX + cardW / 2 - 22;
    const closeY = cardY - cardH / 2 + 22;
    const closeBtn = new GlowNode(closeX, closeY, 12);
    closeBtn.intensity = 0.8;
    closeBtn.hue = 0;
    closeBtn.glowScale = 2;
    closeBtn.label = "×";
    closeBtn.labelSize = 16;
    closeBtn.opacity = reveal;
    this.scene.add(closeBtn);
    this.closeHit = { x: closeX, y: closeY, radius: 12 };

    const closeHint = new Text("关闭", closeX - 30, closeY, 10);
    closeHint.fillStyle = COLORS.textDim;
    closeHint.opacity = reveal;
    closeHint.align = "right";
    this.scene.add(closeHint);

    // --- Loading state ---
    if (this.detailLoading || !this.detailTerm) {
      const loading = new Text("正在加载术语详情...", cardX, cardY, 14);
      loading.fillStyle = COLORS.textDim;
      loading.opacity = reveal;
      this.scene.add(loading);
      return;
    }

    const detail = this.detailTerm;

    // --- Term zh name (large) ---
    const name = new Text(detail.zh, padX, cy, 26);
    name.fillStyle = COLORS.text;
    name.fontWeight = "bold";
    name.align = "left";
    name.opacity = reveal;
    this.scene.add(name);
    cy += 30;

    // --- English name ---
    const en = new Text(detail.en, padX, cy, 14);
    en.fillStyle = info.color;
    en.fontFamily = "monospace";
    en.align = "left";
    en.opacity = reveal;
    this.scene.add(en);
    cy += 26;

    // --- Category badge (colored) ---
    const badgeW = detail.category.length * 14 + 28;
    const badge = new Rect(padX + badgeW / 2, cy, badgeW, 24, 12);
    badge.fillStyle = info.color;
    badge.opacity = 0.22 * reveal;
    badge.strokeStyle = info.color;
    badge.lineWidth = 1.5;
    this.scene.add(badge);
    const badgeText = new Text(detail.category, padX + badgeW / 2, cy, 12);
    badgeText.fillStyle = info.color;
    badgeText.fontWeight = "bold";
    badgeText.opacity = reveal;
    this.scene.add(badgeText);
    cy += 38;

    // --- Short description ---
    const shortLabel = new Text("简介", padX, cy, 12);
    shortLabel.fillStyle = COLORS.highlight;
    shortLabel.fontWeight = "bold";
    shortLabel.align = "left";
    shortLabel.opacity = reveal;
    this.scene.add(shortLabel);
    cy += 20;

    const shortLines = wrapText(detail.short, cardW - 48, 13);
    shortLines.slice(0, 2).forEach((line) => {
      const lt = new Text(line, padX, cy, 13);
      lt.fillStyle = COLORS.text;
      lt.align = "left";
      lt.opacity = reveal;
      this.scene.add(lt);
      cy += 18;
    });
    cy += 8;

    // --- Detailed explanation ---
    const detailLabel = new Text("详细解释", padX, cy, 12);
    detailLabel.fillStyle = COLORS.accent2;
    detailLabel.fontWeight = "bold";
    detailLabel.align = "left";
    detailLabel.opacity = reveal;
    this.scene.add(detailLabel);
    cy += 20;

    const detailPanelTop = cy;
    const detailPanelH = cardY + cardH / 2 - detailPanelTop - 24;
    const innerW = cardW - 48;
    const detailLines = wrapText(detail.detail, innerW, 13);
    const lineH = 18;
    const maxLines = Math.max(1, Math.floor(detailPanelH / lineH));
    detailLines.slice(0, maxLines).forEach((line, i) => {
      const lt = new Text(line, padX, detailPanelTop + i * lineH, 13);
      lt.fillStyle = COLORS.text;
      lt.align = "left";
      lt.opacity = reveal;
      this.scene.add(lt);
    });
    if (detailLines.length > maxLines) {
      const more = new Text(
        `… (共 ${detailLines.length} 行)`,
        padX,
        detailPanelTop + maxLines * lineH,
        11,
      );
      more.fillStyle = COLORS.textDim;
      more.align = "left";
      more.opacity = reveal;
      this.scene.add(more);
    }

    // --- Related terms (same category, excluding current) ---
    const relatedTop = detailPanelTop + Math.min(detailLines.length, maxLines) * lineH + 16;
    if (relatedTop < cardY + cardH / 2 - 30) {
      const relLabel = new Text("相关术语 (同类别 · 点击跳转)", padX, relatedTop, 12);
      relLabel.fillStyle = COLORS.highlight;
      relLabel.fontWeight = "bold";
      relLabel.align = "left";
      relLabel.opacity = reveal;
      this.scene.add(relLabel);

      const related = this.terms
        .filter((t) => t.category === detail.category && t.id !== detail.id)
        .slice(0, 6);
      let rx = padX;
      const ry = relatedTop + 22;
      const chipGap = 12;
      for (const rel of related) {
        const relInfo = CATEGORY_INFO[rel.category] ?? info;
        const chipLabel = rel.zh;
        const chipW = Math.max(chipLabel.length * 12 + 18, 44);
        if (rx + chipW > cardX + cardW / 2 - 24) break;

        const chipNode = new GlowNode(rx + chipW / 2, ry, RELATED_NODE_RADIUS);
        chipNode.intensity = 0.7;
        chipNode.hue = relInfo.hue;
        chipNode.glowScale = 2;
        chipNode.opacity = reveal;
        this.scene.add(chipNode);

        const chipText = new Text(abbreviate(chipLabel, 4), rx + chipW / 2, ry + RELATED_NODE_RADIUS + 12, 10);
        chipText.fillStyle = COLORS.text;
        chipText.opacity = reveal;
        this.scene.add(chipText);

        this.relatedHits.push({
          term: rel,
          x: rx + chipW / 2,
          y: ry,
          radius: RELATED_NODE_RADIUS + 4,
        });
        rx += chipW + chipGap;
      }
    }
  }

  /** Open the detail panel for a term, fetching full details. */
  private openDetail(term: Term): void {
    if (this.selectedTerm && this.selectedTerm.id === term.id) {
      // Toggle closed if the same term is clicked again.
      this.closeDetail();
      return;
    }
    this.selectedTerm = term;
    this.detailTerm = null;
    this.detailLoading = true;
    this.detailRequestedId = term.id;
    this.panelReveal = 0;
    this.renderer.clearAnimations();

    // Animate the panel reveal.
    const state = { v: 0 };
    const tw = new Tween(state, { v: 1 }, 250, Easing.easeOutCubic);
    tw.onUpdate(() => {
      this.panelReveal = state.v;
      this.render();
    });
    this.renderer.addTween(tw);
    this.render();

    // Fetch full details (with abort support).
    void this.fetchDetail(term.id);
  }

  private async fetchDetail(id: number): Promise<void> {
    try {
      const term = await fetchTerm(id, this.getAbortSignal());
      // Ignore stale responses.
      if (this.detailRequestedId !== id) return;
      this.detailTerm = term;
      this.detailLoading = false;
      this.render();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (this.detailRequestedId !== id) return;
      // Fall back to the summary term data already in hand.
      this.detailLoading = false;
      this.render();
    }
  }

  /** Close the detail panel. */
  private closeDetail(): void {
    const state = { v: this.panelReveal };
    const tw = new Tween(state, { v: 0 }, 200, Easing.easeInCubic);
    tw.onUpdate(() => {
      this.panelReveal = state.v;
      this.render();
    });
    tw.onComplete(() => {
      this.selectedTerm = null;
      this.detailTerm = null;
      this.detailLoading = false;
      this.detailRequestedId = -1;
      this.render();
    });
    this.renderer.addTween(tw);
  }

  /** Handle a canvas click: open detail / navigate related / close panel. */
  private handleClick(x: number, y: number): void {
    // If the detail panel is open, handle close + related-term chips first.
    if (this.selectedTerm) {
      if (this.closeHit && distance(x, y, this.closeHit.x, this.closeHit.y) <= this.closeHit.radius) {
        this.closeDetail();
        return;
      }
      for (const hit of this.relatedHits) {
        if (distance(x, y, hit.x, hit.y) <= hit.radius) {
          // Navigate to the related term.
          this.openDetail(hit.term);
          return;
        }
      }
      // Clicks outside the card also close it (but not on a term node behind
      // the panel would be blocked by the backdrop; allow closing on backdrop).
      return;
    }

    // No panel open: check term node hits.
    let best: TermHit | null = null;
    let bestDist = Infinity;
    for (const hit of this.termHits) {
      const d = distance(x, y, hit.x, hit.y);
      if (isPointInTermHit(x, y, hit) && d < bestDist) {
        bestDist = d;
        best = hit;
      }
    }
    if (best) {
      this.openDetail(best.term);
    }
  }

  /** Update cursor style based on hover for affordance. */
  private handleHover(x: number, y: number): void {
    let overClickable = false;
    if (this.selectedTerm) {
      if (this.closeHit && distance(x, y, this.closeHit.x, this.closeHit.y) <= this.closeHit.radius) {
        overClickable = true;
      }
      for (const hit of this.relatedHits) {
        if (distance(x, y, hit.x, hit.y) <= hit.radius) {
          overClickable = true;
          break;
        }
      }
    } else {
      for (const hit of this.termHits) {
        if (isPointInTermHit(x, y, hit)) {
          overClickable = true;
          break;
        }
      }
    }
    this.canvas.style.cursor = overClickable ? "pointer" : "default";
  }

  // Override resize to recompute layout on container size changes.
  resize(): void {
    super.resize();
    this.computeClusterLayout();
    this.render();
  }
}

/** Euclidean distance helper. */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

function isPointInTermHit(x: number, y: number, hit: TermHit): boolean {
  if (hit.width && hit.height) {
    return Math.abs(x - hit.x) <= hit.width / 2 && Math.abs(y - hit.y) <= hit.height / 2;
  }
  return distance(x, y, hit.x, hit.y) <= hit.radius;
}

/** Abbreviate a Chinese term name to at most maxLen characters. */
function abbreviate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.substring(0, maxLen);
}

/** Keep focused term names complete while limiting them to two readable lines. */
function splitTermLabel(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const splitAt = Math.ceil(text.length / 2);
  return [text.slice(0, splitAt), text.slice(splitAt)];
}

/** Greedy word-wrap of `text` into lines no wider than maxWidthPx.

Approximates character width: ~fontSize*1.0 px per CJK char and ~fontSize*0.55
per ASCII char. This avoids a Canvas measureText call and is reasonable for
the mostly-Chinese backend text.
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
