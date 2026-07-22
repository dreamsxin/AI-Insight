/** Shared lifecycle for visualizations that reveal a fixed sequence of steps. */

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";

export abstract class StepSequenceVisualization extends BaseVisualization {
  protected stepTransition = { progress: 1 };
  private sequenceGeneration = 0;
  private sequenceRunning = false;

  protected abstract get maxStep(): number;
  protected abstract renderStepSequenceFrame(): void;

  protected get transitionDuration(): number {
    return 360;
  }

  protected get stepHoldDuration(): number {
    return 420;
  }

  protected canPlayStepSequence(): boolean {
    return true;
  }

  protected initializeStepSequence(): void {
    this.sequenceGeneration++;
    this.sequenceRunning = false;
    this.stepTransition.progress = 1;
    this.setVisualizationStatus("idle");
  }

  protected handleStepSequenceControl(key: string): boolean {
    if (key === "run") {
      this.playStepSequence();
      return true;
    }
    if (key === "step") {
      this.animateSelectedStep();
      return true;
    }
    return false;
  }

  protected applyStepTransition(startIndex: number): void {
    const progress = this.stepTransition.progress;
    const opacity = 0.18 + progress * 0.82;
    const scale = 0.94 + progress * 0.06;
    for (const shape of this.scene.getShapes().slice(startIndex)) {
      shape.opacity *= opacity;
      shape.scale *= scale;
    }
  }

  onUnmount(): void {
    this.sequenceGeneration++;
    this.sequenceRunning = false;
    this.renderer.clearAnimations();
  }

  private animateSelectedStep(): void {
    if (!this.canPlayStepSequence()) return;
    const generation = ++this.sequenceGeneration;
    this.sequenceRunning = false;
    this.renderer.clearAnimations();
    this.setVisualizationStatus("running");
    this.animateStep(generation, true);
  }

  protected playStepSequence(): void {
    if (this.sequenceRunning || !this.canPlayStepSequence()) return;
    const generation = ++this.sequenceGeneration;
    this.sequenceRunning = true;
    this.renderer.clearAnimations();
    this.setVisualizationStatus("running");
    this.setControlValue("step", 0);
    this.animateStep(generation, false);
  }

  private animateStep(generation: number, manual: boolean): void {
    if (generation !== this.sequenceGeneration) return;
    this.stepTransition.progress = 0;
    this.renderStepSequenceFrame();

    const tween = new Tween(
      this.stepTransition,
      { progress: 1 },
      this.transitionDuration,
      Easing.easeOutCubic,
    );
    tween.onUpdate(() => this.renderStepSequenceFrame());
    tween.onComplete(() => {
      if (generation !== this.sequenceGeneration) return;
      this.renderStepSequenceFrame();
      const currentStep = Math.floor(this.controls["step"] ?? 0);
      if (manual || currentStep >= this.maxStep) {
        this.sequenceRunning = false;
        this.setVisualizationStatus("completed");
        return;
      }
      this.holdThenAdvance(currentStep + 1, generation);
    });
    this.renderer.addTween(tween);
  }

  private holdThenAdvance(nextStep: number, generation: number): void {
    const hold = { progress: 0 };
    const tween = new Tween(hold, { progress: 1 }, this.stepHoldDuration, Easing.linear);
    tween.onComplete(() => {
      if (generation !== this.sequenceGeneration) return;
      this.setControlValue("step", nextStep);
      this.animateStep(generation, false);
    });
    this.renderer.addTween(tween);
  }
}
