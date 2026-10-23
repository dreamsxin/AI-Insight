#!/usr/bin/env python3
"""按 docs/index.html 的卡片顺序，为每集注入「上一集 / 目录 / 下一集」导航。

用法（在任意目录）：
    python docs/tools/nav-gen.py          # 注入/更新
    python docs/tools/nav-gen.py --check  # 只检查是否与索引一致，不写文件

顺序来源：index.html 中 a.card 的出现顺序（12 个系列、共 103 集）。
幂等：每次先删除 <!-- epnav:start --> … <!-- epnav:end --> 再重新插入。
新增或删除一集后重跑本脚本即可，不要手工改单集文件。
"""

import os
import re
import sys

DOCS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(DOCS, "index.html")

CSS = """<style>
/* epnav: 集间导航（由 docs/tools/nav-gen.py 生成，勿手工编辑） */
.epnav{position:fixed;top:calc(10px + env(safe-area-inset-top));left:10px;z-index:70;
  display:flex;align-items:center;gap:1px;padding:3px;border-radius:999px;
  background:rgba(7,11,20,.66);border:1px solid rgba(255,255,255,.13);
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
  opacity:.5;transition:opacity .25s ease}
.epnav:hover,.epnav:focus-within{opacity:1}
.epnav a,.epnav span{display:flex;align-items:center;justify-content:center;height:22px;
  border-radius:999px;color:#8b96ad;text-decoration:none;line-height:1;
  font-family:ui-monospace,"Cascadia Code","SF Mono",Consolas,monospace;
  transition:color .2s,background .2s}
.epnav a:hover{color:#22d3ee;background:rgba(34,211,238,.12)}
.epnav-b{width:25px;font-size:15px}
.epnav-h{font-size:10.5px;letter-spacing:.12em;padding:0 7px}
.epnav .dis{opacity:.24;cursor:default}
.epnav :focus-visible{outline:1px solid #22d3ee;outline-offset:1px}
@media (max-width:380px){.epnav-h{display:none}}
@media print{.epnav{display:none}}
</style>"""

JS = """<script>
/* 集间导航键盘支持：← 上一集 / → 下一集 */
addEventListener("keydown", function (e) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
  var sel = e.key === "ArrowLeft" ? "上一集" : e.key === "ArrowRight" ? "下一集" : null;
  if (!sel) return;
  var a = document.querySelector('.epnav a[aria-label="' + sel + '"]');
  if (a) { e.preventDefault(); location.href = a.getAttribute("href"); }
});
</script>"""

BLOCK_RE = re.compile(r"<!-- epnav:start -->.*?<!-- epnav:end -->\n?", re.S)


def read_index():
    """返回 [(文件名, 系列名, 卡片标题), ...]，按索引页出现顺序。"""
    html = open(INDEX, encoding="utf-8").read()
    marks = []
    for m in re.finditer(r'<div class="series-head"><b>(.*?)</b></div>', html):
        marks.append((m.start(), "head", m.group(1)))
    for m in re.finditer(r'<a class="card" href="([^"]+)">(.*?)</a>', html, re.S):
        title = re.search(r"<b>(.*?)</b>", m.group(2))
        marks.append((m.start(), "card", (m.group(1), title.group(1) if title else "")))
    marks.sort(key=lambda x: x[0])

    series, out = "", []
    for _, kind, val in marks:
        if kind == "head":
            series = val
        else:
            out.append((val[0], series, val[1]))
    return out


def build_nav(prev_item, next_item):
    def side(item, label, arrow, cls):
        if not item:
            return f'<span class="epnav-b dis" aria-hidden="true">{arrow}</span>'
        href, _, title = item
        return (f'<a class="epnav-b" href="{href}" aria-label="{label}" '
                f'title="{label}：{title}">{arrow}</a>')

    return "\n".join([
        "<!-- epnav:start -->",
        '<nav class="epnav" aria-label="集间导航">',
        "  " + side(prev_item, "上一集", "‹", "epnav-b"),
        '  <a class="epnav-h" href="index.html" title="返回索引">目录</a>',
        "  " + side(next_item, "下一集", "›", "epnav-b"),
        "</nav>",
        CSS,
        JS,
        "<!-- epnav:end -->",
    ])


def main():
    check_only = "--check" in sys.argv
    items = read_index()
    print(f"索引中共 {len(items)} 集")

    missing = [f for f, _, _ in items if not os.path.exists(os.path.join(DOCS, f))]
    if missing:
        print("索引里存在但磁盘缺失：", ", ".join(missing))
        return 1

    changed = stale = 0
    for i, (fname, _, _) in enumerate(items):
        prev_item = items[i - 1] if i > 0 else None
        next_item = items[i + 1] if i + 1 < len(items) else None
        block = build_nav(prev_item, next_item)

        path = os.path.join(DOCS, fname)
        html = open(path, encoding="utf-8").read()
        stripped = BLOCK_RE.sub("", html)
        updated = stripped.replace("<body>", "<body>\n" + block, 1)

        if updated == html:
            continue
        if "<body>" not in stripped:
            print(f"  跳过（找不到 <body>）：{fname}")
            continue
        stale += 1
        if not check_only:
            open(path, "w", encoding="utf-8", newline="\n").write(updated)
        else:
            print(f"  需更新：{fname}")

    if check_only:
        print("同步" if stale == 0 else f"{stale} 个文件需要更新")
    else:
        print(f"已写入 {stale} 个文件")
    return 0


if __name__ == "__main__":
    sys.exit(main())
