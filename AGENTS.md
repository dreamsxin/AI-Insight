# AGENTS.md

Guidance for ZCode agents working in this repository.

## Project

AI-Insight (洞见AI) is an interactive, Chinese-language tutorial that visualizes
AI/neural-network principles. A FastAPI backend performs real NumPy computations;
a Vite + TypeScript (strict) frontend renders them with a custom Canvas 2D engine
(no React/Vue). Content is organized as 9 chapters, each with pages containing a
visualization, explanatory text, and interactive controls. All user-facing copy is
**Chinese** — match that when adding content.

## Commands

Backend (run from `backend/`):

- Install: `pip install -r requirements.txt` (Python 3.10+)
- Dev server: `python -m uvicorn main:app --reload --port 8000`
- Tests: `pytest` (`asyncio_mode=auto` is set in `pytest.ini`)

Frontend (run from `frontend/`):

- Install: `npm install` (Node 18+)
- Dev server: `npm run dev` → http://localhost:5173 (proxies `/api` → `localhost:8000`)
- Typecheck/build: `npm run build` (`tsc -b && vite build`) — there is no linter configured
- Tests one-shot: `npx vitest run` (`npm test` starts Vitest in watch mode)

`start.bat` / `start.sh` launch both servers.

## Architecture

- **Backend layering**: `routers/` (HTTP) → `services/` (NumPy compute:
  `neural_network.py`, `cnn.py`, `transformer.py`, `datasets.py`) ; Pydantic request
  models in `models/`; chapter content and the 100-term library in `data/`.
  Services raise `ValueError` for bad input; routers translate it to HTTP 400 via
  the `_safe()` helper — follow this pattern for new compute endpoints.
- **Content is data-driven**: `backend/app/data/chapters.py` defines
  Chapter → Page, and each page names a visualization by **string** plus its
  `ControlConfig`s. The frontend resolves that string through `VIZ_REGISTRY`.
- **Adding a visualization**: extend `BaseVisualization` (abstract `onMount()`,
  optional `onControlChange`/`onUnmount`), register it with `registerViz("Name", Ctor)`
  in the chapter's `visualizations/chXX/index.ts`, and reference `"Name"` in
  `chapters.py`. The barrel `visualizations/index.ts` imports every chapter module to
  populate the registry.
- **Canvas engine** lives in `frontend/src/canvas/` (`engine/` Renderer/Scene/
  AnimationLoop, `shapes/`, `animation/` Tween/Timeline/Easing, `interaction/`).
  Prefer it over adding rendering libraries. `three` is a dependency but is only used
  by three visualizations (`ch07` ArchitectureViz, `ch08` TokenizerViz/
  EmbeddingPipelineViz) — Canvas 2D is the default.
- **Lifecycle/requests**: viz instances are created and destroyed per page. Use
  `getAbortSignal()` from `BaseVisualization` for fetch calls so navigation/destroy
  cancels in-flight requests, and do cleanup in `onUnmount()`. API calls go through
  the wrappers in `src/api/client.ts` (`apiGet`/`apiPost`), never raw `fetch`.
- Frontend code is plain TS classes; DOM UI components live in `src/components/`,
  app wiring in `src/core/` (App, Router, EventBus).

## Conventions

- Import path alias: `@/` → `frontend/src/`.
- TypeScript strict mode; do not weaken types to silence errors.
- Keep educational copy jargon-light and analogy-driven (see existing `chapters.py`).
- Dark theme, cyan/purple palette — reuse CSS variables in `src/styles/` and color
  helpers in `src/utils/color.ts`.

## Gotchas

- Trained models persist as individual JSON files under
  `backend/app/data/saved_models/` (no database). The directory is git-ignored and
  created at runtime by `services/model_store.py`; don't commit model files.
