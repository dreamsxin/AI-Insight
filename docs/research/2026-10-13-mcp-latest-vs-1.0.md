# MCP 协议：最新版（2026-07-28）vs 1.0（2024-11-05）对比分析

> 调研日期：2026-10-13 · 所有变更条目取自官方 changelog（含 PR/SEP 链接，可溯源）· 调研方式：官方站点实时抓取

## 一、版本时间线

| 规范版本 | 状态 | 一句话定位 |
| --- | --- | --- |
| 2024-11-05 | Final（1.0 初版） | 有状态连接 + 双 transport 的起点 |
| 2025-03-26 | Final | 授权框架 + Streamable HTTP |
| 2025-06-18 | Final | 结构化输出 + elicitation + OAuth 资源服务器化 |
| 2025-11-25 | Final | 「One Year of MCP」周年版：icons/枚举 elicitation/实验性 tasks |
| **2026-07-28** | **Current（latest）** | **无状态化大重构 —— 握手式协议的终结** |

- 版本号 `YYYY-MM-DD`，仅不兼容变更时递增；修订分 Draft / Current / Final 三态。
- 本版起新增**功能生命周期与弃用政策**：弃用功能保留 ≥12 个月（紧急 90 天），设弃用注册表（[deprecated](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)）。

## 二、1.0（2024-11-05）的原始形态

