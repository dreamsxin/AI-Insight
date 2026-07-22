/** RNNSequenceViz - unrolls a recurrent network through time.

Draws a row of RNN cells (GlowNodes), one per time step. A GLOWING BALL (memory
ball, animated Particle) travels from one cell to the next; its intensity
DECREASES as it travels further (memory-fading metaphor). The current step cell
PULSES with an expanding GlowPulse ring. Each cell receives an input x_t from
below and a hidden state h_{t-1} from the left, emitting h_t to the right.

Formula: h_t = f(W·x_t + U·h_{t-1} + b)
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Arrow } from "@/canvas/shapes/Arrow";
import { GlowNode } from "@/canvas/shapes/GlowNode";
import { GlowPulse } from "@/canvas/shapes/GlowPulse";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";
import { COLORS } from "@/utils/color";

const TOKENS = ["我", "爱", "深", "度", "学", "习", "语", "言"];

/** Hue of the memory ball (purple), fading toward dark. */
const MEMORY_HUE = 265;

export class RNNSequenceViz extends BaseVisualization {
  /** Shared state: the ball travels from the first cell to the current step. */
  private ball = { progress: 0 };
  /** Expanding pulse ring at the current cell. */
  private pulse = { p: 0, active: false };
  private ballRunning = false;
  private ballGen = 0;
  private layout: { cx: number[]; rowY: number; cellW: number; cellH: number } = {
    cx: [],
    rowY: 0,
    cellW: 80,
    cellH: 56,
  };

