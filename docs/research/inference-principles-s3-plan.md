# 「推理原理」演示动画系列 · 第三季 规划书

> 前两季见 `inference-principles-series-plan.md`。第一季（01–12）走一条请求的路，第二季（13–24）算四本账的代价。
> 第三季接在 `inf-24` 之后，编号 **25–36**。

---

## 一、定位：四个数字的背面

对外，一个推理服务只承诺四个数字：

| 数字 | 用户看到的样子 | 谁在背后决定它 |
| :--- | :--- | :--- |
| **分数** | 跑分 99.9 / 93.4 / 42.6 | 评测流程、判分器、覆盖度 |
| **长度** | 支持 1M 上下文 | RoPE 外推、选块、缓存格式 |
| **时延** | 每 token 十几毫秒 | 发射次数、装箱单、融合算子 |
| **密度** | 一张卡跑多少并发 | 字节账、对齐、分区、拓扑 |

前两季讲的是"这台机器怎么运转"。第三季反过来：**从用户能看到的四个数字出发，一路往下钻，看每个数字是被什么东西钉死的。**

四幕各问一个问题：

- **幕 A · 分数是量出来的** —— 一个分数是怎么被造出来的，以及它可以怎么骗你。
- **幕 B · 长度是买来的** —— 上下文变长，花掉的是什么。
- **幕 C · 时延是省出来的** —— 每个 token 的固定开销藏在哪。
- **幕 D · 密度是挤出来的** —— 一格到底能装多少东西。

第 36 集收口：四个数字并排，各自标上"是谁定的"。呼应 S1 的 01（五层图）与 S2 的 24（四本账），但镜头从"机器"移到"用户能看见的那张成绩单"。

### 与前两季的边界

| 已经讲过 | 第三季不再重复 |
| :--- | :--- |
| S1-07 KV 三级金字塔（3FS / 内存 / 显存的分层逻辑） | 30 只讲 token 的字节格式与对齐，不重讲分层 |
| S1-10 EPLB（专家负载均衡） | — |
| S2-14/15 scale 颗粒度与精度花在哪 | 34 只讲两套后端的实现差异，不重讲位宽 |
| S2-23 确定性采样 | 33 讲融合采样的算子结构，确定性只做一句回扣 |
| S2-24 四本账（成本） | 36 讲物理容量，不重算钱 |

---

## 二、素材盘点

这一季第一次做"库存表"——先数清楚有什么，再决定讲什么。

| 素材 | 体量 | 可讲点 | 状态 |
| :--- | ---: | :--- | :--- |
| `DeepInfer/eval/` | 1748 行（README 221） | 两段式生成/判分、Pass@k 无偏估计、LLM judge 八条等价规则、coverage_complete、截断惩罚、三个基准的真实配置与分数 | **全新，前两季零覆盖** |
| `deep_cluster/topology/bind.py` | 100 行 | libnuma 绑定、MPOL_BIND、IB 网卡的 NUMA 节点、逻辑卡号 ↔ 物理卡号 | **全新** |
| `deep_cluster/hardware/{device,nvidia,ascend}.py` | ~300 行 | 加速器探测、CUDA_VISIBLE_DEVICES vs ASCEND_RT_VISIBLE_DEVICES | **全新** |
| `worker/cache_engine.py` | 978 行 | 三种 cache 的字节格式（288 / 528）、mapped layer 共用、32 B 对齐、stored/dropped 分区、state slot 数 | 部分（S1-07 只到分层） |
| `worker/cuda_graph_runner.py` | 168 行 | 桶化策略、bisect_left 选桶、共享 memory pool、反序捕获、padding 与 num_reqs | **全新** |
| `model_executor/input_metadata/` | 1151 行 | InputMetadata 字段语义、CP-mirror 正反索引、-1 表示 padding、compute_attn_info 展开、get_clean_list | **全新** |
| `tilelang_ops/{cuda,asc}/` | 各 30 个文件（27 同名）；cuda 4968 行 / asc 7418 行 | 同一件事的两套实现、rstd_1ulp 拆 fp32、outlier_detection 只在 CUDA、cudagraph 平台差异 | **全新** |
| `layers/rotary_embedding.py` | 284 行 | YaRN：双段频率、beta_fast 32 / beta_slow 1、mscale、两个 max 的区别 | **全新** |
| `v4_modules/index_attn.py` + `compress.py` | 742 行 | 稀疏选块、index cache 压缩比、块分取 max | 部分（S2-14 提到 indexer KV 的 FP4） |
| `layers/fused_sample.py` + `sampler.py` | 1515 行 | temperature/top-p/top-k/log-softmax/采样融成一个 kernel、种子 tag 命名空间 | 部分（S2-23 只讲确定性） |
| `ve/` + `image_embed_ops.py` | 1609 行 | 图像 → patch → token、五种图像特殊 token | **全新，本季未用（见第八节）** |

