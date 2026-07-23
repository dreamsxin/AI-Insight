/** GradientDescentViz - a glowing ball rolling into a 3D-looking bowl.

The loss surface is rendered as a pseudo-3D bowl using concentric
ellipses with radial gradient shading (top-down view but with depth
cues).  A glowing ball with a particle trail rolls downhill, its speed
proportional to the local gradient.  A live loss meter shows the current
value decreasing in real time.

Controls:
  - lr:  learning rate (0.01 - 1.0)
  - start_x: starting position on the loss surface (-3 to 3)
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Circle } from "@/canvas/shapes/Circle";
import { Line } from "@/canvas/shapes/Line";
import { Text } from "@/canvas/shapes/Text";
import { COLORS } from "@/utils/color";
import { clamp, lerp } from "@/utils/math";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";

interface TrailDot {
  x: number;
  y: number;
  opacity: number;
}

export class GradientDescentViz extends BaseVisualization {
  private ball = { x: 0, y: 0, loss: 0 };
  private trail: TrailDot[] = [];
  private trajectory: { x: number; y: number; loss: number }[] = [];
  private stepIdx = 0;
  private isAnimating = false;
  private currentLoss = 0;

  onMount(): void {
    this.computeTrajectory();
    this.ball.x = this.trajectory[0]?.x ?? 0;
    this.ball.y = this.trajectory[0]?.y ?? 0;
    this.ball.loss = this.trajectory[0]?.loss ?? 0;
    this.currentLoss = this.ball.loss;
    this.renderScene();
    this.setVisualizationStatus("running");
    this.startAnimation();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "lr" || key === "start_x") {
      this.renderer.clearAnimations();
      this.isAnimating = false; // reset so startAnimation() doesn't early-return
      this.setVisualizationStatus("running");
      this.trail = [];
      this.computeTrajectory();
      this.ball.x = this.trajectory[0]?.x ?? 0;
      this.ball.y = this.trajectory[0]?.y ?? 0;
      this.ball.loss = this.trajectory[0]?.loss ?? 0;
      this.currentLoss = this.ball.loss;
      this.stepIdx = 0;
      this.renderScene();
      this.startAnimation();
    }
  }

  private computeTrajectory(): void {
    const lr = this.controls["lr"] ?? 0.1;
    const startX = this.controls["start_x"] ?? 2;
    const startY = startX;

    this.trajectory = [];
    let px = startX;
    let py = startY;
    for (let i = 0; i < 40; i++) {
      const loss = px * px + py * py;
      this.trajectory.push({ x: px, y: py, loss });
      const gx = 2 * px;
      const gy = 2 * py;
      px = px - lr * gx;
      py = py - lr * gy;
      if (Math.abs(px) > 100 || Math.abs(py) > 100) break;
    }
  }

  private startAnimation(): void {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.stepIdx = 0;
    this.animateStep();
  }

  private animateStep(): void {
    if (!this.isAnimating || this.trajectory.length === 0) return;

    // Completion: the ball reached the last trajectory point or is near the
    // loss minimum. Hold the "completed" state briefly, then loop back to
    // "running" and restart the descent.
    if (this.stepIdx >= this.trajectory.length - 1 || this.currentLoss < 0.01) {
      this.setVisualizationStatus("completed");
      void this.waitForAnimation(2000).then(() => {
        if (!this.isAnimating) return;
        this.trail = [];
        this.stepIdx = 0;
        this.ball.x = this.trajectory[0].x;
        this.ball.y = this.trajectory[0].y;
        this.ball.loss = this.trajectory[0].loss;
        this.currentLoss = this.ball.loss;
        this.renderScene();
        this.setVisualizationStatus("running");
        this.animateStep();
      });
      return;
    }

    const next = this.trajectory[this.stepIdx + 1];
    if (!next) return;

    // Speed proportional to gradient (steeper = faster descent)
    const curLoss = this.trajectory[this.stepIdx].loss;
    const duration = clamp(250 + curLoss * 20, 150, 500);

    const state = { x: this.ball.x, y: this.ball.y, loss: this.currentLoss };
    const tween = new Tween(state, { x: next.x, y: next.y, loss: next.loss }, duration, Easing.easeInOutCubic);
    tween.onUpdate(() => {
      this.ball.x = state.x;
      this.ball.y = state.y;
      this.ball.loss = state.loss;
      this.currentLoss = state.loss;

      // Add trail dot
      if (Math.random() < 0.4) {
        this.trail.push({ x: state.x, y: state.y, opacity: 1 });
      }
      // Fade trail
      for (const dot of this.trail) {
        dot.opacity *= 0.96;
      }
      this.trail = this.trail.filter((d) => d.opacity > 0.02);

      this.renderScene();
    });
    tween.onComplete(() => {
      this.stepIdx++;
      this.animateStep();
    });
    this.renderer.addTween(tween);
  }

  onUnmount(): void {
    this.isAnimating = false;
  }

  private renderScene(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2 + 20;
    const scale = Math.min(w, h) / 14;

    // Title
    const title = new Text("梯度下降 · 小球滚向谷底", w / 2, 26, 16);
    title.fillStyle = COLORS.text;
    title.fontWeight = "bold";
    this.scene.add(title);

    // Draw pseudo-3D bowl: concentric ellipses with shading
    for (let i = 10; i >= 0; i--) {
      const t = i / 10;
      const rx = scale * (1 + t * 4);
      const ry = scale * 0.5 * (1 + t * 4);
      const intensity = 1 - t;
      const c = new Circle(cx, cy, rx);
      c.fillStyle = `hsla(260, 60%, ${5 + intensity * 12}%, 1)`;
      c.strokeStyle = `hsla(260, 70%, ${15 + intensity * 25}%, ${0.2 + intensity * 0.3})`;
      c.lineWidth = 1;
      c.scale = ry / rx;
      this.scene.add(c);
    }

    // Minimum marker
    const minCircle = new Circle(cx, cy, 6);
    minCircle.fillStyle = COLORS.positive;
    minCircle.strokeStyle = "#ffffff";
    minCircle.lineWidth = 2;
    this.scene.add(minCircle);

    const minLabel = new Text("✓ 最低点", cx, cy + 20, 12);
    minLabel.fillStyle = COLORS.positive;
    this.scene.add(minLabel);

    // Draw trajectory path (faint)
    for (let i = 0; i < this.trajectory.length - 1; i++) {
      const p1 = this.trajectory[i];
      const p2 = this.trajectory[i + 1];
      const x1 = cx + p1.x * scale;
      const y1 = cy + p1.y * scale * 0.5;
      const x2 = cx + p2.x * scale;
      const y2 = cy + p2.y * scale * 0.5;
      const line = new Line(x1, y1, x2, y2);
      line.strokeStyle = "rgba(0, 217, 255, 0.08)";
      line.lineWidth = 1;
      this.scene.add(line);
    }

    // Draw trail
    for (const dot of this.trail) {
      const dx = cx + dot.x * scale;
      const dy = cy + dot.y * scale * 0.5;
      const tc = new Circle(dx, dy, 2 + dot.opacity * 2);
      tc.fillStyle = `hsla(30, 90%, 60%, ${dot.opacity * 0.5})`;
      this.scene.add(tc);
    }

    // Draw the glowing ball
    const ballX = cx + this.ball.x * scale;
    const ballY = cy + this.ball.y * scale * 0.5;

    const glow2 = new Circle(ballX, ballY, 16);
    glow2.fillStyle = "rgba(249, 115, 22, 0.15)";
    this.scene.add(glow2);

    const glow1 = new Circle(ballX, ballY, 11);
    glow1.fillStyle = "rgba(249, 115, 22, 0.35)";
    this.scene.add(glow1);

    const ball = new Circle(ballX, ballY, 7);
    ball.fillStyle = COLORS.accent3;
    ball.strokeStyle = "#ffffff";
    ball.lineWidth = 2;
    this.scene.add(ball);

    // Loss meter (thermometer on right side)
    this.drawLossMeter(w - 70, 70, 30, h - 180);

    // Labels
    const lrVal = this.controls["lr"] ?? 0.1;
    const lrText = new Text(`学习率 η = ${lrVal.toFixed(2)}`, 20, h - 50, 14);
    lrText.align = "left";
    lrText.fillStyle = COLORS.accent2;
    this.scene.add(lrText);

    const lossText = new Text(`当前损失 = ${this.currentLoss.toFixed(3)}`, 20, h - 28, 14);
    lossText.align = "left";
    lossText.fillStyle = this.currentLoss < 0.5 ? COLORS.positive : COLORS.highlight;
    lossText.fontWeight = "bold";
    this.scene.add(lossText);

    // Divergence warning
    if (Math.abs(this.ball.x) > 10 || Math.abs(this.ball.y) > 10) {
      const warn = new Text("⚠ 步子太大，发散了！", w / 2, h - 80, 16);
      warn.fillStyle = COLORS.negative;
      warn.fontWeight = "bold";
      this.scene.add(warn);
    }

    this.renderer.renderOnce();
  }

  private drawLossMeter(x: number, y: number, w: number, h: number): void {
    const maxLoss = this.trajectory[0]?.loss ?? 10;
    const fillRatio = clamp(this.currentLoss / maxLoss, 0, 1);
    const fillH = h * fillRatio;

    // Thermometer background
    for (let i = 0; i < h; i += 4) {
      const t = i / h;
      const bg = new Circle(x + w / 2, y + i, w / 2 - 2);
      bg.fillStyle = `hsla(${lerp(120, 0, t)}, 40%, 15%, 0.5)`;
      bg.scale = 0.8;
      this.scene.add(bg);
    }

    // Fill
    if (fillH > 2) {
      for (let i = 0; i < fillH; i += 3) {
        const t = (h - fillH + i) / h;
        const fc = new Circle(x + w / 2, y + h - fillH + i, w / 2 - 4);
        fc.fillStyle = `hsla(${lerp(120, 0, t)}, 80%, 55%, 0.8)`;
        fc.scale = 0.7;
        this.scene.add(fc);
      }
    }

    // Labels
    const label = new Text("损失", x + w / 2, y - 14, 11);
    label.fillStyle = COLORS.textDim;
    this.scene.add(label);

    const highLabel = new Text("高", x + w / 2, y + 4, 10);
    highLabel.fillStyle = COLORS.negative;
    this.scene.add(highLabel);

    const lowLabel = new Text("低", x + w / 2, y + h - 4, 10);
    lowLabel.fillStyle = COLORS.positive;
    this.scene.add(lowLabel);
  }
}
