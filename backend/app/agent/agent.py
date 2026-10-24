"""通用 Agent 主循环：think -> act -> observe。

生产特性：
- 模型只有提案权：工具调用由宿主执行（同步/异步工具都支持）
- 错误回填为 role=tool 的观察，模型据此自救（Hermes 11 期：报错即观察）
- 三道护栏：步数、token 预算、重复检测；工具白名单
- 全程产生结构化事件（on_event 回调），便于 tracing / SSE 推送 / 审计
- 工具结果可截断，防止大输出撑爆上下文（Hermes 05 期瘦身）
"""

from __future__ import annotations

import inspect
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from app.agent.errors import (
    AgentError,
    MaxStepsExceededError,
    ToolExecutionError,
)
from app.agent.guards import Guardrails, RunStats
from app.agent.llm import LLMClient, LLMResponse
from app.agent.models import (
    AgentResult,
    Message,
    Role,
    ToolCall,
    ToolResult,
)
from app.agent.tools import ToolRegistry

# 事件回调：收到 RunEvent dict，可写日志/发 SSE/落审计
EventHandler = Callable[[dict[str, Any]], Awaitable[None] | None]


@dataclass
class AgentConfig:
    system_prompt: str = "你是一个有用的助手。"
    max_steps: int = 10
    max_prompt_tokens: int | None = None
    max_completion_tokens: int | None = None
    max_total_tokens: int | None = None
    max_repeat: int = 3
    allowed_tools: set[str] | None = None
    temperature: float = 0.7
    # 单个工具结果回填的最大字符数（0/None 表示不截断）
    max_tool_result_chars: int = 8000
    # 工具异常是否回填给模型自救；False 则直接抛出
    raise_on_tool_error: bool = False
    extra_llm_kwargs: dict[str, Any] = field(default_factory=dict)


class Agent:
    """无状态模型 + 有状态 harness：一次 run 维护一份 messages。"""

    def __init__(
        self,
        llm: LLMClient,
        tools: ToolRegistry | None = None,
        config: AgentConfig | None = None,
        *,
        on_event: EventHandler | None = None,
    ) -> None:
        self.llm = llm
        self.tools = tools or ToolRegistry()
        self.config = config or AgentConfig()
        self.on_event = on_event

    async def run(
        self,
        prompt: str | None = None,
        *,
        messages: list[Message] | None = None,
    ) -> AgentResult:
        """执行主循环。可传入历史 messages 续写；prompt 作为新的 user 消息追加。"""
        cfg = self.config
        history: list[Message] = list(messages) if messages else []
        if not history:
            history.append(Message.system(cfg.system_prompt))
        if prompt:
            history.append(Message.user(prompt))

        guards = Guardrails(
            max_steps=cfg.max_steps,
            max_prompt_tokens=cfg.max_prompt_tokens,
            max_completion_tokens=cfg.max_completion_tokens,
            max_total_tokens=cfg.max_total_tokens,
            max_repeat=cfg.max_repeat,
            allowed_tools=cfg.allowed_tools,
        )
        stats = RunStats()
        final_text = ""

        while True:
            stats.steps += 1
            guards.check_step(stats)

            resp = await self.llm.chat(
                history,
                tools=self.tools,
                temperature=cfg.temperature,
                extra=cfg.extra_llm_kwargs or None,
            )
            stats.prompt_tokens += resp.prompt_tokens
            stats.completion_tokens += resp.completion_tokens
            guards.check_tokens(stats)
            await self._emit("llm_response", _resp_event(resp, stats))

            # 记录 assistant 消息（可能含 tool_calls）
            history.append(
                Message.assistant(resp.content, tool_calls=resp.tool_calls or None)
            )

            if not resp.tool_calls:
                final_text = resp.content
                await self._emit("finished", {"output": final_text, "stats": stats.__dict__})
                return AgentResult(
                    output=final_text,
                    messages=history,
                    steps=stats.steps,
                    finish_reason="stop",
                )

            # 执行所有工具调用（彼此独立时模型会一次给多个）
            stats.tool_calls += len(resp.tool_calls)
            for call in resp.tool_calls:
                result = await self._execute(call, guards)
                history.append(Message.tool(result))
                await self._emit(
                    "tool_result",
                    {
                        "name": result.name,
                        "call_id": result.call_id,
                        "is_error": result.is_error,
                        "chars": len(result.content),
                        # 流式 UI 直接展示回填内容；截断避免事件过大
                        "content": result.content[:400],
                    },
                )

    async def _execute(self, call: ToolCall, guards: Guardrails) -> ToolResult:
        registered = set()
        # 延迟取集合，避免注册变动后过期
        registered = {s.name for s in self.tools.specs()}
        guards.ensure_tool_allowed(call.name, registered)
        guards.observe_call(call.name, call.arguments)

        fn = self.tools.get(call.name)
        await self._emit(
            "tool_call", {"name": call.name, "arguments": call.arguments, "call_id": call.id}
        )
        try:
            result = fn(**call.arguments)
            if inspect.isawaitable(result):
                result = await result
        except Exception as exc:  # noqa: BLE001 - 工具错误要转成结构化观察
            if self.config.raise_on_tool_error:
                raise ToolExecutionError(call.name, exc) from exc
            content = f"ERROR: 工具 {call.name} 执行失败: {exc!r}\n请检查参数或换一种方法，不要假装成功。"
            return ToolResult(
                call_id=call.id, name=call.name, content=content, is_error=True
            )

        text = _stringify(result)
        limit = self.config.max_tool_result_chars
        if limit and len(text) > limit:
            text = (
                text[:limit]
                + f"\n…[结果已截断，原始长度 {len(text)} 字符，仅保留前 {limit} 字符]"
            )
        return ToolResult(call_id=call.id, name=call.name, content=text)

    async def _emit(self, event: str, data: dict[str, Any]) -> None:
        if self.on_event is None:
            return
        out = {"event": event, **data}
        coro = self.on_event(out)
        if inspect.isawaitable(coro):
            await coro


def _stringify(result: Any) -> str:
    if isinstance(result, str):
        return result
    if result is None:
        return ""
    import json

    try:
        return json.dumps(result, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        return str(result)


def _resp_event(resp: LLMResponse, stats: RunStats) -> dict[str, Any]:
    return {
        "content": resp.content,
        "tool_calls": [
            {"id": tc.id, "name": tc.name, "arguments": tc.arguments}
            for tc in resp.tool_calls
        ],
        "finish_reason": resp.finish_reason,
        "prompt_tokens": resp.prompt_tokens,
        "completion_tokens": resp.completion_tokens,
        "total_tokens": stats.total_tokens,
        "step": stats.steps,
    }
