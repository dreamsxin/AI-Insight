/** Particle - a small glowing dot that travels along a path.

`progress` (0→1) moves it from (x,y) to (x2,y2).
`trail` draws a fading tail behind the particle.
*/

import type { RenderContext } from "@/types/canvas";
import { Shape } from "./Shape";

export class Particle extends Shape {
  x2: number;
  y2: number;
  /** 0 = at start, 1 = at end */
  progress = 0;
  radius: number;
  /** Trail length in segments */
  trailLength = 6;
  hue = 180;
  /** Whether to show a trail */
  showTrail = true;

  constructor(x1 = 0, y1 = 0, x2 = 0, y2 = 0, radius = 3, hue = 180) {
    super();
    this.x = x1;
    this.y = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.radius = radius;
    this.hue = hue;
  }

  /** Get current position based on progress. */
  get currentX(): number {
    return this.x + (this.x2 - this.x) * this.progress;
  }

  get currentY(): number {
    return this.y + (this.y2 - this.y) * this.progress;
  }

  draw(ctx: RenderContext): void {
    const cx = this.currentX - this.x;
    const cy = this.currentY - this.y;

    // Trail
    if (this.showTrail && this.progress > 0.05) {
      for (let i = 1; i <= this.trailLength; i++) {
        const t = Math.max(0, this.progress - i * 0.04);
        const tx = (this.x2 - this.x) * t;
        const ty = (this.y2 - this.y) * t;
        const alpha = (1 - i / this.trailLength) * 0.4 * this.opacity;
        const tr = this.radius * (1 - i / (this.trailLength + 1));
        if (tr <= 0) continue;
        ctx.fillStyle = `hsla(${this.hue}, 90%, 65%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(tx, ty, tr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Glow
    const glowR = this.radius * 3;
    const grad = ctx.createLinearGradient(cx - glowR, cy - glowR, cx + glowR, cy + glowR);
    grad.addColorStop(0, `hsla(${this.hue}, 90%, 65%, 0)`);
    grad.addColorStop(0.5, `hsla(${this.hue}, 90%, 65%, ${0.5 * this.opacity})`);
    grad.addColorStop(1, `hsla(${this.hue}, 90%, 65%, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = `hsla(${this.hue}, 100%, 80%, ${this.opacity})`;
    ctx.beginPath();
    ctx.arc(cx, cy, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Bright center
    ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * this.opacity})`;
    ctx.beginPath();
    ctx.arc(cx, cy, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}
