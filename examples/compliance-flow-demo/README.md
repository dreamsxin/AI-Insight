# compliance-flow-demo · 高风险对外生成任务的闸门设计

与 `../agent-harness-demo/` 互补：那边 9 个脚本讲**单个 Agent 怎么跑得稳**
（工具循环、护栏、错误回填、轨迹检查点、自进化），这边 4 个脚本讲
**一圈 Agent 怎么分工守门**——当生成物会离开系统（对外提交、正式文稿），
错误不可逆时，靠什么把"生成"关进闸门。

模式全文见 `docs/research/agent-compliance-patterns-research.md`（M1–M8）。

**零 LLM 依赖**：所有"Agent 步骤"都是确定性函数——这组模式的价值在
流程控制（状态机、闸门、计数、快照），不在生成。

## 运行

```bash
# 逐个看演示输出（在 examples/compliance-flow-demo/ 下）
python 01_triage.py
python 02_evidence_gate.py
python 03_position_draft.py
python 04_rejection_loop.py

# 跑规则测试（在 backend/ 下，pytest.ini 已收录本目录）
pytest
```

## 脚本 ↔ 模式对照

| 脚本 | 演示的模式 | 一句话 |
|---|---|---|
| `01_triage.py` | M1 流水线分工 · M2 正交维度 | 分流只给带依据的候选，证据不足建"待识别"不硬猜；四个维度字段互相正交，组合态不需要特殊分支 |
| `02_evidence_gate.py` | M4 证据链 · M5 必需 vs 建议 | 五环链（主张→材料→可核内容→来源→支持范围）逐环点名缺口；必需项缺链即阻塞，建议项未纳入只提醒；必需项不可用"本轮不处理"豁免 |
| `03_position_draft.py` | M3 事实状态机 | 待核/已核/来源冲突三态；冲突即暂停对外生成；未核事实写占位符不自动补；输入一变草稿即失效 |
| `04_rejection_loop.py` | M7 护栏四态 · M8 升级循环 | 阻塞/提醒/不适用/本轮不处理四态+理由强制；关键门槛总检独立校验；同类拒绝 2 次记变化、3 次升级；轮次快照 append-only |

## 设计约定

- **屏上场景均为虚构示意**，不指向任何真实平台规则；
- `Case.stance` 等立场字段只能由调用方（模拟"用户"）设置，规则函数
  永远不从输入文本推导立场——这是 M2"标签不是路线"的代码化；
- `EXEMPTABLE` 白名单之外的检查项标豁免会直接抛 `ValueError`——
  能豁免什么写进代码，不靠自觉。
