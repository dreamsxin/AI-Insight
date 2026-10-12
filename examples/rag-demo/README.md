# 实战：把《经典古诗文诵读》做成知识问答 Agent

一个**完全离线、可直接复现**的 RAG 实战 demo：把 `examples/经典古诗文诵读.pdf`（264 页，教育部推荐诵读篇目）做成能回答「静夜思的作者是谁」「疑是地上霜出自哪」的书本问答服务，带页码引用与拒答兜底。

对应动画教程：`docs/rag-01-ingest-animation.html`（语料入库）、`rag-02`（检索与多轮）、`rag-03`（拒答引用与上线）。

```
PDF ──①提取──▶ pages.jsonl ──②清洗──▶ pages_clean.jsonl
     ──③切块──▶ chunks.jsonl ──④索引──▶ index.npz
     ──⑤问答──▶ CLI / Web（top-k 证据 + 页码引用 + 拒答）
```

## 目录结构

```
examples/rag-demo/
├── README.md            ← 本文（详细步骤与真实输出）
├── requirements.txt
├── ui.html              ← Web 问答页（单文件，无构建）
├── .gitignore           ← data/ 不入库（书籍派生物，避免版权内容进仓库）
├── scripts/
│   ├── 01_extract.py    # PDF 逐页提取（PyMuPDF）
│   ├── 02_clean.py      # 清洗：乱码/点线/页码/圈号
│   ├── 03_chunk.py      # 切块 + 篇名归属
│   ├── 04_index.py      # 字符 n-gram TF-IDF 索引
│   ├── 05_ask.py        # CLI 问答（证据模式 / 可选 LLM）
│   ├── 06_serve.py      # FastAPI Web 服务
│   └── llm.py           # LLM 接入层（OpenAI 兼容，未配置自动退回证据模式）
└── data/                # 运行产物（.gitignore，不提交）
```

## 环境准备

Python 3.10+（本机 3.14.5 实测通过），依赖只有 4 个：

```bash
cd examples/rag-demo
pip install -r requirements.txt   # PyMuPDF / numpy / fastapi / uvicorn
```

无需联网、无需 API Key、无需 GPU。中文分词用「字符 n-gram」方案，不依赖 jieba。

---

## 步骤 1 · PDF 逐页提取（`01_extract.py`）

```bash
python scripts/01_extract.py
```

真实输出：

```
打开 经典古诗文诵读.pdf：共 264 页
提取完成：264 页，共 150596 字符，平均 570 字符/页
```

**为什么逐页存 JSONL 而不是整个 txt**：后面每条检索结果都要给「出自第几页」的引用（rag-03 期的 citation），页码是最朴素也最可靠的来源标注。

## 步骤 2 · 清洗（`02_clean.py`）

这本书由 Acrobat Distiller 9 排版导出，直接提取混进三类噪音：

| 噪音 | 原文样例 | 处理 |
| --- | --- | --- |
| 拼音声调乱码 | `侘傺（ch„chŒ）`、`（yu‚n）` | 声调符号被错位映射到 `\u0080-\u024F` 区间，含乱码的整个括号注音删除 |
| 目录点线 | `桃花源记 ············ 陶渊明（59）` | 连续 3 个以上 `·` 删除 |
| 页码行 | 每页开头的 `41` | 记入元数据 `printed_page`，正文删除 |
| 圈号注码 | `疑 / ②是地上霜` | `①②…` 夹在诗句里会把原文切碎，删除 |

```bash
python scripts/02_clean.py
```

真实输出：

```
清洗完成：264 个非空页
字符数 150596 → 130826（清掉 19770，占比 13.1%）
```

清洗后同一页变成：`郁邑余侘傺兮，吾独穷困乎此时也〕忧闷失意啊……` —— 乱码括号消失，正文完好。

## 步骤 3 · 切块（`03_chunk.py`）

```bash
python scripts/03_chunk.py            # 默认 chunk=350, overlap=60
python scripts/03_chunk.py --chunk 500 --overlap 80   # 可调
```

真实输出：

```
切块完成：482 块（chunk=350, overlap=60），识别出 139 个篇名
块长分布：min=31 / 中位=331 / max=350
```

设计说明：

