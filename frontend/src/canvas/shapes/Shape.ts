/** Abstract Shape - base class for all renderable Canvas shapes. */

import type { RenderContext } from "@/types/canvas";

export abstract class Shape {
  x = 0;
  y = 0;
  opacity = 1;
  scale = 1;
  rotation = 0;
  visible = true;
  fillStyle = "#ffffff";
  strokeStyle = "transparent";
  lineWidth = 1;
  // Tag for identification / hit-testing
  tag: string = "";
  data: unknown = null;

  protected applyTransform(ctx: RenderContext): void {
    ctx.save();
    ctx.globalAlpha *= this.opacity;
    if (this.x !== 0 || this.y !== 0) {
      ctx.translate(this.x, this.y);
    }
    if (this.scale !== 1) {
      ctx.scale(this.scale, this.scale);
    }
    if (this.rotation !== 0) {
      ctx.rotate(this.rotation);
    }
  }

  protected restore(ctx: RenderContext): void {
    ctx.restore();
  }

  /** Draw the shape. Subclasses implement the actual rendering. */
  abstract draw(ctx: RenderContext): void;

  /** Render with transform applied. */
  render(ctx: RenderContext): void {
    if (!this.visible) return;
    this.applyTransform(ctx);
    ctx.fillStyle = this.fillStyle;
    ctx.strokeStyle = this.strokeStyle;
    ctx.lineWidth = this.lineWidth;
    this.draw(ctx);
    this.restore(ctx);
  }
}
