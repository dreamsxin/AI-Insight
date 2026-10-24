"""共享脚手架：离线 ScriptedLLM / 在线真实模型切换 + backend 路径引导。

所有 demo 默认使用离线 ScriptedLLM（无需网络与 API Key，输出确定性）；
加 `--live` 参数则改用环境变量 LLM_BASE_URL / LLM_API_KEY 的真实模型。
"""

from __future__ import annotations

import sys
from pathlib import Path

# 把 backend/ 加入 sys.path，使 `import app.agent` 生效
BACKEND = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND))

from app.agent import Agent, AgentConfig, LLMClient  # noqa: E402
from app.agent.llm import LLMResponse  # noqa: E402
from app.agent.models import ToolCall  # noqa: E402


class ScriptedLLM:
    """按脚本顺序返回预设响应的离线模型替身；记录收到的消息便于观察。"""

    def __init__(self, scripts: list[LLMResponse]):
        self.scripts = list(scripts)
        self.calls: list[list] = []

    async def chat(self, messages, *, tools=None, temperature=0.7, extra=None):
        self.calls.append(list(messages))
        idx = min(len(self.calls) - 1, len(self.scripts) - 1)
        return self.scripts[idx]


def tool_call(cid: str, tool_name: str, **args) -> ToolCall:
    """构造一个模型发起的工具调用提案。"""
    import json

    return ToolCall(
        id=cid,
        name=tool_name,
        arguments=args,
        raw_arguments=json.dumps(args, ensure_ascii=False),
    )


def answer(text: str) -> LLMResponse:
    """最终回答（无工具调用，循环收敛）。"""
    return LLMResponse(content=text, finish_reason="stop", prompt_tokens=10, completion_tokens=5)


def use_tool(calls: list[ToolCall]) -> LLMResponse:
    """要求执行工具（finish_reason=tool_calls，循环继续）。"""
    return LLMResponse(
        content="", tool_calls=calls, finish_reason="tool_calls",
        prompt_tokens=10, completion_tokens=8,
    )


def make_agent(llm, registry, *, system: str, max_steps: int = 8, on_event=None) -> Agent:
    """统一组装：同一套 harness，只换脚本或真实模型。"""
    return Agent(llm, registry, AgentConfig(system_prompt=system, max_steps=max_steps), on_event=on_event)


def live_llm(model: str = "gpt-4o-mini") -> LLMClient:
    """--live 模式：从环境变量读 LLM_BASE_URL / LLM_API_KEY 的真实客户端。"""
    return LLMClient(model=model)


def live_mode(argv: list[str]) -> bool:
    return "--live" in argv


def banner(title: str) -> None:
    print(f"\n{'=' * 58}\n  {title}\n{'=' * 58}")
