> **代码对照 2026-09-03（main）** — 部分完成，保持 OPEN
> **仍开着的原因：** 生产 cookie / 真人 OAuth 同 uid / 真 LLM send；capability `it.todo` 8 条；无 Stryker threshold。Auth/Portal 没有 live Playwright（旧跟踪文档写错）。
> **证据：** `test/platform-v2-quality-gate.e2e-spec.ts`；chat/portal mock e2e；chat `test:e2e:live`；`scripts/live-quality-gate.mjs`；2026-08-19 生产评论已落地 user_settings / migration-history / Manual Linking。

---

平台：`Acongm/portal#117`
父 Epic：#32
前置：#42 Contract Baseline → #33 Auth/User → #34 Chat Durable Core → #43 Consumer Migration。
后续：#35 legacy cleanup。

## 定位
本 Issue 不再负责“第一次发现功能缺口”。缺口应在 #42 契约基线阶段先暴露，并由 #33/#34/#43 实现或显式禁用。

本 Issue 是**真实生产路径的最终质量门**：证明真实 consumer、真实数据库、真实权限与测试断言强度一致，避免 mock/coverage 全绿但系统能力缺失。

## 1. Capability Consistency Gate
以 #42 capability matrix 为准：
- [ ] 所有生产 UI 可见能力 = `durable-supported`
- [ ] 未实现 Stage 6 能力必须 `disabled/capability=false`
- [ ] 不允许 UI 显示 Edit/Reload/Resume 等功能但后端只提供 local-only 模糊语义
- [ ] `it.todo` 若对应生产可见能力，本 Issue 不得关闭
- [ ] 允许保留 TODO 的能力必须已禁用并链接 Stage 6 feature Epic

## 2. Real Supabase RLS Integration
不能再用 SQL 字符串 invariant 或 mock client 代替。

至少使用 local Supabase 或隔离测试 project：
- [ ] authenticated user A 不能 SELECT user B chat/message/profile
- [ ] A 不能 INSERT/UPDATE/DELETE B 数据
- [ ] anonymous A 与 anonymous B 通过 auth.uid 隔离
- [ ] messages INSERT/UPDATE 的 chat ownership invariant
- [ ] FK cascade 真实执行
- [ ] migration 幂等 / eligible legacy data preservation
- [ ] profile partial PATCH 真实 DB 行为
- [ ] clientId spoof 不获得 ownership/quota

## 3. End-to-End Consumer Path
基于 #43 已迁移客户端，而不是手写测试客户端：
- [ ] portal/chat 使用真实 Supabase access token
- [ ] create chat
- [ ] send + stream
- [ ] Reload/Regenerate（如 enabled）不重复 user turn
- [ ] Stop/Cancel durable 状态（如 enabled）
- [ ] refresh → history
- [ ] pagination
- [ ] switch chats
- [ ] delete/rename
- [ ] logout/relogin / cross-device history
- [ ] anonymous → authenticated continuity 按既定策略

## 4. Streaming / Persistence State Machine
必须继续证明：
- [ ] rate limit before write
- [ ] inaccessible chat before user persistence
- [ ] duplicate request concurrency/idempotency
- [ ] provider failure
- [ ] abort/disconnect
- [ ] empty output
- [ ] assistant persistence failure
- [ ] auxiliary touch/title/telemetry failure policy
- [ ] `done/success` 永远晚于 durable terminal state

## 5. Error Contract
- [ ] DTO 400
- [ ] auth 401
- [ ] role 403
- [ ] RLS-hidden/not-found 404 contract
- [ ] rate limit 429
- [ ] provider/persistence failure stable error code/frame
- [ ] 不向 browser 泄漏 DB/service_role/provider secret 细节

## 6. Performance Contract
- [ ] 禁止 table-wide list + JS filter
- [ ] chat cursor query 使用稳定 tie-breaker + matching index
- [ ] message history 使用稳定 cursor + bounded page
- [ ] model context truncation != persisted history pagination
- [ ] 无明显 N+1
- [ ] long history 不无限一次加载

## 7. Mutation Testing
引入 restricted StrykerJS suite，优先：
- `chat.service.ts`
- `chat.repository.ts`
- `user.service.ts`
- principal/role guard
- idempotency/run-state decision logic

- [ ] 设置可执行 mutation threshold（建议起点约 70%，按 CI 成本调整）
- [ ] ownership/status/error/idempotency 关键 mutant 必须被杀死
- [ ] survivor 进入明确测试缺口，不用 line coverage 掩盖

## 8. Production Gate
- [x] typecheck
- [x] unit
- [x] `test:contracts`
- [x] DB/RLS integration（CI `supabase-auth-rls-integration.yml`；capability todo 仍要求更多 invariant）
- [ ] consumer E2E
- [ ] mutation core suite
- [x] build
- [ ] preview smoke
- [ ] production smoke
- [ ] migration/rollback state documented

## Definition of Done
- [x] 真实 consumer path 已使用新 contract（#43 CLOSED；Chat/Portal/Auth BFF）
- [ ] 生产 UI capability 与 durable backend capability 一致
- [ ] real RLS 多用户/匿名隔离通过
- [ ] retry/cancel/failure/pagination 等不是仅 mock 通过
- [ ] mutation suite 能验证关键断言强度
- [ ] legacy endpoint 调用已进入可观察兼容窗口
- [ ] 本 Issue 关闭后，#35 才允许 destructive cleanup

### 2026-09-03 进度（不要用旧 platform-issue-status 8/18 表）

- [x] API mock quality-gate
- [x] Chat mock Playwright
- [x] Portal mock Playwright
- [ ] Auth mock Playwright（**auth 仓无 e2e/**）
- [x] Chat live JWT chrome（注入 session）
- [ ] Portal live JWT（**portal 仓无 test:e2e:live**）
- [x] 线上 user/chats token 冒烟（无 stream）
- [x] 生产 `user_settings` + comments history repair + Manual Linking 配置（2026-08-19）
- [ ] 生产 cookie / 真人 OAuth 同 uid（`auth#48`）
- [ ] 生产真 LLM Send/Retry/Reload/Edit/Cancel
- [ ] `test/assistant-ui-capabilities.todo.spec.ts` 清零或能力显式 disabled
- [ ] Stryker threshold（现仅 mutation smoke）

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