`DeepInfer/doc/inference_deployment_qa.md` 仍是唯一官方文字来源（312 行），第三季只用到 §Cluster & storage 一节和 README 的性能表。

---

## 三、候选主题筛选

候选 15 个，落 12 个。砍掉的三个和理由：

| 候选 | 结论 | 理由 |
| :--- | :--- | :--- |
| 评测：分数怎么算 | ✅ 3 集 | 素材最完整、观众最直接相关、前两季完全没碰 |
| 长上下文：RoPE 外推 / 稀疏 / 字节账 | ✅ 3 集 | 一个数字（长度）三个层次，链路完整 |
| 时延：CUDA Graph / 装箱单 / 融合采样 | ✅ 3 集 | 全是"固定开销"，天然一组 |
| 落地：双平台 / NUMA / 容量 | ✅ 3 集 | 从代码走到机器，给整季一个物理落脚点 |
| 多模态：图像怎么变成 token | ⏸ 备选 | 素材好（`ve/` + `image_embed_ops` 1609 行），但"AI 运作原理 · 深入篇 07"已有多模态；留给第四季或作为加集 |
| 投机解码 draft 训练侧 | ✖ | 仓库里只有推理侧，训练侧无素材，会变成纯演绎 |
| 数据工程 / 数据配比 | ✖ | 两个仓库都没有训练数据管线 |
| 调度器抢占与配额 | ✖ | S1-06 已讲异步调度，再讲会重复 |
| 成本 / 账单 | ✖ | S2-24 刚讲完四本账，一季之内不重复 |

---

## 四、四幕 12 集脚本

每集 6–8 屏，一屏一个视觉 + 一句话。3D 只给有真实空间关系的地方（29 / 35 / 36）。

### 幕 A · 分数（25–27）· 主色 rose `#fb7185`

#### 25 · 三个基准一台秤（7 屏）

1. **封面**：一张成绩单，三行数字 99.9 / 93.4 / 42.6。
2. **两段式**：生成 → 落盘 → 判分。判分可以换 judge 重跑，生成不用重来。这是最被忽略的设计决定。
3. **AIME 2026**：30 题 × 32 次 = 960 条 rollout，Pass@1 99.9% —— 960 条里错的不到 1 条。
4. **GPQA Diamond**：198 题 × 8 次 = 1584 条，93.4%；四选一，瞎猜 25%。
5. **HLE**：2500 题（2158 文本 + 342 图），每题只跑 1 次，42.6%。
6. **差别不在难度，在每题跑几次**：32 / 8 / 1。三根柱 + 题数标签。
7. **收尾**：Pass@1 是"每题平均对率"，不是"一次就对的能力"——直接引出 26。

> 数据锚点：`eval/README.md` L11–L17、L208–L221；`eval/aime/run.sh`；`eval/hle/run.sh`（`n_sample=1` 写死在脚本里，不能用环境变量改）。

#### 26 · k 越大越好看（7 屏）