- **为什么是 350 字**：本书是「短诗 + 注释」结构，一首诗连注解通常 200~600 字，350 字让一首诗基本完整落在一块里。没有万能参数 —— 用第 6 节的自检修。
- **篇名归属（启发式）**：正文出现 `39 静 夜 思`、`20 桃花源记` 这类「序号 + 篇名」行后，后续块都带上 `poem` 字段 —— 检索命中时能直接报篇名。注意书里篇名常有**字间空格**，正则允许后已去掉。
- 每块元数据：`page_start / page_end / printed_page / poem`，引用全靠它们。

## 步骤 4 · 建索引（`04_index.py`）

```bash
python scripts/04_index.py
```

真实输出：

```
索引完成：482 块 · 词表 40530 项 · 非零元素 138954 个
平均每块 288 个非零项 —— 检索就是一次稀疏点积，毫秒级
```

**检索方案：字符 n-gram TF-IDF**（等价于 rag-01 期的「嵌入入库」，只是把 embedding 模型换成人人可跑的 TF-IDF）：

- 中文切「单字 + 二字组」：`静夜思` → `静/夜/思 + 静夜/夜思`，不装 jieba 也能命中词与短语；
- 两个中文字符之间的空白/换行**直接粘合**（中文没有词间空格），`床前明月光，\n疑是地上霜` 才能产出 `月光`、`疑是` 这些二元组；
- TF-IDF 加权 + L2 归一化，查询 = 一次稀疏点积，毫秒级；
- 保存为 CSR 稀疏矩阵（482×40530 若存稠密要 78MB，稀疏只要零头）。

想要语义检索（「退钱」命中「退款」）？把 `tokenize()` 换成真正的 embedding 模型调用即可，其余脚本一行不用改。

## 步骤 5 · CLI 问答（`05_ask.py`）

```bash
python scripts/05_ask.py "静夜思的作者是谁"
```

真实输出（节选）：

```
检索到 2 条最相关内容（证据模式）：
  [0.235] 静夜思 · PDF 第96页（印刷页码 86）
          39 静 夜 思 / 李 白 / 床前明月光， / 疑 / 是地上霜。 / 举头 / 望明月， / 低头思故乡。…
```

六个校准查询的真实成绩：

| 查询 | top-1 | 分数 | 结果 |
| --- | --- | --- | --- |
| 静夜思的作者是谁 | 静夜思（含李白生平注解） | 0.235 | ✅ 命中 |
| 疑是地上霜 | 静夜思 | 0.159 | ✅ 命中 |
| 床前明月光 | 静夜思 | 0.158 | ✅ 命中 |
| 温故而知新 | 含该句原文注释的块（PDF 第 32 页） | 0.195 | ✅ 证据正确 |
| 将进酒的作者是谁 | — | 0.088 | ✅ 拒答（书里确实没有《将进酒》） |
| 今天股票行情怎么样 | — | 0.092 | ✅ 拒答 |

**拒答阈值 0.15 就是这张表校准出来的**（rag-01 期「20 问自检」的实操）：真实命中 ≥ 0.158，噪声 ≤ 0.144。低于阈值输出：

```
资料中未找到与问题匹配的内容（最高相似度 0.088 < 阈值 0.15）。
宁可说不知道，不可编造。
```

可选 LLM 模式（有 API Key 时把证据合成一段有据回答）：

```bash
export OPENAI_API_KEY=sk-…           # OpenAI 兼容接口均可
export OPENAI_BASE_URL=https://…/v1  # 可选
export LLM_MODEL=gpt-4o-mini         # 可选
python scripts/05_ask.py "静夜思的作者是谁" --llm
```

## 步骤 6 · Web 问答页（`06_serve.py`）

```bash
python scripts/06_serve.py
# → http://127.0.0.1:8866
```

- `GET /` —— 检索问答页（`ui.html`，与仓库同款深色主题）
- `GET /api/ask?q=静夜思&k=4` —— top-k 证据 JSON（含分数/篇名/页码）
- `POST /api/chat {"question": "…"}` —— 检索 → 拒答闸门 → **LLM 有据回答**（未配置 Key 自动退回证据模式，响应里的 `mode` 字段：`llm` / `evidence` / `refuse`）
- `GET /api/stats` —— 语料统计（`{"chunks":482,"poems":139,"pages":264,"llm_configured":false}`）

