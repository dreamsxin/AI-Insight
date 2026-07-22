/** Sidebar - chapter navigation list. */

import type { ChapterSummary } from "@/types/chapter";
import type { Route } from "@/core/Router";

export class Sidebar {
  el: HTMLElement;
  backdrop: HTMLButtonElement;
  private items: Map<number, HTMLButtonElement> = new Map();
  private onNavigateCb: ((chapter: number) => void) | null = null;

  constructor() {
    this.el = document.createElement("aside");
    this.el.className = "sidebar";
    this.el.id = "course-sidebar";
    this.el.innerHTML = `
      <div class="sidebar-header">
        <div class="brand-mark" aria-hidden="true">AI</div>
        <div class="brand-copy">
          <h1>AI-Insight</h1>
          <p>AI 原理可视化课程</p>
        </div>
        <button class="sidebar-close" type="button" aria-label="关闭章节导航">×</button>
      </div>
      <nav class="chapter-list" aria-label="课程章节"></nav>
    `;

    this.backdrop = document.createElement("button");
    this.backdrop.type = "button";
    this.backdrop.className = "sidebar-backdrop";
    this.backdrop.setAttribute("aria-label", "关闭章节导航");

    this.el.querySelector<HTMLButtonElement>(".sidebar-close")!.addEventListener("click", () => this.close());
    this.backdrop.addEventListener("click", () => this.close());
  }

  setChapters(chapters: ChapterSummary[]): void {
    const list = this.el.querySelector(".chapter-list") as HTMLElement;
    list.innerHTML = "";
    this.items.clear();

    for (const ch of chapters) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "chapter-item";
      item.innerHTML = `
        <span class="chapter-index">${String(ch.id).padStart(2, "0")}</span>
        <div class="chapter-info">
          <div class="title">${ch.title}</div>
          <div class="subtitle">${ch.page_count} 个主题</div>
        </div>
      `;
      item.addEventListener("click", () => {
        this.onNavigateCb?.(ch.id);
        this.close();
      });
      this.items.set(ch.id, item);
      list.appendChild(item);
    }
  }

  setActive(chapter: number): void {
    for (const [id, el] of this.items) {
      const active = id === chapter;
      el.classList.toggle("active", active);
      if (active) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    }
  }

  onNavigate(cb: (chapter: number) => void): void {
    this.onNavigateCb = cb;
  }

  updateRoute(route: Route): void {
    this.setActive(route.chapter);
  }

  open(): void {
    this.el.classList.add("is-open");
    this.backdrop.classList.add("is-visible");
    document.body.classList.add("sidebar-open");
  }

  close(): void {
    this.el.classList.remove("is-open");
    this.backdrop.classList.remove("is-visible");
    document.body.classList.remove("sidebar-open");
  }
}