1. **封面**：同一批 rollout，k 从 1 调到 32，分数从 99.9 爬到 100。
2. **定义**：从 n 条里抽 k 条，至少一条对就算过。`1 - C(n-c,k)/C(n,k)`。
3. **k=1 退化**：就是 `c/n`。所以 Pass@1 和"平均对率"是同一件事的两个名字。
4. **边界**：`n-c < k` 时公式返回 1.0 —— 错的样本比 k 还少，数学上必然能抽到一条对的。
5. **为什么不重采样**：用组合数解析算，无偏；真去抽 k 条会浪费掉 32 次里的其余样本。
6. **缺样本怎么办**：某题只跑了 3 次（判分失败/截断）时用 `min(k,n)` 近似。直接丢掉这题会让分数**偏高**，因为被丢的通常是难的。
7. **收尾**：报 Pass@k 必须同时报 k 和 n，否则这个数没有意义。

> 数据锚点：`eval/common/passk.py` L8–L51（`estimator`、`pass_at_k_by_task`、`default_k_list`：2 的幂 + n_sample）。

#### 27 · 谁说了算，什么时候不算数（8 屏）

1. **封面**：同一批输出，两种判分器给出不同的分。
2. **rule judge**：AIME 抓 `\boxed{}` 里的整数，GPQA 抓 `ANSWER:` 后的字母。零依赖、完全确定。
3. **LLM judge**：只判"等价"，不看推理过程。八条规则：代数等价、数值等价、集合无序、单位、大小写与标点、多选（字母或内容）、不给部分分、提不出答案算错。
4. **两者一致性**：AIME 的 960 条 rollout 上 100% 一致。
5. **HLE 只能用 LLM judge**：过半答案是自由文本，精确匹配会把对的判成错的，系统性压低分数；`score.py` 直接拒绝 `--judge rule`。
6. **coverage_complete**：Pass@1 只在它为 `true` 时有效。缺 rank、缺样本 → 数字作废。
7. **截断会压低分数**：`finish_reason` 是 `length` / `prompt_length_exceeded` 的 rollout 单列统计，日志明写"raise the judge max_tokens and re-run"。
8. **收尾**：分数有三个隐藏参数——判分器、覆盖度、截断。报分不报这三个，等于没报。

> 数据锚点：`eval/score.py` L60–L70、L130–L170、L195–L205；`eval/common/judge.py` L13–L58。

---

### 幕 B · 长度（28–30）· 主色 blue `#60a5fa`

#### 28 · 位置怎么被拉长（7 屏）

1. **封面**：一句话被推到训练时从没见过的位置。
2. **RoPE 的两类频率**：高频维（相邻 token，转得快）和低频维（远距离，转得慢）。
3. **外推的问题**：超过 `original_max_position` 之后，低频维转不满一圈，模型没见过这些角度。
4. **YaRN 的办法**：分两段——高频保持原样（外推），低频按 `factor` 压缩（插值），中间用 ramp 平滑过渡。`beta_fast=32` / `beta_slow=1` 定义两段的分界。
5. **代价**：压缩低频 = 长距离分辨率下降，所以要有一个 `mscale` 把注意力温度调回来。
6. **两个 max 要分清**：`original_max_position_embeddings`（训练时）与 `max_position_embeddings`（外推后）。
7. **收尾**：外推不是把表拉长，是重新分配分辨率——换来长度，花掉的是远近的区分度。

> 数据锚点：`layers/rotary_embedding.py` L110–L200（`_yarn_find_correction_dim`、`_yarn_linear_ramp_mask`、`yarn_get_mscale`）；`hugging_face/config.py` L88–L96。

#### 29 · 只算该算的块（7 屏，3D）

1. **封面**：一整面墙的 KV 块，只有一小片亮着。
2. **全长注意力**：每个新 token 都要扫完整条历史。100 万 token 的历史，就是每步 100 万次比较。
3. **索引缓存**：每个块存一个"值不值得看"的分数，一个 uint8。块顶上一条细亮的分数条。
4. **两级筛**：`candidate_topk_blocks` 先粗筛候选，`topk_block_score_reduce="max"` 用块内最大值当块分，再取 top-k。
5. **压缩比**：index cache 每条记录是 `block_size // ratio`——压缩过的层，一个 block 只存 `block_size/ratio` 条。
6. **代价**：选错了就永远看不到。这是召回率与算力的直接交换。
7. **收尾**：稀疏不是免费的加速，是"承担看漏的风险换取速度"。

