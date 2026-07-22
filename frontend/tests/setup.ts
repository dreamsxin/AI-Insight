/** Vitest setup file - provides canvas/DOM stubs for testing. */

// happy-dom provides a basic canvas getContext stub.
// If getContext returns null, we create a mock.
import { vi } from "vitest";

// Ensure HTMLCanvasElement.getContext returns a stubbed context
if (!HTMLCanvasElement.prototype.getContext) {
  HTMLCanvasElement.prototype.getContext = (() => createMockCtx()) as CanvasRenderingContext2D;
}

function createMockCtx(): Partial<CanvasRenderingContext2D> {
  return {
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    rect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fill: () => {},
    stroke: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: () => ({ width: 0 }) as TextMetrics,
    clearRect: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }) as CanvasGradient,
    setLineDash: () => {},
    drawImage: () => {},
    bezierCurveTo: () => {},
    arcTo: () => {},
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    lineCap: "butt",
    lineJoin: "miter",
    setTransform: () => {},
  } as Partial<CanvasRenderingContext2D>;
}

// Patch performance.now for deterministic testing if not available
if (!globalThis.performance) {
  globalThis.performance = {
    now: () => Date.now(),
  } as Performance;
}
