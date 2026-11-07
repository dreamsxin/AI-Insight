# AI-Insight 项目审查报告

> **日期**：2026-11-07　**基线**：`47e0fc3`（main，工作区干净）　**性质**：全仓只读核对 + 后续修复跟踪
>
> **一句话结论**：工程质量整体高于同类教学项目——内容数据驱动、框架边界干净、动画库有单一权威源；当前主要债务不是功能缺失，而是**四处可被利用/可复现失败的安全与正确性缺陷**，以及**一套未被 CI 守护的手工数字**导致的文档漂移。
>
> **修复状态（2026-11-07）**：P0、P1 与 P2-1（死代码）已同日实施并全量验证通过，详见第七节；P2-2~P2-7 与 SSE / 自进化两项决策保留不动。

## 〇、审查范围与方法

1. 逐文件读取 `backend/`（47 个 `.py`）、`frontend/src/`（88 个文件）、`docs/index.html` 与 11 份研究文档、`examples/` 与根级工程配置。
2. 用集合交叉核对：章节可视化名 ↔ 注册表、索引卡片 ↔ 磁盘 HTML ↔ triage ↔ 配套脚本。
3. 运行 `nav-gen.py --check`、`demo-gen.py --check`（均只读），读取 `git log` 判断活跃度。
4. 对全部 P0 与关键 P1 结论做了二次抽查（直接读源码行），不以文档描述为依据。

**口径**：下表数值均为实测；与 `README.md` / `AGENTS.md` 描述不一致处，以代码为准，并在第四节单列。

---

## 一、执行摘要

| 维度 | 结论 | 评级 |
|---|---|---|
| 内容体系（docs/） | 12 系列 116 集、0 孤儿 / 0 悬空引用、两个幂等生成器 | 优 |
| 内容数据驱动 | 10 章 31 页 ↔ 31 个可视化，双向零悬空 | 优 |
| Agent 框架 | 14 模块、依赖方向干净、护栏/事件/checkpoint 均为真实实现 | 良 |
| 课程应用前端 | 生命周期清理完整、无裸 fetch、strict TS | 良 |
| 输入校验与并发 | 审查时发现：计算端点无入参上界、同步计算阻塞事件循环、默认工具含 eval 风险 | **已修（P0，见 7.2）** |
| 文档一致性 | 审查时发现：8 处已确认漂移；手工数字不由生成器维护、CI 只校验导航块 | **已修（P1，见 7.2）** |
| 能力空转 | SSE 端点、自进化闭环、多个引擎类写入但无人消费 | 决策项 |

---

## 二、规模基线（实测，可复算）

| 项 | 值 | 复算方式 |
|---|---:|---|
| 后端 Python | 47 文件 / 6,269 行 | `find backend -name '*.py' -not -path '*__pycache__*' \| wc -l` |
| 前端源码 | 88 文件 / 16,506 行（85 TS / 15,248 行） | `find frontend/src -name '*.ts' \| wc -l` |
| HTTP 端点 | 21（4 个 router，无未注册 router） | `backend/main.py:41-44` + `app/routers/` |
| 章节 / 页面 / 可视化 | 10 / 31 / 31 | `chapters.py` 与 `visualizations/index.ts` |
| 术语库 | 100 条（id 0..99，5 类） | `app/data/terms.json` |
| 动画库 | 116 页 + `index.html`（共 117 HTML） | `ls docs/*.html` |
| 配套脚本 | 36 个（triage：36 ✓ / 44 ◐ / 36 —） | `examples/anim-demos/` |
| 测试 | 后端 87 例 / 11 文件；前端 42 例 / 10 文件 | `pytest --collect-only` / `vitest run` |
| 提交 | 81 commits；最新 `47e0fc3` | `git log` |

---

## 三、架构评估

### 3.1 三条产出线

