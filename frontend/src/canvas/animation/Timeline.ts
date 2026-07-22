/** Timeline - orchestrates multiple tweens with offsets and sequencing. */

import { Tween } from "./Tween";

interface ScheduledTween {
  tween: Tween;
  offset: number; // ms from timeline start
}

export class Timeline {
  private tweens: ScheduledTween[] = [];
  private elapsed = 0;
  private playing = false;
  private totalDuration = 0;
  private onCompleteCb: (() => void) | null = null;

  /** Add a tween at a given offset (ms from timeline start). */
  add(tween: Tween, offset: number = 0): this {
    this.tweens.push({ tween, offset });
    const tweenEnd = offset + (tween as unknown as { duration: number }).duration;
    if (tweenEnd > this.totalDuration) {
      this.totalDuration = tweenEnd;
    }
    return this;
  }

  /** Add a tween sequentially after the last one. */
  then(tween: Tween, gap: number = 0): this {
    return this.add(tween, this.totalDuration + gap);
  }

  onComplete(cb: () => void): this {
    this.onCompleteCb = cb;
    return this;
  }

  play(): void {
    this.elapsed = 0;
    this.playing = true;
    for (const { tween } of this.tweens) {
      tween.reset();
    }
  }

  /** Advance all tweens by dt ms. Returns true when the timeline is done. */
  update(dt: number): boolean {
    if (!this.playing) return false;

    this.elapsed += dt;
    let allDone = true;

    for (const { tween, offset } of this.tweens) {
      if (this.elapsed < offset) {
        allDone = false;
        continue;
      }
      if (!tween.isFinished) {
        tween.update(dt);
        if (!tween.isFinished) allDone = false;
      }
    }

    if (allDone && this.elapsed >= this.totalDuration) {
      this.playing = false;
      if (this.onCompleteCb) this.onCompleteCb();
      return true;
    }

    return false;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get duration(): number {
    return this.totalDuration;
  }

  get progress(): number {
    return this.totalDuration > 0
      ? Math.min(1, this.elapsed / this.totalDuration)
      : 0;
  }

  clear(): void {
    this.tweens = [];
    this.elapsed = 0;
    this.totalDuration = 0;
    this.playing = false;
  }
}
