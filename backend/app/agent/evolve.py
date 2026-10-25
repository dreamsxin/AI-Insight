"""GEPA 式提示进化：读失败 case → 反思重写 system prompt → 评估留优。

对应调研（agent-self-evolution-research.md 第二节/第六节 #2）：
- GEPA：反射式 prompt 进化超 GRPO 6%、rollout 少至 1/35； DSPy 已内置
- 外环全部在应用层：不改权重，评估器就是 ``eval.run_eval_async``

流程：
  1. 评估 base system prompt（基线）
  2. 每代：把失败 case（名称/输入/原因）喂给 evolver，重写 K 个 prompt 变体
  3. 逐变体评估，通过数超过当前最优者成为新最优（同分保留先者，稳定优先）
  4. 全部通过则提前停止；返回完整候选档案供人工确认后替换

红线：进化产物是 prompt 而非权重；替换需人工确认（本模块只产出报告）。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from app.agent.eval import EvalCase, EvalReport, run_eval_async
from app.agent.tools import ToolRegistry


@dataclass
class PromptCandidate:
    """一个被评估过的 system prompt 候选。"""

    system_prompt: str
    passed: int
    failed: int
    results: list[tuple[str, bool, str]]
    origin: str  # "base" / "gen{g}-v{v}"
    note: str = ""

    @property
    def total(self) -> int:
        return self.passed + self.failed

    def summary(self) -> dict[str, Any]:
        return {
            "origin": self.origin,
            "passed": self.passed,
            "failed": self.failed,
            "note": self.note,
        }


@dataclass
class EvolutionReport:
    """进化档案：base 基线 + 全部候选 + 最优（替换需人工确认）。"""

    baseline: PromptCandidate
    candidates: list[PromptCandidate] = field(default_factory=list)
    best: PromptCandidate | None = None
    history: list[dict[str, Any]] = field(default_factory=list)

    def audit_lines(self) -> list[str]:
        """可写入 evolution.jsonl 的审计行。"""
        return [json.dumps(x, ensure_ascii=False) for x in self.history]


_EVOLVER_PROMPT = """你在优化一个 AI Agent 的 system prompt。当前 prompt 在部分评估 case 上失败：

失败清单：
{failures}

当前 system prompt：
---
{base}
---

请重写 system prompt：
- 修复失败 case 暴露的问题（通常是缺少关键行为指令）
- 不得破坏已通过 case 需要的约束
- 具体的行为指令（先做什么、后做什么）比抽象品质描述有效

只输出新的 system prompt 全文，不要解释。
"""


def _format_failures(cases: list[EvalCase], results: list[tuple[str, bool, str]]) -> str:
    by_name = {c.name: c for c in cases}
    lines = []
    for name, ok, detail in results:
        if ok:
            continue
        case = by_name.get(name)
        prompt_text = case.prompt if case else "?"
        lines.append(f'- case「{name}」输入：{prompt_text}；失败原因：{detail or "断言未通过"}')
    return "\n".join(lines) or "（无失败）"


def _better(a: PromptCandidate, b: PromptCandidate) -> bool:
    """a 是否应取代 b 成为最优：通过数更多；同分保持先者（稳定优先）。"""
    return a.passed > b.passed


async def evolve_prompt_async(
    cases: list[EvalCase],
    *,
    registry: ToolRegistry,
    base_system_prompt: str,
    evolver,  # LLMClient / ScriptedLLM：负责重写 prompt 的模型
    live_model: str | None = None,
    generations: int = 2,
    variants_per_gen: int = 2,
) -> EvolutionReport:
    """运行进化外环，返回含全部候选与最优 prompt 的报告。"""
    report = EvolutionReport(
        baseline=PromptCandidate(
            system_prompt=base_system_prompt, passed=0, failed=0,
            results=[], origin="base",
        )
    )

    # --- 基线 ---
    base_report: EvalReport = await run_eval_async(
        cases, registry=registry, system_prompt=base_system_prompt, live_model=live_model,
    )
    report.baseline.passed = base_report.passed
    report.baseline.failed = base_report.failed
    report.baseline.results = base_report.results
    report.candidates.append(report.baseline)
    report.best = report.baseline
    report.history.append({"gen": 0, **report.baseline.summary()})

    if base_report.failed == 0:
        report.history.append({"gen": 0, "event": "early-stop", "reason": "基线已全部通过"})
        return report

    current_best = report.baseline
    case_by_name = {c.name: c for c in cases}
    seen_prompts = {base_system_prompt}

    for gen in range(1, generations + 1):
        failures = _format_failures(cases, current_best.results)
        prompt_text = _EVOLVER_PROMPT.format(failures=failures, base=current_best.system_prompt)

        gen_improved = False
        for v in range(1, variants_per_gen + 1):
            origin = f"gen{gen}-v{v}"
            try:
                resp = await evolver.chat(
                    [{"role": "user", "content": prompt_text}], temperature=0.4,
                )
                new_prompt = (resp.content or "").strip()
            except Exception as exc:  # noqa: BLE001 - 进化器故障只损失一个变体
                report.history.append(
                    {"gen": gen, "origin": origin, "event": "evolver-error", "detail": repr(exc)}
                )
                continue
            if not new_prompt or new_prompt in seen_prompts:
                report.history.append({"gen": gen, "origin": origin, "event": "duplicate-skip"})
                continue
            seen_prompts.add(new_prompt)

            cand_report: EvalReport = await run_eval_async(
                cases, registry=registry, system_prompt=new_prompt, live_model=live_model,
            )
            cand = PromptCandidate(
                system_prompt=new_prompt,
                passed=cand_report.passed, failed=cand_report.failed,
                results=cand_report.results, origin=origin,
            )
            report.candidates.append(cand)
            improved = _better(cand, current_best)
            report.history.append(
                {"gen": gen, "origin": origin, "passed": cand.passed, "failed": cand.failed,
                 "improved": improved}
            )
            if improved:
                current_best = cand
                gen_improved = True

        report.history.append(
            {"gen": gen, "event": "generation-done", "improved": gen_improved}
        )
        if current_best.passed == len(cases):
            report.history.append({"gen": gen, "event": "early-stop", "reason": "全部通过"})
            break
        # 没有改进时，下一代仍基于 current_best 的失败重写（换 K 个新变异）

    report.best = current_best
    return report


def evolve_prompt(
    cases: list[EvalCase],
    *,
    registry: ToolRegistry,
    base_system_prompt: str,
    evolver,
    live_model: str | None = None,
    generations: int = 2,
    variants_per_gen: int = 2,
) -> EvolutionReport:
    """同步包装：脚本 / CLI 直接调用。"""
    import asyncio

    return asyncio.get_event_loop().run_until_complete(
        evolve_prompt_async(
            cases, registry=registry, base_system_prompt=base_system_prompt,
            evolver=evolver, live_model=live_model,
            generations=generations, variants_per_gen=variants_per_gen,
        )
    )
