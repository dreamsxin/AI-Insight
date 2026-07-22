/** Text shape - used for labels, values, formulas. */

import type { RenderContext } from "@/types/canvas";
import { Shape } from "./Shape";

export class Text extends Shape {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;

  constructor(
    text: string,
    x = 0,
    y = 0,
    fontSize = 14,
    fontFamily = "system-ui, sans-serif",
  ) {
    super();
    this.text = text;
    this.x = x;
    this.y = y;
    this.fontSize = fontSize;
    this.fontFamily = fontFamily;
    this.fontWeight = "normal";
    this.align = "center";
    this.baseline = "middle";
  }

  protected applyTransform(ctx: RenderContext): void {
    super.applyTransform(ctx);
    ctx.font = `${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
    ctx.textAlign = this.align;
    ctx.textBaseline = this.baseline;
  }

  draw(ctx: RenderContext): void {
    if (this.fillStyle !== "transparent") {
      ctx.fillText(this.text, 0, 0);
    }
    if (this.strokeStyle !== "transparent" && this.lineWidth > 0) {
      ctx.strokeText(this.text, 0, 0);
    }
  }
}