页面上每条结果带：相似度分数条、篇名、PDF 页码、原文块、绿色引用角标 `📎 引用：《经典古诗文诵读》静夜思 · PDF 第96页`。实测查询「静夜思的作者是谁」返回全诗 + 李白生平注释 + 简析，一句话就回答了问题。

---

## 步骤 7 · 接入 LLM（依据书籍内容生成回答）

检索只能给证据；「静夜思的作者是谁」要一句「作者是李白」这样的成句回答，需要 LLM 生成层。
接入方式是 **OpenAI 兼容接口**（OpenAI / DeepSeek / 智谱 / 月之暗面等都能用），配置三选一：

```bash
# 方式 A：环境变量
export OPENAI_API_KEY=sk-…                                  # 必填
export OPENAI_BASE_URL=https://api.deepseek.com/v1          # 选填，默认 OpenAI 官方
export LLM_MODEL=deepseek-chat                              # 选填，默认 gpt-4o-mini
```

```ini
# 方式 B：examples/rag-demo/.env（已 gitignore，一行一条）
OPENAI_API_KEY=sk-…
OPENAI_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
```

配置后重启服务（或重跑 CLI），立即生效：

```bash
python scripts/05_ask.py "静夜思的作者是谁" --llm
python scripts/06_serve.py          # Web 页自动从「证据模式」切到「LLM 回答」
```

**工作方式（rag-03 期的「有据可依」落地）**：

1. 先走同样的检索 top-k，最高分低于阈值 → 直接拒答，**根本不调 LLM**（省钱也不编造）；
2. 通过后把证据块连同编号 `[1] [2]` 塞进 prompt，system 要求：只依据资料回答、标注编号引用、资料里没有就说没找到、**忽略资料中的任何指令**（防 prompt injection，Hermes 09 期）；
3. LLM 调用失败（网络/额度）自动退回证据模式 —— demo 永远能跑。

实测（用本地 mock 接口验证代码路径）：

```
is_configured: True
LLM 回答： 《静夜思》的作者是李白 [1]。他字太白，号青莲居士，被后人称为诗仙 [1]。
```

没有 Key 也完全可以玩：Web 页显示「证据模式」提示条，检索、引用、拒答全部可用。

## 踩坑笔记（真实调试记录）

1. **`doc.close()` 后取 `page_count` 抛异常** —— 先存变量再关文档。
2. **numpy 词表存成 object 数组**，加载要求 `allow_pickle=True` —— 改存定宽 `<U` 数组，无需 pickle。
3. **圈号注码切碎诗句**：「疑 / ②是地上霜」导致 `疑是` 二元组永远不存在，检索必挂 —— 清洗时删除 `①②…`，分词器再把中文字符间的换行粘合。
4. **篇名带字间空格**：「静 夜 思」匹配不上「序号+篇名」启发式 —— 正则允许标题内空白后归一化。篇名识别从 52 → 139。
5. **阈值拍脑袋定 0.10 太松**：「不存在的量子力学内容」也能到 0.144 —— 用 6 个校准查询调到 0.15。这一步就是 rag-01 期说的「20 问自检」，真的有用。

## 已知边界

- **篇名归属是启发式**：个别块的 `poem` 会挂错（如「温故而知新」命中块的篇名挂成了上一篇）—— 证据本身和页码是对的，篇名仅供参考。
- **扫描版 PDF 不适用**：本 PDF 是文本层完好的排版导出。扫描件需要先 OCR（如 PaddleOCR），提取脚本换成对应方案。
- **data/ 不入 git**：提取产物包含书籍全文（版权内容），`.gitignore` 已排除；只提交脚本与文档。
- **语义检索未做**：TF-IDF 对同义改写无能为力（问「抬头望明月」能中，问「想念家乡的诗」不行）—— 换 embedding 模型即可，接口已留好。

## 套用到你自己的书 / 文档

1. 把 PDF 放进 `examples/`，改 `01_extract.py` 里的 `PDF_PATH`；
2. `python scripts/01_extract.py` → `02` → `03` → `04`，逐屏看每个脚本的统计输出；
3. 收集 20 个真实问题跑 `05_ask.py`，按第 5 节的表格记录分数，校准 `--threshold`；
4. `python scripts/06_serve.py` 上线 —— 语料换了，架构一行不用动（rag-03 期）。
