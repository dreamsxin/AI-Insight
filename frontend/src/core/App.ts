/** App - main application controller. */

import { Router } from "./Router";
import { EventBus } from "./EventBus";
import { Sidebar } from "@/components/Sidebar";
import { PageView } from "@/components/PageView";
import { ControlsPanel } from "@/components/ControlsPanel";
import { fetchChapters, fetchChapter } from "@/api/chapters";
import type { Chapter, Page, ChapterSummary } from "@/types/chapter";
import { VIZ_REGISTRY } from "@/visualizations";
import { BaseVisualization } from "@/visualizations/BaseVisualization";

export class App {
  private router: Router;
  private bus: EventBus;
  private sidebar: Sidebar;
  private pageView: PageView;
  private controlsPanel: ControlsPanel;
  private currentViz: BaseVisualization | null = null;
  private chapters: ChapterSummary[] = [];
  private currentChapter: Chapter | null = null;
  private el: HTMLElement;

  constructor(rootEl: HTMLElement) {
    this.router = new Router();
    this.bus = new EventBus();
    this.sidebar = new Sidebar();
    this.pageView = new PageView();
    this.controlsPanel = this.pageView.controlsPanel;
    this.el = rootEl;

    // Layout
    rootEl.appendChild(this.sidebar.el);

    const main = document.createElement("main");
    main.className = "main-content";

    const header = document.createElement("div");
    header.className = "content-header";

    const titleDiv = document.createElement("div");
    titleDiv.className = "title";
    titleDiv.id = "header-title";
    titleDiv.textContent = "AI-Insight · 洞见AI";
    header.appendChild(titleDiv);

    const navDiv = document.createElement("div");
    navDiv.className = "page-nav";
    navDiv.innerHTML = `
      <button class="nav-btn" id="btn-prev">‹ 上一页</button>
      <span class="page-indicator" id="page-indicator">1 / 1</span>
      <button class="nav-btn" id="btn-next">下一页 ›</button>
    `;
    header.appendChild(navDiv);

    main.appendChild(header);
    main.appendChild(this.pageView.el);
    main.appendChild(this.controlsPanel.el);
    rootEl.appendChild(main);

    this.bindEvents();
  }

  private bindEvents(): void {
    this.sidebar.onNavigate((chapter) => {
      this.router.navigate(chapter);
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

    window.addEventListener("resize", () => {
      this.currentViz?.resize();
    });
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

    // Destroy previous visualization
    if (this.currentViz) {
      this.currentViz.destroy();
      this.currentViz = null;
    }

    // Update header
    document.getElementById("header-title")!.textContent = `${chapter.icon} ${chapter.title}`;
    document.getElementById("page-indicator")!.textContent = `${pageIdx + 1} / ${chapter.pages.length}`;

    // Update nav buttons
    const prevBtn = document.getElementById("btn-prev") as HTMLButtonElement;
    const nextBtn = document.getElementById("btn-next") as HTMLButtonElement;
    prevBtn.disabled = pageIdx === 0 && route.chapter === 1;
    nextBtn.disabled = pageIdx === chapter.pages.length - 1 && route.chapter === this.chapters.length;

    // Update page view (info panel)
    this.pageView.setPage(page);

    // Create visualization
    const VizClass = VIZ_REGISTRY[page.visualization];
    const container = this.pageView.getCanvasContainer();
    if (VizClass) {
      this.currentViz = new VizClass(container, page.controls);
      if (page.api_endpoint) {
        (this.currentViz as BaseVisualization & { apiEndpoint?: string }).apiEndpoint = page.api_endpoint;
      }
      this.currentViz.start();
      // Sync initial controls
      this.controlsPanel.setControls(page.controls, this.currentViz.getControls());
    } else {
      container.innerHTML = `<div class="loading">可视化 "${page.visualization}" 暂未实现</div>`;
      this.controlsPanel.setControls([], {});
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