- **交互式课程应用**：FastAPI（routers → services/models/data）+ Vite/TS（Canvas 2D 自研引擎 + DOM 组件）。2026-10-28 后未改动，形态稳定。
- **docs/ 动画演示库**：116 个自包含 HTML，独立于 Vite 应用；`index.html` 卡片顺序是阅读顺序与生成器输入的**唯一权威源**。当前主产出，2026-11 的提交集中在此与配套脚本。
- **通用 Agent 框架**：`backend/app/agent/`，零 LLM-SDK 依赖，仅 httpx + Pydantic；通过 `teaching_tools.py`（→ services）与 `routers/agent.py`（→ 框架）两处桥接接入应用，第 10 章 Playground 消费。

### 3.2 值得保留的设计

1. **内容即数据**：页面用字符串引用可视化，注册表在桶文件副作用式填充；31 ↔ 31 双向一致，新增可视化不会静默漏挂。
2. **框架不反向依赖**：13/14 个 agent 模块只 import `app.agent.*`，services 也不 import agent；两处 bridge 位置明确、可审查。
3. **护栏在代码层**：步数 / token / 重复调用 / 白名单由 `Guardrails` 强制，模型只有提案权；全链路结构化事件 + 可选 JSONL trace。
4. **单一权威源 + 幂等生成器**：`index.html` → `nav-gen.py`（导航胶囊）与 `demo-gen.py`（配套脚本角标），二者都有 `--check`，0 孤儿 / 0 悬空。
5. **生命周期**：`BaseVisualization.destroy()` 依次清理 onUnmount、AbortController、ResizeObserver、rAF、MouseHandler、canvas DOM；WebGL 可视化额外 dispose geometry/material。

---

## 四、文档与代码一致性核对（已抽查确认）

| # | 文档说法 | 实际情况 | 处置 |
|---|---|---|---|
| D1 | `AGENTS.md:49-50` / `README.md:55`：前端通过 SSE 流式消费 `/api/agent/chat`，Playground 实时展示轨迹 | `frontend/src/api/agent.ts` 全文 36 行，仅 `apiPost`；全前端无 `EventSource`/`getReader`。SSE 端点只在 `routers/agent.py:165-205`；Playground 是「思考中…」→ 响应后一次性渲染 | 修正口径 |
| D2 | `README.md:102` three「仅 3 处使用」；`AGENTS.md:72-74` 称 ch07/ch08 三个可视化 | 仅 `ArchitectureViz.ts:3-4` 两行 import、1 个文件；TokenizerViz / EmbeddingPipelineViz 不含 three | 修正口径 |
| D3 | `README.md:29-40` 系列表「12 系列」但只列 10 行、进阶机制 7 期 | `index.html` 实为 3 个独立「推理原理」系列共 12 系列；进阶机制 8 集；表格期数加总 115 | 修正口径 |
| D4 | `docs/index.html:843`「第三季已上线 7 集，其余按批续更」 | `inf-25`…`inf-36` 共 12 集全部上线，`README.md:198` 已标完结 | 修正口径 |
| D5 | `index.html:215/227/240/252` 知识地图 42+40+18+10 集；meta description 分项加总 115 | 实际 116 集；手工计数未随权威源更新 | 修正 + CI 守护 |
| D6 | `chapters.py` 6 个 `api_endpoint`（`/api/nn/forward` 等） | 真实路由是 `/api/compute/...`；前端 `apiEndpoint` 字段无任何读取点，属死配置 | 删除死配置 |
| D7 | `README.md:103` 后端 81 个测试、结构树写 43 个；`chapters.py:1` 注释「9 chapters」 | 实测 87 例 / 11 文件；已有 ch10 | 修正口径 |
| D8 | `rag-demo/README.md` + `docs/index.html:970`：单册《经典古诗文诵读.pdf》264 页 | 磁盘为 `经典古诗文诵读上.pdf` / `下.pdf` 两册（均已跟踪）；`01_extract.py:24` 仍指向不存在的单册 | 修脚本 + 修口径 |

