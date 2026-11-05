#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把「配套脚本」角标注入到动画页面。

约定：脚本名 = 页面名去掉 `-animation.html`
    docs/inf-30-cache-bytes-animation.html
    examples/anim-demos/inf-30-cache-bytes.py

注入器扫描 examples/anim-demos/*.py，自动发现对应页面，不维护映射表。
新增脚本后重跑即可。

用法：
    python docs/tools/demo-gen.py            # 注入 / 更新
    python docs/tools/demo-gen.py --check    # 只报告，不写入
    python docs/tools/demo-gen.py --strip    # 全部撤掉
"""
import io
import os
import re
import sys
import glob

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.dirname(HERE)
ROOT = os.path.dirname(DOCS)
DEMOS = os.path.join(ROOT, 'examples', 'anim-demos')

START = '<!-- demo:start -->'
END = '<!-- demo:end -->'

CSS = """<style>
  .demochip{position:fixed;right:14px;top:calc(9px + env(safe-area-inset-top));z-index:70;
    display:flex;align-items:center;gap:6px;padding:5px 10px 5px 8px;border-radius:99px;
    border:1px solid rgba(255,255,255,.13);background:rgba(9,14,24,.78);
    backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;letter-spacing:.02em;
    color:#7c879e;cursor:pointer;opacity:.62;transition:opacity .25s,border-color .25s,color .25s;
    -webkit-user-select:none;user-select:none}
  .demochip:hover{opacity:1;border-color:rgba(255,255,255,.26);color:#c3cde2}
  .demochip.ok{opacity:1;border-color:var(--acc,#22d3ee);color:var(--acc,#22d3ee)}
  .demochip i{font-style:normal;font-size:10px;opacity:.9}
  .demochip em{font-style:normal;opacity:.55}
  .demochip.ok em{opacity:.9}
  @media (max-width:520px){.demochip em{display:none}}
</style>"""


def block(stem):
    return (
        START + '\n'
        + CSS + '\n'
        + '<div class="demochip" id="demoChip" data-cmd="python examples/anim-demos/%s.py">' % stem
        + '<i>&#9881;</i><b>配套脚本</b><em>%s.py</em></div>' % stem
        + '\n<script>'
        + '(function(){var c=document.getElementById("demoChip");if(!c)return;'
        + 'var t=c.querySelector("em"),cmd=c.getAttribute("data-cmd"),old=t.textContent;'
        + 'c.addEventListener("click",function(){'
        + 'var done=function(){c.classList.add("ok");t.textContent="已复制";'
        + 'setTimeout(function(){c.classList.remove("ok");t.textContent=old},1500)};'
        + 'if(navigator.clipboard&&navigator.clipboard.writeText){'
        + 'navigator.clipboard.writeText(cmd).then(done,function(){t.textContent=cmd});}'
        + 'else{t.textContent=cmd;}});})();'
        + '</script>\n'
        + END
    )


def pages():
    return sorted(os.path.basename(p) for p in glob.glob(os.path.join(DOCS, '*-animation.html')))


def main():
    args = sys.argv[1:]
    check = '--check' in args
    strip = '--strip' in args

    demos = sorted(
        os.path.basename(p)[:-3]
        for p in glob.glob(os.path.join(DEMOS, '*.py'))
        if not os.path.basename(p).startswith('_')
    )
    stems = set(demos)

    written, drifted, removed, orphans = [], [], [], []

    for page in pages():
        path = os.path.join(DOCS, page)
        src = io.open(path, encoding='utf-8').read()
        stem = page[:-len('-animation.html')]

        has = START in src
        want = stem in stems and not strip

        if want and has:
            # 已存在则检查是否同步
            if block(stem) in src:
                continue
            new = re.sub(re.escape(START) + r'.*?' + re.escape(END), block(stem), src, flags=re.S)
            drifted.append(page)
        elif want and not has:
            new = src.replace('</body>', block(stem) + '\n\n</body>', 1)
            written.append(page)
        elif not want and has:
            new = re.sub(r'\n*' + re.escape(START) + r'.*?' + re.escape(END) + r'\n*', '\n', src, flags=re.S)
            removed.append(page)
        else:
            continue

        if not check:
            io.open(path, 'w', encoding='utf-8', newline='\n').write(new)

    # 有脚本但没有页面
    for stem in demos:
        if not os.path.exists(os.path.join(DOCS, stem + '-animation.html')):
            orphans.append(stem)

    verb = '将' if check else '已'
    if written:
        print('%s注入 %d 页：%s' % (verb, len(written), ' '.join(written)))
    if drifted:
        print('%s更新 %d 页：%s' % (verb, len(drifted), ' '.join(drifted)))
    if removed:
        print('%s移除 %d 页：%s' % (verb, len(removed), ' '.join(removed)))
    if orphans:
        print('! 找不到对应页面：%s' % ' '.join(orphans))
    if not (written or drifted or removed or orphans):
        print('同步：%d 个脚本，%d 页均一致' % (len(demos), len(pages())))
    return 0


if __name__ == '__main__':
    sys.exit(main())
