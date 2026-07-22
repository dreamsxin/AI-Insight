/** PageView - primary visualization, controls, and supporting concepts. */

import type { Page } from "@/types/chapter";
import { ControlsPanel } from "./ControlsPanel";

export class PageView {
  el: HTMLElement;
  canvasContainer: HTMLElement;
  infoPanel: HTMLDetailsElement;
  controlsPanel: ControlsPanel;
  private infoContent: HTMLElement;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "page-body";

    const pageMain = document.createElement("section");
    pageMain.className = "page-main";

    const canvasArea = document.createElement("div");
    canvasArea.className = "canvas-area";

    this.canvasContainer = document.createElement("div");
    this.canvasContainer.className = "canvas-container";
    this.canvasContainer.innerHTML = '<div class="loading">加载中</div>';
    canvasArea.appendChild(this.canvasContainer);
    pageMain.appendChild(canvasArea);

    this.controlsPanel = new ControlsPanel();
    pageMain.appendChild(this.controlsPanel.el);
    this.el.appendChild(pageMain);

    this.infoPanel = document.createElement("details");
    this.infoPanel.className = "info-panel";
    this.infoPanel.open = true;
    const summary = document.createElement("summary");
    summary.textContent = "概念与提示";
    this.infoPanel.appendChild(summary);

    this.infoContent = document.createElement("div");
    this.infoContent.className = "info-content";
    this.infoPanel.appendChild(this.infoContent);
    this.el.appendChild(this.infoPanel);
  }

  setPage(page: Page): void {
    this.canvasContainer.setAttribute("aria-label", `${page.title}交互可视化`);
    this.infoContent.innerHTML = "";

    const descEl = document.createElement("div");
    descEl.className = "page-desc";
    descEl.textContent = page.description;
    this.infoContent.appendChild(descEl);

    const seen = new Set([page.description.trim()]);
    for (const block of page.content) {
      const text = block.text.trim();
      if (!text || seen.has(text)) continue;
      const repeatsControls = block.type === "note" && page.controls.length > 0 && (
        page.controls.some((control) => text.includes(control.label)) ||
        /点击|拖动|选择|滑块|鼠标/.test(text)
      );
      if (repeatsControls) continue;
      seen.add(text);
      const el = document.createElement("div");
      el.className = `content-block ${block.type}`;
      el.textContent = block.text;
      this.infoContent.appendChild(el);
    }
  }

  clearCanvas(): void {
    this.canvasContainer.innerHTML = "";
  }

  getCanvasContainer(): HTMLElement {
    this.clearCanvas();
    return this.canvasContainer;
  }
}
