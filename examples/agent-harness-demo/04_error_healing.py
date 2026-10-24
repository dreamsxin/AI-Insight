"""步骤 3 · 错误回填：失败不是崩溃，是塞回循环的观察。

工具报错时不抛异常，而是把错误文本作为 role=tool 的观察回填 ——
模型下一轮亲眼看到失败原因，自己修正参数重试。

运行：  python examples/agent-harness-demo/04_error_healing.py [--live]
"""

from __future__ import annotations

import asyncio
import sys

from _common import answer, banner, live_llm, live_mode, tool_call, use_tool
from app.agent import Agent, ToolRegistry, tool

CONFIG_DIR = {"has_yml": False}


def build_registry() -> ToolRegistry:
    registry = ToolRegistry()

    @tool(registry, description="读取项目配置文件，传文件名如 config.json")
    def read_config(name: str) -> str:
        if not name.endswith((".json", ".yml", ".yaml")):
            raise ValueError(f"不支持的配置格式: {name}")
        if name == "config.json":
            # 第一次：文件真的不存在
            raise FileNotFoundError("config.json 不存在（同目录下也许叫 config.yml？）")
        return "app_port=8000\nlog_level=info"

    return registry


async def main(live: bool) -> None:
    banner("步骤 3 · 错误回填（错误是观察，不是异常）")

    async def on_event(ev: dict) -> None:
        if ev["event"] == "tool_call":
            print(f"  [act ] 调用 {ev['name']}({ev['arguments']})")
        elif ev["event"] == "tool_result":
            tag = "✗ 失败" if ev.get("is_error") else "✓ 成功"
            print(f"  [obs ] {tag} ← {ev['content'][:70]}")

    if live:
        agent = Agent(live_llm(), build_registry(), on_event=on_event)
        result = await agent.run("读取项目配置")
    else:
        from _common import ScriptedLLM

        llm = ScriptedLLM([
            use_tool([tool_call("c1", "read_config", name="config.json")]),
            # 模型读到错误观察后，自己换对了文件名
            use_tool([tool_call("c2", "read_config", name="config.yml")]),
            answer("配置读取成功：端口 8000，日志级别 info。"),
        ])
        agent = Agent(llm, build_registry(), on_event=on_event)
        result = await agent.run("读取项目配置")

    print(f"\n最终回答：{result.output}")
    print("\n要点：")
    print("  · raise_on_tool_error=False（默认）→ 错误成为下一轮观察")
    print("  · 错误信息越具体（『也许叫 config.yml？』），自救成功率越高")
    print("  · 宁可如实报错，不许编一个『已完成』")


if __name__ == "__main__":
    asyncio.run(main(live_mode(sys.argv)))