- `docs/` holds the animation collection; `index.html` is the only entry point
  and links all 81 episodes (none orphaned). Nine series, in index order:
  HERMES AGENT 对象拆解 ·01–18 (08 跨会话记忆篇 is 前瞻演绎/designed
  extrapolation); HERMES AGENT 进阶机制 ·01–07 (thinking budget wired into the
  main loop, Skills progressive disclosure, Hooks lifecycle slots, MCP 2026
  transport evolution, A2A & multi-agent sobering, Harness
  scaffold/checkpoint/background tasks, CUA); AI 运作原理拆解 ·01–15 (13 推理
  模型与思维链 is the merged episode: thinking-token mechanism, trial-and-error
  chain, test-time compute, effort spectrum, billing — it absorbed the old
  深入篇 思考链 episode, and its hero is a 3D search tree that backtracks); AI
  运作原理 · 深入篇 ·01–07 (Transformer skeleton, MoE gating, KV cache + GQA +
  paging, embedding & two-stage retrieval, RLVR & distillation, LoRA
  fine-tuning, multimodal); LLM 模型算法
  原理 ·01–05 (embedding/loss/position-encoding/residual internals + a worked
  vector-attention poem); 推理原理 ·01–12 (`inf-` prefix: the serving layer —
  protocol normalisation, special-token identity, prefill/decode, E-P-D
  disaggregation, async scheduling, three-tier KV cache, SWA bounded replay,
  speculative decoding, EPLB, constrained decoding, streaming parse); AGENT
  开发避坑指南 ·01–05 (incl. 05 tool-poisoning injection); AGENT 实战工坊
  ·01–06 (knowledge-QA RAG walkthrough, project-selection guide, Agentic RAG,
  GraphRAG); AGENT 模式进阶 ·01–06 (`pat-` prefix: Plan-and-Execute,
  Reflection, CoALA memory extraction/routing, window/summary compression, MCP
  Host/Client/Server + tools/list, soft-vs-hard guardrails).
  Each demo is one self-contained file (no build step) using full-screen CSS
  scroll-snap, one animation per screen; they are not part of the Vite app and
  frontend changes do not affect them. Subfolders: `research/` (reports and the
  inference-series plan, not demos), `tools/` (maintenance scripts), `vendor/`
  (vendored libraries).
- **Episode navigation is generated, not hand-written.** Index card order *is*
  the reading order. Every episode carries a `<!-- epnav:start --> …
  <!-- epnav:end -->` block — a fixed top-left pill (`‹ 目录 ›`) plus ←/→
  keyboard shortcuts, positioned to stay clear of the right-side `.dots` and
  the bottom `.scr-foot`. It is injected by `python docs/tools/nav-gen.py`,
  which is idempotent. After adding, removing or reordering an episode,
  re-run it (`--check` reports drift without writing). Never hand-edit the
  block — it is replaced wholesale on the next run, and it is what keeps the
  episodes from being 81 dead ends.
- **Index affordances.** `index.html` also has a client-side search (`/`
  focuses, `Esc` clears; matches `a.card` on text + href), a static 知识地图
  (L1 训练 → L2 模型原理 → L3 推理服务 → L4 Agent 工程) and three recommended
  paths. Links inside the map and paths are deliberately plain `<a>`, not
  `a.card`, so they don't pollute nav-gen's ordering; when a series grows,
  update the per-layer counts in the map.
- **3D in docs demos**: `docs/vendor/three.global.js` is three.js r160 with its
  ES-module `export{}` rewritten to `window.THREE` (so it loads from `file://`
  without a server). Users are: `inf-` 01/05/07/10/11, plus `ai-13-thinking`
  (search tree with backtracking), `ai-19-embedding` (points on the unit sphere,
  angle = cosine similarity) and `ai-15-diffusion` (noise cloud settling into a
  grid). Load it with a plain `<script src="vendor/three.global.js">` *before*
  the inline script that uses it, build scenes with `MeshBasicMaterial` (+
  `EdgesGeometry` / `LineBasicMaterial` for flat wireframe, no lights, matching
  the dark palette), and gate rendering on a `getBoundingClientRect`
  visibility check so off-screen canvases don't burn battery. Fit the camera
  from the container aspect ratio rather than hard-coding a z — the hero canvas
  is tall and narrow on phones. Every 3D screen must degrade to a CSS glow when
  `window.THREE` or WebGL is unavailable.

