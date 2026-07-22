/** ControlsPanel - renders interactive controls from page config. */

import type { ControlConfig } from "@/types/chapter";

export class ControlsPanel {
  el: HTMLElement;
  private onControlChangeCb: ((key: string, value: number) => void) | null = null;
  private controlElements: Map<string, HTMLInputElement | HTMLSelectElement | HTMLButtonElement> = new Map();

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "controls-panel";
  }

  setControls(configs: ControlConfig[], currentValues: Record<string, number>): void {
    this.el.innerHTML = "";
    this.controlElements.clear();

    if (configs.length === 0) {
      this.el.style.display = "none";
      return;
    }
    this.el.style.display = "block";

    const heading = document.createElement("h3");
    heading.textContent = "交互控制";
    this.el.appendChild(heading);

    for (const cfg of configs) {
      const wrapper = document.createElement("div");
      wrapper.className = "control-item";

      if (cfg.type === "slider") {
        wrapper.innerHTML = `
          <label>
            <span>${cfg.label}</span>
            <span class="value mono" data-val="${cfg.key}">${currentValues[cfg.key]?.toFixed(2) ?? cfg.default}</span>
          </label>
        `;
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(cfg.min);
        input.max = String(cfg.max);
        input.step = String(cfg.step);
        input.value = String(currentValues[cfg.key] ?? cfg.default);
        input.addEventListener("input", () => {
          const val = parseFloat(input.value);
          wrapper.querySelector<HTMLElement>(`[data-val="${cfg.key}"]`)!.textContent = val.toFixed(2);
          this.onControlChangeCb?.(cfg.key, val);
        });
        wrapper.appendChild(input);
        this.controlElements.set(cfg.key, input);
      } else if (cfg.type === "button") {
        const btn = document.createElement("button");
        btn.textContent = cfg.label;
        btn.addEventListener("click", () => {
          this.onControlChangeCb?.(cfg.key, 1);
        });
        wrapper.appendChild(btn);
        this.controlElements.set(cfg.key, btn);
      } else if (cfg.type === "select") {
        const label = document.createElement("label");
        label.innerHTML = `<span>${cfg.label}</span>`;
        wrapper.appendChild(label);
        const select = document.createElement("select");
        for (let i = 0; i < cfg.options.length; i++) {
          const opt = document.createElement("option");
          opt.value = String(i);
          opt.textContent = cfg.options[i];
          if (i === (currentValues[cfg.key] ?? cfg.default)) opt.selected = true;
          select.appendChild(opt);
        }
        select.addEventListener("change", () => {
          this.onControlChangeCb?.(cfg.key, parseFloat(select.value));
        });
        wrapper.appendChild(select);
        this.controlElements.set(cfg.key, select);
      }

      this.el.appendChild(wrapper);
    }
  }

  onControlChange(cb: (key: string, value: number) => void): void {
    this.onControlChangeCb = cb;
  }
}
