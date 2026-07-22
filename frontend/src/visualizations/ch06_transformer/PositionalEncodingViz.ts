/** PositionalEncodingViz - sinusoidal positional encoding with barcodes & waves.

Each position gets a unique "barcode" visualization (a row of colored bars derived
from its PE vector). Below the barcodes, sin/cos WAVES animate: a glowing dot
travels along each wave, looping. Different positions have visually different
barcodes, illustrating how the sinusoidal encoding gives each position a unique
identity.

Formula: PE(pos, 2i) = sin(pos/10000^(2i/d)),  PE(pos, 2i+1) = cos(...)
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Rect } from "@/canvas/shapes/Rect";
import { Line } from "@/canvas/shapes/Line";
import { Circle } from "@/canvas/shapes/Circle";
import { GlowNode } from "@/canvas/shapes/GlowNode";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";
import { colormap } from "@/utils/colormap";
import { COLORS } from "@/utils/color";

const SEQ_LEN = 12; // positions 0..11 (fewer rows so barcodes are legible)
const BARCODE_DIMS = 16; // bars per barcode

export class PositionalEncodingViz extends BaseVisualization {
  /** Shared state: the traveling wave dot progress 0->1 (looped). */
  private wave = { progress: 0 };
  private waveGen = 0;

  onMount(): void {
    this.startWaveLoop();
    this.render();
  }

  onControlChange(_key: string, _value: number): void {
    this.render();
  }

  onUnmount(): void {
    this.renderer.clearAnimations();
  }

  private get dim(): number {
    // step 8, range 8..64
    const d = Math.floor(this.controls["dim"] ?? 16);
    return Math.max(8, Math.min(64, Math.round(d / 8) * 8));
  }

  private get pos(): number {
    return Math.max(0, Math.min(SEQ_LEN - 1, Math.floor(this.controls["pos"] ?? 0)));
  }

  /** Loop the wave-dot animation forever. */
  private startWaveLoop(): void {
    const gen = ++this.waveGen;
    this.renderer.clearAnimations();
    this.setVisualizationStatus("running");
    this.wave.progress = 0;
    const tw = new Tween(this.wave, { progress: 1 }, 3000, Easing.linear);
    tw.onUpdate(() => this.render());
    tw.onComplete(() => {
      if (gen !== this.waveGen) return;
      tw.reset();
      this.renderer.addTween(tw);
    });
    this.renderer.addTween(tw);
  }

  /** Compute sinusoidal PE matching backend transformer.positional_encoding. */
  private computePE(dim: number): number[][] {
    const pe: number[][] = [];
    for (let p = 0; p < SEQ_LEN; p++) {
      const row = new Array(dim).fill(0);
      const half = Math.floor(dim / 2);
      const divTerm = new Array(half);
      for (let i = 0; i < half; i++) {
        divTerm[i] = Math.exp((2 * i) * (-Math.log(10000.0) / dim));
      }
      for (let i = 0; i < half; i++) {
        row[2 * i] = Math.sin(p * divTerm[i]);
        if (2 * i + 1 < dim) {
          row[2 * i + 1] = Math.cos(p * divTerm[i]);
        }
      }
      pe.push(row);
    }
    return pe;
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const dim = this.dim;
    const pos = this.pos;
    const pe = this.computePE(dim);

    // --- Title ---
    const title = new Text("位置编码: 用正弦/余弦表示位置", w / 2, 26, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    // --- Metaphor label ---
    const metaphor = new Text("🪪 给每个位置一个独特的身份证号", w / 2, 50, 14);
    metaphor.fillStyle = COLORS.highlight;
    this.scene.add(metaphor);

    // --- Formula ---
    const formula = new Text("PE(pos, 2i) = sin(pos / 10000^(2i/d))", w / 2, 72, 13);
    formula.fillStyle = COLORS.accent2;
    formula.fontFamily = "monospace";
    this.scene.add(formula);

    // --- Barcode layout: one barcode per position ---
    const bcTop = 96;
    const bcBottom = h * 0.52;
    const bcH = (bcBottom - bcTop) / SEQ_LEN;
    const barW = Math.min(18, (w - 160) / BARCODE_DIMS);
    const totalW = BARCODE_DIMS * barW;
    const bcLeft = w / 2 - totalW / 2;

    for (let p = 0; p < SEQ_LEN; p++) {
      const y = bcTop + p * bcH + bcH / 2;
      const isSel = p === pos;

      // Position label
      const plbl = new Text(`pos ${p}`, bcLeft - 40, y, 10);
      plbl.fillStyle = isSel ? COLORS.highlight : COLORS.textDim;
      plbl.fontWeight = isSel ? "bold" : "normal";
      this.scene.add(plbl);

      // Highlight the selected row
      if (isSel) {
        const hl = new Rect(w / 2, y, totalW + 60, bcH - 2, 3);
        hl.fillStyle = "rgba(251, 191, 36, 0.12)";
        hl.strokeStyle = COLORS.highlight;
        hl.lineWidth = 1.5;
        this.scene.add(hl);
      }

      // Draw the barcode bars from the PE vector (first BARCODE_DIMS dims).
      for (let d = 0; d < BARCODE_DIMS; d++) {
        const val = pe[p][d] ?? 0;
        const t = (val + 1) / 2; // [-1,1] -> [0,1]
        const barHeight = (bcH - 4) * (0.2 + t * 0.8);
        const bar = new Rect(bcLeft + d * barW + barW / 2, y, barW - 2, barHeight, 1);
        bar.fillStyle = colormap(t, isSel ? 1 : 0.65);
        bar.strokeStyle = "transparent";
        this.scene.add(bar);
      }
    }

    // --- Animated sin/cos waves below ---
    this.drawWaves(pe, w, h, dim, pos);

    // --- Bottom hint ---
    const hint = new Text(`dim = ${dim}  •  每行是一个位置的"条形码"  •  高亮: pos=${pos}`, w / 2, h - 12, 12);
    hint.fillStyle = COLORS.textDim;
    this.scene.add(hint);

    this.renderer.renderOnce();
  }

  /** Draw animated sin/cos waves with a glowing dot traveling along each. */
  private drawWaves(pe: number[][], w: number, h: number, dim: number, pos: number): void {
    const wavesTop = h * 0.58;
    const wavesH = h * 0.34;
    const left = 80;
    const right = w - 80;
    const plotW = right - left;

    const curves: { dimIdx: number; color: string; label: string; yOffset: number }[] = [
      { dimIdx: 0, color: COLORS.accent, label: "sin (dim 0, 高频)", yOffset: 0 },
      { dimIdx: 1, color: COLORS.accent3, label: "cos (dim 1, 高频)", yOffset: 0 },
    ];
    if (dim >= 4) {
      curves.push(
        { dimIdx: 2, color: COLORS.accent2, label: "sin (dim 2, 低频)", yOffset: 0 },
        { dimIdx: 3, color: COLORS.positive, label: "cos (dim 3, 低频)", yOffset: 0 },
      );
    }

    // Lay out wave rows vertically.
    const rowH = wavesH / curves.length;
    for (let ci = 0; ci < curves.length; ci++) {
      const c = curves[ci];
      const cy = wavesTop + ci * rowH + rowH / 2;
      const amp = rowH / 2 - 8;

      // baseline axis
      const axis = new Line(left, cy, right, cy);
      axis.strokeStyle = COLORS.textDim;
      axis.lineWidth = 1;
      axis.opacity = 0.4;
      this.scene.add(axis);

      // Wave polyline
      const pts: { x: number; y: number }[] = [];
      for (let p = 0; p < pe.length; p++) {
        const x = left + (p / (pe.length - 1)) * plotW;
        const val = pe[p][c.dimIdx] ?? 0;
        const y = cy - val * amp;
        pts.push({ x, y });
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const seg = new Line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        seg.strokeStyle = c.color;
        seg.lineWidth = 2;
        this.scene.add(seg);
      }

      // Glowing dot traveling along the wave (looping).
      const prog = this.wave.progress;
      const idxF = prog * (pts.length - 1);
      const i0 = Math.floor(idxF);
      const i1 = Math.min(pts.length - 1, i0 + 1);
      const frac = idxF - i0;
      const dotX = pts[i0].x + (pts[i1].x - pts[i0].x) * frac;
      const dotY = pts[i0].y + (pts[i1].y - pts[i0].y) * frac;

      const dotHue = c.color === COLORS.accent ? 180 : c.color === COLORS.accent3 ? 25 : c.color === COLORS.accent2 ? 265 : 120;
      const dot = new GlowNode(dotX, dotY, 6);
      dot.intensity = 1;
      dot.hue = dotHue;
      dot.glowScale = 3;
      this.scene.add(dot);

      // Label
      const lbl = new Text(c.label, left, wavesTop + ci * rowH + 4, 10);
      lbl.fillStyle = COLORS.textDim;
      lbl.align = "left";
      this.scene.add(lbl);
    }

    // Vertical line marking the selected position across all waves.
    const px = left + (pos / (pe.length - 1)) * plotW;
    const pline = new Line(px, wavesTop, px, wavesTop + wavesH);
    pline.strokeStyle = COLORS.highlight;
    pline.lineWidth = 1.5;
    pline.opacity = 0.6;
    this.scene.add(pline);

    // A small position marker dot on the first wave.
    const markerCy = wavesTop + rowH / 2;
    const markerVal = pe[pos][0] ?? 0;
    const amp0 = rowH / 2 - 8;
    const marker = new Circle(px, markerCy - markerVal * amp0, 4);
    marker.fillStyle = COLORS.highlight;
    marker.strokeStyle = "transparent";
    this.scene.add(marker);
  }
}
