"""Pydantic 数据模型：消息、工具调用、工具规格、运行结果。

消息结构对齐 OpenAI Chat Completions：
    system / user / assistant(可带 tool_calls) / tool
这保证同一份 messages 可以直接发给任何兼容端点。
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class Role(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class ToolCall(BaseModel):
    """模型发起的一次工具调用（只有提案权，执行由 harness 完成）。"""

    id: str
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    # 模型给的原始 JSON 字符串，参数解析失败时保留以便审计
    raw_arguments: str = ""


class ToolResult(BaseModel):
    """工具执行结果，作为 role=tool 的消息回填给模型。"""

    call_id: str
    name: str
    content: str
    is_error: bool = False


class Message(BaseModel):
    """对话消息（append-only，不改写历史）。"""

    role: Role
    content: str = ""
    # assistant 消息可携带工具调用
    tool_calls: list[ToolCall] | None = None
    # role=tool 时对应的调用 id 与工具名
    tool_call_id: str | None = None
    name: str | None = None

    @classmethod
    def system(cls, content: str) -> "Message":
        return cls(role=Role.SYSTEM, content=content)

    @classmethod
    def user(cls, content: str) -> "Message":
        return cls(role=Role.USER, content=content)

    @classmethod
    def assistant(
        cls, content: str = "", tool_calls: list[ToolCall] | None = None
    ) -> "Message":
        return cls(role=Role.ASSISTANT, content=content, tool_calls=tool_calls)

    @classmethod
    def tool(cls, result: ToolResult) -> "Message":
        return cls(
            role=Role.TOOL,
            content=result.content,
            tool_call_id=result.call_id,
            name=result.name,
        )

    def to_api(self) -> dict[str, Any]:
        """转成 OpenAI 兼容的请求 dict（剔除 None 字段）。"""
        data: dict[str, Any] = {"role": self.role.value}
        if self.content:
            data["content"] = self.content
        if self.tool_calls:
            data["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.name, "arguments": _dump_args(tc)},
                }
                for tc in self.tool_calls
            ]
        if self.tool_call_id is not None:
            data["tool_call_id"] = self.tool_call_id
        if self.name is not None:
            data["name"] = self.name
        return data


def _dump_args(tc: ToolCall) -> str:
    """优先回传模型原始 JSON；用结构化参数兜底（保持键序稳定）。"""
    import json

    if tc.raw_arguments:
        return tc.raw_arguments
    return json.dumps(tc.arguments, ensure_ascii=False)


class ToolSpec(BaseModel):
    """工具规格：暴露给模型的说明书（name + description + JSON Schema）。"""

    name: str
    description: str
    parameters: dict[str, Any] = Field(
        default_factory=lambda: {"type": "object", "properties": {}}
    )


class AgentResult(BaseModel):
    """一次 Agent.run 的最终产物。"""

    output: str
    messages: list[Message]
    steps: int
    finish_reason: str  # stop / tool_calls(length 截断由调用方感知) / max_steps
    stopped_by_guard: bool = False
