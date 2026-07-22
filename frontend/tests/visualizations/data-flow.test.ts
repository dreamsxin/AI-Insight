import { afterEach, describe, expect, it, vi } from "vitest";
import { DataFlowViz } from "@/visualizations/ch07_transformer_overview/DataFlowViz";
import type { ControlConfig } from "@/types/chapter";

const controls: ControlConfig[] = [
  {
    key: "run",
    label: "播放动画",
    type: "button",
    min: 0,
    max: 1,
    step: 1,
    default: 0,
    options: [],
  },
  {
    key: "speed",
    label: "播放速度",
    type: "slider",
    min: 0.5,
    max: 2,
    step: 0.5,
    default: 1,
    options: [],
  },
];

function mockContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: vi.fn() } as unknown as CanvasGradient;
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

function makeContainer(width: number, height: number): HTMLElement {
  const container = document.createElement("div");
  container.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    right: width,
    bottom: height,
    left: 0,
    width,
    height,
    toJSON: () => ({}),
  });
  return container;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DataFlowViz", () => {
  it("uses a two-row path on narrow canvases and can replay after completion", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockContext());
    const viz = new DataFlowViz(makeContainer(360, 420), controls);
    viz.onMount();

    const internals = viz as unknown as {
      stagePositions: Array<{ x: number; y: number }>;
      renderer: { update: (dt: number) => void };
    };
    const rows = new Set(internals.stagePositions.map((point) => point.y));
    expect(rows.size).toBe(2);
    expect(internals.stagePositions[2].x).toBe(internals.stagePositions[3].x);

    viz.setControl("speed", 2);
    viz.setControl("run", 1);
    expect(viz.getStatus()).toBe("running");
    for (let frame = 0; frame < 30; frame++) internals.renderer.update(100);
    expect(viz.getStatus()).toBe("completed");

    viz.setControl("run", 1);
    expect(viz.getStatus()).toBe("running");
    viz.destroy();
  });
});
