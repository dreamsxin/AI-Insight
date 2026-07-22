/** Visualization registry - maps visualization class names to constructors. */

import type { BaseVisualization } from "./BaseVisualization";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VizConstructor = new (container: HTMLElement, controls: import("@/types/chapter").ControlConfig[]) => BaseVisualization;

export const VIZ_REGISTRY: Record<string, VizConstructor> = {};

export function registerViz(name: string, ctor: VizConstructor): void {
  VIZ_REGISTRY[name] = ctor;
}
