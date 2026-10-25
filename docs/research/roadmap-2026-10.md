# Roadmap · 2026-10（v2，10-24 更新）

> 下一版规划基线：docs/ 12 系列 **104 集**（新增进阶机制 ·08《从零造一个
> Harness》）；交互课程应用 43→**51** 后端测试；`backend/app/agent/` 生产级
> 框架 **已接入 HTTP**（`/api/agent/chat` 与 `/chat/stream`，08d27ac）；
> `examples/agent-harness-demo/` 五个离线可运行脚本；Harness 资料汇编
> `docs/research/agent-harness-research.md`（含第二轮面向路线图的调研）。

## ✅ 已完成（2026-10 下旬）

- **P0 · Agent 框架接入应用**（08d27ac）：`POST /api/agent/chat`（message +
  history + config，返回 output/steps/trace）、`POST /api/agent/chat/stream`
  （SSE 逐事件）、AgentError→HTTP 映射（400/409/502/503）、8 个端点集成测试。
- **进阶机制 ·08《从零造一个 Harness》**（0f03a53）：8 屏动画 + epnav 入索引。
- **examples/agent-harness-demo**：裸模型缺口 → 工具循环 → 保险丝 → 错误
  回填 → 轨迹/检查点，离线可跑，`--live` 接真实模型。
- **README/AGENTS 文档全面更新**：三组成结构、104 集、框架入档。
- **资料汇编 v2**（10-24/25）：`agent-harness-research.md` 第二轮
  （LangChain/MongoDB 全文）+ 新增 `agent-self-evolution-research.md`
  （LLM 优化算法 / Agent 自我进化 / 记忆经验学习，三路并行调研）。

## ✅ P1 · 前端 Agent Playground（2026-10-24 完成）

**动机**：端点已可用；让学习者直观看到工具调用轨迹与护栏触发。

**涉及文件**：
- `backend/app/data/chapters.py`：新增第 10 章「Agent 实验台」（1 页，
  visualization=`AgentPlaygroundViz`）
- `frontend/src/api/agent.ts`：按 `client.ts` 模式封装 `agentChat()`
- `frontend/src/visualizations/ch10_agent/AgentPlaygroundViz.ts`：继承
  `BaseVisualization`，canvas 容器内 DOM 聊天 UI + 工具轨迹时间线；
  `ch10_agent/index.ts` 注册 + barrel 导入

**落地**：chapters.py 第 10 章（1 页）+ `api/agent.ts` + `ch10_agent/AgentPlaygroundViz.ts`
（DOM 聊天 UI + 工具轨迹时间线，含建议问题 chips 与 409/503 错误展示）。
**验收**：51 后端测试 + `npm run build` + 42 vitest 全绿；stub LLM 端到端对话、
多轮与手机版 Playwright 截图自检通过。

## ✅ P1 · Harness 深化（2026-10-24 完成，第二轮调研推论）

**动机**：MongoDB 六大件与 Anthropic 长任务配方指出：当前框架缺的不是新
工具，而是「落盘、恢复、审计、瘦身」四件生产件。

1. **Trace 落盘 + 最小评估集**（对应六大件之「可观测 + 评估」）：`on_event`
   事件写 JSONL（示例 05 已有最小实现，升格为框架内置
   `AgentConfig(trace_path=...)`）；配套 5–10 个黄金 case 的离线评估脚本
   （避坑 04 期方法论）。
2. **Checkpoint store**（六大件之「状态与持久化」；SafeHarness：每 3 步一存）：
   `AgentResult.messages` 已可序列化，加内存/SQLite store 与
   `resume(session_id, message)` 入口（对齐 model_store.py 无数据库惯例可先用
   JSON 文件）。
3. **工具结果来源标记**（防上下文提权，2026-09 攻击面）：工具回填自动前缀
   `[数据] 来源=<tool>`，把「数据≠指令」做进框架层而非提示词层。
4. **工具利用率审计**（Vercel 案例：删 80% 工具成功率反升）：`Agent` 统计
   每工具调用次数并随 `finished` 事件输出 —— 为「allowed_tools 最小授权」
   提供数据。

