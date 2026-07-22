import { describe, expect, it, vi } from "vitest";
import { ControlsPanel } from "@/components/ControlsPanel";
import type { ControlConfig } from "@/types/chapter";

describe("ControlsPanel", () => {
  it("shows semantic labels for discrete slider values", () => {
    const panel = new ControlsPanel();
    const config: ControlConfig = {
      key: "hidden_layers",
      label: "隐藏层数量",
      type: "slider",
      min: 1,
      max: 3,
      step: 1,
      default: 1,
      options: [],
      value_labels: ["1 层", "2 层", "3 层"],
    };

    panel.setControls([config], { hidden_layers: 1 });
    const input = panel.el.querySelector<HTMLInputElement>("#control-hidden_layers")!;
    input.value = "3";
    input.dispatchEvent(new Event("input"));

    expect(panel.el.textContent).toContain("3 层");
  });

  it("emits every button click, including repeated clicks", () => {
    const panel = new ControlsPanel();
    const onChange = vi.fn();
    const config: ControlConfig = {
      key: "run",
      label: "运行前向传播",
      type: "button",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [],
    };

    panel.onControlChange(onChange);
    panel.setControls([config], { run: 0 });
    const button = panel.el.querySelector<HTMLButtonElement>(".control-button button")!;
    button.click();
    button.click();

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("updates playback actions and run button labels from visualization state", () => {
    const panel = new ControlsPanel();
    const onPlayback = vi.fn();
    const config: ControlConfig = {
      key: "run",
      label: "运行前向传播",
      type: "button",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [],
    };

    panel.onPlaybackAction(onPlayback);
    panel.setControls([config], { run: 0 });
    panel.setPlaybackState("running");

    const runButton = panel.el.querySelector<HTMLButtonElement>(".control-button button")!;
    const playbackButton = panel.el.querySelector<HTMLButtonElement>(".playback-btn")!;
    expect(runButton.disabled).toBe(true);
    expect(runButton.textContent).toBe("运行中...");

    playbackButton.click();
    expect(onPlayback).toHaveBeenLastCalledWith("pause");

    panel.setPlaybackState("paused");
    expect(playbackButton.textContent).toContain("继续");
    playbackButton.click();
    expect(onPlayback).toHaveBeenLastCalledWith("resume");

    panel.setPlaybackState("completed");
    expect(runButton.textContent).toBe("重新运行前向传播");
  });
});
