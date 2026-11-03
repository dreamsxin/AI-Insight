"""02 证据闸门：五环链 + 必需/建议两种待遇（模式 M4、M5）。

证据链五环：主张 → 材料 → 材料中可核内容 → 来源 → 支持范围。
断在任何一环都不构成证据。必需材料缺链即阻塞；建议材料
未纳入只提示风险。必需项不可用"本轮不处理"豁免。
"""

from __future__ import annotations

from dataclasses import dataclass

from _common import REQUIRED, SUGGESTED, Case, Material, banner, bullet

CHAIN_STEPS = ("材料", "可核内容", "来源", "支持范围")


@dataclass
class Gap:
    """一条链的缺口：环名 + 缺什么。"""

    step: str
    missing: str


def chain_gaps(material: Material, claim: str, source: str | None) -> list[Gap]:
    """逐环检查一条 主张→材料 的证据链。"""
    gaps: list[Gap] = []
    if not material.attachments:
        gaps.append(Gap("材料", "未附文件——只有清单没有文件"))
        return gaps  # 后面的环无从谈起
    for i, att in enumerate(material.attachments, 1):
        tag = f"附件{i}({att.filename})" if len(material.attachments) > 1 else att.filename
        if not att.content_note.strip():
            gaps.append(Gap("可核内容", f"{tag} 未填写材料内容说明"))
        if not att.supports.strip():
            gaps.append(Gap("支持范围", f"{tag} 未写明支持的事实/论点"))
    if not source:
        gaps.append(Gap("来源", "来源位置未记录——无法回查"))
    if not claim.strip():
        gaps.append(Gap("主张", "链的起点是空的"))
    return gaps


@dataclass
class GateReport:
    blocked: list[str]   # 阻塞：不满足则不得生成对外提交包
    risks: list[str]     # 提醒：存在风险，人工判断，不阻塞

    @property
    def passable(self) -> bool:
        return not self.blocked


def gate(case: Case) -> GateReport:
    """提交前材料闸门（M4+M5）。必需项拦截，建议项提示。"""
    blocked: list[str] = []
    risks: list[str] = []

    for m in case.materials:
        if m.origin == REQUIRED and m.skipped:
            # M5：必需项不可用"本轮不处理"豁免——即使历史上有过记录
            blocked.append(f"必需材料「{m.name}」被标记不处理——必需项不可豁免")
            continue
        if m.skipped:
            risks.append(f"建议材料「{m.name}」本轮不处理（{m.skip_reason}）——仅显示风险")
            continue
        claim = m.attachments[0].supports if m.attachments else ""
        source = m.excerpt if m.origin == REQUIRED else None
        gaps = chain_gaps(m, claim, source)
        for g in gaps:
            label = f"「{m.name}」{g.step}：{g.missing}"
            (blocked if m.origin == REQUIRED or g.step in ("可核内容", "支持范围") else risks).append(label)
        if m.origin == REQUIRED and not m.excerpt:
            blocked.append(f"必需材料「{m.name}」无原文摘录——关键词命中不算依据")

    return GateReport(blocked=blocked, risks=risks)


def main() -> None:
    from _common import Attachment, Fact

    banner("02 证据闸门：只有文件名不算证据（M4/M5）")

    case = Case(
        case_id="C-2026-0042",
        materials=[
            Material(
                name="商品对应关系证明",
                origin=REQUIRED,
                excerpt="通知原文摘录：请提供商品来源证明文件（见通知第 3 段）",
                attachments=[
                    Attachment("invoice.pdf"),  # 双字段全空 → 缺链
                ],
            ),
            Material(
                name="供应商营业执照",
                origin=SUGGESTED,
                skipped=True,
                skip_reason="通知未点名；本轮先核对应关系",
            ),
        ],
        facts=[Fact("发票与涉案商品对应关系待核")],
    )

    report = gate(case)
    print("\n闸门结果：")
    bullet(f"附件 invoice.pdf 双字段全空", "→ 材料、可核内容、支持范围三环缺口")
    for b in report.blocked:
        bullet(f"[阻塞] {b}")
    for r in report.risks:
        bullet(f"[提醒] {r}")
    bullet(f"可生成对外提交包：{report.passable}")

    print("\n补全后重跑：")
    case.materials[0].attachments[0] = Attachment(
        "invoice.pdf",
        content_note="采购发票一张：含供应商名称、日期、商品明细",
        supports="支持主张：涉案商品有可回查的采购来源（覆盖数量与日期范围）",
    )
    report2 = gate(case)
    for b in report2.blocked:
        bullet(f"[阻塞] {b}")
    for r in report2.risks:
        bullet(f"[提醒] {r}")
    bullet(f"可生成对外提交包：{report2.passable}", "必需链补全；建议材料不处理只留提醒")


if __name__ == "__main__":
    main()
