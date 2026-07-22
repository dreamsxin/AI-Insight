/** BaseVisualization - abstract base for all chapter visualizations. */

import { Renderer } from "@/canvas/engine/Renderer";
import { MouseHandler } from "@/canvas/interaction/MouseHandler";
import type { ControlConfig } from "@/types/chapter";

export abstract class BaseVisualization {
  protected renderer: Renderer;
  protected mouseHandler: MouseHandler | null = null;
  protected controls: Record<string, number> = {};
  protected controlConfigs: ControlConfig[] = [];
  protected canvas: HTMLCanvasElement;
  protected apiEndpoint: string | undefined;
  private container: HTMLElement;

  constructor(container: HTMLElement, controlConfigs: ControlConfig[] = []) {
    this.container = container;
    this.controlConfigs = controlConfigs;

    // Create canvas element
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    container.appendChild(this.canvas);

    this.renderer = new Renderer(this.canvas);
    this.resize();

    // Initialize control defaults
    for (const cfg of controlConfigs) {
      this.controls[cfg.key] = cfg.default;
    }
  }

  /** Called when visualization is shown. Override to set up scene & events. */
  abstract onMount(): void;

  /** Called when a control value changes. Override to react to user input. */
  onControlChange(_key: string, _value: number): void {}

  /** Called when the visualization is destroyed. Override for cleanup. */
  onUnmount(): void {}

  /** Start the render loop and animation. */
  start(): void {
    this.onMount();
    this.renderer.start();
  }

  /** Stop rendering and clean up. */
  destroy(): void {
    this.onUnmount();
    this.renderer.stop();
    this.mouseHandler?.destroy();
    this.renderer.clearAnimations();
    this.canvas.remove();
  }

  /** Set a control value and trigger callback. */
  setControl(key: string, value: number): void {
    this.controls[key] = value;
    this.onControlChange(key, value);
  }

  /** Get current control values. */
  getControls(): Record<string, number> {
    return this.controls;
  }

  /** Resize canvas to container size. */
  resize(): void {
    const rect = this.container.getBoundingClientRect();
    const w = rect.width || 600;
    const h = rect.height || 400;
    this.renderer.resize(w, h);
  }

  protected get width(): number {
    return this.renderer.width;
  }

  protected get height(): number {
    return this.renderer.height;
  }

  protected get scene() {
    return this.renderer.scene;
  }
}