> 数据锚点：`cache_engine.py` L208（`ica_cache` 形状）；`hugging_face/config.py` candidate_topk_blocks / candidate_block_size / topk_block_score_reduce；`tilelang_ops/{candidate_blocks,swa_index,get_kv_index}.py`。

#### 30 · 一个 token 的字节账（7 屏）

1. **封面**：两行字，一行 288 字节，一行 528。
2. **三种 cache**：主 KV（`ca_cache`）、index KV（`ica_cache`，uint8）、SWA state（每层每 token 528 B = 512 B FP8 数据 + 16 B UE8M0 scale）。
3. **288 与 528**：per-16 FP4 时一个 token 是 256 B 数据 + 32 B scale = 288；MXFP8 时是 512 + 16 = 528。两条字节尺并排，差 240 B。
4. **不是每层都有自己的 cache**：若干层通过 mapped layer id 共用一份（`_get_kv_mapped_layer_id`）。
5. **对齐**：SWA 每层按 32 B 对齐；含 SWA 时整个 block 按 `lcm(32, 每 token 字节数)` 对齐——不为了好看，为了让 TMA / 拷贝一次拿整段。
6. **stored / dropped 分区**：要落盘的放低地址，不落盘的（YOCO consumer SWA、compression state）放高地址；落盘时按长度截断就自然排除 dropped，不用挑着写。
7. **收尾**：KV cache 不是"一块内存"，是一份有版式、有对齐要求、有截断规则的格式。

> 数据锚点：`worker/cache_engine.py` L205–L300（`KVCache` 注释、`StateBlock` docstring、`_align_to_multiple`）。

---

### 幕 C · 时延（31–33）· 主色 teal `#2dd4bf`

#### 31 · 一次发射，还是一百次发射（8 屏）

1. **封面**：同一份活，一张图上 300 个节点，另一张图上 3 个。
2. **发射有固定开销**：每个 kernel launch 都是几十微秒级的固定成本，而 decode 每步有几百个 kernel。
3. **CUDA Graph**：把整段前向录下来，之后一次 `replay()`。
4. **桶化**：不可能为每个 batch size 都录一遍。`build_graph_batch_sizes`：先 1,2,4…（到 interval），再按 interval 等距铺到 max，最后补 max。`DEEPINFER_CUDAGRAPH_BATCH_SIZE_INTERVAL` 默认 8。一把不等距的尺子。
5. **选桶**：`bisect_left` 向上取整到最近的已录桶——真实 batch 37 就跑 40 的图。
6. **代价一**：padding 出来的 3 行白算。**代价二**：`num_reqs` 必须记真实请求数（排除 padding），否则统计和 CP 广播全错。
7. **共享内存池**：所有图共用一个 `graph_memory_pool`，所以捕获要从大到小**反序**进行——先占大块，小块复用。
8. **收尾**：这是一笔"每次省几十微秒，换 3 行白算 + 一份启动时间"的买卖。

> 数据锚点：`worker/cuda_graph_runner.py` L41–L155；`environ.py` L155；`input_metadata/input_metadata.py` L53–L55（`num_reqs` 注释）。

#### 32 · 每批货先开一张装箱单（7 屏）

1. **封面**：一车形状不一的货，要先排成规整的一列才能上流水线。
2. **矛盾**：一批请求每条长度不同，但 kernel 要吃规整张量。`InputMetadata` 就是那张装箱单。
3. **字段语义**：`input_ids`（原始 varlen）、`positions`（**未压缩序列**里的位置）、`valid_token_mask`（false 是 padding）、`num_reqs`。
4. **CP-mirror**：上下文并行时 token 被重新分到各 rank。`mirror_cp_index` 是"怎么排"，`mirror_cp_reverse_index` 是"怎么还原"，`-1` 表示 padding。
5. **`compute_attn_info`**：把紧凑的 index 字段展开成 kernel 要的完整注意力索引，每次 forward 开头都要重算（包括从 cudagraph 复用之后）。
6. **`get_clean_list`**：复用 cudagraph 时，那些"forward 里会重算"的字段必须清成 None，否则拿到上一批的脏数据。
7. **收尾**：kernel 快不快，一半在算，一半在装箱单对不对。

