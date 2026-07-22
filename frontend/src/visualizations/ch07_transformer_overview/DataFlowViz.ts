/** DataFlowViz - animates a token flowing through the Transformer.

Shows the pipeline stages (Token -> Embedding -> +Pos Enc -> Attention -> FFN
-> Output) as labeled Rects with emoji icons. A "run" button
triggers an animation where a glowing Particle (with trail) moves from stage to
stage. Each stage LIGHTS UP (GlowPulse expanding ring) when the particle passes
through. The particle leaves a GLOWING TRAIL behind it.

Initially shows "点击播放动画" until run is pressed.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Rect } from "@/canvas/shapes/Rect";
import { Arrow } from "@/canvas/shapes/Arrow";
import { Particle } from "@/canvas/shapes/Particle";
import { GlowPulse } from "@/canvas/shapes/GlowPulse";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";
import { COLORS } from "@/utils/color";

interface Stage {
  label: string;
  icon: string;
  color: string;
  hue: number;
}

const STAGES: Stage[] = [
  { label: "Token", icon: "📝", color: COLORS.accent, hue: 180 },
  { label: "Embedding", icon: "🔢", color: COLORS.accent2, hue: 265 },
  { label: "+ Pos Enc", icon: "➕", color: COLORS.accent3, hue: 25 },
  { label: "Attention", icon: "🔍", color: COLORS.accent, hue: 190 },
  { label: "FFN", icon: "⚙️", color: COLORS.accent3, hue: 35 },
  { label: "Output", icon: "📤", color: COLORS.positive, hue: 120 },
];

const STAGE_HOVER_MS = 450;

interface Point {
  x: number;
  y: number;
}

export class DataFlowViz extends BaseVisualization {
  private animState = { progress: 0, glow: 0 };
  private particleFrom: Point = { x: 0, y: 0 };
  private particleTo: Point = { x: 0, y: 0 };
  /** GlowPulse ring state per active stage. */
  private pulseState = { p: 0, active: false, x: 0, y: 0, hue: 180 };
  private stagePositions: Point[] = [];
  private running = false;
  private completed = false;
  private activeStage = -1;
  private stageW = 120;
  private runGeneration = 0;
  private pulseGeneration = 0;

  onMount(): void {
    this.computeLayout();
    this.resetFlow();
    this.render();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "run") {
      this.runAnimation();
    } else if (key === "speed") {
      this.cancelAnimation();
      this.resetFlow();
      this.setVisualizationStatus("idle");
      this.render();
    }
  }

  onUnmount(): void {
    this.runGeneration++;
    this.running = false;
    this.renderer.clearAnimations();
  }

  private get speed(): number {
    return Math.max(0.5, Math.min(2, this.controls["speed"] ?? 1));
  }

  private computeLayout(): void {
    const w = this.width;
    const h = this.height;
    if (w >= 680) {
      const gap = 18;
      this.stageW = Math.min(120, (w - 40 - gap * (STAGES.length - 1)) / STAGES.length);
      const totalW = STAGES.length * this.stageW + (STAGES.length - 1) * gap;
      const startX = (w - totalW) / 2 + this.stageW / 2;
      this.stagePositions = STAGES.map((_, i) => ({
        x: startX + i * (this.stageW + gap),
        y: h / 2,
      }));
      return;
    }

    const cols = 3;
    const gap = 14;
    this.stageW = Math.min(108, (w - 32 - gap * (cols - 1)) / cols);
    const totalW = cols * this.stageW + (cols - 1) * gap;
    const left = (w - totalW) / 2 + this.stageW / 2;
    const topY = Math.max(118, h * 0.36);
    const bottomY = Math.min(h - 112, h * 0.65);
    this.stagePositions = STAGES.map((_, i) => {
      const row = Math.floor(i / cols);
      const colInRow = i % cols;
      const col = row % 2 === 0 ? colInRow : cols - 1 - colInRow;
      return {
        x: left + col * (this.stageW + gap),
        y: row === 0 ? topY : bottomY,
      };
    });
  }

  private get blockH(): number {
    return 64;
  }

  /** Emit a GlowPulse ring at a stage. */
  private firePulse(point: Point, hue: number): void {
    const generation = ++this.pulseGeneration;
    this.pulseState = { p: 0, active: true, x: point.x, y: point.y, hue };
    const s = { p: 0 };
    const tw = new Tween(s, { p: 1 }, 600, Easing.easeOutCubic);
    tw.onUpdate(() => {
      if (generation !== this.pulseGeneration) return;
      this.pulseState.p = s.p;
      this.render();
    });
    tw.onComplete(() => {
      if (generation !== this.pulseGeneration) return;
      this.pulseState.active = false;
      this.render();
    });
    this.renderer.addTween(tw);
  }

  private runAnimation(): void {
    if (this.running) return;
    if (this.stagePositions.length !== STAGES.length) return;
    const generation = ++this.runGeneration;
    this.running = true;
    this.completed = false;
    this.setVisualizationStatus("running");
    this.renderer.clearAnimations();
    this.activeStage = 0;
    this.animState.glow = 1;
    this.animState.progress = 0;
    this.particleFrom = { ...this.stagePositions[0] };
    this.particleTo = { ...this.stagePositions[0] };
    this.firePulse(this.stagePositions[0], STAGES[0].hue);
    this.render();
    this.animateSegment(0, generation);
  }

  private animateSegment(index: number, generation: number): void {
    if (generation !== this.runGeneration) return;
    if (index >= this.stagePositions.length - 1) {
      this.finishAnimation(generation);
      return;
    }

    const nextIndex = index + 1;
    this.particleFrom = { ...this.stagePositions[index] };
    this.particleTo = { ...this.stagePositions[nextIndex] };
    this.animState.progress = 0;
    const tween = new Tween(
      this.animState,
      { progress: 1, glow: 1 },
      STAGE_HOVER_MS / this.speed,
      Easing.easeInOutCubic,
    );
    tween.onUpdate(() => {
      this.activeStage = this.animState.progress >= 0.5 ? nextIndex : index;
      this.render();
    });
    tween.onComplete(() => {
      if (generation !== this.runGeneration) return;
      this.activeStage = nextIndex;
      this.firePulse(this.stagePositions[nextIndex], STAGES[nextIndex].hue);
      this.render();
      this.animateSegment(nextIndex, generation);
    });
    this.renderer.addTween(tween);
  }

  private finishAnimation(generation: number): void {
    const hold = { progress: 0 };
    const tween = new Tween(hold, { progress: 1 }, 520 / this.speed, Easing.linear);
    tween.onComplete(() => {
      if (generation !== this.runGeneration) return;
      this.running = false;
      this.completed = true;
      this.activeStage = STAGES.length - 1;
      this.pulseState.active = false;
      this.setVisualizationStatus("completed");
      this.render();
    });
    this.renderer.addTween(tween);
  }

  private cancelAnimation(): void {
    this.runGeneration++;
    this.pulseGeneration++;
    this.running = false;
    this.renderer.clearAnimations();
  }

  private resetFlow(): void {
    const start = this.stagePositions[0] ?? { x: 0, y: 0 };
    this.completed = false;
    this.activeStage = -1;
    this.animState = { progress: 0, glow: 0 };
    this.particleFrom = { ...start };
    this.particleTo = { ...start };
    this.pulseGeneration++;
    this.pulseState.active = false;
  }

  private showCompletedFlow(): void {
    const lastIndex = STAGES.length - 1;
    this.completed = true;
    this.activeStage = lastIndex;
    this.animState = { progress: 1, glow: 1 };
    this.particleFrom = { ...this.stagePositions[lastIndex - 1] };
    this.particleTo = { ...this.stagePositions[lastIndex] };
    this.pulseState.active = false;
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;

    // --- Title ---
    const title = new Text("数据流: Token 在 Transformer 中的流动", w / 2, 28, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    // --- Stage boxes + connecting arrows ---
    for (let i = 0; i < STAGES.length; i++) {
      const point = this.stagePositions[i];
      const cx = point.x;
      const cy = point.y;
      const isActive = i === this.activeStage;
      const isPast = this.activeStage >= 0 && i < this.activeStage;
      const stage = STAGES[i];

      const r = new Rect(cx, cy, this.stageW, this.blockH, 8);
      r.fillStyle = isActive
        ? "rgba(251, 191, 36, 0.2)"
        : isPast
          ? "rgba(0, 217, 255, 0.12)"
          : "rgba(255,255,255,0.04)";
      r.strokeStyle = isActive ? COLORS.highlight : isPast ? stage.color : COLORS.edge;
      r.lineWidth = isActive ? 3 : 1.5;
      this.scene.add(r);

      const num = new Text(`#${i + 1}`, cx, cy - this.blockH / 2 - 10, 10);
      num.fillStyle = isActive ? COLORS.highlight : COLORS.textDim;
      this.scene.add(num);

      // Emoji icon
      const icon = new Text(stage.icon, cx, cy - 10, 22);
      icon.fillStyle = COLORS.text;
      this.scene.add(icon);

      const lbl = new Text(stage.label, cx, cy + 14, 12);
      lbl.fillStyle = isActive ? COLORS.highlight : isPast ? COLORS.text : COLORS.textDim;
      lbl.fontWeight = isActive ? "bold" : "normal";
      this.scene.add(lbl);

      // Arrow to next stage
      if (i < STAGES.length - 1) {
        const next = this.stagePositions[i + 1];
        const dx = next.x - cx;
        const dy = next.y - cy;
        const distance = Math.hypot(dx, dy) || 1;
        const insetX = (dx / distance) * (this.stageW / 2);
        const insetY = (dy / distance) * (this.blockH / 2);
        const arr = new Arrow(
          cx + insetX,
          cy + insetY,
          next.x - insetX,
          next.y - insetY,
          7,
        );
        arr.strokeStyle = isPast ? COLORS.accent2 : COLORS.edge;
        arr.lineWidth = isPast ? 2 : 1.2;
        arr.opacity = isPast ? 1 : 0.5;
        this.scene.add(arr);
      }

      // GlowPulse ring on the active stage.
      if (isActive && this.pulseState.active
        && Math.abs(this.pulseState.x - cx) < 2
        && Math.abs(this.pulseState.y - cy) < 2) {
        const pulse = new GlowPulse(cx, cy, this.stageW * 1.1, stage.hue);
        pulse.progress = this.pulseState.p;
        pulse.lineWidth = 3;
        this.scene.add(pulse);
      }
    }

    // --- The moving glowing particle (with trail) ---
    if (this.activeStage >= 0) {
      const hue = STAGES[Math.max(0, Math.min(STAGES.length - 1, this.activeStage))].hue;
      const particle = new Particle(
        this.particleFrom.x,
        this.particleFrom.y,
        this.particleTo.x,
        this.particleTo.y,
        7,
        hue,
      );
      particle.progress = this.animState.progress;
      particle.trailLength = 10;
      particle.opacity = this.animState.glow;
      this.scene.add(particle);
    }

    // --- Status line ---
    let statusText: string;
    if (this.running) {
      const stageName = this.activeStage >= 0 ? `${STAGES[this.activeStage].icon} ${STAGES[this.activeStage].label}` : "";
      statusText = `动画中... 当前阶段: ${stageName}`;
    } else if (this.completed) {
      statusText = "数据流已到达 Output";
    } else {
      statusText = "点击播放动画";
    }
    const maxStageY = Math.max(...this.stagePositions.map((point) => point.y));
    const statusY = Math.min(h - 46, maxStageY + this.blockH / 2 + 34);
    const status = new Text(statusText, w / 2, statusY, 14);
    status.fillStyle = this.running || this.completed ? COLORS.accent : COLORS.textDim;
    status.fontWeight = this.running || this.completed ? "bold" : "normal";
    this.scene.add(status);

    // --- Hint ---
    const hint = new Text(
      this.running ? "粒子在各阶段间流动，每经过一个阶段就发光脉冲" : "调整速度后可重新播放",
      w / 2,
      h - 18,
      12,
    );
    hint.fillStyle = COLORS.textDim;
    this.scene.add(hint);

    this.renderer.renderOnce();
  }

  // Override resize to recompute layout on container size changes.
  resize(): void {
    super.resize();
    this.computeLayout();
    if (this.running) {
      this.cancelAnimation();
      this.resetFlow();
      this.setVisualizationStatus("idle");
      this.renderer.start();
    } else if (this.completed) {
      this.showCompletedFlow();
    } else {
      this.resetFlow();
    }
    this.render();
  }
}
