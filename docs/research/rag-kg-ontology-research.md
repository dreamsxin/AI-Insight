# RAG × 知识图谱 × 本体论 · 资料汇编

> 调研时间：2026-10-28 · 服务于 AGENT 实战工坊后续选题（现有 rag-05 GraphRAG 一集的深化备料）
> 一句话结论：**图 RAG 不是向量 RAG 的替代，是一张按"问题类型"选档位的光谱**——从纯向量（naive）到层次树（RAPTOR）到轻图（LightRAG/HippoRAG）到社区摘要（GraphRAG）到结构化查询（Text2Cypher），越往右越贵、越擅长全局与多跳；本体论（ontology）是给图加"蓝图"，让 LLM 抽取从自由发挥变成按 schema 交卷。

---

## 一、向量 RAG 的三类失败（为什么需要图）

| 问题类型 | 例子 | 向量 RAG 的表现 |
|---|---|---|
| **全局性/汇总性** | "这批文档里主要的争议主题是什么？" | 检索回的是最相似的几个块，天然答不了"全体" |
| **多跳关系** | "A 的合作者的导师写了什么？" | 每一跳都要一次检索，误差逐跳放大 |
| **关系型精确查询** | "谁在什么时候收购了谁？" | 嵌入相似度抓不住精确的关系方向 |

知识图谱 RAG 的核心主张：**把关系显式存下来，检索就变成"沿边走"而不是"猜相似"**。

---

## 二、方法光谱与选型对比

