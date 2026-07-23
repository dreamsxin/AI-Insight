/** ControlFormatter - format control values with units, labels, and precision.

Handles:
- value_labels for discrete sliders (maps index to semantic label)
- unit suffix (e.g. "0.3 ms", "50%", "3 ×")
- integer stepping (no ".00" for step=1)
- percentage formatting
*/

import type { ControlConfig } from "@/types/chapter";

export class ControlFormatter {
  /** Format a numeric value according to the control's configuration. */
  static format(cfg: ControlConfig, value: number): string {
    // 1. If value_labels exist, map the value to a semantic label
    if (cfg.value_labels?.length) {
      const step = cfg.step || 1;
      const index = Math.round((value - cfg.min) / step);
      return cfg.value_labels[index] ?? String(value);
    }

    // 2. Determine decimal precision from step
    const stepText = String(cfg.step);
    const decimals = stepText.includes(".") ? stepText.split(".")[1].length : 0;

    // 3. Format the number
    let formatted: string;
    if (decimals === 0) {
      formatted = String(Math.round(value));
    } else {
      formatted = value.toFixed(decimals);
    }

    // 4. Append unit suffix
    if (cfg.unit) {
      // Special case: "×" goes before the number for multiplication-like display
      if (cfg.unit === "×") {
        return `${formatted} ×`;
      }
      // Percentage: no space before %
      if (cfg.unit === "%") {
        return `${formatted}%`;
      }
      return `${formatted} ${cfg.unit}`;
    }

    return formatted;
  }

  /** Check if a control should be disabled while the visualization is running. */
  static shouldDisable(cfg: ControlConfig, isRunning: boolean): boolean {
    return Boolean(cfg.disabled_while_running) && isRunning;
  }
}
