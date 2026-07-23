/** BaseVisualization - abstract base for all chapter visualizations. */

import { Renderer } from "@/canvas/engine/Renderer";
import { MouseHandler } from "@/canvas/interaction/MouseHandler";
import type { ControlConfig } from "@/types/chapter";
import type { VisualizationStatus } from "@/types/visualization";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";

export abstract class BaseVisualization {
  protected renderer: Renderer;
  protected mouseHandler: MouseHandler | null = null;
  protected controls: Record<string, number> = {};
  protected controlConfigs: ControlConfig[] = [];
  protected canvas: HTMLCanvasElement;
  protected apiEndpoint: string | undefined;
  protected container: HTMLElement;
  /** AbortController for cancelling API requests on destroy/re-run */
  protected abortController: AbortController | null = null;
  private status: VisualizationStatus = "idle";
  private statusBeforePause: VisualizationStatus = "idle";
  private statusListeners = new Set<(status: VisualizationStatus) => void>();
  private controlValueListeners = new Set<(key: string, value: number) => void>();
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, controlConfigs: ControlConfig[] = []) {
    this.container = container;
    this.controlConfigs = controlConfigs;

    // Create canvas element
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", container.getAttribute("aria-label") ?? "AI 概念交互可视化");
    container.appendChild(this.canvas);

    this.renderer = new Renderer(this.canvas);
    // Do not call the overridable resize() here: subclass fields are not
    // initialized yet when the base constructor runs.
    const rect = container.getBoundingClientRect();
    this.renderer.resize(rect.width || 600, rect.height || 400);

    // Initialize control defaults
    for (const cfg of controlConfigs) {
      this.controls[cfg.key] = cfg.default;
    }

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
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
    this.cancelRequests();
    this.resizeObserver?.disconnect();
    this.renderer.stop();
    this.mouseHandler?.destroy();
    this.renderer.clearAnimations();
    this.statusListeners.clear();
    this.controlValueListeners.clear();
    this.canvas.remove();
  }

  /** Cancel any in-flight API requests. */
  protected cancelRequests(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /** Get or create an AbortController for API requests. Previous one is aborted. */
  protected getAbortSignal(): AbortSignal {
    this.cancelRequests();
    this.abortController = new AbortController();
    return this.abortController.signal;
  }

  /** Called when a text-type control changes. Override in subclasses. */
  onTextChange(_key: string, _text: string): void {}

  pause(): void {
    if (this.status === "paused" || this.status === "completed" || this.status === "error") return;
    this.statusBeforePause = this.status;
    this.renderer.stop();
    this.setVisualizationStatus("paused");
  }

  resume(): void {
    if (this.status !== "paused") return;
    this.renderer.start();
    this.setVisualizationStatus(this.statusBeforePause);
  }

  getStatus(): VisualizationStatus {
    return this.status;
  }

  onStatusChange(cb: (status: VisualizationStatus) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  onControlValueChange(cb: (key: string, value: number) => void): () => void {
    this.controlValueListeners.add(cb);
    return () => this.controlValueListeners.delete(cb);
  }

  /** Set a control value and trigger callback. */
  setControl(key: string, value: number): void {
    const wasPaused = this.status === "paused";
    this.controls[key] = value;
    this.onControlChange(key, value);
    // Parameter changes reset the current run in most visualizations. If that
    // happened while paused, resume the renderer so the next run is live.
    if (wasPaused && this.status !== "paused") this.renderer.start();
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

  protected setVisualizationStatus(status: VisualizationStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }

  /** Update a control from an animation without triggering onControlChange. */
  protected setControlValue(key: string, value: number): void {
    if (this.controls[key] === value) return;
    this.controls[key] = value;
    for (const listener of this.controlValueListeners) listener(key, value);
  }

  protected get width(): number {
    return this.renderer.width;
  }

  protected get height(): number {
    return this.renderer.height;
  }

  /** Wait on the renderer clock so delays pause and resume with tweens. */
  protected waitForAnimation(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const state = { progress: 0 };
      const tween = new Tween(state, { progress: 1 }, ms, Easing.linear);
      tween.onComplete(resolve);
      this.renderer.addTween(tween);
    });
  }

  protected get scene() {
    return this.renderer.scene;
  }
}
