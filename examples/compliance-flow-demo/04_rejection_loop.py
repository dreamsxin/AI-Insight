"""04 升级循环：门槛四态 + 独立总检 + append-only 快照（模式 M7、M8）。

M7：检查项四态（阻塞/提醒/不适用/本轮不处理），不适用与不处理
    必须填理由；关键安全门槛不可用例外状态解除；总检独立校验。
M8：同类拒绝计数升级——第 2 次要求记录变化维度，第 3 次停止
    原入口转升级评估；每轮提交 append-only 快照，退回开新轮不覆盖。
"""

from __future__ import annotations

from dataclasses import dataclass, field

from _common import Case, banner, bullet

# 可豁免的检查项白名单——之外的任何项不可标"不适用/本轮不处理"
EXEMPTABLE = {"同类案例检索"}


@dataclass
class CheckItem:
    name: str
    state: str = "pending"          # pending / ok / blocked / warning / na / skipped
    reason: str | None = None       # na / skipped 必填
    critical: bool = False          # 关键门槛：不可豁免


@dataclass
class Round:
    """一轮提交快照：append-only，永不覆盖。"""

    seq: int
    body: str
    review: str = "pending"         # pending / rejected / escalated
    change_note: str | None = None  # M8：第 2 次起必须记录变化维度


def stage_checklist(stage: str) -> list[CheckItem]:
    """阶段化清单：未进入的阶段不显示其检查项（减噪不放宽）。"""
    plan = {
        "initial": ["通知与案型判断"],
        "drafting": ["通知与案型判断", "事实核对", "关键事实（critical）"],
        "submitting": [
            "通知与案型判断", "事实核对", "关键事实（critical）",
            "必需材料齐备（critical）", "同类案例检索",
        ],
    }
    return [CheckItem(n, critical="critical" in n) for n in plan[stage]]


def mark(item: CheckItem, state: str, reason: str | None = None) -> CheckItem:
    """设置四态。不适用/本轮不处理必须填理由；关键门槛不可豁免。"""
    if state in ("na", "skipped"):
        if item.critical or item.name not in EXEMPTABLE:
            raise ValueError(f"「{item.name}」不可豁免（关键门槛或不在可豁免白名单）")
        if not (reason and reason.strip()):
            raise ValueError(f"「{item.name}」标 {state} 必须填写理由")
    item.state = state
    item.reason = reason
    return item


def final_gate(items: list[CheckItem]) -> list[str]:
    """M7 独立总检：不看阶段检查的脸色，独立重校关键门槛。"""
    blockers = []
    for it in items:
        if it.critical and it.state != "ok":
            blockers.append(f"总检拦截：「{it.name}」未通过（当前 {it.state}）——阶段视图的豁免不影响总检")
    return blockers


def submit(case: Case, body: str, review: str = "pending") -> Round:
    """提交即快照。append-only：永远新增，不改旧轮。"""
    r = Round(seq=len(case.rounds) + 1, body=body, review=review)
    case.rounds.append(r)
    return r


def reject(case: Case, round_: Round) -> str | None:
    """记录拒绝并返回升级指令：None=可继续 / record_change / escalate。"""
    round_.review = "rejected"
    same = sum(1 for r in case.rounds if r.review == "rejected")
    if same >= 3:
        return "escalate"
    if same == 2:
        return "record_change"
    return None


def main() -> None:
    from _common import REQUIRED, Attachment, Material

    banner("04 升级循环：四态门槛 + 总检 + append-only 快照（M7/M8）")

    case = Case(
        case_id="C-2026-0042",
        materials=[Material("必需材料 A", origin=REQUIRED,
                            attachments=[Attachment("a.pdf", content_note="…", supports="…")])],
    )

    print("\n四态演示：")
    items = stage_checklist("submitting")
    try:
        mark(items[3], "na", "不适用")
    except ValueError as e:
        bullet(f"关键门槛标『不适用』→ 拒绝：{e}")
    try:
        mark(items[4], "skipped")  # 无理由
    except ValueError as e:
        bullet(f"无理由标『本轮不处理』→ 拒绝：{e}")
    mark(items[4], "skipped", "本轮检索窗口仅站内，先不处理")
    bullet("同类案例检索标『本轮不处理』（有理由）→ 接受，留档可恢复")

    # 把关键项标 ok 但另一关键项漏掉 → 总检独立拦截
    items[2].state = "ok"
    items[3].state = "pending"
    blockers = final_gate(items)
    for b in blockers:
        bullet(b)

    print("\n升级循环演示：")
    r1 = submit(case, "第一轮提交正文")
    bullet(f"第 1 轮被拒 → {reject(case, r1)}", "可原路继续")
    r2 = submit(case, "第二轮提交正文（未记录变化）")
    bullet(f"第 2 轮被拒 → {reject(case, r2)}", "必须记录本轮新增信息/变化维度")
    r2.change_note = "新增：补交对应关系说明"
    r3 = submit(case, "第三轮原样重提")
    bullet(f"第 3 轮被拒 → {reject(case, r3)}", "停止原入口重复提交，转升级评估")

    print(f"\n快照：{len(case.rounds)} 轮全部保留（append-only）")
    for r in case.rounds:
        bullet(f"round {r.seq}: review={r.review}, change={r.change_note or '—'}")


if __name__ == "__main__":
    main()
