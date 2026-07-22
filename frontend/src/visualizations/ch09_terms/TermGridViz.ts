/** TermGridViz - shows AI terms arranged in clusters by category.

Terms are arranged in CLUSTERS (one per category), each with a GLOWING center
label (the category name). Terms are small GlowNodes colored by category. When
filtering, non-selected clusters FADE OUT (opacity animation) and the selected
cluster EXPANDS slightly. fetchTerms() retrieves all terms.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { GlowNode } from "@/canvas/shapes/GlowNode";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";
import { COLORS } from "@/utils/color";
import { fetchTerms } from "@/api/compute";
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
  private animGen = 0;

  onMount(): void {
    if (!this.loaded) {
      void this.fetchAndRender();
    } else {
      this.computeClusterLayout();
      this.animateIntro();
    }
  }

  onControlChange(_key: string, _value: number): void {
    this.animateFilter();
  }

  onUnmount(): void {
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
      const terms = await fetchTerms();
      this.terms = terms;
      this.loading = false;
      this.loaded = true;
      this.computeClusterLayout();
      this.animateIntro();
    } catch (err) {
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

  /** Filter animation: fade non-selected clusters out, expand the selected one. */
  private animateFilter(): void {
    const filter = this.selectedFilter;
    this.renderer.clearAnimations();
    for (const cat of CATEGORIES) {
      const targetOpacity = filter === "全部" || filter === cat ? 1 : 0.12;
      const targetScale = filter === cat ? 1.12 : 1;
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

    const w = this.width;
    const h = this.height;
    const filter = this.selectedFilter;

    // --- Title ---
    const title = new Text("AI 术语图谱 (按类别聚类)", w / 2, 28, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
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

      // Glowing center label (the category name).
      const centerNode = new GlowNode(center.x, center.y, 30);
      centerNode.intensity = isSelected ? 1 : isFaded ? 0.3 : 0.7;
      centerNode.hue = info.hue;
      centerNode.glowScale = isSelected ? 3.5 : 2.5;
      centerNode.label = cat;
      centerNode.labelSize = 11;
      centerNode.opacity = opacity;
      this.scene.add(centerNode);

      // Arrange terms in a small ring around the cluster center.
      const terms = byCat[cat];
      const ringR = 58 * scale;
      terms.forEach((term, i) => {
        const angle = (i / Math.max(1, terms.length)) * Math.PI * 2;
        const tx = center.x + Math.cos(angle) * ringR;
        const ty = center.y + Math.sin(angle) * ringR;
        const idx = termIndex.get(term) ?? 0;
        const intensity = this.termIntensity[idx] ?? 0;
        if (intensity <= 0.001) return;

        const node = new GlowNode(tx, ty, 16);
        node.intensity = (isSelected ? 0.9 : isFaded ? 0.25 : 0.55) * intensity;
        node.hue = info.hue;
        node.glowScale = isSelected ? 2.6 : 2;
        node.opacity = opacity;
        this.scene.add(node);

        // Abbreviated term label.
        const abbr = abbreviate(term.zh, 3);
        const lbl = new Text(abbr, tx, ty + 24, 9);
        lbl.fillStyle = isSelected ? COLORS.text : COLORS.textDim;
        lbl.opacity = opacity * intensity;
        lbl.fontWeight = isSelected ? "bold" : "normal";
        this.scene.add(lbl);
      });
    }

    // --- Legend ---
    const legendY = h - 42;
    let lx = 40;
    for (const cat of CATEGORIES) {
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
    const countVisible = filter === "全部"
      ? this.terms.length
      : this.terms.filter((t) => t.category === filter).length;
    const countText = new Text(`共 ${countVisible} 个术语`, w - 40, legendY, 11);
    countText.fillStyle = COLORS.highlight;
    countText.fontWeight = "bold";
    countText.align = "right";
    this.scene.add(countText);

    const note = new Text(
      filter === "全部" ? "术语按类别聚类排布 · 选中类别查看详情" : `已聚焦: ${filter} (其他类别淡出)`,
      w / 2,
      h - 18,
      12,
    );
    note.fillStyle = COLORS.textDim;
    this.scene.add(note);

    this.renderer.renderOnce();
  }

  // Override resize to recompute layout on container size changes.
  resize(): void {
    super.resize();
    this.computeClusterLayout();
    this.render();
  }
}

/** Abbreviate a Chinese term name to at most maxLen characters. */
function abbreviate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.substring(0, maxLen);
}
