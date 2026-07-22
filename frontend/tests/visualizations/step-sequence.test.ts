import { afterEach, describe, expect, it, vi } from "vitest";
import { StepSequenceVisualization } from "@/visualizations/StepSequenceVisualization";
import type { ControlConfig } from "@/types/chapter";

class DemoStepSequence extends StepSequenceVisualization {
  onMount(): void {
    this.initializeStepSequence();
    this.renderStepSequenceFrame();
  }

  onControlChange(key: string): void {
    this.handleStepSequenceControl(key);
  }

  protected get maxStep(): number {
    return 2;
  }

  protected renderStepSequenceFrame(): void {
    this.renderer.renderOnce();
  }
}

const controls: ControlConfig[] = [
  {
    key: "run",
    label: "播放",
    type: "button",
    min: 0,
    max: 1,
    step: 1,
    default: 0,
    options: [],
  },
  {
    key: "step",
    label: "步骤",
    type: "slider",
    min: 0,
    max: 2,
    step: 1,
    default: 0,
    options: [],
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StepSequenceVisualization", () => {
  it("advances control values and can replay from the first step", () => {
    const context = {
      clearRect: vi.fn(),
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);

    const container = document.createElement("div");
    container.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      right: 720,
      bottom: 420,
      left: 0,
      width: 720,
      height: 420,
      toJSON: () => ({}),
    });

    const viz = new DemoStepSequence(container, controls);
    const values: number[] = [];
    viz.onControlValueChange((key, value) => {
      if (key === "step") values.push(value);
    });
    viz.onMount();
    viz.setControl("run", 1);

    const renderer = (viz as unknown as { renderer: { update: (dt: number) => void } }).renderer;
    for (let frame = 0; frame < 30; frame++) renderer.update(100);

    expect(viz.getStatus()).toBe("completed");
    expect(viz.getControls().step).toBe(2);
    expect(values).toEqual([1, 2]);

    viz.setControl("run", 1);
    expect(viz.getStatus()).toBe("running");
    expect(viz.getControls().step).toBe(0);
    expect(values.at(-1)).toBe(0);
    viz.destroy();
  });
});
