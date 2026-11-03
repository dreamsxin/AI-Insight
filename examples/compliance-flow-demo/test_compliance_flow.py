"""compliance-flow-demo 的规则测试：每个脚本的核心模式 ≥2 条断言。

从 backend 目录运行 `pytest` 即可收集（pytest.ini testpaths 已包含本目录）。
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from _common import (  # noqa: E402
    CONFLICT,
    PENDING,
    REQUIRED,
    SUGGESTED,
    Attachment,
    Case,
    Fact,
    Material,
)
from importlib import import_module  # noqa: E402

triage = import_module("01_triage")
gate_mod = import_module("02_evidence_gate")
draft_mod = import_module("03_position_draft")
loop_mod = import_module("04_rejection_loop")


# ---------------- 01 分流（M1/M2） ----------------

def test_triage_insufficient_evidence_does_not_guess():
    r = triage.classify("反正就是有点问题")
    assert r["resolved"] is False
    assert r["candidate"] == "待识别案件"
    assert "请粘贴" in r["ask"]


def test_triage_mixed_hits_lists_all_candidates():
    r = triage.classify("迟发率超标，还要交采购发票")
    assert r["resolved"] is False          # 两个候选并列 → 不硬猜
    assert r["also"], "并列候选应全部列出"
    assert r["candidate"] in triage.RULES


def test_triage_unique_hit_resolves():
    r = triage.classify("和另一个陌生账号关联，附了登录记录")
    assert r["resolved"] is True
    assert r["candidate"] == "账号关联"
    assert "操作时间线" in r["ask"]


def test_dimensions_are_orthogonal():
    case = triage.collect_dimensions(
        topic=["账号关联", "商品真实性"], stage="rejected_review",
        stance="部分承认部分争议", channels=["后台文本回复", "文件附件"],
    )
    assert len(case.topic_types) == 2      # 可多选
    assert len(case.channels) == 2         # 可多选
    assert case.stance != case.stage       # 四字段互相独立


# ---------------- 02 证据闸门（M4/M5） ----------------

def _case_with_empty_attachment() -> Case:
    m = Material("商品对应关系证明", origin=REQUIRED, excerpt="通知摘录：请提供来源证明",
                 attachments=[Attachment("invoice.pdf")])
    return Case(case_id="C-1", materials=[m])


def test_empty_attachment_fields_block():
    report = gate_mod.gate(_case_with_empty_attachment())
    assert not report.passable
    steps = {g.split("」")[-1].split("：")[0] for g in report.blocked}
    assert "可核内容" in steps and "支持范围" in steps   # 五环缺口被逐环点名


def test_filled_chain_passes_and_suggested_skip_only_warns():
    case = _case_with_empty_attachment()
    case.materials[0].attachments[0] = Attachment(
        "invoice.pdf", content_note="含供应商名称与日期", supports="支持：商品有可回查来源")
    case.materials.append(Material("营业执照", origin=SUGGESTED, skipped=True,
                                   skip_reason="通知未点名"))
    report = gate_mod.gate(case)
    assert report.passable                                  # 必需链补全 → 放行
    assert report.risks and "本轮不处理" in report.risks[0]  # 建议项跳过只提醒


def test_required_material_cannot_be_skipped():
    case = _case_with_empty_attachment()
    case.materials[0].skipped = True
    case.materials[0].skip_reason = "先不交了"
    report = gate_mod.gate(case)
    assert not report.passable                              # 必需项不可豁免
    assert any("不可豁免" in b for b in report.blocked)


def test_required_without_excerpt_blocks():
    m = Material("证明", origin=REQUIRED, excerpt=None,
                 attachments=[Attachment("a.pdf", content_note="x", supports="y")])
    report = gate_mod.gate(Case(case_id="C-2", materials=[m]))
    assert any("原文摘录" in b for b in report.blocked)


# ---------------- 03 立场分支文稿（M3） ----------------

def test_pending_and_conflict_facts_block_external_draft():
    d1 = draft_mod.draft("争议具体判定", [Fact("X", status=PENDING)])
    assert d1["allowed"] is False and d1["internal_only"]
    d2 = draft_mod.draft("争议具体判定", [Fact("X", status=CONFLICT, source="冲突")])
    assert d2["allowed"] is False and "冲突" in d2["reason"]


def test_partial_stance_splits_sections():
    facts = [Fact("供应商名称", status="verified", source="发票")]
    d = draft_mod.draft("部分承认部分争议", facts)
    assert d["allowed"] and "第一部分" in d["body"] and "第二部分" in d["body"]


def test_video_stance_produces_prep_card_not_letter():
    facts = [Fact("X", status="verified", source="S")]
    d = draft_mod.draft("准备视频核验", facts)
    assert d["allowed"] and d["internal_only"] and "准备卡" in d["body"]


def test_unverified_fact_becomes_placeholder_not_invention():
    body = draft_mod.apply_facts(
        "…{{fact:供应商名称}}…{{fact:库存去向}}…",
        [Fact("库存去向", status=PENDING), Fact("供应商名称", status="verified", source="发票")],
    )
    assert draft_mod.has_unresolved_placeholders(body)
    assert "来源：发票" in body                              # 已核事实照常填入
    assert "待核实:库存去向" in body                         # 未核事实保留占位


# ---------------- 04 升级循环（M7/M8） ----------------

def _items():
    return loop_mod.stage_checklist("submitting")


def test_critical_item_cannot_be_exempted():
    items = _items()
    critical = next(i for i in items if i.critical)
    try:
        loop_mod.mark(critical, "na", "不适用")
        raised = False
    except ValueError:
        raised = True
    assert raised, "关键门槛不可豁免"


def test_exempt_needs_reason():
    items = _items()
    exemptable = next(i for i in items if not i.critical and i.name in loop_mod.EXEMPTABLE)
    try:
        loop_mod.mark(exemptable, "skipped")
        raised = False
    except ValueError:
        raised = True
    assert raised
    loop_mod.mark(exemptable, "skipped", "本轮检索窗口有限")  # 有理由则接受


def test_final_gate_independent_of_stage_view():
    items = _items()
    for i in items:
        if i.name == "同类案例检索":
            loop_mod.mark(i, "skipped", "本轮先不处理")
        elif i.critical:
            i.state = "pending"          # 关键项未过
    blockers = loop_mod.final_gate(items)
    assert blockers, "阶段视图放过 ≠ 总检放过"


def test_rejection_escalation_ladder():
    case = Case(case_id="C-3")
    ops = [loop_mod.reject(case, loop_mod.submit(case, f"r{i}")) for i in range(1, 4)]
    assert ops == [None, "record_change", "escalate"]


def test_rounds_are_append_only():
    case = Case(case_id="C-4")
    loop_mod.submit(case, "r1")
    loop_mod.submit(case, "r2")
    assert [r.seq for r in case.rounds] == [1, 2]
    assert case.rounds[0].body == "r1"                   # 新轮不覆盖旧轮
