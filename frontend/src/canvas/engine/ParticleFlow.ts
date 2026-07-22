/** ParticleFlow - manages particles traveling along edges in a network.

Auto-generates particles that flow from source nodes to destination nodes.
Particles are recycled when they reach the end.

Usage:
  const flow = new ParticleFlow(renderer);
  flow.addEdge(fromX, fromY, toX, toY, hue, weight);
  flow.emit();              // emit one batch of particles
  flow.startContinuous();   // keep emitting forever
  flow.stop();              // stop emitting, let existing particles finish
  flow.clear();             // remove all particles
*/

import type { Renderer } from "@/canvas/engine/Renderer";
import { Particle } from "@/canvas/shapes/Particle";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";

interface FlowEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hue: number;
  weight: number;
}

interface ActiveParticle {
  particle: Particle;
  state: { progress: number };
}

export class ParticleFlow {
  private renderer: Renderer;
  private edges: FlowEdge[] = [];
  private active: ActiveParticle[] = [];
  private emitting = false;
  private emitTimer = 0;
  private emitInterval = 300;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  addEdge(
    x1: number, y1: number, x2: number, y2: number,
    hue = 180, weight = 1,
  ): void {
    this.edges.push({ x1, y1, x2, y2, hue, weight });
  }

  clearEdges(): void {
    this.edges = [];
  }

  /** Emit one particle per edge. */
  emit(hueOverride?: number): void {
    for (const edge of this.edges) {
      this.spawnParticle(edge, hueOverride);
    }
  }

  /** Emit particles only for edges originating from a specific node. */
  emitFrom(x: number, y: number, hueOverride?: number): void {
    for (const edge of this.edges) {
      if (Math.abs(edge.x1 - x) < 1 && Math.abs(edge.y1 - y) < 1) {
        this.spawnParticle(edge, hueOverride);
      }
    }
  }

  private spawnParticle(edge: FlowEdge, hueOverride?: number): void {
    const radius = 2.5 + edge.weight * 1.5;
    const hue = hueOverride ?? edge.hue;
    const p = new Particle(edge.x1, edge.y1, edge.x2, edge.y2, radius, hue);
    p.opacity = 0;
    p.progress = 0;
    this.renderer.scene.add(p);

    // Animate via a plain state object (Particle lacks index signature for Tween)
    const fadeState = { val: 0 };
    const progressState = { progress: 0 };
    const entry: ActiveParticle = { particle: p, state: progressState };
    this.active.push(entry);

    // Fade in
    const fadeIn = new Tween(fadeState, { val: 1 }, 150);
    fadeIn.onUpdate(() => { p.opacity = fadeState.val; });
    this.renderer.addTween(fadeIn);

    // Animate progress along the edge
    const duration = 700 + 300 * (1 - Math.min(edge.weight, 1));
    const progressTween = new Tween(progressState, { progress: 1 }, duration, Easing.easeInOutCubic);
    progressTween.onUpdate(() => {
      p.progress = progressState.progress;
    });
    progressTween.onComplete(() => {
      // Fade out then remove
      const fadeOutState = { val: 1 };
      const fadeTween = new Tween(fadeOutState, { val: 0 }, 200);
      fadeTween.onUpdate(() => { p.opacity = fadeOutState.val; });
      fadeTween.onComplete(() => {
        this.renderer.scene.remove(p);
        const idx = this.active.indexOf(entry);
        if (idx >= 0) this.active.splice(idx, 1);
      });
      this.renderer.addTween(fadeTween);
    });
    this.renderer.addTween(progressTween);
  }

  /** Start continuous emission: emit a batch every `interval` ms. */
  startContinuous(interval = 300): void {
    this.emitting = true;
    this.emitInterval = interval;
    this.emitTimer = 0;
  }

  stop(): void {
    this.emitting = false;
  }

  /** Advance emission timing. Call this from the visualization's render loop. */
  tick(dt: number): void {
    if (!this.emitting) return;
    this.emitTimer += dt;
    if (this.emitTimer >= this.emitInterval) {
      this.emitTimer = 0;
      this.emit();
    }
  }

  /** Remove all particles immediately. */
  clear(): void {
    for (const { particle } of this.active) {
      this.renderer.scene.remove(particle);
    }
    this.active = [];
    this.emitting = false;
  }

  get particleCount(): number {
    return this.active.length;
  }
}
