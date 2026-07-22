/** AttentionConceptViz - shows how attention lets every word attend to all others.

Draws 6 word nodes (GlowNodes) in a horizontal row. When a "focus" word is
selected, CONE-SHAPED light beams (spotlights) are drawn from it to every other
word, and Particle objects flow along the curves to show "attention flowing".
Target words that receive high attention GLOW BRIGHTER. This contrasts with the
RNN's sequential information flow: attention gives every token direct access.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Rect } from "@/canvas/shapes/Rect";
import { Curve } from "@/canvas/shapes/Curve";
import { GlowNode } from "@/canvas/shapes/GlowNode";
import { Particle } from "@/canvas/shapes/Particle";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";
import { COLORS } from "@/utils/color";
import { softmax } from "@/utils/math";

const WORDS = ["我", "喜欢", "这", "美丽", "的", "世界"];

/** Spotlight hue (amber). */
const SPOT_HUE = 45;

export class AttentionConceptViz extends BaseVisualization {
  /** Shared state: a single flowing progress value 0->1 (looped). */
  private flow = { progress: 0 };
  private flowGen = 0;
  private nodePositions: { x: number; y: number }[] = [];

  onMount(): void {
    this.computePositions();
    this.startFlowLoop();
    this.render();
  }

  onControlChange(_key: string, _value: number): void {
    // Reset the flow loop and restart for a fresh spotlight effect.
    this.startFlowLoop();
    this.render();
  }

  onUnmount(): void {
    this.renderer.clearAnimations();
  }

  private computePositions(): void {
    const w = this.width;
    const h = this.height;
    const n = WORDS.length;
    const rowY = h * 0.5 + 10;
    const padX = 80;
    const span = w - padX * 2;
    const spacing = n > 1 ? span / (n - 1) : 0;
    this.nodePositions = [];
    for (let i = 0; i < n; i++) {
      this.nodePositions.push({ x: padX + i * spacing, y: rowY });
    }
  }

  private get focus(): number {
    return Math.max(0, Math.min(WORDS.length - 1, Math.floor(this.controls["focus"] ?? 0)));
  }

  /** Loop the flowing particles forever (reset + re-add on completion). */
  private startFlowLoop(): void {
    const gen = ++this.flowGen;
    this.renderer.clearAnimations();
    this.setVisualizationStatus("running");
    this.flow.progress = 0;
    const tw = new Tween(this.flow, { progress: 1 }, 1400, Easing.linear);
    tw.onUpdate(() => this.render());
    tw.onComplete(() => {
      if (gen !== this.flowGen) return;
      tw.reset();
      this.renderer.addTween(tw);
    });
    this.renderer.addTween(tw);
  }

