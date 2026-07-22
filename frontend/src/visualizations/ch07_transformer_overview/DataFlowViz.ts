/** DataFlowViz - animates a token flowing through the Transformer.

Shows the pipeline stages (Token -> Embedding -> +Pos Enc -> Attention -> FFN
-> ... -> Output) as labeled Rects in a row with emoji icons. A "run" button
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
import { Timeline } from "@/canvas/animation/Timeline";
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
const STAGE_GAP = 40;

export class DataFlowViz extends BaseVisualization {
  /** Shared animation state: the particle's current x position and progress. */
  private animState: { x: number; glow: number } = { x: 0, glow: 0 };
  /** Particle endpoints for the current segment (drives the trail). */
  private particleFrom = 0;
  private particleTo = 0;
  /** GlowPulse ring state per active stage. */
  private pulseState = { p: 0, active: false, x: 0, hue: 180 };
  private stageCenters: number[] = [];
  private stageY = 0;
  private running = false;
  private activeStage = -1;
  private stageW = 120;

  onMount(): void {
    this.computeLayout();
    this.animState.x = this.stageCenters[0];
    this.render();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "run") {
      void this.runAnimation();
    }
  }

  onUnmount(): void {
    this.renderer.clearAnimations();
  }

  private computeLayout(): void {
    const w = this.width;
    const h = this.height;
    const n = STAGES.length;
    const stageW = Math.min(128, (w - STAGE_GAP * (n + 1)) / n);
    const totalW = n * stageW + (n - 1) * STAGE_GAP;
    const startX = (w - totalW) / 2 + stageW / 2;
    this.stageCenters = STAGES.map((_, i) => startX + i * (stageW + STAGE_GAP));
    this.stageY = h / 2;
    this.stageW = stageW;
  }

  private get blockH(): number {
    return 64;
  }

  /** Emit a GlowPulse ring at a stage. */
  private firePulse(x: number, hue: number): void {
    this.pulseState = { p: 0, active: true, x, hue };
    const s = { p: 0 };
    const tw = new Tween(s, { p: 1 }, 600, Easing.easeOutCubic);
    tw.onUpdate(() => {
      this.pulseState.p = s.p;
      this.render();
    });
    tw.onComplete(() => {
      this.pulseState.active = false;
      this.render();
    });
    this.renderer.addTween(tw);
  }

  private async runAnimation(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.renderer.clearAnimations();

    const timeline = new Timeline();
    this.activeStage = 0;
    this.animState.glow = 1;
    this.particleFrom = this.stageCenters[0];
    this.particleTo = this.stageCenters[0];
    this.firePulse(this.stageCenters[0], STAGES[0].hue);
    this.render();

    // Build a tween per stage transition.
    for (let i = 0; i < this.stageCenters.length - 1; i++) {
      const fromX = this.stageCenters[i];
      const toX = this.stageCenters[i + 1];
      const tween = new Tween(this.animState, { x: toX, glow: 1 }, STAGE_HOVER_MS, Easing.easeInOutCubic);
      const stageIdx = i + 1;
      // Set up the particle's endpoints for the trail.
      this.particleFrom = fromX;
      this.particleTo = toX;
      tween.onUpdate(() => {
        const t = (this.animState.x - fromX) / (toX - fromX);
        this.activeStage = t > 0.5 ? stageIdx : stageIdx - 1;
        this.render();
      });
      tween.onComplete(() => {
        this.activeStage = stageIdx;
        this.firePulse(this.stageCenters[stageIdx], STAGES[stageIdx].hue);
        this.render();
      });
      timeline.add(tween, i * STAGE_HOVER_MS);
    }

    timeline.onComplete(() => {
      this.activeStage = this.stageCenters.length - 1;
      this.animState.glow = 1;
      this.render();
      // reset to idle after a pause so it can be replayed
      setTimeout(() => {
        this.running = false;
        this.activeStage = -1;
        this.pulseState.active = false;
        this.animState.x = this.stageCenters[0];
        this.animState.glow = 0;
        this.render();
      }, 1600);
    });

    this.renderer.addTimeline(timeline);
    timeline.play();
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
      const cx = this.stageCenters[i];
      const isActive = i === this.activeStage;
      const isPast = this.activeStage >= 0 && i < this.activeStage;
      const stage = STAGES[i];

      const r = new Rect(cx, this.stageY, this.stageW, this.blockH, 8);
      r.fillStyle = isActive
        ? "rgba(251, 191, 36, 0.2)"
        : isPast
          ? "rgba(0, 217, 255, 0.12)"
          : "rgba(255,255,255,0.04)";
      r.strokeStyle = isActive ? COLORS.highlight : isPast ? stage.color : COLORS.edge;
      r.lineWidth = isActive ? 3 : 1.5;
      this.scene.add(r);

      const num = new Text(`#${i}`, cx, this.stageY - this.blockH / 2 - 12, 10);
      num.fillStyle = isActive ? COLORS.highlight : COLORS.textDim;
      this.scene.add(num);

      // Emoji icon
      const icon = new Text(stage.icon, cx, this.stageY - 10, 22);
      icon.fillStyle = COLORS.text;
      this.scene.add(icon);

      const lbl = new Text(stage.label, cx, this.stageY + 14, 12);
      lbl.fillStyle = isActive ? COLORS.highlight : isPast ? COLORS.text : COLORS.textDim;
      lbl.fontWeight = isActive ? "bold" : "normal";
      this.scene.add(lbl);

      // Arrow to next stage
      if (i < STAGES.length - 1) {
        const nextCx = this.stageCenters[i + 1];
        const arr = new Arrow(
          cx + this.stageW / 2,
          this.stageY,
          nextCx - this.stageW / 2,
          this.stageY,
          7,
        );
        arr.strokeStyle = isPast ? COLORS.accent2 : COLORS.edge;
        arr.lineWidth = isPast ? 2 : 1.2;
        arr.opacity = isPast ? 1 : 0.5;
        this.scene.add(arr);
      }

      // GlowPulse ring on the active stage.
      if (isActive && this.pulseState.active && Math.abs(this.pulseState.x - cx) < 2) {
        const pulse = new GlowPulse(cx, this.stageY, this.stageW * 1.1, stage.hue);
        pulse.progress = this.pulseState.p;
        pulse.lineWidth = 3;
        this.scene.add(pulse);
      }
    }

    // --- The moving glowing particle (with trail) ---
    if (this.activeStage >= 0) {
      const hue = STAGES[Math.max(0, Math.min(STAGES.length - 1, this.activeStage))].hue;
      const particle = new Particle(
        this.particleFrom,
        this.stageY,
        this.particleTo,
        this.stageY,
        7,
        hue,
      );
      // progress within the current segment
      const segLen = this.particleTo - this.particleFrom;
      const segProgress = segLen !== 0 ? (this.animState.x - this.particleFrom) / segLen : 1;
      particle.progress = Math.max(0, Math.min(1, segProgress));
      particle.trailLength = 10;
      particle.opacity = this.animState.glow;
      this.scene.add(particle);
    }

    // --- Status line ---
    let statusText: string;
    if (this.running) {
      const stageName = this.activeStage >= 0 ? `${STAGES[this.activeStage].icon} ${STAGES[this.activeStage].label}` : "";
      statusText = `动画中... 当前阶段: ${stageName}`;
    } else {
      statusText = "点击播放动画";
    }
    const status = new Text(statusText, w / 2, this.stageY + this.blockH / 2 + 44, 14);
    status.fillStyle = this.running ? COLORS.accent : COLORS.textDim;
    status.fontWeight = this.running ? "bold" : "normal";
    this.scene.add(status);

    // --- Hint ---
    const hint = new Text(
      this.running ? "粒子(带拖尾)在各阶段间流动，每经过一个阶段就发光脉冲" : '按 "run" 按钮开始动画',
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
    if (this.activeStage < 0) {
      this.animState.x = this.stageCenters[0] ?? this.animState.x;
    }
    this.render();
  }
}
