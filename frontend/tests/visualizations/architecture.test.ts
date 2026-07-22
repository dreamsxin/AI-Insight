import { describe, expect, it } from "vitest";
import { ARCHITECTURE_STAGES, architecturePositions } from "@/visualizations/ch07_transformer_overview/ArchitectureViz";

describe("ArchitectureViz layout", () => {
  it("keeps the journey centered in a compact three-column route", () => {
    const positions = architecturePositions(390);
    expect(positions).toHaveLength(ARCHITECTURE_STAGES.length);
    expect(positions.map((position) => position.x)).toEqual([
      -2.7, 0, 2.7,
      2.7, 0, -2.7,
      -2.7, 0, 2.7,
    ]);
    expect(positions[0].z).toBeLessThan(positions[3].z);
    expect(positions[3].z).toBeLessThan(positions[6].z);
  });

  it("uses a serpentine five-column route on wider screens", () => {
    const positions = architecturePositions(900);
    expect(positions.slice(0, 5).map((position) => position.x)).toEqual([-5, -2.5, 0, 2.5, 5]);
    expect(positions.slice(5).map((position) => position.x)).toEqual([5, 2.5, 0, -2.5]);
  });
});