**根因**：除 `index.html` 卡片外，至少还有「第二套手工数字」（meta、知识地图、README 表格、规划书基线、系列注释），CI 只跑 `nav-gen.py --check`，不校验这些数字，也不跑 `demo-gen.py --check`。

---

## 五、风险清单

> 状态列在修复后回填。`影响` 一列区分「安全」「正确性」「可复现性」「性能」「可维护性」。

### 5.1 P0 — 必须修

| 编号 | 位置 | 问题与影响 | 修复方向 | 状态 |
|---|---|---|---|---|
| P0-1 | `app/agent/teaching_tools.py:21-25`、`app/agent/examples.py:25-30` | **安全**：`eval(expr, {"__builtins__": {}}, {})` 的字符集白名单含 `*`，`**` 为合法组合，可构造 `9**9**9` 导致 CPU/内存耗尽。该工具表是 `/api/agent/chat` 的默认工具，HTTP 可达；现有测试只覆盖 `__import__('os')` 被拒 | 改为 `ast` 节点白名单求值，禁止 `Pow` 与超大字面量，非法输入抛 `ValueError` | 已修 |
| P0-2 | `app/services/model_store.py:82,111,121,131` | **安全**：`overwrite_id` 来自 JSON body，无校验即 `MODELS_DIR / f"{id}.json"`，可含 `../` 越界读写/覆盖 `.json` 文件。同仓 `agent/store.py` 已有 `_SAFE_ID` 正则，此处缺失 | 增加 id 正则校验（非法抛 `ValueError`，由 `_safe()` 转 400），三个入口统一调用 | 已修 |
| P0-3 | `app/routers/compute.py` 13 个端点、`app/models/compute.py` | **安全/正确性**：端点为 `async def` 却直接调用同步 NumPy，单次训练阻塞整个 uvicorn 事件循环；`epochs` / `layers` / `seq_len` / `dim` / `stride` / `padding` 无 `ge`/`le` 约束，可放大为资源耗尽；`stride=0` 直接 `ZeroDivisionError` → 500 | 端点改为同步 `def`（FastAPI 自动线程池调度）；关键数值字段加约束；`_safe()` 扩展可转 400 的异常类型 | 已修 |
| P0-4 | `examples/rag-demo/scripts/01_extract.py:24`、`README.md:3,54,247`、`docs/index.html:970` | **可复现性**：语料 PDF 改为上/下两册后，脚本与两处文档未同步，按 README 从零复现会在步骤 1 `fitz.open()` 失败 | 脚本按册顺序提取并标注来源，文档同步口径 | 已修 |

### 5.2 P1 — 本轮处理

| 编号 | 位置 | 问题与影响 | 修复方向 | 状态 |
|---|---|---|---|---|
| P1-1 | `app/agent/guards.py:77`、`routers/agent.py:109-116` | **正确性**：白名单拒绝时抛内置 `PermissionError`，不属于 `AgentError`，`except AgentError` 抓不到 → 未处理 500；`ToolNotFoundError` 落到默认 500 | 定义 `ToolNotAllowedError(AgentError)` 并补齐 HTTP 映射 | 已修 |
| P1-2 | `app/agent/evolve.py:146-149` | **正确性**：把 `[{"role":...}]` dict 列表传给期望 `Message` 的 `LLMClient.chat`，真实模型下 `AttributeError` 被 `except Exception` 静默记为 `evolver-error` | 改用 `Message.user(...)`，与 `playbook.py:190` 一致 | 已修 |
| P1-3 | `frontend/src/visualizations/` 7 处、`core/App.ts:121-138` | **正确性**：21 个可视化 API 调用中 7 个未传 `getAbortSignal()`；路由切换 `await fetchChapter` 无取消/序号保护，快速切章会覆写章节并挂载错页 | 补 signal；路由变更加代次令牌 | 已修 |
| P1-4 | `LiveTrainViz.ts:904`、`DigitClassifyViz.ts:791` | **正确性**：`flashModelStatus` 的 2.5s `setTimeout` 未保存句柄，`destroy()` 后回调仍对已移除的 canvas 调 `renderOnce()` | 保存句柄并在 `onUnmount()` 清理 | 已修 |
| P1-5 | `app/agent/store.py:67-72`、`routers/agent.py:42-50` | **正确性**：`JsonCheckpointStore` 用固定 `path.with_suffix(".tmp")`，同一 session 并发 save 会互相 `replace`；模块级单例无锁 | 临时文件改为唯一命名（原子 `replace` 语义不变） | 已修 |
| P1-6 | `app/routers/compute.py:35-40` | **正确性**：`_safe()` 只捕 `ValueError`，NumPy 的 `ZeroDivisionError`/`TypeError`/`OverflowError`/`IndexError` 变成 500 | 扩展捕获集合（不含 `Exception`，避免掩盖缺陷） | 与 P0-3 合并 |
| P1-7 | `docs/index.html` meta/知识地图/进度注释、`README.md`、`AGENTS.md`、`chapters.py` | **可维护性**：D1–D8 的文档漂移；手工数字无 CI 守护 | 修正口径 + 新增 `count-check.py` + CI 补 `--check` | 已修 |

