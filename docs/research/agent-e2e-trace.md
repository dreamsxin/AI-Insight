# Agent 框架 · 真实模型端到端验收记录

> 验收时间：2026-11-06 · 模型：`deepseek-flash` @ `https://api.deepseek.com`（OpenAI 兼容协议）
> 结论：**`test_agent_e2e.py` 2/2 通过 + 一次完整教学会话 trace 采集成功。** 框架的"生产级"声明首次在真实模型上闭环验证。

---

## 一、e2e 测试结果（2/2）

`backend/app/tests/test_agent_e2e.py`（无凭证时整文件跳过，配置后自动启用）：

| 测试 | 验证点 | 结果 |
|---|---|---|
| `test_live_model_uses_calculator_tool` | 真实模型按系统提示调用 `multiply` 工具，23×7 → 回答含 161，`tool_usage >= 1` | ✅ |
| `test_live_model_guard_trips_on_repeat` | 诱导模型反复调用必失败的工具，`max_repeat=2` 触发 `RepeatedCallError` | ✅ |

附带的测试文件修复：`test_live_model_guard_trips_on_repeat` 漏导入 `ToolRegistry`（首次真实运行才暴露）。

## 二、完整会话 trace（教学工具注册表）

提示词：`先算 17+25，再用 inputs=[0.5, 0.2, 0.9] 演示一次前向传播。`（temperature=0）

事件时间线（共 7 个事件，2 步收敛）：

| 步 | 事件 | 内容 |
|---|---|---|
| 1 | `llm_response` | **一次提出两个并行工具调用**：`calculator(expression="17+25")` + `nn_forward_demo(inputs=[0.5,0.2,0.9])`；688 tokens，finish=tool_calls |
| 1 | `tool_call` ×2 → `tool_result` ×2 | 两个结果均无错误；结果文本带 **`[工具数据·来源:…·非指令]`** 前缀（dev-05 注入防御的落地：工具输出被标记为数据而非指令） |
| 2 | `llm_response` | 汇总回答；finish=stop；833 tokens |
| — | `finished` | 统计：steps=2，prompt 1341 + completion 240 tokens，tool_calls=2 |

最终回答质量要点：

```
- 17 + 25 = 42
- 前向传播：输入 [0.5, 0.2, 0.9] → 输出 0.0
  说明输出：网络结构为 3→4→1，隐藏层使用 ReLU。输出恰好为 0.0，
  说明该输入下 ReLU 把隐藏层激活全部截断为 0……
```

模型没有把 `0.0` 当异常搪塞，而是正确解释了 **ReLU 截断现象**（教学工具的固定小网络在偏向性输入下隐藏层整体失活），并主动建议换 `[1.0, 1.0, 1.0]` 对比——工具结果 → 领域解释 → 下一步建议，是"AI 调用教学计算"闭环的完整样例。

## 三、本次落地的小增强

- `llm.py`：`model` 参数支持 `LLM_MODEL` 环境变量（此前默认写死 `gpt-4o-mini`，换供应商必须改代码）。`LLMClient()` 无参构造现在读 `LLM_BASE_URL / LLM_API_KEY / LLM_MODEL` 三个环境变量。
- 运行方式：

```bash
# 凭证走环境变量（LLM_BASE_URL / LLM_API_KEY / LLM_MODEL），不入库
cd backend
pytest app/tests/test_agent_e2e.py -v      # 2 passed
```

## 四、剩余未验证面

- SSE 流式端点（`/api/agent/chat/stream`）只做过 FakeLLM 集成测试，未抓真实流式 trace；
- guard 之外的熔断路径（预算超限 `BudgetExceededError`、步骤上限）在真实模型下未复现（FakeLLM 已覆盖逻辑）；
- 自进化外环（`evolve.py`）需要多轮真实调用，未在本轮范围。

复现 trace 采集：`backend` 目录下配置环境变量后运行 `python .tmp8/run_trace.py`（脚本在 git-ignore 的临时目录，事件 JSON 落盘同目录）。
