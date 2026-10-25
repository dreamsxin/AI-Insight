"""最小评估集运行器（避坑 04 期方法论：小而真 > 大而虚）。

每个 EvalCase = 一条用户输入 + 一段脚本化模型响应 + 一个断言。
`run_eval` 逐 case 用全新 Agent 运行并输出报告；任何 harness 改动
（护栏阈值、标记格式、提示词）都应全量重跑，新旧对比。

用法：
    cases = [
        EvalCase(name="加法走工具", prompt="算 17+25",
                 llm_script=[use_tool([tool_call("c1", "add", a=17, b=25)]), answer("42")],
                 check=lambda r: r.output.endswith("42")),
    ]
    report = run_eval(cases, registry=registry)
    report.print_report()
"""

from __future__ import annotations

import asyncio
from typing import Any
from collections.abc import Callable
from dataclasses import dataclass, field

from app.agent import Agent, AgentConfig, AgentError, LLMClient
from app.agent.models import AgentResult
from app.agent.testing import ScriptedLLM
from app.agent.tools import ToolRegistry


@dataclass
class EvalCase:
    """一条黄金 case：输入 + 脚本（离线）+ 结果断言。"""

    name: str
    prompt: str
    check: Callable[[AgentResult], bool] | None = None
    llm_script: list | None = None  # 离线模式必填（ScriptedLLM 响应序列）
    # 提示进化用：接收 system_prompt、返回对该 prompt 敏感的任务模型。
    # 设置后优先于 llm_script（离线演示「改 prompt → 行为改变」必需）。
    llm_factory: Callable[[str], Any] | None = None
    expect_error: type[AgentError] | None = None  # 期望护栏熔断时填写
    max_steps: int = 8


@dataclass
class EvalReport:
    """运行结果汇总：只涨不跌的资产（每次 harness 改动后全量重跑）。"""

    results: list[tuple[str, bool, str]] = field(default_factory=list)

    @property
    def passed(self) -> int:
        return sum(1 for _, ok, _ in self.results if ok)

    @property
    def failed(self) -> int:
        return sum(1 for _, ok, _ in self.results if not ok)

    def print_report(self) -> None:
        for name, ok, detail in self.results:
            mark = "✓" if ok else "✗"
            line = f"  {mark} {name}"
            if not ok:
                line += f" —— {detail}"
            print(line)
        print(f"评估结果：{self.passed} 通过 / {self.failed} 失败")


async def run_eval_async(
    cases: list[EvalCase],
    *,
    registry: ToolRegistry,
    system_prompt: str = "你是一个严谨的助手。",
    live_model: str | None = None,
) -> EvalReport:
    """逐 case 用全新 Agent 运行并断言；单 case 失败不拖垮整批。"""
    report = EvalReport()
    for case in cases:
        try:
            if case.llm_factory is not None:
                # 提示敏感任务模型：system_prompt 变化 → 行为变化（GEPA 式进化用）
                llm = case.llm_factory(system_prompt)
            elif live_model:
                llm = LLMClient(model=live_model)
            elif case.llm_script is not None:
                llm = ScriptedLLM(case.llm_script)
            else:
                report.results.append((case.name, False, "缺少 llm_factory / llm_script"))
                continue
            agent = Agent(
                llm,
                registry,
                AgentConfig(system_prompt=system_prompt, max_steps=case.max_steps),
            )
            if case.expect_error is not None:
                try:
                    await agent.run(case.prompt)
                    report.results.append((case.name, False, "期望护栏熔断但正常结束"))
                except case.expect_error:
                    report.results.append((case.name, True, ""))
                except AgentError as exc:
                    report.results.append((case.name, False, f"护栏类型不符: {exc!r}"))
                continue
            result = await agent.run(case.prompt)
            if case.check is None:
                report.results.append((case.name, False, "未定义 check"))
                continue
            ok = case.check(result)
            report.results.append((case.name, ok, "断言未通过" if not ok else ""))
        except Exception as exc:  # noqa: BLE001 - 评估器自身不能被单 case 拖垮
            report.results.append((case.name, False, repr(exc)))
    return report


def run_eval(
    cases: list[EvalCase],
    *,
    registry: ToolRegistry,
    system_prompt: str = "你是一个严谨的助手。",
    live_model: str | None = None,
) -> EvalReport:
    """同步包装：脚本/CLI 直接调用。"""
    return asyncio.get_event_loop().run_until_complete(
        run_eval_async(cases, registry=registry, system_prompt=system_prompt, live_model=live_model)
    )