  /** Compute attention weights from the focus word to all others. */
  private computeWeights(): { weights: number[]; focus: number } {
    const n = WORDS.length;
    const focus = this.focus;
    const raw: number[] = [];
    for (let j = 0; j < n; j++) {
      if (j === focus) {
        raw.push(0);
        continue;
      }
      const dist = Math.abs(j - focus);
      const positional = 1 / (1 + dist * 0.8);
      const ripple = 0.5 + 0.5 * Math.sin((focus + 1) * (j + 1) * 0.9);
      raw.push(positional * 0.7 + ripple * 0.3);
    }
    const others = raw.filter((_, j) => j !== focus);
    const sm = softmax(others);
    const weights: number[] = [];
    let k = 0;
    for (let j = 0; j < n; j++) {
      weights.push(j === focus ? 0 : sm[k++]);
    }
    return { weights, focus };
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const n = WORDS.length;

    // Title
    const title = new Text("注意力机制: 每个词可以直接关注所有词", w / 2, 30, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    // --- Spotlight metaphor label ---
    const metaphor = new Text("💡 注意力 = 聚光灯，每个词都能照亮其他词", w / 2, 56, 14);
    metaphor.fillStyle = COLORS.highlight;
    this.scene.add(metaphor);

    const focus = this.focus;
    const focusPos = this.nodePositions[focus];
    const { weights } = this.computeWeights();
    const nodeR = 24;

    // --- Cone-shaped spotlight beams from the focus word ---
    for (let j = 0; j < n; j++) {
      if (j === focus) continue;
      const wt = weights[j];
      const target = this.nodePositions[j];

      // Curve path (arch above the row)
      const midX = (focusPos.x + target.x) / 2;
      const archHeight = 90 + Math.abs(j - focus) * 22;
      const cpY = focusPos.y - archHeight;
      const curve = new Curve(focusPos.x, focusPos.y - nodeR, target.x, target.y - nodeR);
      curve.setControlPoints(midX, cpY, midX, cpY);
      curve.strokeStyle = `hsla(${SPOT_HUE}, 90%, 60%, ${0.3 + wt * 0.6})`;
      curve.lineWidth = 1 + wt * 8;
      this.scene.add(curve);

      // Cone-shaped spotlight beam: a filled triangle from focus to target (wide at source).
      this.drawCone(focusPos.x, focusPos.y, target.x, target.y, wt, SPOT_HUE);

      // Flowing particle along the curve (attention flowing toward the target).
      const prog = (this.flow.progress + j * 0.18) % 1;
      const [px, py] = this.bezierPoint(
        focusPos.x, focusPos.y - nodeR,
        midX, cpY, midX, cpY,
        target.x, target.y - nodeR,
        prog,
      );
      const particle = new Particle(px, py, px, py, 3 + wt * 2, SPOT_HUE);
      particle.progress = 1;
      particle.opacity = 0.4 + wt * 0.6;
      particle.showTrail = false;
      this.scene.add(particle);

      // Weight label near the target
      const wtLbl = new Text(`${(wt * 100).toFixed(0)}%`, target.x, target.y - nodeR - 30, 11);
      wtLbl.fillStyle = COLORS.accent2;
      wtLbl.fontFamily = "monospace";
      this.scene.add(wtLbl);

      // Weight bar beneath the word
      const barW = 36;
      const barH = 4;
      const bar = new Rect(target.x, target.y + nodeR + 28, barW, barH, 2);
      bar.fillStyle = "rgba(255,255,255,0.08)";
      bar.strokeStyle = "transparent";
      this.scene.add(bar);
      const fillW = barW * wt;
      const fill = new Rect(target.x - barW / 2 + fillW / 2, target.y + nodeR + 28, fillW, barH, 2);
      fill.fillStyle = COLORS.accent2;
      fill.strokeStyle = "transparent";
      this.scene.add(fill);
    }

    // --- Word nodes (GlowNodes; high-attention targets glow brighter) ---
    for (let i = 0; i < n; i++) {
      const pos = this.nodePositions[i];
      const isFocus = i === focus;
      const wt = isFocus ? 0 : weights[i];

      const node = new GlowNode(pos.x, pos.y, nodeR);
      node.intensity = isFocus ? 1 : 0.25 + wt * 0.75;
      node.hue = isFocus ? SPOT_HUE : 190 + wt * 40;
      node.glowScale = isFocus ? 3 : 2 + wt * 1.5;
      node.label = WORDS[i];
      node.labelSize = 14;
      this.scene.add(node);

      // Word index below
      const idxLabel = new Text(`#${i}`, pos.x, pos.y + nodeR + 14, 10);
      idxLabel.fillStyle = COLORS.textDim;
      this.scene.add(idxLabel);
    }

    // "Query" label on the focus word
    const queryLabel = new Text("Query (聚光灯)", focusPos.x, focusPos.y - nodeR - 50, 12);
    queryLabel.fillStyle = COLORS.highlight;
    queryLabel.fontWeight = "bold";
    this.scene.add(queryLabel);

    // --- Bottom explanation ---
    const explain = new Text("每个词可以直接关注所有词", w / 2, h - 50, 16);
    explain.fillStyle = COLORS.accent;
    explain.fontWeight = "bold";
    this.scene.add(explain);

    const detail = new Text(
      `当前 Query = "${WORDS[focus]}"  •  光束越粗 = 注意力权重越大（直接连接，无需逐步传递）`,
      w / 2,
      h - 28,
      12,
    );
    detail.fillStyle = COLORS.textDim;
    this.scene.add(detail);

    this.renderer.renderOnce();
  }

  /** Draw a cone-shaped spotlight beam (wide at the source, narrowing at target). */
  private drawCone(
    sx: number, sy: number,
    tx: number, ty: number,
    weight: number,
    hue: number,
  ): void {
    const dx = tx - sx;
    const dy = ty - sy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // Perpendicular unit vector
    const px = -dy / len;
    const py = dx / len;
    const sourceHalf = 14; // wide at the source
    const targetHalf = 3 + weight * 4; // narrow at the target
    const alpha = 0.05 + weight * 0.13;

    // We approximate the cone with a few stacked quads via save/transform-less triangles.
    // Canvas has no polygon shape in our lib, so draw it via the renderer's context using
    // a temporary Curve won't fill; instead we layer 3 thin Rects oriented along the beam.
    // Simplest robust approach: layer translucent lines (Line) of decreasing length.
    // To keep it dependency-light, we draw several short Rect segments fanning out.
    const steps = 5;
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      const half0 = sourceHalf + (targetHalf - sourceHalf) * t0;
      const half1 = sourceHalf + (targetHalf - sourceHalf) * t1;
      const mx0 = sx + dx * t0;
      const my0 = sy + dy * t0;
      const mx1 = sx + dx * t1;
      const my1 = sy + dy * t1;
      // Two edges as a thin quad: approximate with a Rect spanning midpoint, scaled.
      const midX = (mx0 + mx1) / 2;
      const midY = (my0 + my1) / 2;
      const segLen = Math.sqrt((mx1 - mx0) ** 2 + (my1 - my0) ** 2);
      const segHalf = (half0 + half1) / 2;
      const angle = Math.atan2(dy, dx);
      // Use a Rect rotated to align with the beam.
      const rect = new Rect(midX, midY, segLen, segHalf * 2, 0);
      rect.rotation = angle;
      rect.fillStyle = `hsla(${hue}, 90%, 62%, ${alpha})`;
      rect.strokeStyle = "transparent";
      this.scene.add(rect);
    }
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

  // Override resize to recompute positions on container size changes.
  resize(): void {
    super.resize();
    this.computePositions();
    this.render();
  }
}
