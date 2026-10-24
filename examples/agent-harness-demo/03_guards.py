"""步骤 2 · 护栏：三道保险丝，防死循环与烧钱。

模型可能无限重复同一个失败动作。护栏在代码层强制：
MAX_STEPS 步数上限 / token 预算 / 重复调用检测 —— 不依赖模型自觉。

运行：  python examples/agent-harness-demo/03_guards.py
"""

from __future__ import annotations

import asyncio

from _common import banner, make_agent, tool_call, use_tool
from app.agent import RepeatedCallError, ToolRegistry, tool


def build_registry() -> ToolRegistry:
    registry = ToolRegistry()

    @tool(registry, description="读一个配置文件")
    def read_config(name: str) -> str:
        # 演示用：永远失败，模拟模型撞墙
        raise FileNotFoundError(f"config 文件 {name} 不存在")

    return registry


async def main() -> None:
    banner("步骤 2 · 护栏（步数 / 预算 / 重复检测）")

    # 模型脚本：一遍遍用完全相同的参数撞同一堵墙
    from _common import ScriptedLLM

    llm = ScriptedLLM([use_tool([tool_call(f"c{i}", "read_config", name="config.json")]) for i in range(10)])

    registry = build_registry()
    agent = make_agent(llm, registry, system="S", max_steps=10)

    print("模型开始反复以相同参数调用 read_config('config.json') …\n")
    try:
        await agent.run("读取配置")
    except RepeatedCallError as exc:
        print(f"⛔ 保险丝熔断：{exc}")
        print("   （连续 3 次同工具同参数 → 判定复读死循环，强制停止）")

    print("\n三道保险丝（全部在宿主代码里，模型关不掉）：")
    print("  ① max_steps   步数上限     —— 防空转")
    print("  ② token 预算  总量封顶     —— 防烧钱")
    print("  ③ repeat 检测 同参数连击   —— 防复读")
    print("\n→ 熔断后应升级而非硬扛：问人 / 换路 / 如实报 failed（见避坑指南 02 期）")


if __name__ == "__main__":
    asyncio.run(main())
