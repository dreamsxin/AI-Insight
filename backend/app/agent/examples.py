"""通用 Agent 框架的开箱示例。

运行需要环境变量（OpenAI 兼容端点）：
    LLM_BASE_URL=https://api.deepseek.com/v1   # 或 OpenAI / 本地 vLLM
    LLM_API_KEY=sk-xxx

    import asyncio
    from app.agent.examples import build_demo_agent
    asyncio.run(build_demo_agent().run("北京和上海哪个人口多？用计算器核对一下"))

测试与无网络环境请参考 app/tests/test_agent.py，其中用 FakeLLM 驱动完整循环。
"""

from __future__ import annotations

from app.agent import Agent, AgentConfig, LLMClient, ToolRegistry, tool


def build_registry() -> ToolRegistry:
    """一个内置计算器 + 时钟的最小工具表，演示注册方式。"""
    registry = ToolRegistry()

    @tool(registry, description="安全地计算一个数学表达式，只允许数字与运算符")
    def calculator(expression: str) -> str:
        allowed = set("0123456789+-*/()., %")
        if not expression or any(ch not in allowed for ch in expression):
            raise ValueError("表达式包含非法字符")
        expr = expression.replace(",", "").replace("%", "/100")
        # 仅用 eval 处理纯数学表达式，字符白名单已挡住函数调用
        return str(eval(expr, {"__builtins__": {}}, {}))  # noqa: S307

    @tool(registry, description="返回当前 UTC 时间的 ISO 字符串")
    def now_utc() -> str:
        from datetime import datetime, timezone

        return datetime.now(timezone.utc).isoformat()

    return registry


def build_demo_agent(*, model: str = "gpt-4o-mini", on_event=None) -> Agent:
    """组装一个可直接 run 的生产形态 Agent。"""
    llm = LLMClient(model=model)
    config = AgentConfig(
        system_prompt=(
            "你是一个严谨的助手。涉及计算必须调用 calculator 工具，"
            "不要心算；工具报错时读懂错误并修正参数重试。"
        ),
        max_steps=8,
        max_total_tokens=200_000,
        max_repeat=3,
        max_tool_result_chars=4000,
        temperature=0.2,
    )
    return Agent(llm, build_registry(), config, on_event=on_event)
