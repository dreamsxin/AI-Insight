/** Curve shape - bezier curves for attention connections. */

import type { RenderContext } from "@/types/canvas";
import { Shape } from "./Shape";

export class Curve extends Shape {
  cp1x: number;
  cp1y: number;
  cp2x: number;
  cp2y: number;
  endX: number;
  endY: number;

  constructor(x = 0, y = 0, endX = 0, endY = 0) {
    super();
    this.x = x;
    this.y = y;
    this.endX = endX;
    this.endY = endY;
    // Default control points: curve upward
    const midX = (x + endX) / 2;
    this.cp1x = midX - x;
    this.cp1y = -50;
    this.cp2x = midX - x;
    this.cp2y = -50;
  }

  setControlPoints(cp1x: number, cp1y: number, cp2x: number, cp2y: number): this {
    this.cp1x = cp1x - this.x;
    this.cp1y = cp1y - this.y;
    this.cp2x = cp2x - this.x;
    this.cp2y = cp2y - this.y;
    return this;
  }

  draw(ctx: RenderContext): void {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(this.cp1x, this.cp1y, this.cp2x, this.cp2y, this.endX - this.x, this.endY - this.y);
    if (this.strokeStyle !== "transparent" && this.lineWidth > 0) ctx.stroke();
  }
}
