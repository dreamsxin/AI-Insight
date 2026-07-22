/** AnimationLoop - manages requestAnimationFrame and delta time. */

export class AnimationLoop {
  private rafId: number | null = null;
  private lastTime = 0;
  private running = false;
  private updateCb: (dt: number) => void;
  private renderCb: () => void;
  private fpsCounter = 0;
  private fpsTimer = 0;
  private fps = 0;

  constructor(update: (dt: number) => void, render: () => void) {
    this.updateCb = update;
    this.renderCb = render;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min(now - this.lastTime, 100); // cap at 100ms
    this.lastTime = now;

    this.updateCb(dt);
    this.renderCb();

    // FPS tracking
    this.fpsCounter++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1000) {
      this.fps = this.fpsCounter;
      this.fpsCounter = 0;
      this.fpsTimer = 0;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  get isRunning(): boolean {
    return this.running;
  }

  get currentFps(): number {
    return this.fps;
  }
}
