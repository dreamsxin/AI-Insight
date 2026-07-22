/** Line shape - used for weight connections between neurons. */

import type { RenderContext } from "@/types/canvas";
import { Shape } from "./Shape";

export class Line extends Shape {
  x2: number;
  y2: number;

  constructor(x1 = 0, y1 = 0, x2 = 0, y2 = 0) {
    super();
    this.x = x1;
    this.y = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  draw(ctx: RenderContext): void {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(this.x2 - this.x, this.y2 - this.y);
    if (this.strokeStyle !== "transparent" && this.lineWidth > 0) ctx.stroke();
  }
}