  onMount(): void {
    this.computeLayout();
    this.render();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "step") {
      // Restart the memory-ball animation toward the new current step.
      this.animateBall();
    } else if (key === "seq_len") {
      this.ballGen++;
      this.renderer.clearAnimations();
      this.ballRunning = false;
      this.ball.progress = 0;
      this.pulse.active = false;
      this.computeLayout();
      this.setVisualizationStatus("idle");
      this.render();
    } else {
      this.render();
    }
  }

  onUnmount(): void {
    this.ballGen++;
    this.ballRunning = false;
    this.renderer.clearAnimations();
  }

  private get seqLen(): number {
    return Math.max(3, Math.min(8, Math.floor(this.controls["seq_len"] ?? 5)));
  }

  private get currentStep(): number {
    return Math.max(0, Math.min(this.seqLen - 1, Math.floor(this.controls["step"] ?? 0)));
  }

  private computeLayout(): void {
    const w = this.width;
    const h = this.height;
    const n = this.seqLen;
    const cellW = Math.min(92, (w - 80) / n);
    const cellH = 60;
    const rowY = h / 2 + 8;
    const totalW = n * cellW + (n - 1) * 22;
    const startX = (w - totalW) / 2 + cellW / 2;
    const cx: number[] = [];
    for (let t = 0; t < n; t++) cx.push(startX + t * (cellW + 22));
    this.layout = { cx, rowY, cellW, cellH };
  }

  /** Animate the memory ball from cell 0 to the current step, fading as it goes. */
  private animateBall(): void {
    const gen = ++this.ballGen;
    this.renderer.clearAnimations();
    this.setVisualizationStatus("running");
    const cur = this.currentStep;
    const cx = this.layout.cx;
    if (cx.length === 0) {
      this.setVisualizationStatus("completed");
      return;
    }

    if (cur === 0) {
      this.ball.progress = 1;
      this.render();
      this.pulseTarget(gen);
      return;
    }

    // Travel from cell 0 to cell `cur`.
    this.ball.progress = 0;
    this.ballRunning = true;
    const tw = new Tween(this.ball, { progress: 1 }, 350 + cur * 160, Easing.easeInOutCubic);
    tw.onUpdate(() => this.render());
    tw.onComplete(() => {
      if (gen !== this.ballGen) return;
      this.ballRunning = false;
      this.render();
      this.pulseTarget(gen);
    });
    this.renderer.addTween(tw);
  }

  private pulseTarget(gen: number): void {
    this.pulse = { p: 0, active: true };
    const pulseState = { p: 0 };
    const pulseTw = new Tween(pulseState, { p: 1 }, 700, Easing.easeOutCubic);
    pulseTw.onUpdate(() => {
      this.pulse.p = pulseState.p;
      this.render();
    });
    pulseTw.onComplete(() => {
      if (gen !== this.ballGen) return;
      this.pulse.active = false;
      this.setVisualizationStatus("completed");
      this.render();
    });
    this.renderer.addTween(pulseTw);
  }

  /** Ball intensity: full at the source, fading toward 0.25 as distance grows. */
  private ballIntensity(): number {
    if (!this.ballRunning) return 0;
    const t = this.ball.progress;
    const cur = this.currentStep;
    const fade = cur <= 1 ? 1 : 1 - (cur - 1) * 0.11;
    return Math.max(0.25, fade) * (0.5 + 0.5 * t);
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const n = this.seqLen;
    const cur = this.currentStep;
    const { cx, rowY, cellW, cellH } = this.layout;

    // Title
    const title = new Text("RNN 展开图: 循环神经网络按时间步展开", w / 2, 28, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    // --- Memory metaphor label ---
    const metaphor = new Text("🧠 记忆球 = 之前的信息，每传一步就变暗", w / 2, 54, 14);
    metaphor.fillStyle = COLORS.highlight;
    this.scene.add(metaphor);

    // --- Hidden-state arrows + memory ball path ---
    for (let t = 1; t < n; t++) {
      const isPast = t <= cur;
      const isCurrentEdge = t === cur && this.ballRunning;
      const hArrow = new Arrow(cx[t - 1] + cellW / 2, rowY, cx[t] - cellW / 2, rowY, 8);
      hArrow.strokeStyle = isCurrentEdge ? COLORS.highlight : isPast ? COLORS.accent2 : COLORS.edge;
      hArrow.lineWidth = isCurrentEdge ? 2.5 : isPast ? 2 : 1;
      hArrow.opacity = isPast ? 1 : 0.4;
      this.scene.add(hArrow);

      const hPrev = new Text(`h${sub(t - 1)}`, (cx[t - 1] + cx[t]) / 2, rowY - 14, 11);
      hPrev.fillStyle = COLORS.accent2;
      hPrev.fontFamily = "monospace";
      hPrev.opacity = isPast ? 1 : 0.4;
      this.scene.add(hPrev);
    }

    // --- Memory ball traveling along the path from cell 0 to current step ---
    if (this.ballRunning && cur > 0) {
      const segLen = cx[1] - cx[0];
      const ballX = cx[0] + this.ball.progress * (cur * (cellW / 2 + segLen / 2 + cellW / 2));
      this.drawMemoryBall(ballX, rowY, this.ballIntensity());
    }

    // --- Cells ---
    for (let t = 0; t < n; t++) {
      const isCurrent = t === cur;
      const isPast = t < cur;
      const isFuture = t > cur;
      const dim = isCurrent ? 1 : isPast ? 0.6 : 0.35;

      // Input x_t
      const inputY = rowY + cellH / 2 + 50;
      const inputArrow = new Arrow(cx[t], inputY, cx[t], rowY + cellH / 2 + 4, 8);
      inputArrow.strokeStyle = isCurrent ? COLORS.accent : COLORS.edge;
      inputArrow.lineWidth = isCurrent ? 2.5 : 1.5;
      inputArrow.opacity = dim;
      this.scene.add(inputArrow);

      const token = TOKENS[t] ?? "•";
      const xLabel = new Text(`x${sub(t)}`, cx[t], inputY + 16, 13);
      xLabel.fillStyle = isCurrent ? COLORS.accent : COLORS.textDim;
      xLabel.opacity = dim;
      this.scene.add(xLabel);

      const tokLabel = new Text(token, cx[t], inputY + 34, 14);
      tokLabel.fillStyle = isCurrent ? COLORS.highlight : COLORS.text;
      tokLabel.fontWeight = isCurrent ? "bold" : "normal";
      tokLabel.opacity = dim;
      this.scene.add(tokLabel);

      // RNN cell as a GlowNode
      const node = new GlowNode(cx[t], rowY, cellW / 2.4);
      node.intensity = isCurrent ? 1 : isPast ? 0.55 : 0.2;
      node.hue = isCurrent ? 180 : isPast ? 265 : 210;
      node.label = `RNN`;
      node.labelSize = 12;
      node.glowScale = isCurrent ? 2.8 : 2.2;
      node.opacity = dim;
      this.scene.add(node);

      // Hidden state label inside the cell
      const hLabel = new Text(`h${sub(t)}`, cx[t], rowY + 14, 11);
      hLabel.fillStyle = COLORS.text;
      hLabel.fontFamily = "monospace";
      hLabel.opacity = dim;
      this.scene.add(hLabel);

      // Output arrow (only the current cell emits a visible output)
      if (t === cur) {
        const outArrow = new Arrow(cx[t], rowY - cellH / 2, cx[t], rowY - cellH / 2 - 40, 8);
        outArrow.strokeStyle = COLORS.accent3;
        outArrow.lineWidth = 2.5;
        this.scene.add(outArrow);

        const outLabel = new Text(`y${sub(t)}`, cx[t], rowY - cellH / 2 - 52, 13);
        outLabel.fillStyle = COLORS.accent3;
        outLabel.fontWeight = "bold";
        this.scene.add(outLabel);
      }

      // GlowPulse ring on the current cell
      if (isCurrent && this.pulse.active) {
        const pulse = new GlowPulse(cx[t], rowY, cellW * 1.2, 180);
        pulse.progress = this.pulse.p;
        pulse.lineWidth = 2.5;
        this.scene.add(pulse);
      }

      // Time-step label
      const tLabel = new Text(`t=${t}`, cx[t], rowY + cellH / 2 + 12, 11);
      tLabel.fillStyle = COLORS.textDim;
      tLabel.opacity = dim;
      this.scene.add(tLabel);

      // Fading hint for future cells
      if (isFuture) {
        const fade = new Text("(待计算)", cx[t], rowY - cellH / 2 - 14, 9);
        fade.fillStyle = COLORS.textDim;
        fade.opacity = 0.5;
        this.scene.add(fade);
      }
    }

    // --- Formula at the bottom ---
    const formula = new Text("hₜ = f(W·xₜ + U·hₜ₋₁ + b)", w / 2, h - 38, 16);
    formula.fillStyle = COLORS.accent;
    formula.fontFamily = "monospace";
    formula.fontWeight = "bold";
    this.scene.add(formula);

    const hint = new Text(
      cur === n - 1 ? "当前: 最后一步 (记忆累积最多)" : `当前步: t=${cur} (高亮脉冲) · 记忆球从 t=0 传到此处`,
      w / 2,
      h - 16,
      12,
    );
    hint.fillStyle = COLORS.textDim;
    this.scene.add(hint);

    this.renderer.renderOnce();
  }

  /** Draw the glowing memory ball + its fading trail. */
  private drawMemoryBall(x: number, y: number, intensity: number): void {
    const cx = this.layout.cx;
    const cur = this.currentStep;
    // Trail of faded copies behind the ball along the path.
    for (let i = 1; i <= 6; i++) {
      const t = Math.max(0, this.ball.progress - i * 0.06);
      const segLen = cx.length > 1 ? cx[1] - cx[0] : 0;
      const tx = cx[0] + t * (cur * (this.layout.cellW / 2 + segLen / 2 + this.layout.cellW / 2));
      if (tx >= cx[0] - 5) {
        const trail = new GlowNode(tx, y, 7);
        trail.intensity = intensity * (1 - i / 7) * 0.5;
        trail.hue = MEMORY_HUE;
        trail.glowScale = 1.8;
        this.scene.add(trail);
      }
    }
    // The ball itself.
    const ball = new GlowNode(x, y, 11);
    ball.intensity = intensity;
    ball.hue = MEMORY_HUE;
    ball.glowScale = 3.2;
    this.scene.add(ball);
  }

  // Override resize to recompute layout on container size changes.
  resize(): void {
    super.resize();
    this.computeLayout();
    this.render();
  }
}

/** Convert a digit to a Unicode subscript string (for h₀, h₁, …). */
function sub(n: number): string {
  const subs = "₀₁₂₃₄₅₆₇₈₉";
  return String(n)
    .split("")
    .map((ch) => subs[Number(ch)] ?? ch)
    .join("");
}