| 方法 | 核心结构 | 索引成本 | 查询成本 | 擅长 | 出处 |
|---|---|---|---|---|---|
| Naive RAG | 向量 | 低 | 低 | 局部事实查询 | — |
| **RAPTOR** | 递归聚类摘要**树** | 中 | 低 | 需要多抽象层的问题 | [Semantic Scholar](https://www.semanticscholar.org/paper/RAPTOR%3A-Recursive-Abstractive-Processing-for-Tree-Organized-Retrieval/Sarthi-Abdullah/1d40f07569482d24e3335ffb31394d4bf1567e6f) |
| **LightRAG** | 实体关系图 + 向量双层 | 中 | 低 | 成本/质量平衡，增量更新友好 | [HKUDS/LightRAG](https://github.com/HKUDS/LightRAG)（EMNLP 2025） |
| **HippoRAG 2** | KG + Personalized PageRank | 中 | 低 | 多跳 QA，避免重型索引 | [OSU NLP Group](https://github.com/markmbain/OSU-NLP-Group-HippoRAG)、[dev.to 综述](https://dev.to/newshunt_ai/introducing-hipporag-2-giving-ai-models-human-like-memory-3no5) |
| **Microsoft GraphRAG** | 实体图 + 社区层次摘要 | **极高** | 中 | 全局性问题、企业级推理 | [官方文档](https://microsoft.github.io/graphrag/index/overview/) |
| **LazyGraphRAG** | 图 + **延迟到查询时**才用 LLM | ≈GraphRAG 的 **0.1%** | 较高 | 预算紧、查询模式不可预测 | Microsoft Research（2024 底） |
| **Text2Cypher** | 属性图数据库（Neo4j） | 中 | 低 | 精确关系查询、可解释 | [Neo4j+LangChain 实践](https://arshren.medium.com/knowledge-graph-driven-retrieval-augmented-generation-rag-0ea0c8944711) |

> 数据更新频繁时，"重索引"是图 RAG 最大的隐形负债——GraphRAG/LazyGraphRAG/RAPTOR 都在为此付钱，LightRAG 和 HippoRAG 2 的卖点正是把这笔钱降下来（[来源](https://www.linkedin.com/pulse/most-multi-hop-rag-goes-stale-moment-your-data-changes-geymonat-twhpf)）。

---

## 三、核心机制拆解

### 3.1 GraphRAG：先造图，再"分圈子写总结"

官方[索引流水线](https://microsoft.github.io/graphrag/index/overview/)五步：从原始文本抽取 **实体 / 关系 / 主张（claims）** → 在实体图上做**社区发现**（Leiden 算法，自动分圈子）→ 每个圈子生成**多级粒度的社区摘要**（圈中圈，层层向上汇总）→ 文本向量化 → 全部落 Parquet + 向量库。

查询分两档：
- **local search**：从问题出发找相关实体，带上邻接关系和原文块——答"具体的"。
- **global search**：把社区摘要（可能只取顶层）喂给 LLM 做地图级综述——答"全体的"。

这就是 rag-05 那句"抽实体关系、分圈子写总结"的完整版。代价：每个块都要过一遍 LLM 抽取，社区摘要再来一遍——**索引期的 LLM 账单是向量 RAG 的几十倍量级**。

### 3.2 LazyGraphRAG：把 LLM 支出从"建库"挪到"查库"

思路：索引时只便宜地建图（NLP 抽实体 + 图统计），**所有 LLM 调用推迟到查询时**——查询时才对最相关的社区做 LLM 分析。索引成本约为 GraphRAG 的 0.1%，代价是每次查询更贵。适合"不知道用户会问什么、但问题总量也不大"的场景。与预聚合的 GraphRAG 是一笔典型的"预计算 vs 现算"账（呼应推理原理 S1 的 prefill/decode 思路）。

### 3.3 LightRAG：双层检索 + 增量更新（当前性价比标杆）

[HKUDS/LightRAG](https://github.com/HKUDS/LightRAG)（EMNLP 2025）的关键设计：

- **双层检索（dual-level）**：同时抽 **low-level**（具体实体及其直接关系）和 **high-level**（主题/概念层的关系链），一次查询同时拿到"细节"与"主题"。
- **五种查询模式**：`local` / `global` / `hybrid`（前两者合并）/ `naive`（纯向量）/ `mix`（三者全并，**默认**）。实测 `mix` 最好，延迟略高于 naive。
- **增量更新与删除重建**：删文档时用索引期缓存的 LLM 结果快速重建受影响的实体/关系——动态语料的刚需。
- **四角色 LLM 配置**：抽取（快、便宜、**关思考模式**）、查询（要更强、可开思考）、关键词（低延迟）、VLM（多模态）。抽取和查询用不同档位的模型，本身就是一笔推理经济账。
- 四类存储（KV / 向量 / 图 / 文档状态），生产推荐 PostgreSQL 一套全包；图可选 Neo4j。
- 论文 win-rate 表：对 NaiveRAG 全面优势（Legal 域 Overall 84.8% vs 15.2%），对 GraphRAG 在 Diversity 上大幅领先、Overall 接近——**接近的质量，便宜得多的索引**。

### 3.4 HippoRAG：把"回忆"建模为图上的扩散

神经科学启发：人脑新皮层存内容、海马体存**索引**。HippoRAG 用 LLM 抽实体建成 KG，查询时在图上跑 **Personalized PageRank（PPR）**——把问题里的实体作为"激活种子"，激活能量沿边扩散，收集最相关的节点。多跳问题不需要真的跳多次，一次扩散就到达。HippoRAG 2（2025）补上与稠密检索的混合，进一步降低索引成本。适合多跳 QA 为主的场景（MuSiQue / 2WikiMultiHopQA 这类基准上的常胜路线）。

### 3.5 RAPTOR：不建图，建树

把块递归地"聚类 → 摘要 → 再聚类"，形成一棵从原文到全局主题的抽象层级的树；检索可在任意层进行。严格说不是图 RAG，但它与 GraphRAG 回答的是同一类"需要全局视角"的问题，且结构更简单——是"图之外"的重要参照系。

---

## 四、本体论（Ontology）：给图加蓝图

### 4.1 三个必须分清的词

| 词 | 是什么 | 一句话 |
|---|---|---|
| **本体（ontology）** | 一个领域的**形式化规范**：有哪些类、哪些关系、什么约束 | **蓝图** |
| **知识图谱（KG）** | 按某本体填充后的**实例数据** | **建筑** |
| **模式（schema）** | 工程语境下本体的同义词（属性图世界里更常叫 schema） | 蓝图的工程叫法 |

经典描述逻辑把本体拆成两部分（[来源](https://de-knowledgebase.sercuarc.org/TBox.html)）：
- **TBox（Terminological Box）**：术语箱——类层次、属性定义、公理。`作品 ⊑ 内容；作者 ⊸ 写 ⊸ 作品`。
- **ABox（Assertional Box）**：断言箱——具体实例。`《静夜思》 是 作品；李白 写 《静夜思》`。

（用 rag-demo 的古诗文语料做例子：TBox 是"诗人—写了—诗作—属于—朝代"这套词汇表，ABox 是"李白—写了—静夜思"这些事实。）

### 4.2 两种图数据模型

| | RDF 三元组 + OWL | 属性图（Neo4j 等） |
|---|---|---|
| 数据形状 | `(主语, 谓语, 宾语)` 三元组 | 节点 + 带属性的边 |
| 推理 | OWL 本体自带推理（类继承、一致性检查） | 无原生推理，靠查询表达 |
| 查询语言 | SPARQL | Cypher |
| 工程亲和 | 语义网/标准化场景 | 应用开发主流、上手快 |
| 与向量结合 | 需外挂 | Neo4j 已原生支持向量索引，一库两查 |

实践中的主流：**属性图存 ABox、本体（TBox）作为 LLM 抽取时的约束文档**——两头都要，但不引入完整 OWL 栈（[Ontology vs Graph Database](https://volodymyrpavlyshyn.substack.com/p/ontology-vs-graph-database-llm-agents)）。

### 4.3 本体约束的 KG 构建（2025-2026 的研究热点）

LLM 自由抽取实体关系的两个顽疾：**同一实体多种写法**（"李白" vs "李太白" vs "诗仙"）和**schema 漂移**（每篇文档抽出的关系类型都对不上）。本体约束抽取（ontology-grounded construction）的解法：

1. **先有 TBox 再抽取**：prompt 里给 LLM 实体类型与关系类型的封闭清单（"只允许抽出：诗人/诗作/朝代/地点 四类节点，写了/属于/描绘 三种关系"）。
2. **抽取即合规**：输出必须是 schema 合法的实例，非法即拒——把"图清洗"前移到"生成时"。
3. **本体本身可以半自动学**：LLM 从语料 propose 类与关系 → 人审 → 固化为 TBox（[Kastle Lab 综述](https://kastle-lab.github.io)、[Ontology-grounded AKGC](https://www.alphaxiv.org/overview/2512.01289)）。
4. **反方向同样重要——别过度设计**：[Lean KG with small LLMs](https://medium.com/@shreyasinghal0409/why-your-graphrag-is-over-engineered-building-lean-knowledge-graphs-with-small-language-models-a9ac655891c6) 的结论是小型 LLM 配 **精简 schema** 反而效果更好；类和关系越多，小模型越容易抽错。经验法则：**TBox 从 ≤10 个类、≤15 种关系起步，按查询需求长**。

代表作：[OntoMetric](https://arxiv.org/html/2512.01289v2)（本体驱动的 ESG 监管文档 KG 构建与治理）、[Emergent Mind 综述](https://www.emergentmind.com/topics/ontology-grounded-llm-construction)。

---

## 五、工程选型决策表

按三个问题选档位：

1. **用户问什么？** 局部事实 → 向量就够；多跳 → HippoRAG/图遍历；全局综述 → GraphRAG（或 LightRAG global）；精确关系 → Text2Cypher。
2. **数据多久变一次？** 天天变 → 轻图（LightRAG 增量 / HippoRAG 2）；基本静态 → 重索引无所谓（GraphRAG）。
3. **预算多少？** LLM 索引账单：LazyGraphRAG 0.1x → LightRAG 1x → GraphRAG 10x+（量级示意）。

**默认起点建议**：LightRAG `mix` 模式 + Lean schema + PostgreSQL 后端；查询侧按需升级到 GraphRAG 的社区摘要路线。

---

## 六、与本仓库的衔接

- **rag-05《GraphRAG：把碎片连成地图》** 已讲直觉版：抽实体关系 → 分圈子写总结 → 先看地图定方向、再回细节取证。本调研补足了它背后的**数字与档位**（社区摘要的 LLM 成本、LightRAG/HippoRAG 的替代路线、LazyGraphRAG 的 0.1%）。
- **rag-demo** 的古诗文语料是现成的本体教学素材：诗人/诗作/朝代/意象 四类节点 + 写了/属于/化用 三种关系，TBox 一页纸就能画出来——"用 5 个类把整本诗文集连成图"是极好的下一集示范。
- **潜在选题**（未排期）：
  1. 工坊 07《给语料一张地图：从向量库到知识图谱》——rag-demo 语料 + LightRAG/LeanKG 实做，实体消歧（李白=李太白）与 TBox 约束抽取是两个天然的知识点。
  2. 模式进阶 07《图上的记忆》——HippoRAG 的 PPR 与 pat-03 CoALA 记忆路线同框：知识图谱作为 Agent 长期记忆的索引层。
  3. 备料一篇《LazyGraphRAG 的账》：预计算 vs 现算，可与 inf 系列的 prefill/decode 账本互相引用。

---

## 七、来源清单

- [Microsoft GraphRAG 官方文档 · Indexing Overview](https://microsoft.github.io/graphrag/index/overview/)
- [HKUDS/LightRAG（EMNLP 2025）](https://github.com/HKUDS/LightRAG)
- [HippoRAG · OSU NLP Group](https://github.com/markmbain/OSU-NLP-Group-HippoRAG) · [HippoRAG 2 综述](https://dev.to/newshunt_ai/introducing-hipporag-2-giving-ai-models-human-like-memory-3no5)
- [RAPTOR 论文页](https://www.semanticscholar.org/paper/RAPTOR%3A-Recursive-Abstractive-Processing-for-Tree-Organized-Retrieval/Sarthi-Abdullah/1d40f07569482d24e3335ffb31394d4bf1567e6f)
- [GraphRAG: When Vector Search Is Not Enough（2026-09 深度文）](https://saram.io)
- [重索引负债：multi-hop RAG 在数据变化时](https://www.linkedin.com/pulse/most-multi-hop-rag-goes-stale-moment-your-data-changes-geymonat-twhpf)
- [TBox vs ABox](https://de-knowledgebase.sercuarc.org/TBox.html) · [TAR: TBox/ABox 神经逻辑推理](https://arxiv.org/abs/2205.14591)
- [Ontology vs Graph Database（LLM Agents 视角）](https://volodymyrpavlyshyn.substack.com/p/ontology-vs-graph-database-llm-agents)
- [Ontology-grounded LLM Construction 综述](https://www.emergentmind.com/topics/ontology-grounded-llm-construction) · [OntoMetric](https://arxiv.org/html/2512.01289v2) · [Kastle Lab：加速 KG 与本体工程](https://kastle-lab.github.io)
- [Lean Knowledge Graphs with small LLMs](https://medium.com/@shreyasinghal0409/why-your-graphrag-is-over-engineered-building-lean-knowledge-graphs-with-small-language-models-a9ac655891c6)
- [Neo4j + LangChain 的 KG-RAG 实践](https://arshren.medium.com/knowledge-graph-driven-retrieval-augmented-generation-rag-0ea0c8944711) · [生产级 Graph RAG 指南](https://blogs.versalence.ai/graph-rag-neo4j-langchain-production-guide) · [JIT 混合 Graph RAG 教程](https://ragaboutit.com/how-to-build-a-jit-hybrid-graph-rag-with-code-tutorial)
