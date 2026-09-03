> **代码对照 2026-09-03（main）** — 1.3 代码完成
> **仍开着的原因：** 1.4 #37、1.5 #35 未关。
> **证据：** Portal/Chat/Auth 已切 `/api/user` + `/api/chats`；#43 CLOSED。

---

关联总控：#1
后端主 Epic：`Acongm/node-vercel-starter#32`
依赖：#116 完成稳定基线。

## 核心原则
Stage 1 不再采用“先把接口写完 → coverage 拉高 → 最后才看前端到底需要什么”的顺序。

改为：

`真实 UI 行为 → contract baseline → durable backend → real consumer migration → real DB/E2E/mutation gate → legacy cleanup`

目标仍是：

`Supabase Auth → Bearer token → NestJS principal → user-scoped Supabase client → RLS → chats/messages(parts + durable run)`

## 严格执行顺序

### 1.0 Contract Baseline
`Acongm/node-vercel-starter#42`，当前 PR #39

- [ ] 从 chat/assistant-ui 真实 UI 反推 capability matrix
- [ ] failure/state-machine contract
- [ ] coverage 只作为 regression guard
- [ ] UI 可见但不 durable 的能力必须进入实现任务或显式 disabled

### 1.1 Auth/User Durable Contract
`Acongm/node-vercel-starter#33`

- [ ] Supabase principal 唯一 identity
- [ ] `/api/user/me`
- [ ] profile partial PATCH / clear semantics
- [ ] real DB 验证，不只 mock
- [ ] Supabase anonymous identity
- [ ] `Acongm/auth#28` 同步联调

### 1.2 Chat Durable Core
`Acongm/node-vercel-starter#34`

- [ ] clientMessageId / idempotency
- [ ] runId / running-complete-cancelled-error-incomplete
- [ ] Reload/Regenerate 不重复 user turn
- [ ] Cancel/provider/persist failure durable semantics
- [ ] message parts + standard stream
- [ ] stable cursor pagination
- [ ] touch/title/telemetry 等辅助失败不破坏 durable success
- [ ] Edit/Branch/Resume 若不实现则 capability=false

### 1.3 Real Consumer Migration
`Acongm/node-vercel-starter#43`

- [ ] portal/chat/auth-client 使用 Supabase access token
- [ ] client 从 `/api/chat/threads*` 切 `/api/chats*`
- [ ] server persisted history 是唯一 truth
- [ ] portal embedded chat 与 chat.acongm.com 共用 adapter
- [ ] assistant-ui capability gating
- [ ] legacy/new endpoint 流量可观察

### 1.4 Final Quality Gate
`Acongm/node-vercel-starter#37`

- [ ] real Supabase RLS multi-user/anonymous integration
- [ ] real consumer E2E
- [ ] retry/idempotency/cancel/failure/pagination
- [ ] stable error contract
- [ ] mutation testing
- [ ] performance/index
- [ ] production smoke

### 1.5 Legacy Cleanup
`Acongm/node-vercel-starter#35`

- [ ] legacy adapter 无独立业务逻辑
- [ ] identity/chat backfill
- [ ] legacy reasoning/source 正确迁为 parts，避免历史功能丢失
- [ ] unmapped/orphan 数据 report
- [ ] observation window 后 legacy 调用归零
- [ ] backup/rollback 后删除 custom OAuth/JWT/auth_users/threads/SSE

## Capability 完整性规则
任何生产 UI 功能在 Stage 1 结束时只能是：

1. **durable-supported + contract/E2E tested**；或
2. **disabled + linked future Issue**。

不能出现第三种：“按钮存在，LocalRuntime 看起来能用，但刷新/重试/跨设备后数据语义不成立”。

当前尤其关注：
- Reload/Regenerate
- Edit/Branch
- Stop/Cancel
- resume/reconnect
- history update/delete
- pagination

## Definition of Done
- [ ] API #42/#33/#34/#43/#37/#35 全部关闭
- [ ] portal/chat 新流量 100% 使用新 contract
- [ ] 生产 UI capability 与 durable backend 一致
- [ ] real RLS + consumer E2E + mutation gate 全绿
- [ ] legacy endpoint 调用归零
- [ ] destructive cleanup 有 backup/rollback 证据
- [ ] Stage 1 关闭后再把主要精力转向 Shared UI / KB

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
