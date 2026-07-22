/** EmbeddingSpaceViz - 2D scatter plot of word embeddings.

A "category" select chooses which cluster of words to show: 动物, 颜色, 国家,
or 混合 (all combined). Points are drawn as Circles with labels, colored per
category. A few dashed lines connect similar words to illustrate clustering,
and the note "相似词的向量距离更近" is shown at the bottom.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Circle } from "@/canvas/shapes/Circle";
import { Line } from "@/canvas/shapes/Line";
import { COLORS } from "@/utils/color";

interface WordPoint {
  word: string;
  x: number;
  y: number;
  category: string;
}

const CAT_ANIMAL = "动物";
const CAT_COLOR = "颜色";
const CAT_COUNTRY = "国家";

/** Per-category color. */
const CATEGORY_COLOR: Record<string, string> = {
  [CAT_ANIMAL]: COLORS.accent,
  [CAT_COLOR]: COLORS.accent3,
  [CAT_COUNTRY]: COLORS.positive,
};

/** Predefined 2D coordinates (already projected). */
const POINTS: WordPoint[] = [
  // 动物
  { word: "猫", x: 1, y: 2, category: CAT_ANIMAL },
  { word: "狗", x: 1.5, y: 2.2, category: CAT_ANIMAL },
  { word: "鸟", x: 3, y: 4, category: CAT_ANIMAL },
  { word: "鱼", x: 2.5, y: 3, category: CAT_ANIMAL },
  { word: "马", x: 0.5, y: 1, category: CAT_ANIMAL },
  { word: "虎", x: 1.2, y: 1.5, category: CAT_ANIMAL },
  // 颜色
  { word: "红", x: 5, y: 1, category: CAT_COLOR },
  { word: "橙", x: 5.5, y: 1.5, category: CAT_COLOR },
  { word: "黄", x: 6, y: 2, category: CAT_COLOR },
  { word: "绿", x: 5.2, y: 2.5, category: CAT_COLOR },
  { word: "蓝", x: 6.5, y: 1, category: CAT_COLOR },
  { word: "紫", x: 5.8, y: 2.8, category: CAT_COLOR },
  // 国家
  { word: "中国", x: 8, y: 3, category: CAT_COUNTRY },
  { word: "美国", x: 9, y: 3.5, category: CAT_COUNTRY },
  { word: "日本", x: 8.5, y: 2.5, category: CAT_COUNTRY },
  { word: "韩国", x: 8.2, y: 3.2, category: CAT_COUNTRY },
  { word: "法国", x: 9.5, y: 4, category: CAT_COUNTRY },
  { word: "英国", x: 9.2, y: 3.8, category: CAT_COUNTRY },
];

const CATEGORY_OPTIONS: string[] = [CAT_ANIMAL, CAT_COLOR, CAT_COUNTRY, "混合"];

/** Pairs of similar words to connect with dashed lines (same category). */
const SIMILAR_PAIRS: [string, string][] = [
  ["猫", "狗"],
  ["猫", "虎"],
  ["鸟", "鱼"],
  ["红", "橙"],
  ["黄", "绿"],
  ["中国", "韩国"],
  ["美国", "英国"],
  ["法国", "英国"],
];

export class EmbeddingSpaceViz extends BaseVisualization {
  onMount(): void {
    this.render();
  }

  onControlChange(_key: string, _value: number): void {
    this.render();
  }

  private get categoryIndex(): number {
    const v = Math.floor(this.controls["category"] ?? 0);
    return Math.max(0, Math.min(CATEGORY_OPTIONS.length - 1, v));
  }

  private get selectedCategory(): string {
    return CATEGORY_OPTIONS[this.categoryIndex];
  }