> 数据锚点：`input_metadata/input_metadata.py` L28–L80；`input_metadata/prepare_tensor_input_zos.py`（382 行）。

#### 33 · 采样也是一个算子（6 屏）

1. **封面**：一条 20 万长的 logits，最后只吐出一个 id。
2. **朴素做法**：temperature、top-k、top-p、min-p、重复惩罚、log-softmax、采样——七步七个 kernel，每步都要把 20 万个数搬一遍显存。
3. **融合**：`fused_sample` 一次做完 temperature + top-p/top-k + log-softmax + 采样。七段流水线压成一段。
4. **种子命名空间**：`tag` 不是默认值就偏移种子——draft 和 target 必须用不同的随机流，否则验证会假通过。
5. **确定性**：只依赖 `(seq_seeds, sample_positions, is_nextn_predict)`，与批大小、行序无关（一句回扣 S2-23）。
6. **收尾**：采样只占一个 token 的时间，但它每步都跑——一个 kernel 的差别乘以步数，就是可感的差别。

> 数据锚点：`tilelang_ops/fused_sample.py` L22–L40；`layers/sampler.py`（683 行）；`tilelang_ops/random_sampling.py`。

---

### 幕 D · 密度（34–36）· 主色 indigo `#818cf8`

#### 34 · 一份代码，两颗芯片（7 屏）

1. **封面**：同一个形状，两种材质。
2. **目录对照**：`tilelang_ops/cuda/` 与 `tilelang_ops/asc/` 各 30 个文件，**27 个同名**——同一件事的两套实现。
3. **行数不对等**：cuda 侧 4968 行，asc 侧 7418 行，贵了约 1.5 倍。不是更啰嗦，是同样的数值要多做几步补偿。
4. **rstd_1ulp**：为了让两个平台算出同一位，asc 侧把一个 fp32 拆成 high + low 两个 fp32 相加，并保持 FP32/FMA 的运算顺序与训练侧的数值标准一致。一个数裂成两片。
5. **各多出三个**：cuda 独有 `outlier_detection.py`（量化前探最大绝对值，超了就 abort——否则整个 tile 溢出）、`quant.py`、`prepare_decode_metadata.py`；asc 独有 `kv_quant.py`、`rstd_1ulp.py`、`prepare_v4_decode_metadata.py`。差异本身就是"平台的脾气"。
6. **cudagraph 的平台差异**：GPU 有 `keep_graph=True` + `instantiate()`，NPU 只有 instantiate 之后的图。
7. **收尾**：跨平台不是编译一遍就完了，是每个平台都要有人重新对一遍数值。

> 数据锚点：`tilelang_ops/{cuda,asc}/` 目录清单；`asc/rstd_1ulp.py` L1–L25；`cuda/outlier_detection.py` L1–L20；`cuda_graph_runner.py` L121–L132；`README.md` L29–L41（支持 SM100 与 Ascend 950）。

#### 35 · 把进程钉在网卡旁边（7 屏，3D）

1. **封面**：一台机器，两个 CPU 插座、8 张卡、一张网卡——连错一条线，带宽掉一半。
2. **NUMA 的现实**：内存分属不同插座，跨插座访问延迟翻倍。
3. **卡也有"家"**：每张卡挂在一个 NUMA 节点上。
4. **网卡也有**：`/sys/class/infiniband/mlx5_0/device/numa_node`。
5. **做法**：`which_numa` 先查卡或网卡属于哪个节点，再 `numa_sched_setaffinity` 把 CPU 钉过去、`set_mempolicy(MPOL_BIND)` 把内存也钉过去。三个圈依次收紧。
6. **卡号不是物理号**：`CUDA_VISIBLE_DEVICES` 重排之后，第 3 号卡可能是第 7 张。`physical_device_id` 就是把逻辑序号换回物理序号——换错了，NUMA 就绑到别人的插座上。
7. **收尾**：这一屏没有算法，只有拓扑。但绑错了，前面十集全白讲。

