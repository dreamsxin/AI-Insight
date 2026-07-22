/** Renderer - ties together canvas, scene, and animation loop. */

import type { RenderContext } from "@/types/canvas";
import { Scene } from "./Scene";
import { AnimationLoop } from "./AnimationLoop";
import { Tween } from "../animation/Tween";
import { Timeline } from "../animation/Timeline";

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scene: Scene;
  private loop: AnimationLoop;
  private tweens: Tween[] = [];
  private timelines: Timeline[] = [];
  private dpr: number = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");
    this.ctx = ctx;
    this.scene = new Scene();
    this.loop = new AnimationLoop(this.update.bind(this), this.render.bind(this));
  }

  /** Set the canvas size (CSS pixels), accounting for device pixel ratio. */
  resize(width: number, height: number, dpr = window.devicePixelRatio || 1): void {
    this.dpr = dpr;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Get the CSS pixel width of the canvas. */
  get width(): number {
    return this.canvas.width / this.dpr;
  }

  /** Get the CSS pixel height of the canvas. */
  get height(): number {
    return this.canvas.height / this.dpr;
  }

  /** Start the render loop. */
  start(): void {
    this.loop.start();
  }

  /** Stop the render loop. */
  stop(): void {
    this.loop.stop();
  }

  /** Add a tween to be updated each frame. */
  addTween(tween: Tween): Tween {
    this.tweens.push(tween);
    return tween;
  }

  /** Add a timeline to be updated each frame. */
  addTimeline(timeline: Timeline): Timeline {
    this.timelines.push(timeline);
    return timeline;
  }

  /** Remove all tweens and timelines. */
  clearAnimations(): void {
    this.tweens = [];
    this.timelines = [];
  }

  private update(dt: number): void {
    // Callbacks may enqueue or reset tweens while the current batch updates.
    // Keep those additions in the next frame instead of overwriting them.
    const currentTweens = this.tweens;
    this.tweens = [];
    for (const tween of currentTweens) {
      tween.update(dt);
      if (!tween.isFinished && !this.tweens.includes(tween)) {
        this.tweens.push(tween);
      }
    }

    // Update timelines
    const currentTimelines = this.timelines;
    this.timelines = [];
    for (const timeline of currentTimelines) {
      timeline.update(dt);
      if (timeline.isPlaying && !this.timelines.includes(timeline)) {
        this.timelines.push(timeline);
      }
    }
  }

  private render(): void {
    const ctx = this.ctx as unknown as RenderContext;
    ctx.clearRect(0, 0, this.width, this.height);
    this.scene.render(ctx);
  }

  /** Force a single render frame (without starting the loop). */
  renderOnce(): void {
    this.render();
  }
}
