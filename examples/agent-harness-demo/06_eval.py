"""步骤 5+ · 最小评估集：让 Harness 改动有数字可依（避坑 04 期方法论）。

任何 harness 改动（护栏阈值、标记格式、提示词）都应全量重跑黄金 case。
本脚本内置 4 条离线 case：两条应通过、一条断言故意失败（演示报告）、
一条期望护栏熔断。加 --live 时用真实模型跑非护栏 case。

运行：  python examples/agent-harness-demo/06_eval.py [--live]
"""

from __future__ import annotations

import asyncio
import sys

from _common import answer, banner, live_llm, live_mode, tool_call, use_tool
from app.agent import (
    EvalCase,
    RepeatedCallError,
    ToolRegistry,
    run_eval_async,
    tool,
)


def build_registry() -> ToolRegistry:
    registry = ToolRegistry()

    @tool(registry, description="两数相加")
    def add(a: int, b: int) -> int:
        return a + b

    @tool(registry, description="读一个配置文件")
    def read_config(name: str) -> str:
        if name != "config.yml":
            raise FileNotFoundError(f"{name} 不存在（也许叫 config.yml？）")
        return "app_port=8000"

    return registry


def build_cases() -> list[EvalCase]:
    return [
        EvalCase(
            name="加法走工具并收敛",
            prompt="算 17+25",
            llm_script=[use_tool([tool_call("c1", "add", a=17, b=25)]), answer("17 加 25 等于 42。")],
            check=lambda r: r.output.endswith("42。") and r.tool_usage.get("add") == 1,
        ),
        EvalCase(
            name="配置错误后自救",
            prompt="读取配置",
            llm_script=[
                use_tool([tool_call("c1", "read_config", name="config.json")]),
                use_tool([tool_call("c2", "read_config", name="config.yml")]),
                answer("配置读取成功。"),
            ],
            check=lambda r: r.output.endswith("成功。"),
        ),
        EvalCase(
            name="复读触发护栏（期望熔断）",
            prompt="复读",
            llm_script=[use_tool([tool_call(f"c{i}", "read_config", name="config.yml")]) for i in range(10)],
            expect_error=RepeatedCallError,
            max_steps=10,
        ),
        EvalCase(
            name="故意失败的断言（演示报告）",
            prompt="算 1+1",
            llm_script=[answer("2")],
            check=lambda r: r.output == "这条永远不会成立",
        ),
    ]


async def main(live: bool) -> None:
    banner("步骤 5+ · 最小评估集（黄金 case 全量重跑）")
    cases = build_cases()
    if live:
        # 真实模型下护栏时序不确定，仅跑确定性 case
        cases = [c for c in cases if c.expect_error is None]
        report = await run_eval_async(cases, registry=build_registry(), live_model=live_llm().model)
    else:
        report = await run_eval_async(cases, registry=build_registry())

    report.print_report()
    print("\n要点：")
    print("  · 评估集是唯一只涨不跌的资产 —— 线上翻车 trace 转成新 case")
    print("  · 改护栏 / 标记 / 提示词后全量重跑，新旧对比，全绿才合入")


if __name__ == "__main__":
    asyncio.run(main(live_mode(sys.argv)))
