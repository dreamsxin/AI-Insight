/** ControlsPanel - renders interactive controls from page config.

Supports: slider, button, select, toggle (switch), text input,
segmented buttons, and stepper.
Uses ControlFormatter for value display (units, labels, precision).
*/

import type { ControlConfig } from "@/types/chapter";
import type { PlaybackAction, VisualizationStatus } from "@/types/visualization";
import { ControlFormatter } from "@/utils/ControlFormatter";

export class ControlsPanel {
  el: HTMLElement;
  private onControlChangeCb: ((key: string, value: number) => void) | null = null;
  private onTextChangeCb: ((key: string, text: string) => void) | null = null;
  private onPlaybackActionCb: ((action: PlaybackAction) => void) | null = null;
  private controlElements: Map<string, HTMLInputElement | HTMLSelectElement | HTMLButtonElement> = new Map();
  private controlConfigs: Map<string, ControlConfig> = new Map();
  private buttonLabels: Map<string, string> = new Map();
  private currentStatus: VisualizationStatus = "idle";
  private statusEl: HTMLElement | null = null;
  private playbackButton: HTMLButtonElement | null = null;
  private grid: HTMLElement | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "controls-panel";
  }

  setControls(configs: ControlConfig[], currentValues: Record<string, number>): void {
    this.el.innerHTML = "";
    this.controlElements.clear();
    this.controlConfigs.clear();
    this.buttonLabels.clear();
    this.statusEl = null;
    this.playbackButton = null;

    if (configs.length === 0) {
      this.el.hidden = true;
      return;
    }
    this.el.hidden = false;

    // Header + playback toolbar
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

    // Group controls by `group` field
    const groups = this.groupConfigs(configs);
    this.grid = document.createElement("div");
    this.grid.className = "controls-grid";

    for (const [groupName, groupConfigs] of groups) {
      if (groupName !== "__default__") {
        const groupLabel = document.createElement("div");
        groupLabel.className = "control-group-label";
        groupLabel.textContent = groupName;
        this.grid.appendChild(groupLabel);
      }
      for (const cfg of groupConfigs) {
        this.renderControl(cfg, currentValues, this.grid);
      }
    }

    this.el.appendChild(this.grid);
    this.updatePlaybackUi();
  }

  private groupConfigs(configs: ControlConfig[]): Map<string, ControlConfig[]> {
    const groups = new Map<string, ControlConfig[]>();
    for (const cfg of configs) {
      const g = cfg.group ?? "__default__";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(cfg);
    }
    return groups;
  }

  private renderControl(cfg: ControlConfig, currentValues: Record<string, number>, container: HTMLElement): void {
    this.controlConfigs.set(cfg.key, cfg);
    const wrapper = document.createElement("div");
    wrapper.className = `control-item control-${cfg.type}`;
    wrapper.dataset.key = cfg.key;
    if (cfg.description) wrapper.title = cfg.description;

    switch (cfg.type) {
      case "slider":
        this.renderSlider(cfg, currentValues, wrapper);
        break;
      case "button":
        this.renderButton(cfg, wrapper);
        break;
      case "select":
        this.renderSelect(cfg, currentValues, wrapper);
        break;
      case "toggle":
        this.renderToggle(cfg, currentValues, wrapper);
        break;
      case "text":
        this.renderText(cfg, currentValues, wrapper);
        break;
      case "segmented":
        this.renderSegmented(cfg, currentValues, wrapper);
        break;
      case "stepper":
        this.renderStepper(cfg, currentValues, wrapper);
        break;
    }

    container.appendChild(wrapper);
  }

  private renderSlider(cfg: ControlConfig, currentValues: Record<string, number>, wrapper: HTMLElement): void {
    const initialValue = currentValues[cfg.key] ?? cfg.default;
    const inputId = `control-${cfg.key}`;
    wrapper.innerHTML = `
      <label for="${inputId}">
        <span>${cfg.label}</span>
        <span class="value mono" data-val="${cfg.key}">${ControlFormatter.format(cfg, initialValue)}</span>
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
      wrapper.querySelector<HTMLElement>(`[data-val="${cfg.key}"]`)!.textContent = ControlFormatter.format(cfg, val);
      this.onControlChangeCb?.(cfg.key, val);
    });
    wrapper.appendChild(input);
    this.controlElements.set(cfg.key, input);
  }

  private renderButton(cfg: ControlConfig, wrapper: HTMLElement): void {
    const btn = document.createElement("button");
    btn.textContent = cfg.label;
    btn.addEventListener("click", () => {
      this.onControlChangeCb?.(cfg.key, 1);
    });
    wrapper.appendChild(btn);
    this.controlElements.set(cfg.key, btn);
    this.buttonLabels.set(cfg.key, cfg.label);
  }

  private renderSelect(cfg: ControlConfig, currentValues: Record<string, number>, wrapper: HTMLElement): void {
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

  private renderToggle(cfg: ControlConfig, currentValues: Record<string, number>, wrapper: HTMLElement): void {
    const toggleId = `control-${cfg.key}`;
    const isOn = (currentValues[cfg.key] ?? cfg.default) !== 0;
    wrapper.innerHTML = `
      <label for="${toggleId}" class="toggle-label">
        <span>${cfg.label}</span>
      </label>
    `;
    const switchEl = document.createElement("button");
    switchEl.id = toggleId;
    switchEl.type = "button";
    switchEl.className = `toggle-switch ${isOn ? "on" : "off"}`;
    switchEl.setAttribute("role", "switch");
    switchEl.setAttribute("aria-checked", String(isOn));
    switchEl.textContent = isOn ? "开" : "关";
    switchEl.addEventListener("click", () => {
      const newVal = switchEl.classList.contains("on") ? 0 : 1;
      switchEl.classList.toggle("on", newVal === 1);
      switchEl.classList.toggle("off", newVal === 0);
      switchEl.setAttribute("aria-checked", String(newVal === 1));
      switchEl.textContent = newVal === 1 ? "开" : "关";
      this.onControlChangeCb?.(cfg.key, newVal);
    });
    wrapper.appendChild(switchEl);
    this.controlElements.set(cfg.key, switchEl);
  }

  private renderText(cfg: ControlConfig, currentValues: Record<string, number>, wrapper: HTMLElement): void {
    const inputId = `control-${cfg.key}`;
    const label = document.createElement("label");
    label.htmlFor = inputId;
    label.innerHTML = `<span>${cfg.label}</span>`;
    wrapper.appendChild(label);
    const input = document.createElement("input");
    input.id = inputId;
    input.type = "text";
    input.className = "text-input";
    input.placeholder = cfg.description ?? "输入文本...";
    // Use value_labels[0] as default text if available, else use the default index into options
    const defaultIdx = Math.floor(currentValues[cfg.key] ?? cfg.default);
    input.value = cfg.options[defaultIdx] ?? cfg.value_labels?.[defaultIdx] ?? "";
    input.addEventListener("input", () => {
      this.onTextChangeCb?.(cfg.key, input.value);
    });
    wrapper.appendChild(input);
    this.controlElements.set(cfg.key, input);
  }

  private renderSegmented(cfg: ControlConfig, currentValues: Record<string, number>, wrapper: HTMLElement): void {
    const label = document.createElement("label");
    label.innerHTML = `<span>${cfg.label}</span>`;
    wrapper.appendChild(label);
    const segContainer = document.createElement("div");
    segContainer.className = "segmented-control";
    const currentIdx = Math.floor(currentValues[cfg.key] ?? cfg.default);
    for (let i = 0; i < cfg.options.length; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `segmented-btn ${i === currentIdx ? "active" : ""}`;
      btn.textContent = cfg.options[i];
      btn.addEventListener("click", () => {
        segContainer.querySelectorAll(".segmented-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.onControlChangeCb?.(cfg.key, i);
      });
      segContainer.appendChild(btn);
    }
    wrapper.appendChild(segContainer);
    // Store first button for disabled state management
    const firstBtn = segContainer.querySelector("button");
    if (firstBtn) this.controlElements.set(cfg.key, firstBtn as HTMLButtonElement);
  }

  private renderStepper(cfg: ControlConfig, currentValues: Record<string, number>, wrapper: HTMLElement): void {
    const inputId = `control-${cfg.key}`;
    const currentValue = currentValues[cfg.key] ?? cfg.default;
    wrapper.innerHTML = `
      <label for="${inputId}">
        <span>${cfg.label}</span>
        <span class="value mono" data-val="${cfg.key}">${ControlFormatter.format(cfg, currentValue)}</span>
      </label>
    `;
    const stepperRow = document.createElement("div");
    stepperRow.className = "stepper-row";
    const decBtn = document.createElement("button");
    decBtn.type = "button";
    decBtn.className = "stepper-btn";
    decBtn.textContent = "−";
    const incBtn = document.createElement("button");
    incBtn.type = "button";
    incBtn.className = "stepper-btn";
    incBtn.textContent = "+";
    let value = currentValue;
    const update = (newVal: number) => {
      value = Math.max(cfg.min, Math.min(cfg.max, newVal));
      wrapper.querySelector<HTMLElement>(`[data-val="${cfg.key}"]`)!.textContent = ControlFormatter.format(cfg, value);
      this.onControlChangeCb?.(cfg.key, value);
    };
    decBtn.addEventListener("click", () => update(value - cfg.step));
    incBtn.addEventListener("click", () => update(value + cfg.step));
    stepperRow.appendChild(decBtn);
    stepperRow.appendChild(incBtn);
    wrapper.appendChild(stepperRow);
    this.controlElements.set(cfg.key, incBtn);
  }

  onControlChange(cb: (key: string, value: number) => void): void {
    this.onControlChangeCb = cb;
  }

  onTextChange(cb: (key: string, text: string) => void): void {
    this.onTextChangeCb = cb;
  }

  onPlaybackAction(cb: (action: PlaybackAction) => void): void {
    this.onPlaybackActionCb = cb;
  }

  setPlaybackState(status: VisualizationStatus): void {
    this.currentStatus = status;
    this.updatePlaybackUi();
  }

  setControlValue(key: string, value: number): void {
    const config = this.controlConfigs.get(key);
    const control = this.controlElements.get(key);
    if (!config) return;

    if (config.type === "segmented") {
      const wrapper = this.grid?.querySelector(`[data-key="${key}"]`);
      wrapper?.querySelectorAll<HTMLButtonElement>(".segmented-btn").forEach((button, index) => {
        button.classList.toggle("active", index === Math.round(value));
      });
      return;
    }

    if (!control || control instanceof HTMLButtonElement) return;

    control.value = String(value);
    if (control instanceof HTMLInputElement) {
      const valueEl = this.el.querySelector<HTMLElement>(`[data-val="${key}"]`);
      if (valueEl) valueEl.textContent = ControlFormatter.format(config, value);
    }
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
      this.playbackButton.disabled = this.currentStatus === "idle"
        || this.currentStatus === "completed"
        || this.currentStatus === "error";
    }

    // Update run/play buttons
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

    // Disable controls marked disabled_while_running
    const isRunning = this.currentStatus === "running" || this.currentStatus === "paused";
    for (const [key, cfg] of this.controlConfigs) {
      if (!cfg.disabled_while_running) continue;
      const el = this.controlElements.get(key);
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
        el.disabled = isRunning;
      } else if (el instanceof HTMLButtonElement) {
        // Don't disable the run/play button here (handled above)
        if (key !== "run" && key !== "play") {
          el.disabled = isRunning;
        }
      }
      // Also disable segmented buttons
      const wrapper = this.grid?.querySelector(`[data-key="${key}"]`);
      if (wrapper) {
        wrapper.querySelectorAll("button").forEach(btn => {
          if (key !== "run" && key !== "play") {
            (btn as HTMLButtonElement).disabled = isRunning;
          }
        });
      }
    }
  }

  /** Get the current text value of a text-type control. */
  getTextValue(key: string): string {
    const el = this.controlElements.get(key);
    if (el instanceof HTMLInputElement) return el.value;
    return "";
  }
}
