"""Pydantic models for the Agent API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AgentHistoryMessage(BaseModel):
    """A prior conversation turn supplied by the caller."""

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=20000)


class AgentChatRequest(BaseModel):
    """Request body for ``POST /api/agent/chat`` (and ``/chat/stream``)."""

    message: str = Field(min_length=1, max_length=20000)
    history: list[AgentHistoryMessage] = Field(default_factory=list, max_length=40)
    system_prompt: str | None = Field(default=None, max_length=8000)
    max_steps: int = Field(default=8, ge=1, le=25)
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    # 提供时服务端按它加载/保存会话检查点（覆盖 history 字段）
    session_id: str | None = Field(
        default=None, min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_\-]+$"
    )


class AgentTraceStep(BaseModel):
    """One tool call / result pair element for UI timelines."""

    type: Literal["tool_call", "tool_result"]
    id: str
    name: str
    arguments: dict | None = None
    content: str | None = None
    is_error: bool = False


class AgentChatResponse(BaseModel):
    """Response body for ``POST /api/agent/chat``."""

    output: str
    steps: int
    finish_reason: str
    trace: list[AgentTraceStep] = Field(default_factory=list)
    session_id: str | None = None