来源：[2024-11-05 spec](https://modelcontextprotocol.io/specification/2024-11-05)（initialize 握手细节为公认稳定内容）

- **有状态连接**：`initialize` 握手 + 客户端/服务器能力协商（灵感来自 LSP 的 Host/Client/Server 三角色）。
- **两种 transport**：`stdio`（子进程 stdin/stdout 按行分隔）；`HTTP+SSE`（双端点：SSE 长连接收 + POST 发，连接时下发 endpoint 事件，要求 DNS rebinding 防护）。
- **服务器三类能力**：Resources / Prompts / Tools；客户端能力仅 Sampling（服务端发起的 LLM 递归调用）。
- 附带功能：Configuration、Progress、Cancellation、Error reporting、Logging。
- 安全四原则（用户同意、隐私、工具安全、Sampling 控制）自初版即有。

## 三、逐版变更（2024-11-05 → 2026-07-28）

### 2025-03-26：授权 + 新传输

来源：[changelog](https://modelcontextprotocol.io/specification/2025-03-26/changelog)

1. 基于 **OAuth 2.1** 的完整授权框架（PR #133）
2. **Streamable HTTP 取代 HTTP+SSE**（PR #206）
3. 新增 JSON-RPC batching（PR #228，*后被下一版移除*）
4. 工具 **annotations**（readOnly/destructive 等行为提示，PR #185）
5. 其他：ProgressNotification 加 `message`、audio content、completions capability

### 2025-06-18：结构化与安全收紧

来源：[changelog](https://modelcontextprotocol.io/specification/2025-06-18/changelog)

1. **移除 JSON-RPC batching**（PR #416，短命特性）
2. **结构化工具输出**：`outputSchema` / `structuredContent`（PR #371）
3. MCP 服务器归类为 **OAuth Resource Server**，引入 Protected Resource Metadata（PR #338）；客户端必须实现 RFC 8707 Resource Indicators（PR #734）
4. 新增**安全最佳实践**页
5. **elicitation**：服务端向用户追问（PR #382）
6. 工具结果支持 **resource links**（PR #603）
7. HTTP 请求必须带 `MCP-Protocol-Version` 头（PR #548）；Lifecycle SHOULD 升级为 MUST
8. 其他：`_meta` 扩展位、Completion context、`title` 字段

### 2025-11-25：周年版「One Year of MCP」

来源：[changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog)

1. 授权服务器发现支持 **OIDC Discovery**（PR #797）；OAuth Client ID Metadata Documents 成为推荐注册方式（SEP-991）
2. tools/resources/prompts 支持 **icons**（SEP-973）
3. 经 `WWW-Authenticate` 增量授权 scope（SEP-835）
4. 工具命名指南（SEP-986）；**ElicitResult/EnumSchema 标准化**（单选/多选枚举，SEP-1330）；**URL mode elicitation**（SEP-1036）
5. **sampling 支持 tools/toolChoice**（SEP-1577）
6. **实验性 tasks**：异步长任务，轮询 + 延迟取结果（SEP-1686）
7. 次要：JSON Schema 2020-12 定为默认方言（SEP-1613）、治理结构正式化（SEP-932）、SDK 分级（SEP-1730）、PRM 对齐 RFC 9728 等
8. 注：社区讨论的 "tool search" 未进本版 changelog（以扩展/SEP 形式讨论）

### 2026-07-28：无状态化大重构（与 1.0 差异最大的部分）

来源：[changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

1. **移除协议级会话**与 `Mcp-Session-Id` 头；列表端点不再随连接变化（SEP-2567）
2. **移除 initialize/initialized 握手**：每个请求在 `_meta` 自带 `io.modelcontextprotocol/protocolVersion`、`clientCapabilities`、`clientInfo`；版本不匹配返回 `UnsupportedProtocolVersionError`（SEP-2575）
3. 新增 **`server/discover`**（服务器必须实现）：一次性返回版本/能力/身份（SEP-2575）
4. `subscriptions/listen` 取代 GET 端点与 `resources/subscribe`
5. **移除 ping、logging/setLevel、roots list_changed**（日志级别改由 `_meta` 的 logLevel 按请求指定）
6. **tasks 移出核心协议**，改为官方扩展 `io.modelcontextprotocol/tasks`；`tasks/result` 改为轮询 `tasks/get`，新增 `tasks/update`（SEP-2663）
7. **MRTR 多轮请求模式**取代服务端主动请求（roots/sampling/elicitation）：服务器返回 `InputRequiredResult`，客户端重试原请求并附答案（SEP-2322）
8. 所有结果必带 `resultType`；**移除 SSE 断线续传 / Last-Event-ID**
9. 次要：capabilities 增加 `extensions` 字段、OTel trace 约定、`Mcp-Method`/`Mcp-Name` 必选头（SEP-2243）、列表结果必带 `ttlMs`/`cacheScope` 缓存提示（SEP-2549）、inputSchema 放开为任意 JSON Schema 2020-12 关键字、错误码分配策略
10. 弃用：Roots/Sampling/Logging（SEP-2577）、HTTP+SSE、DCR（转向 CIMD）

## 四、最新版 vs 1.0：七个维度的核心差异

| 维度 | 1.0（2024-11-05） | 最新（2026-07-28） |
| --- | --- | --- |
| **连接模型** | 有状态：initialize 握手 + 会话 + 能力协商，一次定终身 | **无状态**：每个请求 `_meta` 自带版本/能力/身份，协商随请求走 |
| **发现机制** | initialize 握手交换 capabilities | `server/discover` 一次性拉取版本/能力/身份 |
| **Transport** | stdio + HTTP+SSE（双端点长连接） | stdio + **Streamable HTTP**；HTTP+SSE 弃用；无 SSE 断线续传 |
| **服务端→客户端请求** | 服务端可直接发起 sampling/roots/elicitation | **MRTR 模式**：服务端返回 `InputRequiredResult`，客户端重试原请求并附答案（服务端不再「反向调用」） |
| **安全/授权** | 无协议级授权（部署自定义） | OAuth 2.1 → Resource Server 分离 → PRM/OIDC/CIMD 一整条授权栈 + 安全最佳实践页 |
| **工具输出** | 纯文本 content | **structuredContent + outputSchema**（机器可读），resource links，校验错误按 Tool Execution Error 返回 |
| **长任务/扩展** | 无 | tasks（扩展 `io.modelcontextprotocol/tasks`）+ capabilities.extensions + 弃用注册表 |

**一句话总结**：1.0 是「一对长连接里谈好一切」的会话式协议；最新版把 MCP 改造成**「每个请求自描述、无状态、可缓存可路由」**的 Web 式协议——官方维护者 David Soria Parra 的原话：「MCP 正从双向有状态协议转变为请求/响应式无状态协议」，并称 2026-07-28 是「远程 MCP 上线一年来最重要的一次发布」。驱动因素是生产团队的真实需求：Cloudflare 视角是「无状态、可缓存、可路由、全球可扩展——像 Web 其他部分一样」。采用规模：Tier 1 SDK 月下载近 5 亿次，TS/Python 各破 10 亿。

## 五、对本仓库演示系列的影响

- **hermes-03「MCP 自动引导」**（initialize 握手带回 instructions → 拼进 system）描述的是 **1.0～2025-11-25 的行为**，在 2026-07-28 下已改为 `server/discover` + 逐请求协商——动画原理层面（服务器把能力/说明交给客户端、客户端拼进上下文）仍然成立，但「握手」细节需要加一条版本备注，或补一期「MCP 协议五年演进」。
- **hermes-13「上下文组装」** 的静态层/动态层缓存逻辑与 1.0 有状态会话强相关；2026-07-28 无状态化后，缓存改为依赖 `ttlMs`/`cacheScope` 列表缓存提示——口径需局部更新。
- dev 系列（dev-01 工具 schema、dev-04 评估）不受影响；`outputSchema/structuredContent`（2025-06-18 引入）与 dev-01 的「schema 校验」互相印证。

## 六、主要来源

- 版本时间线与当前 latest：https://modelcontextprotocol.io/specification/versioning
- 各版 changelog：https://modelcontextprotocol.io/specification/{2025-03-26,2025-06-18,2025-11-25,2026-07-28}/changelog
- 1.0 原始形态：https://modelcontextprotocol.io/specification/2024-11-05
- 官方发布文（2026-07-28）：https://blog.modelcontextprotocol.io/posts/2026-07-28/
- 路线图：https://blog.modelcontextprotocol.io/posts/mcp-roadmap/
- 唯一「公认稳定内容」条目：1.0 initialize 握手细节（对应 spec 页抓取受限）
