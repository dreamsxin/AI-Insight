/** Tween - a single property animation over time. */

import type { EasingFn } from "./Easing";
import { Easing } from "./Easing";

type NumericProps = Record<string, number>;

export class Tween {
  private target: NumericProps;
  private startProps: NumericProps = {};
  private endProps: NumericProps;
  private duration: number; // ms
  private easing: EasingFn;
  private delay: number = 0; // ms
  private elapsed = 0;
  private started = false;
  private finished = false;
  private onUpdateCb: ((progress: number) => void) | null = null;
  private onCompleteCb: (() => void) | null = null;

  constructor(
    target: NumericProps,
    endProps: NumericProps,
    duration: number,
    easing: EasingFn = Easing.easeInOutCubic,
  ) {
    this.target = target;
    this.endProps = endProps;
    this.duration = duration;
    this.easing = easing;
  }

  setDelay(ms: number): this {
    this.delay = ms;
    return this;
  }

  setEasing(fn: EasingFn): this {
    this.easing = fn;
    return this;
  }

  onUpdate(cb: (progress: number) => void): this {
    this.onUpdateCb = cb;
    return this;
  }

  onComplete(cb: () => void): this {
    this.onCompleteCb = cb;
    return this;
  }

  /** Advance the tween by dt milliseconds. Returns true when finished. */
  update(dt: number): boolean {
    if (this.finished) return true;
    if (!this.started) {
      this.started = true;
      for (const key in this.endProps) {
        this.startProps[key] = this.target[key] ?? 0;
      }
    }

    this.elapsed += dt;
    if (this.elapsed < this.delay) return false;

    const t = Math.min(1, (this.elapsed - this.delay) / this.duration);
    const eased = this.easing(t);

    for (const key in this.endProps) {
      const start = this.startProps[key];
      const end = this.endProps[key];
      this.target[key] = start + (end - start) * eased;
    }

    if (this.onUpdateCb) this.onUpdateCb(eased);

    if (t >= 1) {
      this.finished = true;
      if (this.onCompleteCb) this.onCompleteCb();
    }

    return this.finished;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  reset(): void {
    this.elapsed = 0;
    this.started = false;
    this.finished = false;
  }
}
