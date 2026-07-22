import { describe, expect, it, vi } from "vitest";
import { Renderer } from "@/canvas/engine/Renderer";
import { Tween } from "@/canvas/animation/Tween";

describe("Renderer animation queue", () => {
  it("keeps a tween requeued from its completion callback", () => {
    const canvas = document.createElement("canvas");
    canvas.getContext = vi.fn(() => ({
      clearRect: vi.fn(),
      setTransform: vi.fn(),
    })) as unknown as typeof canvas.getContext;

    const renderer = new Renderer(canvas);
    const state = { value: 0 };
    let completions = 0;
    const tween = new Tween(state, { value: 1 }, 100);

    tween.onComplete(() => {
      completions++;
      if (completions < 2) {
        state.value = 0;
        tween.reset();
        renderer.addTween(tween);
      }
    });

    renderer.addTween(tween);
    const update = (renderer as unknown as { update: (dt: number) => void }).update.bind(renderer);
    update(100);
    update(100);

    expect(completions).toBe(2);
    expect(state.value).toBe(1);
  });
});
