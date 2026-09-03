> **代码对照 2026-09-03（main）** — Auth/Chat 子模块部分完成；Logs 未完成
> **仍开着的原因：** 子 Issue #58/#60/#37 仍 OPEN。
> **证据：** #56/#57/#59/#61 API 层已在 main。

---

关联长期 Epic：#1 / #32
消费者：`Acongm/auth` / `Acongm/chat` / `Acongm/portal`

## 最终目标
`node-vercel-starter` 不以“通过一次迁移/验收”为最终目标，而是沉淀成可复用的 API 基座，首要标准化三个通用模块：

1. **#56 Auth/User**：登录态、用户信息、Profile/Settings、session/refresh/logout 语义标准化；
2. **#57 Chat**：低延迟发送、匿名/登录历史、会话分页/缓存、stream/run/idempotency 标准化；
3. **#58 Logs**：结构化日志、request/trace id、错误/性能日志以及可查询能力标准化。

要求优先参考成熟开源实现与框架能力，不继续为通用场景自建私有协议。

## 参考基线
- Supabase Auth Sessions / SignOut / getClaims：由 Supabase 管理 identity/session；非敏感普通 API 应尽量使用 JWT 自包含能力，避免无意义中心 Auth round-trip。
- Vercel `vercel/chatbot`：认证、持久化 Chat History、AI SDK/shadcn 的成熟 Chat 应用结构。
- `assistant-ui/assistant-ui`：thread/runtime/streaming/message part/action 的 Chat UI/runtime contract。
- NestJS Logger + Pino：结构化 JSON logging；后续可接 OpenTelemetry trace/metrics。

## 子目标
- [ ] #56 Auth/User 标准模块
- [ ] #57 Chat 标准模块
- [ ] #58 Logs 标准模块
- [ ] 三模块目录、DTO/error contract、repository/service/controller 分层一致
- [ ] 通用能力有单测/集成测试，不以 coverage 数字替代功能用例
- [ ] Portal/Auth/Chat 消费同一 contract，禁止重新复制业务逻辑

## 当前实现队列
### P0 — 先解决真实架构/性能问题
1. **#59 Auth + Chat send critical path**：复用已验证 principal；消除一次请求重复 Supabase Auth verification；压缩首 token 前路径。
2. **`Acongm/auth#51` Auth Client 收口**：统一 session/anonymous/logout state machine，消除跨仓复制漂移。
3. **`Acongm/chat#40` Non-blocking Chat bootstrap/history**：shell/composer 不再被 auth/full-history 阻塞，history 首屏 + lazy pagination。
4. **#60 Logs runtime 重构**：Pino/requestId/trace/redaction，并把 operational logs 与 Chat transcript/audit 分离。

### P1 — 建立标准用户配置
5. **#61 User Settings API**：defaults/overrides/default model/default prompt/cache/RLS。
6. Auth/Chat/Portal 消费 #61；Shared UI 使用 `Acongm/shadcn-ui#15` 覆盖 loading/error/user menu/settings。

## 模块化要求
每个模块统一至少包含：
- controller / DTO / service / repository(adapter)
- stable error code
- configuration/env contract
- cache/session strategy（适用时）
- logging/telemetry hooks
- unit + integration + contract tests
- README/API examples

## 非目标
- 不自建 Supabase 已经提供的 OAuth/password/session provider
- 不新增 private Chat SSE/event 协议
- 不把所有日志无脑写数据库
- 不因单一 Consumer 需求污染通用模块 API

## DoD
最终能够把 Auth / Chat / Logs 作为三个相对独立、文档清晰、测试完整的通用模块用于当前多个 `.acongm.com` 项目，并且常见场景不需要每个前端仓库重新实现一遍。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
