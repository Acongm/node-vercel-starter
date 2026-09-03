> **代码对照 2026-09-03（main）** — 1.0–1.3 已关；Epic 等 #37/#35
> **仍开着的原因：** #37 Final Quality Gate 与 #35 Legacy Cleanup 仍 OPEN。
> **证据：** GitHub：#42 #33 #34 #43 CLOSED。

---

平台总控：`Acongm/portal#1`
平台 Stage 1：`Acongm/portal#117`

## 目标
身份交给 Supabase Auth，User/Chat 权限交给 RLS；NestJS 保留业务 authorization、AI/context/KB/web-search/rate-limit/telemetry。Chat 使用可扩展 message parts + durable run semantics + 标准 stream contract，停止维护第二套 identity provider 与私有 Thread/SSE 基础设施。

## 已完成基础 — PR #31（2026-08-08 已合入）
- [x] server-side Supabase access-token verification
- [x] `SupabaseAuthGuard`
- [x] request-scoped/user-scoped Supabase client，让 RLS 成为最终权限边界
- [x] `GET /api/user/me`
- [x] `PATCH /api/user/profile`
- [x] 新 `/api/chats` 模块并行 legacy threads
- [x] 专用 Chat repository
- [x] `profiles/chats/messages` schema
- [x] `parts jsonb`
- [x] authenticated ownership RLS
- [x] FK cascade
- [x] additive migration，保留 legacy 表/接口兼容

## Stage 1 现在严格按 6 步执行

### 1.0 — #42 Contract Baseline（当前 API 优化先做）
当前 PR：#39

先从真实 `Acongm/chat` / assistant-ui 行为反推契约：
- capability matrix：durable-supported / local-only / disabled / planned
- failure matrix
- state-machine negative tests
- controller SSE contract
- User/profile contract
- coverage 只作为回归指标，不当功能完整度

**目的：先发现缺功能，再写实现，避免快乐覆盖。**

### 1.1 — #33 Auth/User Durable Contract
- Supabase principal 唯一身份源
- `/api/user/me` 稳定 contract
- profile partial PATCH / null/clear semantics
- anonymous identity / upgrade
- real DB 验证 profile patch，不只 mock

### 1.2 — #34 Chat v2 Durable Core
- stable message id + `clientMessageId`
- `runId` + explicit running/complete/cancelled/error/incomplete
- Reload/Regenerate 幂等，不重复 user turn
- cancel/provider/persistence failure durable semantics
- parts + standard stream
- stable chat/history cursor pagination
- auxiliary touch/title/telemetry 不破坏 durable success
- Edit/Branch/Resume 若本阶段不实现，必须 capability=false

### 1.3 — #43 Consumer Migration
真实消费者切换：
- portal/chat/auth-client 使用 Supabase access token
- `/api/user/*` + `/api/chats*`
- assistant-ui adapter
- capability gating
- server persisted history 单一真相
- 新/旧 endpoint 流量可观察

### 1.4 — #37 Final Quality Gate
在真实 consumer 已切换后验证：
- real Supabase RLS multi-user/anonymous isolation
- consumer E2E
- retry/cancel/failure/pagination
- error contract
- mutation testing
- performance/index
- production smoke

### 1.5 — #35 Legacy Cleanup
只在 #37 通过后：
- legacy adapter observation
- identity/chat backfill + semantic preservation
- reasoning/source 正确迁为 parts
- legacy 调用归零
- backup/rollback gate
- 删除 custom OAuth/JWT/auth_users/old threads/SSE

## 为什么调整顺序
旧顺序 `#33 → #34 → #37 → #35` 有两个问题：

1. #37 同时承担“发现功能缺口”和“最终验收”，太晚；PR #39 已经证明应该先做 contract audit。
2. #35 同时包含 client switch 和 destructive cleanup，导致 #37 无法基于真实新 consumer path 做最终 E2E。

新顺序把 **contract discovery → implementation → real consumer → final gate → cleanup** 分离。

## Long-term Boundaries
### Auth
- Supabase Auth：email/password、OAuth、anonymous、session、refresh、password reset
- NestJS：verify principal、role/business authorization
- `profiles`：application profile

### Chat
- Chat service：conversation/run orchestration
- repository：ownership/persistence/query
- explicit run/idempotency domain
- AI adapter：provider/model
- KB/context/Tavily：业务能力
- telemetry：usage/trace/error，与 transcript 分离

## 禁止继续新增
- custom password hash
- custom OAuth state/callback/exchange
- project-issued 普通用户 JWT
- `x-client-id` 作为最终 ownership
- legacy SSE 新事件类型
- Chat production `list all → JS filter`
- 生产 UI 暴露 backend 不支持的 durable capability

## Definition of Done
- [x] #42 closed
- [x] #33 closed
- [x] #34 closed
- [x] #43 closed
- [ ] #37 closed
- [ ] #35 closed
- [ ] 普通用户身份只有 Supabase Auth 一套
- [ ] 生产 UI capability 与 durable API capability 一致
- [ ] User/Chat real RLS security E2E 全绿
- [x] portal/chat 主路径已使用新 User/Chat contract（legacy threads BFF 仍在 chat）
- [ ] legacy identity/thread/SSE production implementation 删除
- [ ] migration/rollback/env/architecture 文档完整

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
