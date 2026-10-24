"""离线测试替身：不接真实模型也能确定性驱动 Agent 循环。

供单元测试 / examples / eval 使用 —— 12 个框架测试与 harness 示例都基于它。
"""

from __future__ import annotations

import json

from app.agent.llm import LLMResponse
from app.agent.models import ToolCall


class ScriptedLLM:
    """按脚本顺序返回预设响应；记录每次收到的消息，便于断言与观察。"""

    def __init__(self, scripts: list[LLMResponse]):
        self.scripts = list(scripts)
        self.calls: list[list] = []

    async def chat(self, messages, *, tools=None, temperature=0.7, extra=None):
        self.calls.append(list(messages))
        idx = min(len(self.calls) - 1, len(self.scripts) - 1)
        return self.scripts[idx]


def tool_call(cid: str, tool_name: str, **args) -> ToolCall:
    """构造一个模型发起的工具调用提案。"""
    return ToolCall(
        id=cid,
        name=tool_name,
        arguments=args,
        raw_arguments=json.dumps(args, ensure_ascii=False),
    )


def answer(text: str) -> LLMResponse:
    """最终回答（无工具调用，循环收敛）。"""
    return LLMResponse(
        content=text, finish_reason="stop", prompt_tokens=10, completion_tokens=5
    )


def use_tool(calls: list[ToolCall]) -> LLMResponse:
    """要求执行工具（finish_reason=tool_calls，循环继续）。"""
    return LLMResponse(
        content="", tool_calls=calls, finish_reason="tool_calls",
        prompt_tokens=10, completion_tokens=8,
    )
