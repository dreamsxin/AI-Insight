# Roadmap · 2026-10

> 仓库下一步规划。现状基线：docs/ 12 系列 103 集动画（无孤儿）、交互课程应用
> （9 章 + 43 后端测试 + 25 前端测试）、`backend/app/agent/` 生产级通用 Agent
> 框架（9 文件 + 12 离线测试，尚未接入任何 HTTP 端点或前端页面）。

## P0 · Agent 框架接入应用

**动机**：`app/agent/` 已具备完整运行时，但只能以脚本方式使用；接上 HTTP 层
才能被前端与外部调用方使用，也才能暴露真实问题（超时、取消、错误映射）。

**涉及文件**：
- `backend/app/routers/agent.py`（新增）：
  - `POST /api/agent/chat`：请求体 `{message, history?, config?}`，返回
    `AgentResult`（output/steps/finish_reason）；可选 `text/event-stream`
    流式模式，把 `on_event` 事件逐条 SSE 推送
  - `AgentError` 子类 → HTTP 映射表：`MaxStepsExceededError`/`BudgetExceededError`/
    `RepeatedCallError` → 409（带原因），`ValidationError` → 400，
    `ToolExecutionError` → 502（上游工具失败）。**注意 `AgentError` 不是
    `ValueError`，不能套用 `_safe()`**
- `backend/main.py`：`app.include_router(agent.router, prefix=settings.API_PREFIX)`
- `backend/app/tests/test_agent_api.py`（新增）：用 FakeLLM 注入的端点集成测试
- `frontend/src/api/agent.ts`（新增）：按 `client.ts` 封装模式补 `agentChat()`

**验收**：`pytest` 全绿（含新端点测试）；curl 调用 `/api/agent/chat` 返回结构化
结果；无 `LLM_API_KEY` 时返回明确的 503 配置错误而非崩溃。

## P1 · 前端 Agent Playground（教学闭环）

**动机**：让学习者直观看到 Agent 循环（工具调用、护栏触发、错误自救），
并把框架与现有 NumPy 计算服务打通。

**方案（路线 A，零路由改动）**：
- `backend/app/data/chapters.py` 新增第 10 章「Agent 实验台」，page 的
  `visualization` 指向新 viz
- `frontend/src/visualizations/ch10_agent/AgentChatViz.ts`：继承
  `BaseVisualization`，在 canvas 容器内渲染聊天 UI + 工具调用时间线
  （消费 `on_event` 事件流）；`index.ts` 注册 + barrel 导入
- `backend/app/agent/teaching_tools.py`（新增）：把 `services/` 的
  `nn_forward` / `cnn_convolve` / `transformer_attention` 等包装为
  `ToolRegistry` 工具 —— Agent 演示"调计算引擎答题"，与课程内容互指

**验收**：`#/ch10/p1` 可对话并看到工具调用轨迹；护栏触发时 UI 显示结构化原因；
`npm run build` 与 `npx vitest run` 通过。

## P1 · 动画库收尾

**动机**：推理原理第三季（"四个数字的背面"）尚有 9 集未上线。

- 按 `research/inference-principles-s3-plan.md` 推进：inf-26/27（上下文长度）、
  inf-28/29（单 token 延迟）、inf-32–36（密度与平台）
- 每集完成后跑 `python docs/tools/nav-gen.py` 并更新知识地图计数
- 完成后更新 `research/animation-coverage-audit.md` 覆盖审计

**验收**：index 12 系列 36+ 集推理原理全量上线；`--check` 无漂移。

## P2 · 工程深化（按需启动）

- **真实模型 e2e**：标记 `@pytest.mark.skipif(not os.getenv("LLM_API_KEY"))`
  的端到端用例，CI 默认跳过、本地可开
- **评估集与 trace 落盘**：按避坑指南 04 期方法论，把 `on_event` 事件写入
  JSONL trace，配套 5–10 个黄金 case 的最小评估脚本
- **子代理支持**：遵循 hermes-17 期结论"默认单 Agent、子代理窄用"——只在
  独立上下文隔离场景加 `Agent.run` 组合，不建多 Agent 编排
- **会话持久化**：`AgentResult.messages` 已可序列化，加一个内存/SQLite
  store（对齐 model_store.py 的无数据库惯例）
- **配置完善**：可选引入 python-dotenv 或在 start 脚本中注入 LLM 凭证

## 已知小账（随手修）

- `requirements.txt` 的 `numpy>=2.3.0` 需要 Python 3.11+，与 README "3.10+"
  表述存在张力（README 已加注；后续可统一为 3.11+ 或放开 numpy 上限）
- `examples/` 下两份未跟踪 PDF（rag-demo 语料），决定去留后处理
