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
- `docs/` holds a self-contained animated demo series with an index page
  (`index.html` links all of them): HERMES AGENT 对象拆解 ·01–18 (08 跨会话
  记忆篇 is 前瞻演绎/designed extrapolation), AI 运作原理拆解 ·01–15,
  LLM 模型算法原理 ·01–05 (embedding/loss/position-encoding/residual
  algorithm internals + a worked vector-attention poem example), AGENT
  开发避坑指南 ·01–04 (developer-facing
  pitfalls), AGENT 实战工坊
  ·01–04 (knowledge-QA RAG build walkthrough + project-selection guide), and
  AGENT 模式进阶 ·01–06 (pat- prefix: Plan-and-Execute, Reflection, CoALA
  memory extraction/routing, sliding-window/summarization compression, MCP
  Host/Client/Server + tools/list discovery, soft-vs-hard guardrails). The
  `docs/research/` subfolder holds protocol/spec research reports (not demos).
  None
  are part of the Vite app — each demo is a single
  file (no build step, no external deps) using full-screen CSS scroll-snap
  sections where one animation segment plays per screen. Keep new demos in this
  same self-contained pattern and add them to the index; editing frontend code
  does not affect them.
