"""Agent API routes — expose the app.agent runtime over HTTP.

Error mapping (AgentError is NOT ValueError, so `_safe()` does not apply):
- ValidationError            -> 400
- MaxStepsExceeded / BudgetExceeded / RepeatedCall -> 409 (guard tripped)
- ToolExecutionError         -> 502 (upstream tool failed)
- missing LLM credentials    -> 503 (configuration, not client's fault)
"""

from __future__ import annotations

import asyncio
import json
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.agent import (
    Agent,
    AgentConfig,
    AgentError,
    BudgetExceededError,
    LLMClient,
    MaxStepsExceededError,
    Message,
    RepeatedCallError,
    ToolExecutionError,
    ValidationError,
)
from app.agent.teaching_tools import build_teaching_registry
from app.models.agent import (
    AgentChatRequest,
    AgentChatResponse,
    AgentTraceStep,
)

router = APIRouter(prefix="/agent", tags=["agent"])

DEFAULT_SYSTEM_PROMPT = (
    "你是 AI-Insight 课程的教学助手，回答保持简洁、面向初学者。"
    "涉及算术必须调用 calculator 工具，不要心算；"
    "演示神经网络前向传播用 nn_forward_demo（inputs 固定 3 个数字）；"
    "演示卷积用 cnn_convolve_demo（kernel 选 edge/blur/sharpen/emboss）。"
    "工具报错时读懂错误信息、修正参数重试，绝不假装成功。"
)

_GUARD_ERRORS = (MaxStepsExceededError, BudgetExceededError, RepeatedCallError)


def _require_llm_config() -> None:
    if not os.getenv("LLM_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail={
                "kind": "MissingLLMCredentials",
                "message": "未配置 LLM_API_KEY 环境变量，Agent 服务不可用。"
                "请设置 LLM_BASE_URL / LLM_API_KEY 后重启后端。",
            },
        )


def _create_agent(req: AgentChatRequest, on_event=None) -> Agent:
    """Build a per-request Agent. Module-level so tests can monkeypatch it."""
    llm = LLMClient()
    config = AgentConfig(
        system_prompt=req.system_prompt or DEFAULT_SYSTEM_PROMPT,
        max_steps=req.max_steps,
        max_repeat=3,
        max_total_tokens=200_000,
        max_tool_result_chars=8000,
        temperature=req.temperature,
    )
    return Agent(llm, build_teaching_registry(), config, on_event=on_event)


def _history_messages(req: AgentChatRequest) -> list[Message]:
    history = [Message.system(req.system_prompt or DEFAULT_SYSTEM_PROMPT)]
    for turn in req.history:
        if turn.role == "user":
            history.append(Message.user(turn.content))
        else:
            history.append(Message.assistant(turn.content))
    return history


def _http_status(exc: AgentError) -> int:
    if isinstance(exc, ValidationError):
        return 400
    if isinstance(exc, _GUARD_ERRORS):
        return 409
    if isinstance(exc, ToolExecutionError):
        return 502
    return 500


@router.post("/chat", response_model=AgentChatResponse)
async def agent_chat(req: AgentChatRequest):
    """Run the agent loop once and return the final answer plus a tool trace."""
    _require_llm_config()
    trace: list[AgentTraceStep] = []

    def on_event(ev: dict) -> None:
        kind = ev.get("event")
        if kind == "tool_call":
            trace.append(
                AgentTraceStep(
                    type="tool_call",
                    id=str(ev.get("call_id", "")),
                    name=str(ev.get("name", "")),
                    arguments=ev.get("arguments") or {},
                )
            )
        elif kind == "tool_result":
            trace.append(
                AgentTraceStep(
                    type="tool_result",
                    id=str(ev.get("call_id", "")),
                    name=str(ev.get("name", "")),
                    content=str(ev.get("content", "")),
                    is_error=bool(ev.get("is_error", False)),
                )
            )

    agent = _create_agent(req, on_event)
    try:
        result = await agent.run(req.message, messages=_history_messages(req))
    except AgentError as exc:
        raise HTTPException(
            status_code=_http_status(exc),
            detail={"kind": type(exc).__name__, "message": str(exc)},
        ) from exc
    return AgentChatResponse(
        output=result.output,
        steps=result.steps,
        finish_reason=result.finish_reason,
        trace=trace,
    )


@router.post("/chat/stream")
async def agent_chat_stream(req: AgentChatRequest):
    """SSE variant: emit each framework event as a JSON `data:` line."""
    _require_llm_config()
    queue: asyncio.Queue = asyncio.Queue()

    async def on_event(ev: dict) -> None:
        await queue.put(ev)

    async def _run() -> None:
        try:
            agent = _create_agent(req, on_event)
            await agent.run(req.message, messages=_history_messages(req))
        except AgentError as exc:
            await queue.put(
                {"event": "error", "kind": type(exc).__name__, "detail": str(exc)}
            )
        except Exception as exc:  # noqa: BLE001 - 流式通道必须以事件收尾
            await queue.put({"event": "error", "kind": "InternalError", "detail": repr(exc)})
        finally:
            await queue.put(None)

    async def event_stream():
        task = asyncio.create_task(_run())
        try:
            while True:
                ev = await queue.get()
                if ev is None:
                    break
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        finally:
            task.cancel()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
