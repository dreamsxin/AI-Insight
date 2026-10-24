"""真实模型端到端测试（Roadmap P2）。

需要环境变量 LLM_BASE_URL / LLM_API_KEY；未配置时整文件跳过 ——
CI 默认绿色，本地配置凭证后手动触发：
    LLM_API_KEY=sk-... LLM_BASE_URL=https://api.deepseek.com/v1 pytest app/tests/test_agent_e2e.py
"""

from __future__ import annotations

import os

import pytest

pytestmark = pytest.mark.skipif(
    not os.getenv("LLM_API_KEY"),
    reason="需要 LLM_API_KEY：真实模型 e2e（CI 默认跳过，本地配置凭证后运行）",
)


def build_registry():
    from app.agent import ToolRegistry, tool

    registry = ToolRegistry()

    @tool(registry, description="两数相乘，返回整数积")
    def multiply(a: int, b: int) -> int:
        return a * b

    return registry


@pytest.mark.asyncio
async def test_live_model_uses_calculator_tool():
    from app.agent import Agent, AgentConfig, LLMClient

    agent = Agent(
        LLMClient(),
        build_registry(),
        AgentConfig(
            system_prompt="算术必须调用 multiply 工具，不要心算。回答末尾单独一行给出数字结果。",
            max_steps=6,
            temperature=0.0,
        ),
    )
    result = await agent.run("帮我算 23 乘 7")
    assert "161" in result.output
    assert result.tool_usage.get("multiply", 0) >= 1


@pytest.mark.asyncio
async def test_live_model_guard_trips_on_repeat():
    from app.agent import Agent, AgentConfig, LLMClient, RepeatedCallError, tool

    registry = ToolRegistry()

    @tool(registry, description="永远失败的读取")
    def broken() -> str:
        raise FileNotFoundError("总是失败")

    agent = Agent(
        LLMClient(),
        registry,
        AgentConfig(system_prompt="读取数据。", max_steps=10, max_repeat=2, temperature=0.0),
    )
    with pytest.raises(RepeatedCallError):
        await agent.run("反复读取数据，直到成功为止。不许换方法。")