> 数据锚点：`deep_cluster/topology/bind.py` L42–L93；`deep_cluster/hardware/device.py` L15–L60。

#### 36 · 一格能装多少（6 屏，3D）

1. **封面**：一排机柜，每个格子里装着看不见的 cache。
2. **state slot 数**：`get_num_state_slots = int(max_num_seqs × ratio) + 1`。
3. **一份 state block 的分区**：stored（要落盘的 SWA）在前，dropped（YOCO consumer SWA、compression state）在后——落盘时按长度截断就能排除 dropped。
4. **对齐的零头**：每层 SWA 按 32 B 对齐，含 SWA 时整块按 `lcm(32, 每 token 字节数)` 对齐。几 KB 的零头 × 层数 × 卡数。
5. **集群那一层**：3FS 每台存储服务器 20 × 30.73 TB SSD，读 ≥40 GB/s、写 5 GB/s，10+2 纠删码；折算到每张卡约 14.4 TB 逻辑容量。一个 scale-up 域 64 卡跑 decode、4 卡跑 prefill。
6. **收尾**：容量不是"买了多少硬盘"，是"对齐、分区、纠删码之后还能装多少"。四个数字并排，各自标上是谁定的——全季收口。

> 数据锚点：`worker/cache_engine.py` L177–L182、L210–L300；`inference_deployment_qa.md` §Cluster & storage；`README.md` L77–L84。

---

## 五、视觉与工程规范

沿用前两季骨架，**外壳继续用第二季那套按幕着色的变量**（`--acc / --acc2 / --accBg / --accBd / --accGl`），本季只换色值，不换结构：

| 幕 | 主色 | 变量值 |
| :--- | :--- | :--- |
| A · 分数 | rose | `#fb7185` |
| B · 长度 | blue | `#60a5fa` |
| C · 时延 | teal | `#2dd4bf` |
| D · 密度 | indigo | `#818cf8` |

这样三季的色板互不重叠（S1 五幕 cyan/purple/green/amber/pink，S2 四幕 amber/cyan/green/purple），全站 105 集里一眼能认出是哪一季。

其余沿用：

- 结构：`.screen` → `.scr-head`（`.step-badge` + `h2` + `.scr-desc`）/ `.stage` / `.scr-foot`。
- 入场：`.rv` + `.d1`–`.d7` 阶梯；右侧 `.dots` 由 `IntersectionObserver`（threshold 0.55）驱动。
- 每集 6–8 屏，一屏一个视觉 + 一句收束，关键数字每集 3–4 个。
- 动画只挂在 `.screen.active` 下，离屏不跑；`prefers-reduced-motion` 全部收成 `.001s`。
- 3D（29 / 35 / 36）用 `docs/vendor/three.global.js` 全局脚本，`MeshBasicMaterial` 平涂 + `EdgesGeometry`，按 `getBoundingClientRect` 可见性启停，无 WebGL 时降级为 CSS 光晕。**实例着色时基材质必须设 `0xffffff`**，否则 `setColorAt` 会被乘没（第二季 21 集踩过）。
- 命名：`inf-25-<slug>-animation.html` … `inf-36-<slug>-animation.html`。

slug 建议：

| 集 | slug | 集 | slug |
| :-- | :--- | :-- | :--- |
| 25 | `eval-bench` | 31 | `cuda-graph` |
| 26 | `pass-at-k` | 32 | `metadata-pack` |
| 27 | `judge-coverage` | 33 | `fused-sampler` |
| 28 | `yarn` | 34 | `two-platforms` |
| 29 | `sparse-blocks` | 35 | `numa-bind` |
| 30 | `cache-bytes` | 36 | `density` |

---

## 六、数据可信度标注

沿用 A/B/C 三级（同 S1/S2，屏上不标级别，用「实测」「约」「示意」措辞区分）：

