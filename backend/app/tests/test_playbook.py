"""Playbook（自进化闭环）测试：delta 去重 / source 红线 / 渲染限长 / 注入 / Reflector。"""

from __future__ import annotations

import json

import pytest

from app.agent import (
    Agent,
    AgentConfig,
    Message,
    Playbook,
    ScriptedLLM,
    ToolRegistry,
    ValidationError,
    reflect_into_playbook,
    tool,
)
from app.agent.testing import answer, tool_call, use_tool


def scripted(scripts):
    return ScriptedLLM(scripts)


def build_registry():
    registry = ToolRegistry()

    @tool(registry, description="两数相加")
    def add(a: int, b: int) -> int:
        return a + b

    return registry


# ---------- Curator：delta 追加与去重 ----------


def test_add_delta_requires_source():
    pb = Playbook()
    with pytest.raises(ValidationError):
        pb.add_delta("坑", "先探后改", source="")
    with pytest.raises(ValidationError):
        pb.add_delta("坑", "先探后改", source="   ")
    assert len(pb.entries) == 0


def test_add_delta_rejects_bad_kind():
    pb = Playbook()
    with pytest.raises(ValidationError):
        pb.add_delta("感想", "今天天气不错", source="trace:x")


def test_add_delta_dedups_normalized_text():
    pb = Playbook()
    e1, created1 = pb.add_delta("坑", "调用 apply 前必须先用 probe 查明文件名", source="trace:a")
    e2, created2 = pb.add_delta("坑", "调用 apply 前必须先用 probe 查明文件名", source="trace:b")
    assert created1 and not created2
    assert e1 is e2 and e1.hits == 1 and len(pb.entries) == 1  # hits=重复出现次数


def test_add_delta_rejects_empty_text():
    pb = Playbook()
    with pytest.raises(ValidationError):
        pb.add_delta("教训", "  ", source="trace:a")


# ---------- 渲染限长 ----------


def test_render_respects_char_budget():
    pb = Playbook()
    for i in range(30):
        pb.add_delta("教训", f"经验条目第 {i:02d} 号，内容足够长以撑爆预算" * 2, source=f"trace:{i}")
    rendered = pb.render(max_chars=600)
    assert rendered.startswith("[Playbook")
    assert len(rendered) <= 800  # 2000 预算没用满就被最新优先截断
    assert "29" in rendered  # 最新的条目保留
    assert rendered.count("- [") <= 30


def test_render_empty_playbook_returns_empty():
    assert Playbook().render() == ""


# ---------- 持久化 ----------


def test_save_load_round_trip(tmp_path):
    pb = Playbook()
    pb.add_delta("坑", "先探后改", source="trace:a")
    pb.add_delta("模式", "测试通过才翻牌", source="trace:b")
    path = tmp_path / "playbook.json"
    pb.save(path)
    loaded = Playbook.load(path)
    assert [e.text for e in loaded.entries] == ["先探后改", "测试通过才翻牌"]
    assert loaded.entries[0].source == "trace:a"


def test_load_missing_returns_empty(tmp_path):
    assert len(Playbook.load(tmp_path / "nope.json").entries) == 0


# ---------- Agent 注入 ----------


@pytest.mark.asyncio
async def test_playbook_injected_into_system_message(tmp_path):
    pb = Playbook()
    pb.add_delta("坑", "先探后改", source="trace:a")
    path = tmp_path / "playbook.json"
    pb.save(path)

    llm = ScriptedLLM([answer("ok")])
    agent = Agent(llm, build_registry(), AgentConfig(system_prompt="S", playbook_path=str(path)))
    await agent.run("hi")

    first = llm.calls[0][0]
    assert first.role.value == "system"
    assert first.content.startswith("S")
    assert "[Playbook" in first.content and "先探后改" in first.content


@pytest.mark.asyncio
async def test_no_playbook_no_injection(tmp_path):
    llm = ScriptedLLM([answer("ok")])
    agent = Agent(llm, build_registry(), AgentConfig(system_prompt="S"))
    await agent.run("hi")
    assert llm.calls[0][0].content == "S"


@pytest.mark.asyncio
async def test_missing_playbook_file_is_silent(tmp_path):
    llm = ScriptedLLM([answer("ok")])
    agent = Agent(
        llm, build_registry(),
        AgentConfig(system_prompt="S", playbook_path=str(tmp_path / "nope.json")),
    )
    result = await agent.run("hi")
    assert result.output == "ok"


# ---------- Reflector ----------


@pytest.mark.asyncio
async def test_reflector_extracts_lessons_from_trace(tmp_path):
    # 先造一份带外部信号的轨迹
    trace = tmp_path / "trace.jsonl"
    llm = scripted([
        use_tool([tool_call("c1", "apply_config", filename="config.json", port=8100)]),
        answer("改好了"),
    ])
    agent = Agent(llm, build_registry(), AgentConfig(system_prompt="S", trace_path=str(trace)))
    await agent.run("改配置")

    # 反思模型：输出结构化 delta（引用轨迹中的错误信号）
    reflect_llm = scripted([answer(json.dumps([
        {"kind": "坑",
         "text": "调用 apply_config 前必须先用 probe_config 查明实际文件名",
         "signal": "tool ERROR: config.json 不存在"},
    ], ensure_ascii=False))])

    pb = Playbook()
    created = await reflect_into_playbook(pb, trace, reflect_llm)
    assert len(created) == 1
    assert created[0].text.startswith("调用 apply_config")
    assert "trace.jsonl" in created[0].source


@pytest.mark.asyncio
async def test_reflector_drops_entries_without_signal(tmp_path):
    trace = tmp_path / "trace.jsonl"
    trace.write_text('{"event": "finished", "output": "ok"}\n', encoding="utf-8")
    reflect_llm = scripted([answer(json.dumps([
        {"kind": "教训", "text": "无证据的内省条目", "signal": ""},
        {"kind": "教训", "text": "另一条也没有证据"},
    ], ensure_ascii=False))])
    pb = Playbook()
    created = await reflect_into_playbook(pb, trace, reflect_llm)
    assert created == [] and len(pb.entries) == 0


@pytest.mark.asyncio
async def test_reflector_survives_non_json_response(tmp_path):
    trace = tmp_path / "trace.jsonl"
    trace.write_text('{"event": "finished"}\n', encoding="utf-8")
    reflect_llm = scripted([answer("我觉得这次运行挺好的。")])
    pb = Playbook()
    created = await reflect_into_playbook(pb, trace, reflect_llm)
    assert created == []


def build_registry():
    registry = ToolRegistry()

    @tool(registry, description="探测实际的配置文件名")
    def probe_config() -> str:
        return "实际配置文件是 config.yml"

    @tool(registry, description="修改配置文件中的端口")
    def apply_config(filename: str, port: int) -> str:
        if filename != "config.yml":
            raise ValueError(f"{filename} 不存在；请先用 probe_config 查明实际文件名")
        return f"端口已更新为 {port}"

    return registry
