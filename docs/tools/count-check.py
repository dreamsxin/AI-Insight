# -*- coding: utf-8 -*-
"""内容库计数一致性校验（只读，从不写文件）。

用法：
    python docs/tools/count-check.py --check

背景：``docs/index.html`` 的卡片是集数与阅读顺序的唯一权威源，但仓库里
还存在「第二套手工数字」——搜索框计数、知识地图分层计数、README 系列表、
anim-demos 的 triage、meta description。它们过去靠手工同步，已多次漂移。
本脚本把这些数字全部拿权威源复算一遍，供 CI 守护。

校验项：
  1. 卡片 ↔ 磁盘 ``*-animation.html`` 双向零差集
  2. 搜索框 ``#qn`` 显示数 == 卡片数
  3. 知识地图 4 个 ``layer-n`` == 按系列归属复算的 L4/L3/L2/L1
  4. README 系列表期数之和 == 卡片数
  5. anim-demos triage 的 ✓/◐/— 之和 == 卡片数，且 ✓ == 脚本数
  6. 已完结系列不残留「续更」措辞
  7. meta description 不含会漂移的集数 / 编号区间

新增系列时，除了改 index.html，还要在 ``LAYER_BY_SERIES`` 里登记其分层。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DOCS = ROOT / "docs"
INDEX = DOCS / "index.html"
README = ROOT / "README.md"
TRIAGE = ROOT / "examples" / "anim-demos" / "README.md"
DEMOS = ROOT / "examples" / "anim-demos"

CARD_RE = re.compile(r'<a class="card" href="([^"]+\.html)"')
SERIES_RE = re.compile(r'<div class="series">(.*?)(?=<div class="series">|\Z)', re.S)
HEAD_RE = re.compile(r'<div class="series-head"><b>(.*?)</b>')
QN_RE = re.compile(r'<span class="finder-n" id="qn">(\d+)\s*集</span>')
LAYER_RE = re.compile(r'<div class="layer-n">(\d+)\s*集</div>')
META_RE = re.compile(r'<meta name="description" content="([^"]*)"')
README_ROW_RE = re.compile(r"^\|[^|]+\|\s*(\d+)\s*\|", re.M)
TRIAGE_ROW_RE = re.compile(r"^\|\s*([✓◐—])\s*\|\s*`", re.M)

# 系列标题 -> 知识地图分层。标题必须与 index.html 的 series-head 完全一致。
LAYER_BY_SERIES = {
    "训练原理 · 模型怎么来的": "L1",
    "AI 运作原理拆解": "L2",
    "AI 运作原理 · 深入篇": "L2",
    "LLM 模型算法原理": "L2",
    "推理原理": "L3",
    "推理原理 · 第二季": "L3",
    "推理原理 · 第三季": "L3",
    "HERMES AGENT 对象拆解": "L4",
    "HERMES AGENT 进阶机制": "L4",
    "AGENT 开发避坑指南": "L4",
    "AGENT 实战工坊 · 知识问答": "L4",
    "AGENT 模式进阶": "L4",
}

STALE_PHRASES = ("其余按批续更", "已上线 7 集")


def main() -> int:
    problems: list[str] = []
    html = INDEX.read_text(encoding="utf-8")
    cards = CARD_RE.findall(html)
    n = len(cards)
    if not n:
        print("! index.html 未解析到任何卡片")
        return 1

    # 1. 卡片 ↔ 磁盘
    disk = {p.name for p in DOCS.glob("*-animation.html")}
    missing = sorted(set(cards) - disk)
    orphan = sorted(disk - set(cards))
    if missing:
        problems.append(f"索引引用了不存在的文件：{missing}")
    if orphan:
        problems.append(f"磁盘有未被索引引用的动画页：{orphan}")
    if len(set(cards)) != n:
        problems.append("索引中存在重复卡片")

    # 2. 搜索框计数
    qn = QN_RE.search(html)
    if not qn or int(qn.group(1)) != n:
        problems.append(f"搜索框 #qn 显示 {qn.group(1) if qn else '缺失'}，应为 {n} 集")

    # 3. 知识地图分层计数
    counts = {"L1": 0, "L2": 0, "L3": 0, "L4": 0}
    seen: list[str] = []
    for segment in SERIES_RE.findall(html):
        head = HEAD_RE.search(segment)
        if not head:
            continue
        title = head.group(1)
        layer = LAYER_BY_SERIES.get(title)
        if layer is None:
            problems.append(f"未知系列（请在 LAYER_BY_SERIES 登记分层）：{title}")
            continue
        seen.append(title)
        counts[layer] += len(CARD_RE.findall(segment))
    expected = [counts["L4"], counts["L3"], counts["L2"], counts["L1"]]
    shown = [int(x) for x in LAYER_RE.findall(html)]
    if shown != expected:
        problems.append(f"知识地图分层计数 {shown} != {expected}（顺序 L4/L3/L2/L1）")
    if sum(expected) != n:
        problems.append(f"分层合计 {sum(expected)} != 卡片数 {n}")

    # 4. README 系列表
    rows = [int(x) for x in README_ROW_RE.findall(README.read_text(encoding="utf-8"))]
    if sum(rows) != n:
        problems.append(f"README 系列表期数合计 {sum(rows)}（{len(rows)} 行）!= {n}")

    # 5. triage 与脚本
    marks = TRIAGE_ROW_RE.findall(TRIAGE.read_text(encoding="utf-8"))
    scripts = [p for p in DEMOS.glob("*.py") if not p.name.startswith("_")]
    if len(marks) != n:
        problems.append(f"anim-demos triage 共 {len(marks)} 条 != {n}")
    if marks.count("✓") != len(scripts):
        problems.append(f"triage ✓ {marks.count('✓')} 个 != 磁盘脚本 {len(scripts)} 个")

    # 6. 过期的连载措辞
    for phrase in STALE_PHRASES:
        if phrase in html:
            problems.append(f"index.html 仍含过期的连载措辞：{phrase!r}")

    # 7. meta 不含硬编码数字
    meta = META_RE.search(html)
    if meta and re.search(r"\d+\s*集|\d{2}-\d{2}", meta.group(1)):
        problems.append("meta description 含会漂移的集数/编号，请改成定性描述")

    if problems:
        print(f"不一致（{len(problems)} 项）；权威源 = docs/index.html 的 {n} 张卡片")
        for p in problems:
            print(f"  ! {p}")
        return 1
    print(
        f"同步：{n} 集 / {len(seen)} 系列 / 分层 L4-L1={expected} / "
        f"triage ✓{marks.count('✓')} ◐{marks.count('◐')} —{marks.count('—')} / "
        f"0 孤儿 · 0 悬空"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
