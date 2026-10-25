"""步骤 7 · 自进化最小闭环：失败 → 反思 → playbook 追加 → 下次成功。

ACE 式上下文演化（无需训练）：
  轮 1（没有 playbook）：模型踩坑 → 虚假宣布成功 → 任务检查失败
  反思：Reflector 读 trace JSONL，只从**外部信号**提炼一条教训写入 playbook
  轮 2（带上 playbook）：同样的模型「读过手册」→ 先探后改 → 任务检查通过

运行：  python examples/agent-harness-demo/08_self_improve.py [--live]
产物：  playbook.json / trace-r1.jsonl（生成在示例目录，可 git 审计）
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from _common import answer, banner, live_llm, live_mode, tool_call, use_tool
from app.agent import (
    Agent,
    AgentConfig,
    Message,
    Playbook,
    ToolRegistry,
    reflect_into_playbook,
    tool,
)

HERE = Path(__file__).resolve().parent
PB_PATH = HERE / "playbook.json"
TRACE_R1 = HERE / "trace-r1.jsonl"

# 任务状态（检查「是否真的改成了」）
CONFIG = {"port": 8000}


def build_registry() -> ToolRegistry:
    registry = ToolRegistry()

    @tool(registry, description="探测实际的配置文件名")
    def probe_config() -> str:
        return "实际配置文件是 config.yml（不是 config.json）"

    @tool(registry, description="修改配置文件中的端口")
    def apply_config(filename: str, port: int) -> str:
        if filename != "config.yml":
            # 外部信号：就是这条错误会被 Reflector 提炼成教训
            raise ValueError(f"{filename} 不存在；请先用 probe_config 查明实际文件名")
        CONFIG["port"] = port
        return f"端口已更新为 {port}"

    return registry


class TeachableLLM:
    """可教的模型：system 里有 playbook 就按『先探后改』行事，否则踩坑。

    离线演示用——真实场景中「读过手册就会做」由模型本身完成。
    """

    def __init__(self) -> None:
        self.calls = 0

    async def chat(self, messages, *, tools=None, temperature=0.7, extra=None):
        self.calls += 1
        has_playbook = any(
            "[Playbook" in (m.content or "") for m in messages if m.role.value == "system"
        )
        if has_playbook:
            return _smart(self.calls)
        return _naive(self.calls)


def _naive(n: int):
    """没读过手册：直接改 → 报错 → 再改 → 又错 → 虚假宣布成功。"""
    from _common import answer, use_tool

    seq = {
        1: use_tool([tool_call("c1", "apply_config", filename="config.json", port=8100)]),
        2: use_tool([tool_call("c2", "apply_config", filename="config.json", port=8100)]),
    }
    if n in seq:
        return seq[n]
    return answer("已把端口改为 8100。")  # ⚠ 实际没改成 —— 过早宣布完工


def _smart(n: int):
    """读过手册：先探，再改，确认。"""
    from _common import answer, tool_call, use_tool

    seq = {
        1: use_tool([tool_call("c3", "probe_config")]),
        2: use_tool([tool_call("c4", "apply_config", filename="config.yml", port=8100)]),
    }
    if n in seq:
        return seq[n]
    return answer("端口已改为 8100（先 probe 查得 config.yml）。")


async def run_round(name: str, playbook_used: bool, trace: Path | None = None) -> bool:
    CONFIG["port"] = 8000
    registry = build_registry()
    cfg = AgentConfig(
        system_prompt="你负责修改配置端口。任务：把端口改为 8100。",
        max_steps=8,
        playbook_path=str(PB_PATH) if playbook_used else None,
        trace_path=str(trace) if trace else None,
    )
    llm = live_llm() if live_mode(sys.argv) else TeachableLLM()
    agent = Agent(llm, registry, cfg)
    result = await agent.run("把配置端口改为 8100")
    ok = CONFIG["port"] == 8100
    print(f"  {name}：模型回答「{result.output}」")
    print(f"  任务检查：{'✓ 端口真的改成了' if ok else '✗ 端口没改成（虚假完工）'}")
    return ok


async def main(live: bool) -> None:
    banner("步骤 7 · 自进化最小闭环（失败 → 反思 → playbook → 成功）")
    PB_PATH.unlink(missing_ok=True)

    # --- 轮 1：没有 playbook ------------------------------------------------
    print("\n轮 1 · 没有 playbook：")
    ok1 = await run_round("轮 1", playbook_used=False, trace=TRACE_R1)

    # --- 反思：Reflector 读 trace，只从外部信号提炼 -------------------------
    if live:
        reflect_llm = live_llm()
    else:
        from _common import ScriptedLLM

        lesson = json.dumps([
            {
                "kind": "坑",
                "text": "改配置前必须先用 probe_config 查明实际文件名，不要猜 config.json",
                "signal": "tool ERROR: config.json 不存在；请先用 probe_config 查明实际文件名",
            }
        ], ensure_ascii=False)
        reflect_llm = ScriptedLLM([answer(lesson)])

    pb = Playbook.load(PB_PATH)
    created = await reflect_into_playbook(pb, TRACE_R1, reflect_llm)
    pb.save(PB_PATH)
    print("\n反思：从 trace-r1.jsonl 提炼出", len(created), "条新经验 →")
    for e in created:
        print(f"  + [{e.kind}] {e.text}（来源：{e.source}）")

    # --- 轮 2：带上 playbook -------------------------------------------------
    print("\n轮 2 · 带上 playbook：")
    ok2 = await run_round("轮 2", playbook_used=True)

    print("\n--- playbook.json（可 git 审计的演化历史）---")
    print(PB_PATH.read_text(encoding="utf-8"))
    print(f"结论：轮 1 {'成功' if ok1 else '失败'} → 反思沉淀 → 轮 2 {'成功' if ok2 else '失败'}")
    print("这就是「越用越好」的最小闭环 —— 全程没有改模型的一根权重。")


if __name__ == "__main__":
    asyncio.run(main(live_mode(sys.argv)))