### 5.3 P2 — P2-1 已清理，其余登记

| 编号 | 问题 | 说明 |
|---|---|---|
| P2-1 | 死代码 | **已清理**（复核与清单见 7.5）。原报告有**两处误判经复核纠正**：`Scene.setLayer` 有 20+ 处调用，配合 `clear("chart")` / `clear("chart_loss")` 等按层清理真实生效，**保留**；`Timeline` 并非「无引用」，而是「类被 `Renderer` 引用、但 `addTimeline` 无任何调用者」的整条无消费者链，按链条整体删除 |
| P2-2 | 渲染性能 | 13 个纯静态 Viz 仍由 rAF 以 ~60fps 全量重绘；仅 `ArchitectureViz` 覆写 `start()` 规避。需引入「脏标记/按需重绘」机制，改动面大 |
| P2-3 | 单文件内聚 | `TermGridViz.ts` 934 / `LiveTrainViz.ts` 913 / `DigitClassifyViz.ts` 800 / `ActivationViz.ts` 726 行，布局/请求/状态/绘制混在一个类 |
| P2-4 | 测试覆盖 | 31 个 Viz 仅 5–6 个有行为测试；`src/api/`、`core/App|Router` 无测试；`ArchitectureViz` 只测纯函数 |
| P2-5 | 训练语义不一致 | `neural_network.train()` 普通 GD + 统一激活，`train_step()` 强制输出层 sigmoid + Adam，两接口对同一网络语义不同 |
| P2-6 | 历史文档回写 | `animation-coverage-audit.md`（113 集）、`roadmap-2026-10.md`（104 集）、`inference-principles-series-plan.md`（18 个未挂索引）多为标注时点的历史快照，个别未标「已解决」 |
| P2-7 | 工程化 | `start.bat`/`start.sh` 自 2026-07 未维护；根级无 pyproject/linter/pre-commit；`pytest.ini` 的 testpaths 跨目录收录 `examples/compliance-flow-demo` |

### 5.4 需用户决策（不擅自实施）

| 项 | 选项 | 说明 |
|---|---|---|
| SSE 流式 | A 接上前端 / B 从文档撤下 | 后端 `/chat/stream` 已实现且可用；前端接需新增解析层与逐事件渲染，属功能开发而非缺陷修复 |
| 自进化闭环 | A 接入 HTTP / B 明确标注为「框架能力，未启用」 | `_create_agent()` 未设 `trace_path`/`playbook_path`，eval/playbook/evolve 目前只在测试与 examples 中运行 |
| 死代码清理 | 全部删除 / 保留为教学示例 | `app/agent/examples.py`、`ParticleFlow` 等可能有意作为演示保留 → **用户已选「全部删除」，见 7.5** |

