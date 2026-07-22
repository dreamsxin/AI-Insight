/** Arrow shape - used for data flow direction. */

import type { RenderContext } from "@/types/canvas";
import { Shape } from "./Shape";

export class Arrow extends Shape {
  x2: number;
  y2: number;
  headSize: number;

  constructor(x1 = 0, y1 = 0, x2 = 0, y2 = 0, headSize = 8) {
    super();
    this.x = x1;
    this.y = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.headSize = headSize;
  }

  draw(ctx: RenderContext): void {
    const dx = this.x2 - this.x;
    const dy = this.y2 - this.y;
    const angle = Math.atan2(dy, dx);
    const len = Math.sqrt(dx * dx + dy * dy);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dx, dy);
    if (this.strokeStyle !== "transparent" && this.lineWidth > 0) ctx.stroke();

    // Arrowhead
    const hs = this.headSize;
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.lineTo(dx - hs * Math.cos(angle - Math.PI / 6), dy - hs * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(dx - hs * Math.cos(angle + Math.PI / 6), dy - hs * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    if (this.fillStyle !== "transparent") ctx.fill();
  }
}
