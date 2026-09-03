> **代码对照 2026-09-03（main）** — 主路径已落地，性能调参未关
> **仍开着的原因：** `CHAT_MODEL_CONTEXT_LIMIT` 仍为 500；无 `verifyAccessToken` 只调用一次的集成测试；无 Pino 查询 runbook。
> **证据：** `AiV1Service.enforceRateLimit(req, principal)`；`chat.first_token`；`test/chat.send-critical-path.spec.ts`；JWKS verify。

---

父目标：#55 / #56 / #57
消费者：`Acongm/chat` / `Acongm/portal`

## 现状审计（main）
当前 `/api/chats/:id/messages/stream` 已由 `SupabaseAuthGuard` 校验 bearer token 并写入 `request.auth`；但 `ChatService.streamMessage()` 随后调用 `AiV1Service.enforceRateLimit(request)`，后者又通过 `JwtAuthService.resolvePrincipal()` 重新解析 bearer，最终再次调用 Supabase Auth 校验。

这意味着新 Chat v2 正常发送路径存在 **同一请求重复 identity verification** 的风险，并把不必要的 Auth 网络开销放在模型 stream 之前。

同时当前 pre-stream critical path 还串行包含：
`rateLimit → get chat → listRecentMessages(<=500) → parent resolve → persist user → create run → touch → provider stream`。

## 目标
把 Chat send 前置路径压缩到真正必要步骤；一次 HTTP request 只解析/验证一次 principal，并建立可测的 first-token latency contract。

## 1. Principal 单次解析
- [x] `SupabaseAuthGuard` 成功后，业务层直接消费 `request.auth`
- [x] `AiV1Service.enforceRateLimit` 接受已验证 `AuthPrincipal`，Chat v2 不再次 resolve
- [x] controller/guard/service 之间 principal contract 单一
- [x] legacy `/api/ai/v1/*` 仍自行 resolve，不污染 `/api/chats*`
- [ ] 单测断言一次 Chat v2 send 中 Supabase verifier 只调用一次

## 2. JWT verification 策略
按 Supabase 当前官方能力评估：
- [ ] 项目如使用 asymmetric signing key，优先验证 `auth.getClaims(token)` / JWKS cached verification，避免每请求 `getUser()` 访问 Auth server
- [ ] 若仍使用 HS256/shared-secret legacy signing，则明确 remote verification 的性能边界与迁移计划，不自行不安全验证共享 secret
- [ ] principal/JWKS cache 不得超过 token `exp`；key rotation 有明确失效策略
- [ ] sensitive action 若要求 logout 后立即撤销，可单独校验 `session_id`，不能把昂贵 session DB check 加到所有普通 Chat 请求

参考：
- https://supabase.com/docs/reference/javascript/auth-getclaims
- https://supabase.com/docs/guides/auth/jwts
- https://supabase.com/docs/guides/auth/sessions

## 3. Send critical path
- [ ] 测量并记录阶段耗时：auth / chat lookup / history projection / user persist / run create / provider first token
- [x] `title/touch/telemetry` 等非首包必要工作不得阻塞 provider stream
- [ ] review `listRecentMessages(..., 500)`：只读取实际 model context 所需 bounded branch/context，避免固定 500 成为默认发送成本
- [ ] parent lookup 与 recent-history projection 避免可消除的重复 DB round trip
- [ ] 不因 sidebar/list/profile/settings 请求影响 send API

## 4. 性能契约测试
测试不要只看 coverage：
- [x] verified principal exactly once（单测：`enforceRateLimit` 带 principal 只调一次；无 verifier 集成计数）
- [x] anonymous send（合同/单测）
- [x] authenticated send（合同/单测）
- [ ] 50/500 message history 下 DB query 次数/读取上限稳定
- [x] auxiliary title/touch/telemetry slow/failure 不影响 first token
- [x] provider first-token timing hook 已打 `chat.first_token`（Pino/#58 查询未完成）

## DoD
`/api/chats/:id/messages/stream` 的身份校验只发生一次；send 前置步骤有明确 bounded query/耗时；首 token latency 可以从自动化测试与 production structured logs 中持续观测。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