**处置**：前两项选 B —— 保留代码实现，把 `AGENTS.md` / `README.md` 的口径改成「SSE 端点存在但前端暂未接入」「自进化闭环已实现但未接入 HTTP」，不再声称已有能力已上线。第三项经用户确认后按「全部删除」执行，但**只删全仓零引用的符号与文件**，有真实调用点的（`Scene.setLayer`、`examples.py` 的示例工具）予以保留；后端 HTTP 端点属公共契约，不在删除范围。

---

## 六、修复计划与验收

| 批次 | 范围 | 验收方式 | 状态 |
|---|---|---|---|
| B1 | P0-1 ~ P0-4 + 各自回归测试 | 新增用例覆盖 `**` 被拒、`../` 被拒、超大入参被拒（422）、数值异常转 400、两册 PDF 路径发现；`pytest` 全绿 | 已完成 |
| B2 | P1-1 ~ P1-6 | 新增用例覆盖错误 HTTP 映射、checkpoint 并发写与临时文件清理；evolver 参数类型修正后现有进化测试全绿；前端 `vitest run` 全绿 | 已完成 |
| B3 | P1-7 / D1–D8 口径修正 + `count-check.py` + CI | 三个 `--check` 与语料检查均同步；`npm run build` 通过 | 已完成 |
| B4 | 全量验证 + 本报告状态回填 | 后端 **124 passed / 2 skipped**、前端 **42 passed**、构建通过、四个 `--check` 全绿 | 已完成 |

---

## 七、修复记录（2026-11-07 实施完成）

> 共变更 29 个既有文件 + 4 个新增文件；未改动 P2 与 5.4 决策项。

### 7.1 新增文件

| 文件 | 作用 |
|---|---|
| `docs/research/project-audit-2026-11-07.md` | 本审查报告 |
| `backend/app/agent/expr.py` | AST 节点白名单算术求值，替代 `eval` |
| `backend/app/tests/test_security.py` | 22 个安全 / 正确性回归用例 |
| `docs/tools/count-check.py` | 全库计数一致性只读校验（7 项） |

### 7.2 关键改动

1. **P0-1**：新增 `expr.evaluate_arithmetic()`，只接受 `Expression` / `Constant` / `UnaryOp(±)` / `BinOp(+ - * /)`，拒绝 `Pow`、调用、属性、超大字面量与超长表达式；`teaching_tools.py` 与 `examples.py` 两处 calculator 均改用它。
2. **P0-2**：`model_store.py` 增 `_SAFE_ID` + `_check_id()`，`save` / `load` / `delete` 三入口统一校验；空 `overwrite_id` 保留「不覆盖」的既有语义。
3. **P0-3**：`compute.py` 13 个端点 `async def` → `def`（FastAPI 线程池调度，不再阻塞事件循环）；`models/compute.py` 对 `epochs` / `layers` / `data` / `stride` / `padding` / `pool_size` / `seq_len` / `dim` 加界，`mode` 收窄为 `Literal["max","avg"]`；`_safe()` 扩为 `(ValueError, TypeError, ZeroDivisionError, OverflowError, IndexError)`。约束取值已对照现有测试与前端控件范围核对（`learning_rate` 允许 0、前端 epochs 上限 1000），未造成回归。
4. **P0-4**：`01_extract.py` 按文件名顺序发现上/下两册，输出跨册连续 `page` 并新增 `book` / `book_page`；新增纯 stdlib 的 `--check` 模式；README 与 `docs/index.html:970` 同步口径，单册时代的「真实输出」改标为历史记录。
5. **P1**：`ToolNotAllowedError`（`AgentError` 子类）取代内置 `PermissionError` 并补 HTTP 映射（白名单 → 409、未注册工具 → 400）；`evolve.py` 改用 `Message.user(...)`；前端 7 处补 `getAbortSignal()`（`FeatureMapViz` 的 4 个并发请求共用一个 signal，避免互相取消）、`App.ts` 加路由代次令牌；两处 `setTimeout` 保存句柄并在 `onUnmount()` 用 `window.clearTimeout` 清理；`JsonCheckpointStore` 改为**唯一临时文件 + `threading.Lock()`** —— 并发回归测试在 Windows 上暴露「只改文件名仍会 WinError 5」，故补进程内互斥锁串行化 `replace`。
6. **P1-7 / D1–D8**：修正 `AGENTS.md`（SSE / three / 进阶集数）、`README.md`（系列表拆为 12 行、测试数、结构树、SSE 与自进化口径）、`docs/index.html`（meta 去数字化、知识地图 46/36/28/6、进阶 8 集、第三季完结）、`chapters.py`（删除 6 个路径错误且无人消费的 `api_endpoint`、注释 9 → 10）；CI 新增 `demo-gen.py --check`、`count-check.py --check` 与 rag-demo 语料检查。

