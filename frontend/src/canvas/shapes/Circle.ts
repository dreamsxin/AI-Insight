/** Circle shape - used for neuron nodes, points, etc. */

import type { RenderContext } from "@/types/canvas";
import { Shape } from "./Shape";

export class Circle extends Shape {
  radius: number;

  constructor(x = 0, y = 0, radius = 10) {
    super();
    this.x = x;
    this.y = y;
    this.radius = radius;
  }

  draw(ctx: RenderContext): void {
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    if (this.fillStyle !== "transparent") ctx.fill();
    if (this.strokeStyle !== "transparent" && this.lineWidth > 0) ctx.stroke();
  }
}
