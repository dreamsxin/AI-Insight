"""步骤 1 · 工具循环：给模型一双手（think → act → observe）。

Harness 的第一块积木：模型只「提案」工具调用，宿主执行后把结果塞回消息，
循环直到模型不再要求工具 —— 它终于能真正计算了。

运行：  python examples/agent-harness-demo/02_tool_loop.py [--live]
"""

from __future__ import annotations

import asyncio
import sys

from _common import answer, banner, live_llm, live_mode, tool_call, use_tool
from app.agent import Agent, ToolRegistry, tool


def build_registry() -> ToolRegistry:
    registry = ToolRegistry()

    @tool(registry, description="两数相加")
    def add(a: int, b: int) -> int:
        return a + b

    return registry


async def main(live: bool) -> None:
    banner("步骤 1 · 工具循环（think → act → observe）")

    async def on_event(ev: dict) -> None:
        if ev["event"] == "tool_call":
            print(f"  [act ] 模型提案 → {ev['name']}({ev['arguments']})")
        elif ev["event"] == "tool_result":
            print(f"  [obs ] 宿主执行，结果回填 ← {ev['content'][:60]}")

    if live:
        agent = Agent(live_llm(), build_registry(), on_event=on_event)
        result = await agent.run("帮我算 17 加 25")
    else:
        from _common import ScriptedLLM

        llm = ScriptedLLM([
            use_tool([tool_call("c1", "add", a=17, b=25)]),   # 第 1 轮：提案工具
            answer("17 加 25 等于 42。"),                       # 第 2 轮：收敛作答
        ])
        agent = Agent(llm, build_registry(), on_event=on_event)
        result = await agent.run("帮我算 17 加 25")

    print(f"  [think] 第 2 轮模型不再要求工具，循环收敛")
    print(f"\n最终回答：{result.output}")
    print(f"循环步数：{result.steps} · 消息轨迹：{len(result.messages)} 条（system/user/assistant/tool/assistant）")
    print("\n→ 模型全程只有提案权，执行权在宿主手里 —— 这是 Harness 的安全边界")


if __name__ == "__main__":
    asyncio.run(main(live_mode(sys.argv)))
