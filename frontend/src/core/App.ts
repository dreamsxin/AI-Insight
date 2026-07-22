/** App - main application controller. */

import { Router } from "./Router";
import { Sidebar } from "@/components/Sidebar";
import { PageView } from "@/components/PageView";
import { ControlsPanel } from "@/components/ControlsPanel";
import { fetchChapters, fetchChapter } from "@/api/chapters";
import type { Chapter, ChapterSummary, Page } from "@/types/chapter";
import type { PlaybackAction } from "@/types/visualization";
import { VIZ_REGISTRY } from "@/visualizations";
import { BaseVisualization } from "@/visualizations/BaseVisualization";

export class App {
  private router: Router;
  private sidebar: Sidebar;
  private pageView: PageView;
  private controlsPanel: ControlsPanel;
  private currentViz: BaseVisualization | null = null;
  private chapters: ChapterSummary[] = [];
  private currentChapter: Chapter | null = null;
  private currentPage: Page | null = null;
  private statusUnsubscribe: (() => void) | null = null;
  private controlValueUnsubscribe: (() => void) | null = null;
  private el: HTMLElement;

  constructor(rootEl: HTMLElement) {
    this.router = new Router();
    this.sidebar = new Sidebar();
    this.pageView = new PageView();
    this.controlsPanel = this.pageView.controlsPanel;
    this.el = rootEl;

    // Layout
    rootEl.appendChild(this.sidebar.el);
    rootEl.appendChild(this.sidebar.backdrop);

    const main = document.createElement("main");
    main.className = "main-content";

    const header = document.createElement("header");
    header.className = "content-header";

    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.className = "sidebar-toggle";
    menuButton.id = "sidebar-toggle";
    menuButton.setAttribute("aria-controls", "course-sidebar");
    menuButton.setAttribute("aria-label", "打开章节导航");
    menuButton.textContent = "☰";
    header.appendChild(menuButton);

    const headerContext = document.createElement("div");
    headerContext.className = "header-context";
    headerContext.innerHTML = `
      <div class="header-chapter" id="header-chapter">AI-Insight</div>
      <h1 class="header-page-title" id="header-page-title">AI 原理可视化</h1>
    `;
    header.appendChild(headerContext);

    const navDiv = document.createElement("div");
    navDiv.className = "page-nav";
    navDiv.setAttribute("aria-label", "页面导航");
    navDiv.innerHTML = `
      <button class="nav-btn" id="btn-prev"><span aria-hidden="true">‹</span><span class="nav-label">上一页</span></button>
      <span class="page-indicator" id="page-indicator" aria-live="polite">1 / 1</span>
      <button class="nav-btn" id="btn-next"><span class="nav-label">下一页</span><span aria-hidden="true">›</span></button>
    `;
    header.appendChild(navDiv);

    main.appendChild(header);
    main.appendChild(this.pageView.el);
    rootEl.appendChild(main);

    this.bindEvents();
  }

  private bindEvents(): void {
    this.sidebar.onNavigate((chapter) => {
      this.router.navigate(chapter);
    });

    document.getElementById("sidebar-toggle")!.addEventListener("click", () => {
      this.sidebar.open();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.sidebar.close();
    });

    document.getElementById("btn-prev")!.addEventListener("click", () => {
      this.router.prev();
    });

    document.getElementById("btn-next")!.addEventListener("click", () => {
      const route = this.router.route;
      const chapter = this.currentChapter;
      if (chapter && route.page < chapter.pages.length) {
        this.router.next();
      } else if (this.chapters.length > route.chapter) {
        this.router.navigate(route.chapter + 1);
      }
    });

    this.router.onChange((route) => this.handleRouteChange(route));

    this.controlsPanel.onControlChange((key, value) => {
      this.currentViz?.setControl(key, value);
    });

    this.controlsPanel.onPlaybackAction((action) => this.handlePlaybackAction(action));
  }

  private async handleRouteChange(route: { chapter: number; page: number }): Promise<void> {
    // Update sidebar active state
    this.sidebar.updateRoute(route);

    // Load chapter if needed
    if (!this.currentChapter || this.currentChapter.id !== route.chapter) {
      try {
        this.currentChapter = await fetchChapter(route.chapter);
      } catch (e) {
        console.error("Failed to load chapter:", e);
        return;
      }
    }

    const chapter = this.currentChapter;
    const pageIdx = Math.min(route.page - 1, chapter.pages.length - 1);
    const page = chapter.pages[pageIdx];
    if (!page) return;
    this.currentPage = page;

    // Update header
    document.getElementById("header-chapter")!.textContent = `第 ${chapter.id} 章 · ${chapter.title}`;
    document.getElementById("header-page-title")!.textContent = page.title;
    document.getElementById("page-indicator")!.textContent = `${pageIdx + 1} / ${chapter.pages.length}`;

    // Update nav buttons
    const prevBtn = document.getElementById("btn-prev") as HTMLButtonElement;
    const nextBtn = document.getElementById("btn-next") as HTMLButtonElement;
    prevBtn.disabled = pageIdx === 0 && route.chapter === 1;
    nextBtn.disabled = pageIdx === chapter.pages.length - 1 && route.chapter === this.chapters.length;

    // Update page view (info panel)
    this.pageView.setPage(page);

    this.mountVisualization(page);
  }

  private mountVisualization(page: Page): void {
    this.statusUnsubscribe?.();
    this.statusUnsubscribe = null;
    this.controlValueUnsubscribe?.();
    this.controlValueUnsubscribe = null;
    this.currentViz?.destroy();
    this.currentViz = null;

    const VizClass = VIZ_REGISTRY[page.visualization];
    const container = this.pageView.getCanvasContainer();
    if (VizClass) {
      this.currentViz = new VizClass(container, page.controls);
      if (page.api_endpoint) {
        (this.currentViz as BaseVisualization & { apiEndpoint?: string }).apiEndpoint = page.api_endpoint;
      }
      this.controlsPanel.setControls(page.controls, this.currentViz.getControls());
      this.statusUnsubscribe = this.currentViz.onStatusChange((status) => {
        this.controlsPanel.setPlaybackState(status);
      });
      this.controlValueUnsubscribe = this.currentViz.onControlValueChange((key, value) => {
        this.controlsPanel.setControlValue(key, value);
      });
      this.currentViz.start();
    } else {
      container.innerHTML = `<div class="loading">可视化 "${page.visualization}" 暂未实现</div>`;
      this.controlsPanel.setControls([], {});
    }
  }

  private handlePlaybackAction(action: PlaybackAction): void {
    if (action === "pause") {
      this.currentViz?.pause();
    } else if (action === "resume") {
      this.currentViz?.resume();
    } else if (action === "reset" && this.currentPage) {
      this.mountVisualization(this.currentPage);
    }
  }

  async init(): Promise<void> {
    try {
      this.chapters = await fetchChapters();
      this.sidebar.setChapters(this.chapters);
    } catch (e) {
      console.error("Failed to load chapters:", e);
      this.sidebar.el.querySelector(".chapter-list")!.innerHTML =
        '<div style="padding:20px;color:var(--negative);font-size:13px;">无法连接后端服务，请确保后端运行在 localhost:8000</div>';
    }
  }
}
