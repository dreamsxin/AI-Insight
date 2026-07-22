/** ControlsPanel - renders interactive controls from page config. */

import type { ControlConfig } from "@/types/chapter";
import type { PlaybackAction, VisualizationStatus } from "@/types/visualization";

export class ControlsPanel {
  el: HTMLElement;
  private onControlChangeCb: ((key: string, value: number) => void) | null = null;
  private onPlaybackActionCb: ((action: PlaybackAction) => void) | null = null;
  private controlElements: Map<string, HTMLInputElement | HTMLSelectElement | HTMLButtonElement> = new Map();
  private buttonLabels: Map<string, string> = new Map();
  private currentStatus: VisualizationStatus = "idle";
  private statusEl: HTMLElement | null = null;
  private playbackButton: HTMLButtonElement | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "controls-panel";
  }

  setControls(configs: ControlConfig[], currentValues: Record<string, number>): void {
    this.el.innerHTML = "";
    this.controlElements.clear();
    this.buttonLabels.clear();
    this.statusEl = null;
    this.playbackButton = null;

    if (configs.length === 0) {
      this.el.hidden = true;
      return;
    }
    this.el.hidden = false;

    const header = document.createElement("div");
    header.className = "controls-header";

    const heading = document.createElement("h2");
    heading.textContent = "交互参数";
    header.appendChild(heading);

    const playback = document.createElement("div");
    playback.className = "playback-toolbar";

    this.statusEl = document.createElement("span");
    this.statusEl.className = "playback-status";
    this.statusEl.setAttribute("aria-live", "polite");
    playback.appendChild(this.statusEl);

    this.playbackButton = document.createElement("button");
    this.playbackButton.type = "button";
    this.playbackButton.className = "playback-btn";
    this.playbackButton.addEventListener("click", () => {
      this.onPlaybackActionCb?.(this.currentStatus === "paused" ? "resume" : "pause");
    });
    playback.appendChild(this.playbackButton);

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "playback-btn";
    resetButton.textContent = "↺ 重置";
    resetButton.addEventListener("click", () => this.onPlaybackActionCb?.("reset"));
    playback.appendChild(resetButton);

    header.appendChild(playback);
    this.el.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "controls-grid";
    this.el.appendChild(grid);

    for (const cfg of configs) {
      const wrapper = document.createElement("div");
      wrapper.className = `control-item control-${cfg.type}`;

      if (cfg.type === "slider") {
        const initialValue = currentValues[cfg.key] ?? cfg.default;
        const inputId = `control-${cfg.key}`;
        wrapper.innerHTML = `
          <label for="${inputId}">
            <span>${cfg.label}</span>
            <span class="value mono" data-val="${cfg.key}">${this.formatValue(cfg, initialValue)}</span>
          </label>
        `;
        const input = document.createElement("input");
        input.id = inputId;
        input.type = "range";
        input.min = String(cfg.min);
        input.max = String(cfg.max);
        input.step = String(cfg.step);
        input.value = String(initialValue);
        input.addEventListener("input", () => {
          const val = parseFloat(input.value);
          wrapper.querySelector<HTMLElement>(`[data-val="${cfg.key}"]`)!.textContent = this.formatValue(cfg, val);
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
        this.buttonLabels.set(cfg.key, cfg.label);
      } else if (cfg.type === "select") {
        const label = document.createElement("label");
        const selectId = `control-${cfg.key}`;
        label.htmlFor = selectId;
        label.innerHTML = `<span>${cfg.label}</span>`;
        wrapper.appendChild(label);
        const select = document.createElement("select");
        select.id = selectId;
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

      grid.appendChild(wrapper);
    }

    this.updatePlaybackUi();
  }

  onControlChange(cb: (key: string, value: number) => void): void {
    this.onControlChangeCb = cb;
  }

  onPlaybackAction(cb: (action: PlaybackAction) => void): void {
    this.onPlaybackActionCb = cb;
  }

  setPlaybackState(status: VisualizationStatus): void {
    this.currentStatus = status;
    this.updatePlaybackUi();
  }

  private updatePlaybackUi(): void {
    const labels: Record<VisualizationStatus, string> = {
      idle: "就绪",
      running: "运行中",
      paused: "已暂停",
      completed: "已完成",
      error: "出现错误",
    };
    if (this.statusEl) {
      this.statusEl.textContent = labels[this.currentStatus];
      this.statusEl.dataset.status = this.currentStatus;
    }

    if (this.playbackButton) {
      const paused = this.currentStatus === "paused";
      this.playbackButton.textContent = paused ? "▶ 继续" : "Ⅱ 暂停";
      this.playbackButton.disabled = this.currentStatus === "completed" || this.currentStatus === "error";
    }

    for (const [key, originalLabel] of this.buttonLabels) {
      const button = this.controlElements.get(key);
      if (!(button instanceof HTMLButtonElement)) continue;
      const isRunAction = key === "run" || key === "play";
      if (!isRunAction) continue;
      button.disabled = this.currentStatus === "running" || this.currentStatus === "paused";
      button.textContent = this.currentStatus === "running"
        ? "运行中..."
        : this.currentStatus === "completed"
          ? `重新${originalLabel}`
          : this.currentStatus === "error"
            ? `重试${originalLabel}`
            : originalLabel;
    }
  }

  private formatValue(cfg: ControlConfig, value: number): string {
    if (cfg.value_labels?.length) {
      const step = cfg.step || 1;
      const index = Math.round((value - cfg.min) / step);
      return cfg.value_labels[index] ?? String(value);
    }

    const stepText = String(cfg.step);
    const decimals = stepText.includes(".") ? stepText.split(".")[1].length : 0;
    return value.toFixed(decimals);
  }
}