### 7.3 验收结果

| 命令 | 结果 |
|---|---|
| `pytest -q`（backend + compliance-flow-demo） | **124 passed, 2 skipped**（2 个 e2e 需真实凭证，按设计跳过） |
| `npx vitest run` | **42 passed (10 files)** |
| `npm run build`（`tsc -b && vite build`） | 通过，strict TS 无错误（仅 Vite 的 782 KB chunk 体积提示） |
| `nav-gen.py --check` | 同步，索引 116 集 |
| `demo-gen.py --check` | 同步，36 个脚本 / 116 页一致 |
| `count-check.py --check` | 同步：116 集 / 12 系列 / L4-L1 = 46,36,28,6 / triage ✓36 ◐44 —36 / 0 孤儿 · 0 悬空 |
| `01_extract.py --check` | 发现两册（上、下），输出路径正确 |

> 备注 1（本机环境）：`npx vitest run` 默认多线程并行时，多个 worker 争写同一个临时缓存文件（`<tmp>/web/<hash>`），被当前运行环境的 fs 代理以 `EPERM` 拒绝，导致**随机有一个测试文件未被收集**（表现为 9 文件 / 37~39 用例 + 1 unhandled error，退出码仍为 0）。这与代码无关，且 GitHub Actions 上不会出现。规避命令：`npx vitest run --no-file-parallelism --pool=forks --poolOptions.forks.singleFork=true`，实测 **10 文件 / 42 用例全通过、无 error**，上表 `vitest` 一行即以此结果为准。
>
> 备注 2：本机未安装 PyMuPDF，rag-demo 的**完整提取**未实跑，仅验证了 `--check` 路径发现；完整复现需先 `pip install -r examples/rag-demo/requirements.txt`。

### 7.4 遗留

- 5.4 的前两项决策未实施；SSE 与自进化闭环已按选项 B 修正文档口径（明确「前端暂未接入 / 未接入 HTTP」）。第三项「死代码清理」已执行，见 7.5。
- P2-2~P2-7 仍登记未动：静态 Viz 的 rAF 空转、超大单文件、Viz 行为测试覆盖、训练语义不一致、历史文档回写、工程化配置。
- 新增测试后后端用例数 87 → **109**（97 个 test 函数 + 12 个参数化展开）；总收集 126 = 109 + 17（`examples/compliance-flow-demo`），README 与结构树已同步。

### 7.5 P2-1 死代码清理（用户确认后执行）

清理前对 15 个符号做了全仓精确扫描（`*.ts` / `*.py`，含 `examples/`、`docs/tools/`、前后端 tests），只删**零引用**项：

