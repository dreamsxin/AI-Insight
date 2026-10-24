# 通用 Agent 框架（app.agent）

一个零 LLM-SDK 依赖、可用于生产的异步 Agent 运行时。设计取自 `docs/hermes-*`
动画系列的工程共识：**模型只有提案权，执行权在宿主（harness）**。

- 纯 `think → act → observe` 主循环，模型走 OpenAI Chat Completions 兼容协议
- 工具即普通函数（同步/异步），自动生成或手写 JSON Schema
- 护栏全部在代码层：步数、token 预算、重复调用检测、工具白名单
- 工具错误回填为 `role=tool` 观察，模型可自救；结果自动截断防上下文爆炸
- 全链路结构化事件（`on_event`），便于 tracing / SSE / 审计
- 100% 类型标注 + Pydantic v2，不依赖 LangChain 等重框架

## 30 秒上手

```python
import asyncio
from app.agent import Agent, AgentConfig, LLMClient, ToolRegistry, tool

registry = ToolRegistry()

@tool(registry, description="两数相加")
def add(a: int, b: int) -> int:
    return a + b

agent = Agent(
    LLMClient(base_url="https://api.deepseek.com/v1", api_key="sk-...", model="deepseek-chat"),
    registry,
    AgentConfig(system_prompt="你是计算助手，算术一律用工具。", max_steps=6),
    on_event=lambda e: print(e["event"], e),   # 可选：观测每一步
)

result = asyncio.run(agent.run("帮我算 17 加 25"))
print(result.output)          # 最终回答
print(result.steps)           # 用了几轮
print(result.messages)        # 完整消息轨迹（可持久化/续写）
```

环境变量 `LLM_BASE_URL` / `LLM_API_KEY` 可省略构造参数。任何实现
`/chat/completions` 的端点（OpenAI、DeepSeek、本地 vLLM/Ollama 兼容层）都能接入。

## 模块地图

| 文件 | 职责 |
|---|---|
| `models.py` | `Message` / `ToolCall` / `ToolResult` / `ToolSpec` / `AgentResult` |
| `tools.py` | `ToolRegistry` 注册表、`@tool` 装饰器、类型注解 → JSON Schema |
| `llm.py` | `LLMClient`：httpx 异步调用兼容端点，解析 tool_calls 与用量 |
| `store.py` | `CheckpointStore` 检查点存储（内存 / JSON 文件，原子写） |
| `testing.py` | `ScriptedLLM` 离线测试替身（脚本化响应 + 消息记录） |
| `eval.py` | `EvalCase` / `run_eval`：最小评估集运行器（避坑 04 方法论） |
| `guards.py` | `Guardrails`：max_steps / token 预算 / 重复检测 / 白名单；`RunStats` |
| `agent.py` | `Agent` 主循环、工具执行、错误回填、事件发射 |
| `errors.py` | 可分类的异常体系（重试 / 上报 / 转人工） |
| `examples.py` | 计算器 + 时钟的最小可运行组装 |

## 生产检查清单

1. **凭证**：用环境变量/密钥管理注入，勿硬编码；建议外层加网络白名单
2. **预算**：按任务设置 `max_steps` 与 `max_total_tokens`，高风险任务从严
3. **权限**：用 `allowed_tools` 做最小授权；危险工具（删除/支付/外发）应在工具内部再确认
4. **可观测**：接 `on_event` 落 trace（工具名、参数、耗时、token、错误）
5. **工具幂等**：重试可能发生，写操作做成幂等；错误信息要可行动
6. **上下文**：长任务对历史做摘要压缩，或把大结果交给工具侧处理，只回结论

## 与动画系列的对应

| 机制 | 出处 |
|---|---|
| think→act→observe 主循环、错误回填 | Hermes 04 / 11 |
| max_steps、token 预算、重复检测 | Hermes 02 / 12、避坑 02 |
| 工具白名单与最小权限 | Hermes 09 |
| 工具结果截断瘦身 | Hermes 05 |
| 工具顺序稳定利于前缀缓存 | Hermes 16 |
| 结构化事件 / trace | 避坑 04 |

测试见 `app/tests/test_agent.py`（用 FakeLLM 离线驱动，无需网络与密钥）。