| 级别 | 本季例子 |
| :--- | :--- |
| **A · 代码可验证** | 288 / 528 字节、`lcm(32, …)` 对齐、`cudagraph interval` 默认 8、`beta_fast=32`、Pass@k 公式、judge 的八条规则、`rstd_1ulp` 的拆分方法 |
| **B · 官方文字自述** | AIME/GPQA/HLE 的题数与 99.9 / 93.4 / 42.6、960 条 rollout 上两判分器 100% 一致、3FS 的 20 × 30.73 TB 与 14.4 TB/卡、64 卡 / 4 卡的实测配置 |
| **C · 演绎示意** | 29 集墙面上块的数量与亮度分布、31 集"几十微秒"的发射开销量级、36 集机柜的格子比例 |

---

## 七、交付节奏

**第一批（MVP，3 集）** —— 验证"从数字倒推"这个叙事能不能站住：✅ 已上线

1. `inf-25` 三个基准一台秤 —— 入口，必须最先有。
2. `inf-31` 一次发射还是一百次发射 —— 全季最"反直觉"的一集，动画最有记忆点。
3. `inf-30` 一个 token 的字节账 —— 数字最硬、视觉最干净（字节尺）。

**第二批（4 集）**：26 Pass@k、27 判分器、28 YaRN、29 稀疏选块。✅ 已上线（2026-10-27，总集数 108）
**第三批（5 集）**：32 装箱单、33 融合采样、34 双平台、35 NUMA、36 容量。✅ 全部上线（2026-10-27，总集数 113）——**第三季 12 集全部完结**

理由：先做"观众能立刻对上号"的（25/31）和"数字最硬"的（30），再做需要一点铺垫的（26/27/28/29），最后补物理层的（34/35/36）。

---

## 八、待确认的决策点

1. **集数 12 还是 10**：若想更快上线，可砍 32（装箱单，最技术向）与 33（融合采样，与 S2-23 略有邻近），留 10 集。我倾向保 12——32 是 31 的必要补充（padding 陷阱离开装箱单讲不清）。
2. **多模态是否加集**：`ve/` + `image_embed_ops.py` 共 1609 行完全没动，HLE 的 342 道图像题也需要它。可作为第 13 集（`inf-37-image-tokens`），或整集留给第四季。
3. **35 集的 3D 尺度**：2 插座 / 8 卡 / 1 网卡是真实机器的简化。要不要改成 2 插座 / 16 卡（更像 SM100 整机）？卡多了视觉更糊，卡少了不像真机。
4. **分数那一幕要不要放真实数字**：99.9 / 93.4 / 42.6 是官方 reference。放上去有说服力，但也就把"跑分"和"这个部署"绑定了。建议放，脚注写明是 reference 而非本机实测。

---

## 九、附录：素材索引

按集列出"打开哪个文件能看到什么"，写脚本时直接照着翻：

```
25   eval/README.md L11-L17          三基准的题数/采样数/Pass@1 口径
     eval/README.md L208-L221       reference 分数
     eval/aime/bench.py             prompt 构造与答案抽取
26   eval/common/passk.py L8-L51     estimator / pass_at_k_by_task / default_k_list
27   eval/common/judge.py L13-L58    ANSWER_EXACT_MATCH_PROMPT 八条
     eval/common/judge.py L58+       HLE_JUDGE_PROMPT
     eval/score.py L60-L70           HLE 拒绝 rule judge
     eval/score.py L130-L170         coverage_complete / truncated_rollouts
28   layers/rotary_embedding.py L110-L200
     hugging_face/config.py L88-L96  _rope_yarn_params
29   worker/cache_engine.py L208     ica_cache 形状
     v4_modules/index_attn.py        选块主体
     v4_modules/compress.py          compress_ratio
30   worker/cache_engine.py L205-L300  KVCache / StateBlock
31   worker/cuda_graph_runner.py L41-L155
     environ.py L155                 interval 默认 8
32   input_metadata/input_metadata.py L28-L80
     input_metadata/prepare_tensor_input_zos.py
33   tilelang_ops/fused_sample.py L22-L40
     layers/sampler.py
34   tilelang_ops/cuda/ vs asc/      30 对 30，27 同名；各多 3 个
     asc/rstd_1ulp.py L1-L25
     cuda/outlier_detection.py
35   deep_cluster/topology/bind.py
     deep_cluster/hardware/device.py
36   worker/cache_engine.py L177-L300
     doc/inference_deployment_qa.md §Cluster & storage
     README.md L77-L84
```

