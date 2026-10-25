"""步骤 8 · GEPA 式提示进化：读失败 case → 重写 prompt → 评估留优。

自进化外环（无需训练）：
  基线 prompt 在 2 条 case 上全挂 → 进化器读失败清单重写 prompt →
  逐变体评估 → 通过数超过基线者成为新最优 → 输出候选档案（人工确认后替换）。

运行：  python examples/agent-harness-demo/09_prompt_evolution.py [--live]
产物：  evolution.jsonl（进化档案审计行）
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from _common import banner, live_llm, live_mode, tool_call, use_tool
from app.agent import (
    EvalCase,
    ToolRegistry,
    evolve_prompt_async,
    tool,
)
from app.agent.testing import answer

HERE = Path(__file__).resolve().parent
AUDIT = HERE / "evolution.jsonl"

BASE_PROMPT = "你负责修改配置端口。"


def build_registry() -> ToolRegistry:
    registry = ToolRegistry()

    @tool(registry, description="探测实际的配置文件名")
    def probe_config() -> str:
        return "实际配置文件是 config.yml（不是 config.json）"

    @tool(registry, description="修改配置文件中的端口")
    def apply_config(filename: str, port: int) -> str:
        if filename != "config.yml":
            raise ValueError(f"{filename} 不存在；请先用 probe_config 查明实际文件名")
        return f"端口已更新为 {port}"

    return registry


class PromptSensitiveLLM:
    """提示敏感任务模型：system prompt 里有 probe 纪律就先探后改，否则瞎猜踩坑。"""

    def __init__(self, system_prompt: str) -> None:
        self.system_prompt = system_prompt
        self.calls = 0

    async def chat(self, messages, *, tools=None, temperature=0.7, extra=None):
        self.calls += 1
        from app.agent.testing import answer as _answer, tool_call as _tc, use_tool as _ut

        smart = "先调用 probe_config" in (messages[0].content if messages else "")
        n = self.calls
        if smart:
            seq = {
                1: _ut([_tc(f"p{n}", "probe_config")]),
                2: _ut([_tc(f"a{n}", "apply_config", filename="config.yml", port=8100)]),
            }
            if n in seq:
                return seq[n]
            return _answer("端口已改为 8100（依据：probe_config 查得实际文件名 config.yml）。")
        seq = {
            1: _ut([_tc(f"p{n}", "apply_config", filename="config.json", port=8100)]),
            2: _ut([_tc(f"q{n}", "apply_config", filename="config.json", port=8100)]),
        }
        if n in seq:
            return seq[n]
        return _answer("已把端口改为 8100。")


def build_cases() -> list[EvalCase]:
    # llm_factory：接收 system_prompt → 返回对该 prompt 敏感的任务模型
    return [
        EvalCase(
            name="改端口",
            prompt="把配置端口改为 8100",
            llm_factory=PromptSensitiveLLM,
            check=lambda r: "8100" in r.output,
        ),
        EvalCase(
            name="改端口并说明依据",
            prompt="把端口改为 8100，并说明你怎么知道该改哪个文件",
            llm_factory=PromptSensitiveLLM,
            check=lambda r: "8100" in r.output and "config.yml" in r.output,
        ),
    ]


class EvolutionLLM:
    """进化器替身：第 1 次给出好重写；之后的变体与基线相同（被去重跳过）。"""

    def __init__(self) -> None:
        self.calls = 0

    async def chat(self, messages, *, tools=None, temperature=0.7, extra=None):
        self.calls += 1
        from _common import answer as _answer

        if self.calls == 1:
            return _answer(
                "你负责修改配置端口。纪律：先调用 probe_config 查明实际配置文件名，"
                "再用 apply_config 传入该文件名与目标端口；不许猜文件名；"
                "回答时必须给出依据（实际文件名）。"
            )
        return _answer(BASE_PROMPT)  # 变体与基线相同 → duplicate-skip


async def main(live: bool) -> None:
    banner("步骤 8 · GEPA 式提示进化（失败清单 → 重写 prompt → 评估留优）")

    evolver = live_llm() if live else EvolutionLLM()
    report = await evolve_prompt_async(
        build_cases(),
        registry=build_registry(),
        base_system_prompt=BASE_PROMPT,
        evolver=evolver,
        generations=2,
        variants_per_gen=2,
    )

    print(f"基线：{report.baseline.passed}/{report.baseline.total} 通过")
    for c in report.candidates[1:]:
        print(f"候选 {c.origin}：{c.passed}/{c.total} 通过")
    print(f"最优：{report.best.origin} · {report.best.passed}/{report.best.total}")

    AUDIT.write_text("\n".join(report.audit_lines()) + "\n", encoding="utf-8")
    print(f"\n进化档案已写入 {AUDIT.name}：")
    for line in AUDIT.read_text(encoding="utf-8").splitlines():
        print(" ", line[:110])

    print("\n--- 最优 system prompt ---")
    print(report.best.system_prompt)
    print("\n要点：")
    print("  · 只改 prompt 不改权重，2/2 失败 → 2/2 通过")
    print("  · 全部通过即提前停止；重复变体自动去重；替换前留人工确认")


if __name__ == "__main__":
    asyncio.run(main(live_mode(sys.argv)))
