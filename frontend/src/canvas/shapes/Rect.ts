/** Rectangle shape - used for matrix cells, panels, layers. */

import type { RenderContext } from "@/types/canvas";
import { Shape } from "./Shape";

export class Rect extends Shape {
  width: number;
  height: number;
  radius: number;

  constructor(x = 0, y = 0, width = 100, height = 60, radius = 0) {
    super();
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.radius = radius;
  }

  draw(ctx: RenderContext): void {
    if (this.radius > 0) {
      this.drawRounded(ctx);
    } else {
      ctx.beginPath();
      ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
      if (this.fillStyle !== "transparent") ctx.fill();
      if (this.strokeStyle !== "transparent" && this.lineWidth > 0) ctx.stroke();
    }
  }

  private drawRounded(ctx: RenderContext): void {
    const w = this.width;
    const h = this.height;
    const r = this.radius;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + r, -h / 2);
    ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
    ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
    ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
    ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
    ctx.closePath();
    if (this.fillStyle !== "transparent") ctx.fill();
    if (this.strokeStyle !== "transparent" && this.lineWidth > 0) ctx.stroke();
  }
}
