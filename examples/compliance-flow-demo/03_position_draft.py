"""03 立场分支文稿：事实状态机 + 占位符（模式 M3）。

三条硬规则：
1. 立场决定文稿结构——部分承认必须把承认与争议分开，纯补件
   不得套用承认型结构，纯视频核验出内部准备卡而非对外文稿；
2. 事实待核或来源冲突 → 不生成对外稿，只给内部组稿方案；
3. 未提供/未核实的事实写占位符，占位符未清零不得对外。
"""

from __future__ import annotations

from _common import CONFLICT, PENDING, VERIFIED, Case, Fact, banner, bullet

PLACEHOLDER = "{{待核实"


def fact_gate(facts: list[Fact]) -> str:
    """事实状态机：verified 才放行；conflict 一票暂停。"""
    statuses = {f.status for f in facts}
    if CONFLICT in statuses:
        return "conflict"
    if PENDING in statuses or not facts:
        return "pending"
    return "verified"


def draft(stance: str, facts: list[Fact]) -> dict:
    """按立场生成对应结构。事实未核/冲突 → 不可对外。"""
    gate = fact_gate(facts)
    if gate != "verified":
        return {
            "allowed": False,
            "reason": "来源冲突，暂停对外生成——记录冲突字段与来源后转人工"
            if gate == "conflict"
            else "存在待核事实——只允许内部组稿方案，不生成对外文稿",
            "internal_only": True,
            "body": None,
        }

    if stance == "承认已核实的具体事实":
        body = "【根因】…【整改】…"
    elif stance == "争议具体判定":
        body = "【争议事项】仅呈现争议事实与逐项证据——不出现承认型表述"
    elif stance == "部分承认部分争议":
        # 关键：承认与争议必须分开，混写会把"争议"变成"默认承认"
        body = "【第一部分 · 承认的已核实事实】…\n【第二部分 · 争议的具体判定】…（两部分独立成节）"
    elif stance == "仅补件不陈述实体立场":
        body = "【主体说明】…【文件说明】逐件列明——不出现任何事实定性"
    elif stance == "准备视频核验":
        body = "【内部准备卡】实际处置原因 · 参与人职责 · 可现场展示的原始记录（非对外文稿）"
    else:
        raise ValueError(f"未知立场：{stance}")
    return {"allowed": True, "reason": None, "internal_only": stance == "准备视频核验", "body": body}


def apply_facts(body: str, facts: list[Fact]) -> str:
    """把已核事实填入；未核事实写占位符——绝不自动补全。"""
    for f in facts:
        if f.status == VERIFIED:
            body = body.replace(f"{{{{fact:{f.claim}}}}}", f"{f.claim}（来源：{f.source}）")
        elif f"{{{{fact:{f.claim}}}}}" in body:
            body = body.replace(f"{{{{fact:{f.claim}}}}}", f"{PLACEHOLDER}:{f.claim}}}")
    return body


def has_unresolved_placeholders(body: str) -> bool:
    return PLACEHOLDER in body


def invalidate(changed: bool) -> bool:
    """M3 失效规则：输入一变，已生成草稿即失效。"""
    return changed


def main() -> None:
    banner("03 立场分支文稿：不知道就说不知道（M3）")

    facts_pending = [
        Fact("发票与涉案商品对应关系", status=PENDING),
        Fact("供应商名称与日期", status=VERIFIED, source="发票原件第 1 行"),
    ]
    d1 = draft("部分承认部分争议", facts_pending)
    print("\n状态 A：存在待核事实")
    bullet(f"可生成对外稿：{d1['allowed']}", d1["reason"])
    bullet("允许的", "继续收集整理材料，输出内部组稿方案")

    facts_conflict = [
        Fact("上架日期", status=CONFLICT, source="通知称 3 月，后台导出为 4 月"),
    ]
    d2 = draft("争议具体判定", facts_conflict)
    print("\n状态 B：来源冲突")
    bullet(f"可生成对外稿：{d2['allowed']}", d2["reason"])

    facts_ok = [Fact("供应商名称与日期", status=VERIFIED, source="发票原件第 1 行")]
    d3 = draft("部分承认部分争议", facts_ok)
    print("\n状态 C：全部已核")
    bullet("结构", "承认与争议分节——混写会让'争议'读起来像'默认承认'")
    bullet(d3["body"].splitlines()[0])
    bullet(d3["body"].splitlines()[1])

    filled = apply_facts(d3["body"], facts_ok + [Fact("库存去向", status=PENDING)])
    print("\n占位符演示：")
    bullet(f"未核事实 → {PLACEHOLDER}:库存去向}} —— 保留待人工清零，不自动补")
    bullet(f"占位符未清零：{has_unresolved_placeholders(filled)}", "→ 提交前总检将拦截")
    bullet(f"输入变更后草稿失效：{invalidate(True)}", "通知/材料/附件一变，按当前资料重新生成")


if __name__ == "__main__":
    main()
