import { afterEach, describe, expect, it, vi } from "vitest";
import { FunctionPlotViz } from "@/visualizations/ch01_functions/FunctionPlotViz";
import { ActivationViz } from "@/visualizations/ch01_functions/ActivationViz";
import type { ControlConfig } from "@/types/chapter";

const button = (key: string, label: string): ControlConfig => ({
  key,
  label,
  type: "button",
  min: 0,
  max: 1,
  step: 1,
  default: 0,
  options: [],
});

const slider = (key: string, label: string, min: number, max: number, step: number, value: number): ControlConfig => ({
  key,
  label,
  type: "slider",
  min,
  max,
  step,
  default: value,
  options: [],
});

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
    arc: noOp,
    arcTo: noOp,
    rect: noOp,
    fill: noOp,
    stroke: noOp,
    fillText: noOp,
    strokeText: noOp,
    clearRect: noOp,
    setTransform: noOp,
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
    bottom: 420,
    left: 0,
    width: 720,
    height: 420,
    toJSON: () => ({}),
  });
  return element;
}

function advance(viz: unknown, milliseconds: number): void {
  const renderer = (viz as { renderer: { update: (dt: number) => void } }).renderer;
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 100) renderer.update(100);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("chapter one playback", () => {
  it("completes and replays the linear input sweep", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockContext());
    const viz = new FunctionPlotViz(container(), [
      button("run", "播放输入移动"),
      slider("w", "轨道倾斜", -3, 3, 0.1, 1),
      slider("b", "上下移动", -5, 5, 0.1, 0),
    ]);
    viz.onMount();

    viz.setControl("run", 1);
    advance(viz, 4300);
    expect(viz.getStatus()).toBe("completed");

    viz.setControl("run", 1);
    expect(viz.getStatus()).toBe("running");
    viz.destroy();
  });

  it("runs the same input sweep after switching away from ReLU", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockContext());
    const viz = new ActivationViz(container(), [
      button("run", "播放输入扫描"),
      { key: "activation", label: "规则", type: "select", min: 0, max: 3, step: 1, default: 2, options: ["Step", "Sigmoid", "ReLU", "Tanh"] },
      slider("x", "输入", -6, 6, 0.5, 1),
    ]);
    viz.onMount();
    viz.setControl("activation", 1);
    advance(viz, 500);

    viz.setControl("run", 1);
    advance(viz, 4500);
    expect(viz.getStatus()).toBe("completed");
    expect(viz.getControls().x).toBe(6);
    viz.destroy();
  });

  it("moves through story, principle, and math drilldown levels", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockContext());
    const viz = new ActivationViz(container(), [
      button("run", "播放数字通过闸门"),
      { key: "activation", label: "闸门", type: "select", min: 0, max: 3, step: 1, default: 2, options: ["Step", "Sigmoid", "ReLU", "Tanh"] },
      { key: "mode", label: "层次", type: "segmented", min: 0, max: 2, step: 1, default: 0, options: ["故事", "原理", "数学"] },
      slider("x", "输入", -6, 6, 0.5, 1),
    ]);
    viz.onMount();

    expect(viz.getDrilldownDepth()).toBe(0);
    viz.setControl("mode", 0);
    expect(viz.getDrilldownDepth()).toBe(1);
    viz.setControl("mode", 1);
    expect(viz.getDrilldownDepth()).toBe(2);
    viz.setControl("mode", 2);
    expect(viz.getDrilldownDepth()).toBe(3);
    expect(viz.getDrilldownPath()).toEqual(["激活函数总览", "单向闸门 ReLU", "内部原理", "数学曲线"]);
    viz.destroy();
  });
});
