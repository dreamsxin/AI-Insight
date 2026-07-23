import { afterEach, describe, expect, it, vi } from "vitest";
import type { ControlConfig } from "@/types/chapter";

const { attentionResponse } = vi.hoisted(() => ({
  attentionResponse: {
    q: [[2, 0, 0], [0, 1, 0], [0.3, 1.4, 0], [1, 0, 0], [0.2, 0.4, 1.5]],
    k: [[2, 0, 0], [0, 1, 0], [0.3, 1.4, 0], [1, 0, 0], [0.2, 0.4, 1.5]],
    v: [[2, 0, 0], [0, 1, 0], [0.3, 1.4, 0], [1, 0, 0], [0.2, 0.4, 1.5]],
    scores: Array.from({ length: 5 }, () => [0.4, 0.2, 0.1, 0.2, 0.1]),
    weights: Array.from({ length: 5 }, (_, index) => index === 3
      ? [0.46, 0.12, 0.11, 0.2, 0.11]
      : [0.2, 0.2, 0.2, 0.2, 0.2]),
    output: Array.from({ length: 5 }, () => [1, 0, 0]),
  },
}));

vi.mock("@/api/compute", () => ({
  transformerAttention: vi.fn().mockResolvedValue(attentionResponse),
}));

import { SelfAttentionViz } from "@/visualizations/ch06_transformer/SelfAttentionViz";

function mockContext(): CanvasRenderingContext2D {
  const noOp = vi.fn();
  return {
    save: noOp,
    restore: noOp,
    translate: noOp,
    scale: noOp,
    rotate: noOp,
    beginPath: noOp,
    closePath: noOp,
    moveTo: noOp,
    lineTo: noOp,
    bezierCurveTo: noOp,
    arc: noOp,
    arcTo: noOp,
    rect: noOp,
    fillRect: noOp,
    fill: noOp,
    stroke: noOp,
    fillText: noOp,
    strokeText: noOp,
    clearRect: noOp,
    setTransform: noOp,
    createLinearGradient: () => ({ addColorStop: noOp }),
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

function container(): HTMLElement {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    right: 720,
    bottom: 500,
    left: 0,
    width: 720,
    height: 500,
    toJSON: () => ({}),
  });
  return element;
}

function controls(): ControlConfig[] {
  return [
    { key: "run", label: "播放寻找线索", type: "button", min: 0, max: 1, step: 1, default: 0, options: [] },
    { key: "focus", label: "正在提问的词", type: "slider", min: 0, max: 4, step: 1, default: 3, options: [], value_labels: ["小猫", "因为", "饿了", "它", "找食物"] },
    { key: "mode", label: "观察层次", type: "segmented", min: 0, max: 2, step: 1, default: 0, options: ["故事", "原理", "数学"] },
  ];
}

function advance(viz: SelfAttentionViz, milliseconds: number): void {
  const renderer = (viz as unknown as { renderer: { update: (dt: number) => void } }).renderer;
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 100) renderer.update(100);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SelfAttentionViz drilldown", () => {
  it("moves from sentence story to Q/K/V and the weight matrix", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockContext());
    const viz = new SelfAttentionViz(container(), controls());
    viz.onMount();
    await Promise.resolve();
    await Promise.resolve();

    expect(viz.getDrilldownDepth()).toBe(0);
    viz.setControl("mode", 0);
    expect(viz.getDrilldownDepth()).toBe(1);
    viz.setControl("mode", 1);
    expect(viz.getDrilldownDepth()).toBe(2);
    viz.setControl("mode", 2);
    expect(viz.getDrilldownPath()).toEqual([
      "Self-Attention 总览",
      "词语“它”",
      "Q / K / V 原理",
      "权重矩阵",
    ]);

    viz.setControl("run", 1);
    advance(viz, 2300);
    expect(viz.getStatus()).toBe("completed");
    viz.destroy();
  });
});
