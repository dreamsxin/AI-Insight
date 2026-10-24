"""步骤 4 · 轨迹与检查点：可观测、可恢复的 Harness。

两件事：
① on_event 把每一步写成 JSONL trace —— 黑盒变白盒，失败可回放（避坑 04 期）；
② messages 序列化落盘 = 检查点 —— 新会话带着历史继续，崩溃不再从头再来
  （Hermes 18 期：会话即事件日志）。

运行：  python examples/agent-harness-demo/05_trace_and_checkpoint.py [--live]
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from _common import answer, banner, live_llm, live_mode
from app.agent import Agent, Message, ToolRegistry, tool

HERE = Path(__file__).resolve().parent
TRACE = HERE / "trace.jsonl"
CHECKPOINT = HERE / "checkpoint.json"


def build_registry() -> ToolRegistry:
    registry = ToolRegistry()

    @tool(registry, description="查询某城市当前气温（演示数据）")
    def get_weather(city: str) -> str:
        return {"杭州": "12–19°C 小雨", "北京": "8–15°C 晴"}.get(city, f"{city}：暂无数据")

    return registry


async def main(live: bool) -> None:
    banner("步骤 4 · 轨迹（JSONL）与检查点（messages 落盘）")

    # --- ① 全链路留痕 ----------------------------------------------------
    trace_file = TRACE.open("w", encoding="utf-8")

    async def on_event(ev: dict) -> None:
        trace_file.write(json.dumps(ev, ensure_ascii=False) + "\n")

    if live:
        agent = Agent(live_llm(), build_registry(), on_event=on_event)
        result = await agent.run("杭州今天多少度？")
    else:
        from _common import ScriptedLLM, tool_call, use_tool

        llm = ScriptedLLM([
            use_tool([tool_call("c1", "get_weather", city="杭州")]),
            answer("杭州今天 12–19°C 小雨，出门带伞。"),
        ])
        agent = Agent(llm, build_registry(), on_event=on_event)
        result = await agent.run("杭州今天多少度？")
    trace_file.close()

    print("① 轨迹已写入 trace.jsonl：")
    for line in TRACE.read_text(encoding="utf-8").splitlines():
        ev = json.loads(line)
        print(f"   {ev['event']:<12} " + json.dumps(
            {k: v for k, v in ev.items() if k != "event"}, ensure_ascii=False)[:80])

    # --- ② 检查点：messages 落盘，下个会话接着聊 --------------------------
    CHECKPOINT.write_text(
        json.dumps([m.model_dump() for m in result.messages], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\n② 检查点已写入 checkpoint.json（{len(result.messages)} 条消息）")

    restored = [Message(**m) for m in json.loads(CHECKPOINT.read_text(encoding="utf-8"))]
    restored.append(Message.user("那北京呢？"))
    print(f"   恢复 {len(restored) - 1} 条历史，追加新问题『那北京呢？』继续运行：")

    if live:
        agent2 = Agent(live_llm(), build_registry())
        result2 = await agent2.run(messages=restored)
    else:
        from _common import ScriptedLLM

        llm2 = ScriptedLLM([answer("北京 8–15°C 晴。")])
        agent2 = Agent(llm2, build_registry())
        result2 = await agent2.run(messages=restored)

    print(f"   续聊回答：{result2.output}")
    print("\n→ 崩溃恢复 = 事件/消息重放；这正是 Hermes 18 期『会话即日志』的最小实现")


if __name__ == "__main__":
    asyncio.run(main(live_mode(sys.argv)))
    print(f"\n产物：{TRACE.name} / {CHECKPOINT.name}（已生成在示例目录，可删除）")
