/** Shared breadcrumb navigation for visualizations that zoom from overview to detail. */

import { BaseVisualization } from "@/visualizations/BaseVisualization";

export abstract class DrilldownVisualization extends BaseVisualization {
  private drilldownNav: HTMLElement | null = null;
  private drilldownPath: string[] = [];

  protected initializeDrilldown(rootLabel: string): void {
    this.drilldownPath = [rootLabel];
    this.drilldownNav = document.createElement("nav");
    this.drilldownNav.className = "drilldown-nav";
    this.drilldownNav.setAttribute("aria-label", "可视化层级");
    this.container.appendChild(this.drilldownNav);
    this.renderDrilldownNav();
  }

  protected setDrilldownPath(labels: string[]): void {
    this.drilldownPath = labels.length ? labels : this.drilldownPath.slice(0, 1);
    this.renderDrilldownNav();
  }

  getDrilldownDepth(): number {
    return Math.max(0, this.drilldownPath.length - 1);
  }

  getDrilldownPath(): string[] {
    return [...this.drilldownPath];
  }

  protected onDrilldownRequest(_depth: number): void {}

  override onUnmount(): void {
    this.drilldownNav?.remove();
    this.drilldownNav = null;
  }

  private renderDrilldownNav(): void {
    if (!this.drilldownNav) return;
    this.drilldownNav.innerHTML = "";

    this.drilldownPath.forEach((label, index) => {
      if (index > 0) {
        const separator = document.createElement("span");
        separator.className = "drilldown-separator";
        separator.textContent = "›";
        separator.setAttribute("aria-hidden", "true");
        this.drilldownNav!.appendChild(separator);
      }

      if (index < this.drilldownPath.length - 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "drilldown-link";
        button.textContent = label;
        button.addEventListener("click", () => this.onDrilldownRequest(index));
        this.drilldownNav!.appendChild(button);
      } else {
        const current = document.createElement("span");
        current.className = "drilldown-current";
        current.textContent = label;
        current.setAttribute("aria-current", "page");
        this.drilldownNav!.appendChild(current);
      }
    });
  }
}
