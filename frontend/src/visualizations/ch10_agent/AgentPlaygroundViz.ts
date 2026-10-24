/** AgentPlaygroundViz - live chat with the agent runtime (chapter 10). */

import { agentChat } from "@/api/agent";
import { ApiError } from "@/api/client";
import { BaseVisualization } from "@/visualizations/BaseVisualization";

import "./agent-playground.css";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "算一下 17+25",
  "演示卷积 kernel=edge",
  "前向传播 inputs=[0.5, 0.2, 0.9]",
];

export class AgentPlaygroundViz extends BaseVisualization {
  private root: HTMLDivElement | null = null;
  private logEl: HTMLDivElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private statusEl: HTMLSpanElement | null = null;
  private history: Turn[] = [];
  private running = false;

  onMount(): void {
    this.root = document.createElement("div");
    this.root.className = "agp";
    this.root.innerHTML = this.renderSkeleton();
    this.container.appendChild(this.root);

    this.logEl = this.root.querySelector(".agp-log");
    this.inputEl = this.root.querySelector(".agp-input input");
    this.sendBtn = this.root.querySelector(".agp-input button");
    this.statusEl = this.root.querySelector(".agp-dot");

    this.sendBtn?.addEventListener("click", () => void this.send());
    this.inputEl?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) void this.send();
    });
    for (const chip of this.root.querySelectorAll<HTMLButtonElement>(".agp-chip")) {
      chip.addEventListener("click", () => {
        if (this.inputEl && !this.running) {
          this.inputEl.value = chip.dataset.q ?? "";
          void this.send();
        }
      });
    }

    this.appendSystem("教学助手已就绪：算术用 calculator，前向传播用 nn_forward_demo（3 个输入），卷积用 cnn_convolve_demo。");
    this.inputEl?.focus();
  }

  override onUnmount(): void {
    this.root?.remove();
    this.root = null;
  }

  private renderSkeleton(): string {
    const chips = SUGGESTIONS.map((q) => `<button class="agp-chip" data-q="${q}">${q}</button>`).join("");
    return `
      <div class="agp-head">
        <span class="agp-dot"></span>
        <b>Agent 实验台</b>
        <span>模型提案工具 · 宿主执行 · 观察回填（Hermes 04 期主循环）</span>
      </div>
      <div class="agp-log"></div>
      <div class="agp-chips">${chips}</div>
      <div class="agp-input">
        <input type="text" placeholder="问点什么，或点上方示例…" maxlength="2000" />
        <button type="button">发送</button>
      </div>`;
  }

  private appendMessage(role: "user" | "agent" | "system", text: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = `agp-msg ${role}`;
    el.textContent = text;
    this.logEl?.appendChild(el);
    this.scrollLog();
    return el;
  }

  private appendSystem(text: string): void {
    this.appendMessage("system", text);
  }

  private appendTrace(container: HTMLDivElement): void {
    const wrap = document.createElement("div");
    wrap.className = "agp-trace";
    container.appendChild(wrap);
  }

  private appendStep(trace: HTMLDivElement, step: { type: string; name: string; content?: string | null; is_error?: boolean }): void {
    const el = document.createElement("div");
    const isCall = step.type === "tool_call";
    el.className = `agp-step ${step.type === "tool_call" ? "call" : "result"}${step.is_error ? " is-err" : ""}`;
    const k = document.createElement("span");
    k.className = "k";
    k.textContent = isCall ? "提案" : step.is_error ? "失败" : "结果";
    const v = document.createElement("span");
    v.className = "v";
    v.textContent = isCall ? `${step.name}()` : `${step.name} → ${step.content ?? ""}`;
    v.title = v.textContent ?? "";
    el.append(k, v);
    trace.appendChild(el);
    this.scrollLog();
  }

  private scrollLog(): void {
    if (this.logEl) this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  private setRunning(busy: boolean): void {
    this.running = busy;
    if (this.sendBtn) this.sendBtn.disabled = busy;
    if (this.inputEl) this.inputEl.disabled = busy;
    if (this.statusEl) this.statusEl.className = `agp-dot${busy ? " busy" : ""}`;
  }

  private async send(): Promise<void> {
    const text = (this.inputEl?.value ?? "").trim();
    if (!text || this.running) return;
    this.setRunning(true);
    if (this.inputEl) this.inputEl.value = "";

    this.appendMessage("user", text);
    const typing = this.appendMessage("agent", "思考中…");

    try {
      const resp = await agentChat(
        { message: text, history: this.history, max_steps: 8, temperature: 0.3 },
        this.getAbortSignal(),
      );
      typing.remove();
      const bubble = this.appendMessage("agent", resp.output);
      if (resp.trace.length > 0) {
        this.appendTrace(bubble);
        for (const step of resp.trace) this.appendStep(bubble.querySelector(".agp-trace")!, step);
        this.scrollLog();
      }
      this.history.push({ role: "user", content: text });
      this.history.push({ role: "assistant", content: resp.output });
    } catch (err) {
      typing.remove();
      const detail =
        err instanceof ApiError
          ? `请求失败（HTTP ${err.status}）`
          : err instanceof DOMException && err.name === "AbortError"
            ? "已取消"
            : "网络错误，请确认后端已启动";
      this.appendMessage("system", detail);
      if (this.statusEl) this.statusEl.className = "agp-dot err";
    } finally {
      this.setRunning(false);
      this.inputEl?.focus();
    }
  }
}
