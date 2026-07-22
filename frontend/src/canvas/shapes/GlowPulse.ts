/** GlowPulse - an expanding ring that radiates outward from a point.

Used when a node "fires" to show activation spreading.
`progress` (0->1) expands the ring from radius 0 to `maxRadius`,
fading out as it expands.
*/

import type { RenderContext } from "@/types/canvas";
import { Shape } from "./Shape";

export class GlowPulse extends Shape {
  /** 0 = just started, 1 = fully expanded */
  progress = 0;
  hue = 180;
  maxRadius: number;
  lineWidth = 2;

  constructor(x = 0, y = 0, maxRadius = 40, hue = 180) {
    super();
    this.x = x;
    this.y = y;
    this.maxRadius = maxRadius;
    this.hue = hue;
  }

  draw(ctx: RenderContext): void {
    const r = this.maxRadius * this.progress;
    const alpha = (1 - this.progress) * 0.6;

    if (alpha <= 0 || r <= 0) return;

    // Outer ring
    ctx.strokeStyle = `hsla(${this.hue}, 90%, 65%, ${alpha})`;
    ctx.lineWidth = this.lineWidth;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner faint ring
    if (r > 5) {
      ctx.strokeStyle = `hsla(${this.hue}, 90%, 75%, ${alpha * 0.4})`;
      ctx.lineWidth = this.lineWidth * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
