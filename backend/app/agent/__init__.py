"""生产级通用 Agent 框架（无第三方 LLM SDK 依赖）。

设计原则（与 docs/hermes-* 动画一一对应）：
- 模型只有提案权，执行权在宿主（harness）：think -> act -> observe 主循环
- 纯函数式工具注册表：工具是带 JSON Schema 的普通函数，同步/异步皆可
- 护栏在代码层而非提示词：max_steps / token 预算 / 重复检测 / 工具权限
- 全链路结构化事件：每一步产生可观测的 RunEvent，便于 tracing 与审计
- 模型客户端走 OpenAI Chat Completions 兼容协议（OpenAI / DeepSeek / 本地 vLLM 通吃）

快速开始见 app/agent/README.md。
"""

from app.agent.models import (
    AgentResult,
    Message,
    Role,
    ToolCall,
    ToolResult,
    ToolSpec,
)
from app.agent.errors import (
    AgentError,
    BudgetExceededError,
    MaxStepsExceededError,
    RepeatedCallError,
    ToolExecutionError,
    ToolNotFoundError,
    ValidationError,
)
from app.agent.llm import LLMClient, LLMResponse
from app.agent.tools import ToolRegistry, tool
from app.agent.agent import Agent, AgentConfig
from app.agent.guards import Guardrails, RunStats

__all__ = [
    "Agent",
    "AgentConfig",
    "AgentResult",
    "LLMClient",
    "LLMResponse",
    "Message",
    "Role",
    "ToolCall",
    "ToolResult",
    "ToolSpec",
    "ToolRegistry",
    "tool",
    "Guardrails",
    "RunStats",
    "AgentError",
    "BudgetExceededError",
    "MaxStepsExceededError",
    "ToolExecutionError",
    "ToolNotFoundError",
    "ValidationError",
    "RepeatedCallError",
]
