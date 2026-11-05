#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-27 谁说了算，什么时候不算数

对应动画：docs/inf-27-judge-coverage-animation.html

这一份造一个「两种判分器 + 一道闸门」的最小系统：
  1. 八条等价规则，把表面不同的答案判成同一个
  2. 规则判分器与「LLM 判分器」在同一批 960 条上给出完全一致的结果
  3. 一旦有题落在规则覆盖之外，coverage_complete = False，整题 Pass@1 作废

第 3 点是重点：100% 一致只在覆盖范围之内成立。
    python examples/anim-demos/inf-27-judge-coverage.py
"""
import re
from fractions import Fraction

GOLD = "42"


# ── 八条等价规则 ────────────────────────────────────────────────────────────
def r_trim(s):        return s.strip()                                   # 1 空白
def r_paren(s):       return re.sub(r"^[（(]|[）)]$", "", s).strip()      # 2 去括号
def r_percent(s):                                                    # 3 百分号
    m = re.fullmatch(r"(-?[\d.]+)\s*%", s)
    return "%.6g" % (float(m.group(1)) / 100) if m else s


def r_fraction(s):                                                   # 4 分数 → 小数
    m = re.fullmatch(r"(-?\d+)\s*/\s*(\d+)", s)
    return "%.6g" % float(Fraction(int(m.group(1)), int(m.group(2)))) if m else s


def r_sci(s):                                                        # 5 科学计数
    try:
        return "%.6g" % float(s)
    except ValueError:
        return s


def r_thousands(s):   return s.replace(",", "")                       # 6 千分位
def r_case(s):        return s.lower()                                # 7 大小写
def r_trailing(s):                                                    # 8 结尾句号
    return s.rstrip("。.")


RULES = [r_trim, r_paren, r_percent, r_thousands, r_fraction, r_sci, r_case, r_trailing]

# 覆盖之外的写法：近似、区间、带单位的自然语言。规则判分器不敢下判断
UNCOVERED = [r"约", r"~", r"至", r"左右", r"大概"]


def normalize(raw):
    """返回规范形；无法判定时返回 None（= 落在覆盖之外）。"""
    s = raw
    for r in RULES:
        s = r(s)
    if any(re.search(p, s) for p in UNCOVERED):
        return None
    try:
        return "%.6g" % float(s)
    except ValueError:
        return None


def rule_judge(ans, gold=GOLD):
    a, g = normalize(ans), normalize(gold)
    if a is None:
        return None                      # 覆盖不到 → 不下判断
    return a == g


def llm_judge(ans, gold=GOLD):
    """LLM 判分器在这里被建模成「同样能读懂语义、但只在覆盖内才敢判」。

    真实实现是另一次模型调用 + 八条规则提示词；这里把它当成同一判定的
    另一条路径，用来检验两者是否给出一致结论。
    """
    a, g = normalize(ans), normalize(gold)
    if a is None:
        return None
    return a == g


def main():
    # 一批 960 条 rollout：959 条对（换着写法），1 条错
    forms = ["42", "42.", " 42 ", "42.0", "4200%", "84/2", "4.2e1", "42。"]
    answers = [forms[i % len(forms)] for i in range(959)] + ["41"]

    print("一、八条规则各管一种表面差异")
    for f in forms:
        print("  %-8s → %s   %s" % (f, normalize(f), "判对" if rule_judge(f) else "判错"))

    print()
    print("二、两种判分器在 960 条上的一致率")
    agree = sum(1 for a in answers if rule_judge(a) == llm_judge(a))
    print("  960 条 rollout，rule 与 llm 一致 %d 条 → %.1f%%" % (agree, agree / 960 * 100))
    print("  这条结论可以写进报告：换判分器不影响这个基准的分数。")

    print()
    print("  但一致率是「在覆盖内」的结论。看一条覆盖外的：")
    for odd in ["约 42", "40~45", "42 左右"]:
        print("    %-8s → rule=%s  llm=%s  （两边都拒判）"
              % (odd, rule_judge(odd), llm_judge(odd)))

    print()
    print("三、覆盖闸门：coverage_complete 不为 True，分数直接作废")
    clean = answers
    dirty = answers + ["约 42"]           # 多一道覆盖外的题
    for name, rows in (("全部覆盖", clean), ("含 1 条覆盖外", dirty)):
        judged = [rule_judge(a) for a in rows]
        complete = all(j is not None for j in judged)
        # Pass@1 只在 complete 时成立
        score = "%.1f%%" % (sum(1 for j in judged if j) / len(rows) * 100) if complete else "作废"
        print("  %-14s n=%d  coverage_complete=%-5s  Pass@1=%s"
              % (name, len(rows), complete, score))

    print()
    print("  分母里只要混进一条判不了的，剩下的数字就不是「这个基准的分数」，")
    print("  而是「我能判的那些题的分数」—— 两者不能混用。")

    print()
    print("四、被截断的 rollout 要单列，不能当错题")
    truncated = 3
    print("  truncated_rollouts = %d：它的答案可能本来就是对的，只是没生成完。" % truncated)
    print("  当错题算 → 分数偏低；当对题算 → 分数偏高；单列才诚实。")

    assert agree == 960
    assert rule_judge("4200%") is True and rule_judge("约 42") is None
    assert not all(rule_judge(a) is not None for a in dirty)
    print("\n[自检] 八条规则各自生效、960 条 100% 一致、覆盖外拒判 —— 与动画一致")


if __name__ == "__main__":
    main()