  /** Points visible given the current category filter. */
  private visiblePoints(): WordPoint[] {
    const cat = this.selectedCategory;
    if (cat === "混合") return POINTS;
    return POINTS.filter((p) => p.category === cat);
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const cat = this.selectedCategory;

    // --- Title ---
    const title = new Text("嵌入空间: 2D 词向量分布", w / 2, 30, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    // --- Plot area ---
    const padL = 70;
    const padR = 40;
    const padT = 70;
    const padB = 80;
    const plotX0 = padL;
    const plotY0 = padT;
    const plotX1 = w - padR;
    const plotY1 = h - padB;
    const plotW = plotX1 - plotX0;
    const plotH = plotY1 - plotY0;

    // Data bounds. Keep a fixed overall range so the layout is stable across
    // category switches; only widen if a single category needs more room.
    const pts = this.visiblePoints();
    let minX = 0;
    let maxX = 10;
    let minY = 0;
    let maxY = 5;
    if (cat !== "混合") {
      // Tighten bounds to the selected cluster for a closer view.
      let lx = Infinity, hx = -Infinity, ly = Infinity, hy = -Infinity;
      for (const p of pts) {
        if (p.x < lx) lx = p.x;
        if (p.x > hx) hx = p.x;
        if (p.y < ly) ly = p.y;
        if (p.y > hy) hy = p.y;
      }
      if (pts.length > 0) {
        minX = lx - 1;
        maxX = hx + 1;
        minY = ly - 1;
        maxY = hy + 1;
      }
    }

    const toPx = (x: number): number => plotX0 + ((x - minX) / (maxX - minX)) * plotW;
    const toPy = (y: number): number => plotY1 - ((y - minY) / (maxY - minY)) * plotH;

    // --- Background grid lines ---
    const xStep = niceStep(maxX - minX);
    const yStep = niceStep(maxY - minY);
    for (let gx = Math.ceil(minX / xStep) * xStep; gx <= maxX; gx += xStep) {
      const px = toPx(gx);
      const gl = new Line(px, plotY0, px, plotY1);
      gl.strokeStyle = "rgba(255,255,255,0.04)";
      gl.lineWidth = 1;
      this.scene.add(gl);
      const lab = new Text(fmtTick(gx), px, plotY1 + 16, 10);
      lab.fillStyle = COLORS.textDim;
      this.scene.add(lab);
    }
    for (let gy = Math.ceil(minY / yStep) * yStep; gy <= maxY; gy += yStep) {
      const py = toPy(gy);
      const gl = new Line(plotX0, py, plotX1, py);
      gl.strokeStyle = "rgba(255,255,255,0.04)";
      gl.lineWidth = 1;
      this.scene.add(gl);
      const lab = new Text(fmtTick(gy), plotX0 - 14, py, 10);
      lab.fillStyle = COLORS.textDim;
      this.scene.add(lab);
    }

    // --- Axes ---
    const xAxis = new Line(plotX0, plotY1, plotX1, plotY1);
    xAxis.strokeStyle = COLORS.textDim;
    xAxis.lineWidth = 1.5;
    this.scene.add(xAxis);
    const yAxis = new Line(plotX0, plotY0, plotX0, plotY1);
    yAxis.strokeStyle = COLORS.textDim;
    yAxis.lineWidth = 1.5;
    this.scene.add(yAxis);

    const xAxLabel = new Text("维度 1", (plotX0 + plotX1) / 2, plotY1 + 34, 11);
    xAxLabel.fillStyle = COLORS.textDim;
    this.scene.add(xAxLabel);
    const yAxLabel = new Text("维度 2", plotX0 - 44, (plotY0 + plotY1) / 2, 11);
    yAxLabel.fillStyle = COLORS.textDim;
    yAxLabel.rotation = -Math.PI / 2;
    this.scene.add(yAxLabel);

    // --- Dashed cluster lines (between similar pairs) ---
    for (const [a, b] of SIMILAR_PAIRS) {
      const pa = pts.find((p) => p.word === a);
      const pb = pts.find((p) => p.word === b);
      if (!pa || !pb) continue;
      const ln = new Line(toPx(pa.x), toPy(pa.y), toPx(pb.x), toPy(pb.y));
      const col = CATEGORY_COLOR[pa.category] ?? COLORS.edge;
      ln.strokeStyle = col;
      ln.lineWidth = 1;
      ln.opacity = 0.35;
      // Dashed effect via small segments (Canvas API supports setLineDash, but
      // our Line shape does not expose it; emulate with low-opacity thin lines).
      this.scene.add(ln);
    }

    // --- Points ---
    for (const p of pts) {
      const col = CATEGORY_COLOR[p.category] ?? COLORS.text;
      const px = toPx(p.x);
      const py = toPy(p.y);

      // Halo
      const halo = new Circle(px, py, 9);
      halo.fillStyle = col;
      halo.opacity = 0.18;
      this.scene.add(halo);

      // Point
      const dot = new Circle(px, py, 5);
      dot.fillStyle = col;
      dot.strokeStyle = COLORS.bg;
      dot.lineWidth = 1.5;
      this.scene.add(dot);

      // Label (offset to the upper-right of the point)
      const lbl = new Text(p.word, px + 12, py - 10, 12);
      lbl.fillStyle = COLORS.text;
      lbl.align = "left";
      this.scene.add(lbl);
    }

    // --- Legend (categories present) ---
    const legendCats = cat === "混合" ? [CAT_ANIMAL, CAT_COLOR, CAT_COUNTRY] : [cat];
    let lx = plotX1 - 16;
    const ly = plotY0 + 10;
    // Right-align the legend entries.
    const legendEntries = legendCats.map((c) => ({ label: c, color: CATEGORY_COLOR[c] }));
    for (const e of legendEntries) {
      const tw = e.label.length * 13 + 28;
      const dot = new Circle(lx - tw + 10, ly, 5);
      dot.fillStyle = e.color;
      this.scene.add(dot);
      const lab = new Text(e.label, lx - tw + 22, ly, 11);
      lab.fillStyle = COLORS.text;
      lab.align = "left";
      this.scene.add(lab);
      lx -= tw + 12;
    }

    // --- Bottom note ---
    const note = new Text("相似词的向量距离更近", w / 2, h - 22, 13);
    note.fillStyle = COLORS.highlight;
    this.scene.add(note);

    this.renderer.renderOnce();
  }
}

/** Choose a "nice" axis step roughly dividing a range into ~5-7 ticks. */
function niceStep(range: number): number {
  const raw = range / 6;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow;
  let step: number;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  return step * pow;
}

/** Format an axis tick value compactly. */
function fmtTick(v: number): string {
  if (Math.abs(v) < 1e-9) return "0";
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(0);
  return v.toFixed(1);
}
