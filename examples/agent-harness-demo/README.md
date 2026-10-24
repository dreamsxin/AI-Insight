# Agent Harness Demo — 从零造一个 Harness 的可运行示例

配合动画《HERMES 进阶机制 ·08 · 从零造一个 Harness》
（`docs/hermes-20-harness-build-animation.html`），用仓库自带的
[`backend/app/agent/`](../../backend/app/agent/) 框架，五步走完
「裸模型 → 可工作的 Agent」的全部关键积木。

## 运行

```bash
# 在仓库任意位置；默认离线脚本化模型，无需网络与 API Key
python examples/agent-harness-demo/01_bare_llm.py
python examples/agent-harness-demo/02_tool_loop.py
python examples/agent-harness-demo/03_guards.py
python examples/agent-harness-demo/04_error_healing.py
python examples/agent-harness-demo/05_trace_and_checkpoint.py

# 接真实模型（读环境变量 LLM_BASE_URL / LLM_API_KEY）
python examples/agent-harness-demo/02_tool_loop.py --live
```

依赖即 backend 的 `requirements.txt`（httpx + pydantic），无其他安装。

## 五步对照表

| 脚本 | 补上的缺口 | 框架对应 | 动画屏 |
|---|---|---|---|
| `01_bare_llm.py` | 认识裸调用的三个缺口：不会动手 / 无状态 / 不可信 | — | STEP 1 |
| `02_tool_loop.py` | 不会动手 → 工具循环 think→act→observe | `ToolRegistry` + `Agent.run` | STEP 2 |
| `03_guards.py` | 死循环烧钱 → 步数/预算/重复三道保险丝 | `Guardrails` | STEP 3 |
| `04_error_healing.py` | 工具失败即崩溃 → 错误回填为观察、模型自救 | `is_error` ToolResult | STEP 4 |
| `05_trace_and_checkpoint.py` | 黑盒与从头重来 → JSONL 轨迹 + messages 检查点续聊 | `on_event` / `AgentResult.messages` | STEP 5 |

05 会产出 `trace.jsonl`（逐步事件）与 `checkpoint.json`（可恢复的消息历史），
可直接打开查看 Harness 留下的「工作痕迹」。

## 延伸

- 生产框架文档：`backend/app/agent/README.md`（生产检查清单、模块地图）
- 资料汇编：`docs/research/agent-harness-research.md`
  （Anthropic 长任务 harness 两段式、feature 清单 200+ 项、SafeHarness checkpoint 等）