---

## 十、第一批实施记录（25 / 30 / 31 已交付）

### 四个决策点的结论

| 问题 | 结论 | 理由 |
| :--- | :--- | :--- |
| 12 集还是 10 集 | **12 集** | 32（装箱单）是 31 的前提，padding 陷阱离开装箱单讲不清 |
| 多模态是否加集 | **不加，留第四季** | 一季之内把 12 集做透，比 13 集摊薄更值 |
| 35 集的 3D 尺度 | **2 插座 / 8 卡 / 1 网卡** | 8 卡两插座就是真实整机（HGX 那一级），再多视觉就糊了 |
| 分数放不放真实值 | **放** | 脚注已标 reference，不是本机实测 |

### 交付物

3 个单文件动画，共 **21 屏**，已在 `docs/index.html` 注册为独立系列「推理原理 · 第三季」（索引 93 → 96 集）。

| 集 | 文件 | 幕 | 屏 | 交互 / 3D |
| :-- | :--- | :-: | --: | :-- |
| 25 | `inf-25-eval-bench-animation.html` | A | 7 | 960 点阵 |
| 30 | `inf-30-cache-bytes-animation.html` | B | 7 | 32 B 网格叠加 |
| 31 | `inf-31-cuda-graph-animation.html` | C | 7 | **滑杆选桶**（1–64 实时算白算比例） |

### 与第二季的工程改动

1. **外壳加了 `--accSoft`**（34% 实色），专门替代第二季误用 `--accBg`（8% 透明）做渐变色的地方 —— 那个 bug 在第二季 13 集让标尺几乎看不见，这次从变量层面堵掉。
2. **幕内所有屏统一用本幕主色做光晕**，不再逐屏换色。第二季的 `.s2–.s9` 各自换色，到第三季改为全幕一致，四幕之间才有"章节感"。
3. **新增通用组件**：`.flow`（横向流程）、`.axis`（带参考线的概率轴）、`.split`（两段堆叠条）、`.tbl`（四列表）、`.bytebar` / `.grid32`（字节尺与 32B 网格）、`.runs`（逐块点亮）、`.slider`（滑杆）。下一批直接复用。

### 视觉上返工的三处

1. **25 集封面数字重复**（副标题与大号数字都写了 99.9 / 93.4 / 42.6），删掉副标题里那行。
2. **25 集"跑次块"全糊成一片**：块用了 `--accSoft`，32 个一模一样的浅色方块看不出"32 次"。改成实色主色 + 逐块 `animation-delay`。
3. **30 集"共用"屏原本是 SVG 连线图**，在 390px 手机上 10px 字号缩到 6.5px，读不了。改成纯 CSS 的"芯片行 + 三张卡"，手机上自然换成两行，全宽可读。
4. **31 集尺子右端 "64" 标签被右侧导航点压住**，去掉端点标签（1/16/32 足够定位）。

### 校验方式

- Playwright（Edge headless）三集 × 7 屏逐屏滚动：**零 pageerror、零 console error**。
- 滑杆逻辑逐值验证：`9 → 桶 16（白算 43.8%）`、`37 → 桶 40（白算 7.5%）`、`8/64 → 0%`，与 `bisect_left` 手算一致。
- 桌面 900×1000 与手机 390×844 两档截图复核；水平溢出与已上线的 24 集同源（`.screen::before{inset:-20%}` 造成的 scrollWidth 虚高，非新增问题）。

### 剩余九集

26 / 27 / 28 / 29 / 32 / 33 / 34 / 35 / 36，按第七节第二批、第三批推进。