| 范围 | 删除内容 |
|---|---|
| 整文件（265 行） | `frontend/src/core/EventBus.ts`(27)、`canvas/engine/ParticleFlow.ts`(146)、`canvas/animation/Timeline.ts`(92) |
| Canvas 引擎 | `Renderer.ts` 的 `Timeline` import、`timelines` 字段、`addTimeline()`、`clearAnimations()` 与 `update()` 中的 timeline 分支（tween 链保留） |
| API 层 | `client.ts` 的 `apiDelete()` 与 `createTimeoutController()`；`compute.ts` 的 `fetchDatasets()` / `removeModel()` 及其 import；`types/api.ts` 的 `DatasetInfo` |
| `api_endpoint` 整条链 | `BaseVisualization.apiEndpoint`、`App.ts` 的赋值分支、`types/chapter.ts` 两处可选字段、`backend/app/models/chapter.py` 两处 `Optional[str]` 字段（7.1 已删 `chapters.py` 的 6 处数据） |
| Agent 框架 | `AgentResult.stopped_by_guard`、`ToolRegistry._is_async` / `is_async()`（`inspect` import 仍用于 `getdoc`/`signature`，保留）、`Playbook._norms`（去重实际靠 `add_delta` 的线性比对，缓存集从未被读取） |
| 文档口径 | `README.md` 结构树 / 设计特点 3 处、`AGENTS.md` 的 Canvas 引擎与 core 描述 2 处 |

**明确保留**：
- `Scene.setLayer`（20+ 调用点 + `clear(layer)` 生效，原报告误报）；
- `app/agent/examples.py`（有意的教学示例工具）；
- 后端 `GET /api/compute/nn/datasets`、`DELETE /api/compute/nn/models/{id}` 及其响应模型声明（含 `DatasetInfo`）——HTTP 公共契约与 schema 文档，即使未被 `response_model` 显式引用也不属于应用内死代码；
- 前端 `fetchDataset` / `fetchSavedModels` / `saveModel` / `loadModel` 等被 `LiveTrainViz`、`DigitClassifyViz` 真实调用的封装。

删 `removeModel` 后 `apiDelete` 失去唯一调用者，故一并删除。

**验收**：清理后复跑 —— `pytest` **124 passed / 2 skipped**、`vitest`（单 worker 模式）**42 passed / 10 files**、`npm run build` 通过（strict TS 无错误）、四个 `--check` 全同步；全仓残留扫描仅剩上述有意保留的后端契约模型。详见 7.3。

---

## 附录 A：复算命令

```bash
# 规模
find backend -name '*.py' -not -path '*__pycache__*' | wc -l
find frontend/src -name '*.ts' | wc -l
ls docs/*.html | wc -l

# 内容库一致性（只读）
python docs/tools/nav-gen.py --check
python docs/tools/demo-gen.py --check
python docs/tools/count-check.py --check
python examples/rag-demo/scripts/01_extract.py --check

# 测试与构建（本机后端依赖装在 Python 3.10；需自行选择已装依赖的解释器）
cd backend && pytest
cd frontend && npx vitest run && npm run build
```

## 附录 B：核对清单

- [x] 10 章 / 31 页 ↔ 31 个 `VIZ_REGISTRY` key（双向零悬空）
- [x] 100 条术语 `id 0..99` 与 CH9 筛选控件、滑块上限一致
- [x] 116 张索引卡片 ↔ 116 个 HTML ↔ 116 条 triage ↔ 36 个 ✓ 脚本
- [x] 4 个 router 全部注册，21 个端点无重复
- [x] `app/agent/` 13/14 模块不反向依赖，唯一越界为 `teaching_tools.py`
- [x] 无硬编码真实 LLM 密钥；`.env` / `saved_models` / `agent_sessions` 已 gitignore
- [x] 全仓 Python / TS 无真实 TODO/FIXME 占位
- [x] 修复后：`eval` 已从 `app/agent/` 全部移除，`**` 与调用型表达式被 AST 白名单拒绝
- [x] 修复后：模型 id / 会话 id 均有正则校验，计算端点入参均有上下界
- [x] 修复后：13 个 compute 端点均为同步 `def`，不再阻塞 uvicorn 事件循环
- [x] 修复后：116 集 / 12 系列 / 分层计数 / triage / README 表格由 CI 中的 `count-check.py` 守护
