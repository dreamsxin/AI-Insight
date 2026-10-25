"""GEPA 式提示进化测试：prompt 敏感任务模型 + 进化外环 + 边界行为。"""

from __future__ import annotations

import pytest

from app.agent import (
    Agent,
    AgentConfig,
    EvalCase,
    EvolutionReport,
    ScriptedLLM,
    ToolRegistry,
    evolve_prompt_async,
    tool,
)
from app.agent.evolve import PromptCandidate
from app.agent.llm import LLMResponse
from app.agent.testing import answer, tool_call, use_tool

# ---------- 提示敏感的任务模型 ----------

CONFIG = {"port": 8000}


class PromptSensitiveLLM:
    """system prompt 里有「先调用 probe_config」就先探后改；否则瞎猜踩坑。"""

    def __init__(self, system_prompt: str) -> None:
        self.system_prompt = system_prompt
        self.calls = 0

    async def chat(self, messages, *, tools=None, temperature=0.7, extra=None):
        self.calls += 1
        sys_text = messages[0].content if messages else ""
        smart = "先调用 probe_config" in sys_text
        n = self.calls
        from app.agent.testing import answer, tool_call, use_tool

        if smart:
            seq = {
                1: use_tool([tool_call(f"p{n}", "probe_config")]),
                2: use_tool([tool_call(f"a{n}", "apply_config", filename="config.yml", port=8100)]),
            }
            if n in seq:
                return seq[n]
            return answer("端口已改为 8100。")
        # naive：瞎猜 config.json → 报错两次 → 虚假宣布成功
        seq = {
            1: use_tool([tool_call(f"p{n}", "apply_config", filename="config.json", port=8100)]),
            2: use_tool([tool_call(f"q{n}", "apply_config", filename="config.json", port=8100)]),
        }
        if n in seq:
            return seq[n]
        return answer("已把端口改为 8100。")


def build_registry():
    registry = ToolRegistry()

    @tool(registry, description="探测实际的配置文件名")
    def probe_config() -> str:
        return "实际配置文件是 config.yml（不是 config.json）"

    @tool(registry, description="修改配置文件中的端口")
    def apply_config(filename: str, port: int) -> str:
        if filename != "config.yml":
            raise ValueError(f"{filename} 不存在；请先用 probe_config 查明实际文件名")
        CONFIG["port"] = port
        return f"端口已更新为 {port}"

    return registry


def build_cases():
    return [
        EvalCase(
            name="改端口",
            prompt="把配置端口改为 8100",
            llm_factory=PromptSensitiveLLM,
            check=lambda r: CONFIG["port"] == 8100,
        ),
        EvalCase(
            name="再改端口",
            prompt="把配置端口改为 8100 并确认",
            llm_factory=PromptSensitiveLLM,
            check=lambda r: CONFIG["port"] == 8100,
        ),
    ]


BASE_PROMPT = "你负责修改配置端口。"


class FixedLLM:
    """进化器替身：每次返回固定的重写文本。"""

    def __init__(self, text: str) -> None:
        self.text = text

    async def chat(self, messages, *, tools=None, temperature=0.7, extra=None):
        return LLMResponse(content=self.text, finish_reason="stop")


GOOD_REWRITE = (
    "你负责修改配置端口。纪律：先调用 probe_config 查明实际配置文件名，"
    "再用 apply_config 传入该文件名与目标端口。不许猜文件名；"
    "工具报错时读懂错误修正重试；只有工具确认成功才算完成。"
)


# ---------- 测试 ----------


@pytest.mark.asyncio
async def test_evolution_improves_pass_count():
    global CONFIG
    CONFIG = {"port": 8000}
    evolver = FixedLLM(GOOD_REWRITE)
    report = await evolve_prompt_async(
        build_cases(), registry=build_registry(),
        base_system_prompt=BASE_PROMPT, evolver=evolver,
        generations=1, variants_per_gen=1,
    )
    assert report.baseline.passed == 0
    assert report.best.passed == report.baseline.total
    assert report.best is not report.baseline
    assert report.best.system_prompt == GOOD_REWRITE
    assert any(h.get("improved") for h in report.history)


@pytest.mark.asyncio
async def test_evolver_failure_keeps_baseline():
    class BrokenLLM:
        async def chat(self, messages, **kwargs):
            raise RuntimeError("进化器故障")

    global CONFIG
    CONFIG = {"port": 8000}
    report = await evolve_prompt_async(
        build_cases(), registry=build_registry(),
        base_system_prompt=BASE_PROMPT, evolver=BrokenLLM(),
        generations=1, variants_per_gen=1,
    )
    assert report.best is report.baseline
    assert len(report.candidates) == 1
    assert any(h.get("event") == "evolver-error" for h in report.history)


@pytest.mark.asyncio
async def test_all_pass_baseline_stops_early():
    global CONFIG
    CONFIG = {"port": 8000}
    # 基线 prompt 本身含关键指令 → 2 case 全过 → 提前停止，进化器零调用
    evolver = FixedLLM("不应被使用")
    report = await evolve_prompt_async(
        build_cases(), registry=build_registry(),
        base_system_prompt="纪律：先调用 probe_config 查明实际文件名，再 apply_config。",
        evolver=evolver, generations=2, variants_per_gen=2,
    )
    assert report.baseline.passed == 2
    assert report.best is report.baseline
    assert evolver.text == "不应被使用"  # 从未被调用
    assert any(h.get("event") == "early-stop" for h in report.history)


@pytest.mark.asyncio
async def test_duplicate_variant_is_skipped():
    global CONFIG
    CONFIG = {"port": 8000}
    # 进化器返回与基线完全相同的 prompt → duplicate-skip，不重复评估
    report = await evolve_prompt_async(
        build_cases(), registry=build_registry(),
        base_system_prompt=BASE_PROMPT, evolver=FixedLLM(BASE_PROMPT),
        generations=1, variants_per_gen=2,
    )
    assert [h.get("event") for h in report.history].count("duplicate-skip") == 2
    assert len(report.candidates) == 1


def test_prompt_candidate_total():
    c = PromptCandidate(system_prompt="x", passed=3, failed=1, results=[], origin="base")
    assert c.total == 4
