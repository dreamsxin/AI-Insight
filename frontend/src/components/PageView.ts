/** PageView - main content area: canvas + info panel + controls. */

import type { Page, Chapter } from "@/types/chapter";
import { ControlsPanel } from "./ControlsPanel";

export class PageView {
  el: HTMLElement;
  canvasContainer: HTMLElement;
  infoPanel: HTMLElement;
  controlsPanel: ControlsPanel;
  private onControlChangeCb: ((key: string, value: number) => void) | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "page-body";

    // Canvas area
    const canvasArea = document.createElement("div");
    canvasArea.className = "canvas-area";

    this.canvasContainer = document.createElement("div");
    this.canvasContainer.className = "canvas-container";
    this.canvasContainer.innerHTML = '<div class="loading">加载中</div>';
    canvasArea.appendChild(this.canvasContainer);

    this.el.appendChild(canvasArea);

    // Info panel
    this.infoPanel = document.createElement("div");
    this.infoPanel.className = "info-panel";
    this.el.appendChild(this.infoPanel);

    // Controls panel
    this.controlsPanel = new ControlsPanel();
  }

  setPage(page: Page): void {
    // Update info panel
    this.infoPanel.innerHTML = "";
    const titleEl = document.createElement("div");
    titleEl.className = "page-title";
    titleEl.textContent = page.title;
    this.infoPanel.appendChild(titleEl);

    const descEl = document.createElement("div");
    descEl.className = "page-desc";
    descEl.textContent = page.description;
    this.infoPanel.appendChild(descEl);

    for (const block of page.content) {
      const el = document.createElement("div");
      el.className = `content-block ${block.type}`;
      if (block.type === "note") {
        el.textContent = block.text;
      } else {
        el.textContent = block.text;
      }
      this.infoPanel.appendChild(el);
    }

    // Render controls (but don't attach to DOM yet - caller controls layout)
  }

  clearCanvas(): void {
    this.canvasContainer.innerHTML = "";
  }

  getCanvasContainer(): HTMLElement {
    this.clearCanvas();
    return this.canvasContainer;
  }
}
