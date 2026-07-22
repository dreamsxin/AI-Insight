/** Scene - manages a collection of shapes and renders them in order. */

import type { RenderContext } from "@/types/canvas";
import type { Shape } from "../shapes/Shape";

export class Scene {
  private shapes: Shape[] = [];
  private layers: Map<string, Shape[]> = new Map();
  private currentLayer: string = "default";

  /** Add a shape to the current layer. */
  add(shape: Shape): Shape {
    if (!this.layers.has(this.currentLayer)) {
      this.layers.set(this.currentLayer, []);
    }
    this.layers.get(this.currentLayer)!.push(shape);
    this.shapes.push(shape);
    return shape;
  }

  /** Remove a specific shape from all layers. */
  remove(shape: Shape): void {
    this.shapes = this.shapes.filter((s) => s !== shape);
    for (const [, layerShapes] of this.layers) {
      const idx = layerShapes.indexOf(shape);
      if (idx >= 0) layerShapes.splice(idx, 1);
    }
  }

  /** Switch to a named layer for subsequent additions. */
  setLayer(name: string): void {
    if (!this.layers.has(name)) {
      this.layers.set(name, []);
    }
    this.currentLayer = name;
  }

  /** Clear all shapes from the scene (or a specific layer). */
  clear(layer?: string): void {
    if (layer) {
      const layerShapes = this.layers.get(layer);
      if (layerShapes) {
        for (const s of layerShapes) {
          const idx = this.shapes.indexOf(s);
          if (idx >= 0) this.shapes.splice(idx, 1);
        }
        layerShapes.length = 0;
      }
    } else {
      this.shapes = [];
      this.layers.clear();
      this.layers.set("default", []);
      this.currentLayer = "default";
    }
  }

  /** Get all shapes (for hit-testing etc). */
  getShapes(): Shape[] {
    return this.shapes;
  }

  /** Render all visible shapes to the context. */
  render(ctx: RenderContext): void {
    for (const shape of this.shapes) {
      shape.render(ctx);
    }
  }

  get count(): number {
    return this.shapes.length;
  }
}
