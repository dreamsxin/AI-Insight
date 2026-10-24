"""步骤 0 · 裸 LLM 调用：Harness 出现之前的世界。

直接调用模型只有「一问一答」：不能动手、没有状态、无法验证。
这一屏展示三个缺口 —— 后面每个 demo 各补一个。

运行：  python examples/agent-harness-demo/01_bare_llm.py [--live]
"""

from __future__ import annotations

import asyncio
import sys

from _common import answer, banner, live_llm, live_mode


async def main(live: bool) -> None:
    banner("步骤 0 · 裸 LLM 调用（没有 Harness）")

    if live:
        from app.agent import LLMClient, Message

        resp = await LLMClient().chat([Message.user("用一句话介绍什么是 Agent Harness")])
        print(f"模型回答：{resp.content}\n")
    else:
        from _common import ScriptedLLM

        llm = ScriptedLLM([answer("Agent Harness 是包裹模型的工程层：循环、工具、护栏与日志。")])
        resp = await llm.chat([{"role": "user", "content": "什么是 Agent Harness？"}])
        print(f"模型回答：{resp.content}\n")

    print("裸调用的三个缺口：")
    print("  ✗ 不会动手   —— 说得出『2+3 等于 5』，但从不真正计算")
    print("  ✗ 没有状态   —— 每次调用从零开始，任务中断即全部丢失")
    print("  ✗ 不可信任   —— 没有步数/预算限制，也没有可审计的轨迹")
    print("\n→ 后续 demo 逐个补齐：02 工具循环 · 03 护栏 · 04 错误自救 · 05 轨迹与检查点")


if __name__ == "__main__":
    asyncio.run(main(live_mode(sys.argv)))
