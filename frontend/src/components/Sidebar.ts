/** Sidebar - chapter navigation list. */

import type { ChapterSummary } from "@/types/chapter";
import type { Route } from "@/core/Router";

export class Sidebar {
  el: HTMLElement;
  private items: Map<number, HTMLElement> = new Map();
  private onNavigateCb: ((chapter: number) => void) | null = null;

  constructor() {
    this.el = document.createElement("aside");
    this.el.className = "sidebar";
    this.el.innerHTML = `
      <div class="sidebar-header">
        <h1>AI-Insight</h1>
        <p>洞见AI · 从函数到Transformer的视觉之旅</p>
      </div>
      <div class="chapter-list"></div>
    `;
  }

  setChapters(chapters: ChapterSummary[]): void {
    const list = this.el.querySelector(".chapter-list") as HTMLElement;
    list.innerHTML = "";
    this.items.clear();

    for (const ch of chapters) {
      const item = document.createElement("div");
      item.className = "chapter-item";
      item.innerHTML = `
        <div class="chapter-icon">${ch.icon}</div>
        <div class="chapter-info">
          <div class="title">${ch.title}</div>
          <div class="subtitle">${ch.subtitle}</div>
        </div>
      `;
      item.addEventListener("click", () => {
        this.onNavigateCb?.(ch.id);
      });
      this.items.set(ch.id, item);
      list.appendChild(item);
    }
  }

  setActive(chapter: number): void {
    for (const [id, el] of this.items) {
      el.classList.toggle("active", id === chapter);
    }
  }

  onNavigate(cb: (chapter: number) => void): void {
    this.onNavigateCb = cb;
  }

  updateRoute(route: Route): void {
    this.setActive(route.chapter);
  }
}
