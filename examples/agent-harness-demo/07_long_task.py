"""步骤 6 · 长任务两段式：feature 清单 + 进度文件（Anthropic 配方）。

长任务 agent 的两大失败模式（Anthropic, 2025-11）：
  ① one-shot 试图一次做完 → context 耗尽留半成品
  ② 过早宣布完工（看到进展就说完成了）
解法是 harness 层的三件套：initializer 先把需求展开成 feature 清单
（JSON，全部 passes:false）、每个 session 只做一个 feature、测试通过才允许
翻 true —— 本脚本用「工具层强制测试门禁」演示这套纪律。

运行：  python examples/agent-harness-demo/07_long_task.py [--live]
产物：  manifest.json / progress.md（生成在示例目录）
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from _common import answer, banner, live_llm, live_mode, tool_call, use_tool
from app.agent import Agent, ToolRegistry, tool

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "manifest.json"
PROGRESS = HERE / "progress.md"


# ---------- initializer 产物（首个 session 的职责） ----------

def initialize(features: list[str]) -> None:
    MANIFEST.write_text(
        json.dumps(
            [{"feature": f, "passes": False} for f in features],
            ensure_ascii=False, indent=2,
        ),
        encoding="utf-8",
    )
    PROGRESS.write_text("# 进度日志\n", encoding="utf-8")


def load_manifest() -> list[dict]:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def save_manifest(items: list[dict]) -> None:
    MANIFEST.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------- 每个 session 可用的工具 ----------

def build_registry() -> ToolRegistry:
    registry = ToolRegistry()

    @tool(registry, description="读取 feature 清单，返回尚未完成的条目")
    def read_manifest() -> str:
        remaining = [x["feature"] for x in load_manifest() if not x["passes"]]
        return json.dumps({"remaining": remaining}, ensure_ascii=False)

    @tool(registry, description="实现一个 feature。test_result 必须是真实测试的结论：pass 才允许标记完成，fail 会被拒绝")
    def implement_feature(feature: str, test_result: str) -> str:
        if test_result != "pass":
            # 测试门禁：未验证就不许翻牌 —— 治「过早宣布完工」
            raise ValueError(f"测试结果为 {test_result!r}，未通过不得标记完成。先修复再跑测试。")
        items = load_manifest()
        for x in items:
            if x["feature"] == feature and not x["passes"]:
                x["passes"] = True
                save_manifest(items)
                return f"{feature} 已标记 passes=true（测试通过）"
        raise ValueError(f"清单里没有未完成的 feature: {feature!r}")

    @tool(registry, description="追加一条进度日志")
    def write_progress(note: str) -> str:
        with PROGRESS.open("a", encoding="utf-8") as f:
            f.write(f"- {note}\n")
        return "progress 已更新"

    return registry


async def run_session(session_id: int, prompt: str, scripts) -> None:
    """一个 session = 一次全新 Agent + 干净上下文，只带清单与进度。"""
    llm = None if live_mode(sys.argv) else _Scripted(scripts)
    agent = Agent(live_llm() if live_mode(sys.argv) else llm,
                  build_registry(),
                  _cfg())
    print(f"\n--- session {session_id} ---")
    result = await agent.run(prompt)
    print(f"  收尾：{result.output}")


def _cfg():
    from app.agent import AgentConfig
    return AgentConfig(
        system_prompt="你负责长任务中的一个 feature：读清单 → 实现 → 跑测试 → 通过才标记 → 写进度。一次只做一个。",
        max_steps=8,
    )


class _Scripted:
    """与 _common.ScriptedLLM 相同，但每个 session 需要独立脚本。"""

    def __init__(self, scripts):
        from _common import ScriptedLLM
        self._inner = ScriptedLLM(scripts)

    def __getattr__(self, item):
        return getattr(self._inner, item)


async def main(live: bool) -> None:
    banner("步骤 6 · 长任务两段式（feature 清单 + 进度文件）")

    # --- initializer session：搭环境、立清单 ---
    initialize(["登录页", "购物车", "订单导出"])
    with PROGRESS.open("a", encoding="utf-8") as f:
        f.write("- initializer：清单建立，3 项全部 passes=false\n")
    print("initializer：manifest.json 已建立（3 项全部 passes=false）")

    if live:
        print("（--live 模式请自行运行三个 session，此处略）")
        return

    # --- session 1：做一个 feature，测试通过 ---
    await run_session(1, "做下一个 feature", [
        use_tool([tool_call("c1", "read_manifest")]),
        use_tool([
            tool_call("c2", "implement_feature", feature="登录页", test_result="pass"),
            tool_call("c3", "write_progress", note="登录页完成，测试通过"),
        ]),
        answer("登录页完成，测试通过，已标记。"),
    ])

    # --- session 2：测试没过，被门禁拒绝 → 修复后重试 ---
    await run_session(2, "做下一个 feature", [
        use_tool([tool_call("c4", "read_manifest")]),
        use_tool([tool_call("c5", "implement_feature", feature="购物车", test_result="fail")]),
        use_tool([
            tool_call("c6", "implement_feature", feature="购物车", test_result="pass"),
            tool_call("c7", "write_progress", note="购物车完成（先失败后修复，测试通过）"),
        ]),
        answer("购物车第一次测试失败被门禁拦下，修复后通过并标记。"),
    ])

    print("\n--- 最终 manifest ---")
    print(MANIFEST.read_text(encoding="utf-8"))
    print("--- progress.md ---")
    print(PROGRESS.read_text(encoding="utf-8"))
    print("要点：")
    print("  · 每个全新 session 只靠 manifest + progress 就能接续 —— context 断了，任务不断")
    print("  · 「测试没过就不许翻牌」在工具层强制（raise ValueError），模型骗不了门禁")
    print("  · 剩余 session 永远从清单顶部取活 —— 治 one-shot 与过早宣布完工")


if __name__ == "__main__":
    asyncio.run(main(live_mode(sys.argv)))
