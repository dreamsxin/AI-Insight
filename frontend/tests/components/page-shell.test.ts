import { describe, expect, it } from "vitest";
import { PageView } from "@/components/PageView";
import { Sidebar } from "@/components/Sidebar";
import type { ChapterSummary, Page } from "@/types/chapter";

describe("Responsive page shell", () => {
  it("renders chapter navigation as buttons and toggles the drawer", () => {
    const sidebar = new Sidebar();
    const chapters: ChapterSummary[] = [{
      id: 1,
      title: "从函数到神经网络",
      subtitle: "Functions",
      page_count: 3,
      icon: "",
    }];

    sidebar.setChapters(chapters);
    const item = sidebar.el.querySelector<HTMLButtonElement>(".chapter-item");
    expect(item?.tagName).toBe("BUTTON");

    sidebar.open();
    expect(sidebar.el.classList.contains("is-open")).toBe(true);
    expect(sidebar.backdrop.classList.contains("is-visible")).toBe(true);

    sidebar.close();
    expect(sidebar.el.classList.contains("is-open")).toBe(false);
  });

  it("keeps controls beside the visualization and removes repeated action notes", () => {
    const view = new PageView();
    const page: Page = {
      id: "p1",
      title: "前向传播",
      visualization: "ForwardPassViz",
      description: "数据逐层流动。",
      content: [
        { type: "text", text: "每层执行加权求和。" },
        { type: "formula", text: "a = f(Wx + b)" },
        { type: "note", text: "点击运行前向传播按钮开始。" },
      ],
      controls: [{
        key: "run",
        label: "运行前向传播",
        type: "button",
        min: 0,
        max: 1,
        step: 1,
        default: 0,
        options: [],
      }],
    };

    view.setPage(page);
    expect(view.controlsPanel.el.parentElement?.classList.contains("page-main")).toBe(true);
    expect(view.canvasContainer.getAttribute("aria-label")).toBe("前向传播交互可视化");
    expect(view.infoPanel.textContent).toContain("每层执行加权求和");
    expect(view.infoPanel.textContent).not.toContain("点击运行前向传播按钮开始");
  });
});