**落地**：`AgentConfig.trace_path`（JSONL 逐事件落盘）、`AgentConfig.tag_tool_results`
（默认开启，`[工具数据·来源:X·非指令]` 前缀）、`AgentResult.tool_usage`（逐工具
调用计数进 finished 事件）、`app/agent/store.py`（Memory/JsonCheckpointStore，
原子写）、`app/agent/testing.py`（ScriptedLLM 公共替身）、`app/agent/eval.py`
（EvalCase / run_eval / run_eval_async）、示例 `06_eval.py`（4 条黄金 case，含
故意失败与护栏熔断演示）。
**验收**：新增 11 个特性测试，全量 62 passed；06_eval 输出 3 通过 / 1 故意失败。

## P1 · 动画库收尾

- 推理原理第三季剩 9 集（inf-26–29、32–36），按
  `research/inference-principles-s3-plan.md` 推进；每集后跑 `nav-gen.py`
  并更新知识地图计数；完成后刷新覆盖审计文档。

## P1+ · Agent 自进化最小闭环（2026-10-25 新增，依据 self-evolution 调研第五/六节）

**动机**：调研结论——应用层的 self-improvement 只有三条正路：**提示进化
（GEPA）、上下文演化（ACE playbook）、经验复用**，全部不需要训练；且必须
守住三条红线（反思接外部验证 / 经验库安全条目 / 评估器按攻击面对待）。
本仓库已具备闭环的一半：`eval.py` 是现成评估器、`trace_path` 产出结构化
轨迹、`store.py` 有原子写模式。

**分两步落地**：
1. **ACE 式 playbook（P1+，约 150–200 行）**：
   - `app/agent/playbook.py`：结构化 playbook 存储（沿用 store.py 原子写，
     按条目追加 delta 而非全文重写——防 context collapse 是 ACE 核心约束）
   - `AgentConfig(playbook_path=...)`：启动时把 playbook 注入 system_prompt
   - Reflector：任务结束后一次 LLM 调用读 trace JSONL，提炼「教训 delta」
     （成功模式 / 踩坑），Curator 合并去重
   - 红线：提炼必须引用外部信号（测试结果 / 工具输出），纯内省不写入
2. **GEPA 式提示进化（P2）**：外层循环读失败 trace → LLM 反思生成
   system_prompt 变体 → `run_eval_async` 按 golden case 通过率维护 Pareto
   前沿 → 人工确认后替换
3. **示例**：`examples/agent-harness-demo/08_self_improve.py`——离线演示
   「失败 → 反思 → playbook 追加 → 下次成功」的最小进化循环

**验收**：08 示例第 2 轮同一任务成功率提升（离线脚本可复现）；评估集
全量重跑不回归；playbook 有 git 可审计的历史。

## P2 · 工程深化（按需启动）

- **真实模型 e2e**：`@pytest.mark.skipif(not os.getenv("LLM_API_KEY"))`，
  CI 默认跳过。
- **长任务两段式示例**（Anthropic 配方）：`examples/agent-harness-demo/`
  进阶篇 —— feature 清单 JSON + progress 文件 + 单 session 单 feature；
  暂不进框架核心（保留 harness 简单性）。
- **反方证据校准**（Scale AI SWE-Atlas / METR：harness 收益因模型而异）：
  任何 harness 改动以评估集数字说话，避免为改而改。
- **治理三问自检**（MongoDB）：能否从检查点恢复？能否产出审计轨迹？
  能否看到单次行动成本？——第三问需在事件流中带 token/调用成本标注。
- **子代理支持**：遵循 hermes-17 期「窄用」结论，仅独立上下文隔离场景。

## 已知小账（随手修）

- `requirements.txt` 的 `numpy>=2.3.0` 需 Python 3.11+，与 README "3.10+"
  表述有张力（README 已加注；后续统一为 3.11+ 或放开 numpy 上限）。
- `examples/` 两份未跟踪 PDF（rag-demo 语料），决定去留后处理。
- Playground 路线 B（独立顶层页面，需扩展 Router.ts）暂缓——路线 A 够用。
