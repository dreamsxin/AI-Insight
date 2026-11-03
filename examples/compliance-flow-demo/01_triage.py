"""01 分流：规则候选 + 正交维度（模式 M1、M2）。

两条演示线：
1. 分流只给"带依据的候选"，证据不足建"待识别"并追问，不硬猜；
2. 四个维度字段互相正交、可组合——对比互斥路线塞不下组合态。
"""

from __future__ import annotations

from _common import Case, banner, bullet

# 规则表：线索关键词 → 案型候选与依据说明（示意场景，非任何真实平台规则）
RULES = {
    "账号关联": ["关联", "陌生账号", "共同因素", "登录记录"],
    "商品真实性": ["真实性", "采购发票", "授权链", "正品"],
    "履约绩效": ["迟发", "取消率", "妥投", "ODR"],
}

NEEDED_FACTS = {
    "账号关联": ["关系类型", "共同因素", "操作时间线"],
    "商品真实性": ["通知原文", "采购/授权链", "商品范围"],
    "履约绩效": ["统计窗口", "订单清单", "履约方式"],
}


def classify(text: str) -> dict:
    """按线索关键词给出候选。命中不足 → 待识别 + 追问，绝不硬猜。"""
    hits: dict[str, list[str]] = {}
    for topic, words in RULES.items():
        found = [w for w in words if w in text]
        if found:
            hits[topic] = found

    if not hits:
        return {
            "resolved": False,
            "candidate": "待识别案件",
            "ask": "请粘贴最新通知原文，或描述遇到的问题——线索不足时不确认处理维度。",
            "evidence": [],
        }
    # 多个候选并列时同样不硬猜，全部列出由用户确认
    best = max(hits, key=lambda k: len(hits[k]))
    return {
        "resolved": len(hits) == 1,
        "candidate": best,
        "evidence": hits[best],
        "also": [k for k in hits if k != best] or None,
        "ask": f"需要补充：{'、'.join(NEEDED_FACTS[best])}",
    }


def collect_dimensions(topic: list[str], stage: str, stance: str, channels: list[str]) -> Case:
    """四个正交字段独立设置——组合态无需任何特殊分支。"""
    return Case(
        case_id="C-2026-0042",
        topic_types=topic,
        stage=stage,
        stance=stance,
        channels=channels,
    )


def main() -> None:
    banner("01 分流：候选带依据，不足不硬猜（M1/M2）")

    r1 = classify("通知说我的店铺和另一个陌生账号关联，附了登录记录")
    print(f"\n输入 A：账号关联类描述")
    bullet(f"候选：{r1['candidate']}（唯一，置信可确认）", "、".join(r1["evidence"]))
    bullet("追问", r1["ask"])

    r2 = classify("系统提示迟发率超标，订单显示部分妥投异常，还有采购发票要交")
    print(f"\n输入 B：混合描述（履约 + 真实性线索同时命中）")
    bullet(f"最高候选：{r2['candidate']}", "、".join(r2["evidence"]))
    bullet("并列候选（同样列出，不替用户取舍）", "、".join(r2["also"] or []))
    bullet("追问", r2["ask"])

    r3 = classify("反正就是有点问题，你们看着办")
    print(f"\n输入 C：无可用线索")
    bullet(f"结果：{r3['candidate']} —— 不确认案型，不预选路线")
    bullet("追问", r3["ask"])

    print(f"\n正交维度演示：一条组合态")
    case = collect_dimensions(
        topic=["账号关联", "商品真实性"],   # 问题类型可多选
        stage="rejected_review",           # 被拒后复盘
        stance="部分承认部分争议",          # 立场独立于类型
        channels=["后台文本回复", "文件附件"],  # 提交形式可多选
    )
    bullet(f"维度组合：{case.topic_types} × {case.stage} × {case.stance} × {case.channels}")
    bullet("若用互斥路线（A/B/C/D 四选一）", "这个组合态无处安放——只能丢信息或乱塞")
    bullet("正交字段", "四个格子各放各的，组合无需特殊分支")


if __name__ == "__main__":
    main()
