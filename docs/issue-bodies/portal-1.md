> **代码对照 2026-09-03（main）** — 总控保持 OPEN
> **仍开着的原因：** Stage 0 #116 未关。Stage 1.3 代码已在 main，不要把焦点切到 KB/DocHub。
> **证据：** 见 `docs/platform-issue-status.md` 2026-09-03。

---

# .acongm.com Platform 总控路线图

> **本 Issue 是整个 `.acongm.com` 系列项目的唯一执行入口。**
> 原 `Acongm/platform` 已更名为 `Acongm/portal`；Portal 同时承担 Platform 总控与 `www.acongm.com` 产品实现。

## 仓库 / 域名
| 职责 | 仓库 |
|---|---|
| `www.acongm.com` + Platform 总控 | `Acongm/portal` |
| `auth.acongm.com` | `Acongm/auth` |
| `chat.acongm.com` | `Acongm/chat` |
| `api.acongm.com` | `Acongm/node-vercel-starter` |
| `dochub.acongm.com` | `Acongm/dochub` |
| Shared UI Registry | `Acongm/shadcn-ui` |

## 冻结架构原则
1. Supabase Auth 是唯一普通用户 identity source。
2. Supabase RLS 是 User/Chat 数据权限最终边界。
3. NestJS 保留业务 authorization、AI/KB/search/rate-limit/telemetry，不再做第二套 Identity Provider。
4. Chat 使用 `chats/messages + parts jsonb`；Stage 1 同时补 durable run/idempotency semantics，stream 对齐成熟 UIMessage/message stream 语义。
5. Portal/Chat/Auth/DocHub 共用 semantic theme；通用 UI canonical source 最终为 `Acongm/shadcn-ui`。
6. KB/DocHub 以 `document_versions` 为版本事实源，Git ↔ DB 必须可追踪、幂等、可恢复。
7. 数据/协议迁移统一采用 additive → client switch → observation → legacy removal。
8. **Coverage 只作为 regression guard；功能完整性以真实 capability contract + real DB/E2E 为准。**

# 执行队列

## Stage 0 — Production Reliability（**当前只做这里**）
主 Issue：#116

严格顺序：
1. `Acongm/chat#25` PR：stream 完成后不清空
2. `Acongm/chat#26`：history / refresh / thread switch 一致性
3. `Acongm/auth#29`：Site URL / Redirect / return_to 基线
4. `Acongm/auth#25`：GitHub OAuth production
5. `Acongm/auth#27`：Email SMTP / confirmation / recovery
6. `Acongm/auth#26`：Google OAuth（P1，可在 GitHub/email 稳定后）
7. Portal/Auth/Chat/API build/test/deploy + production smoke

**完成标准：** login → chat → stream → refresh → history → switch thread → relogin 连续稳定通过。

---

## Stage 1 — Supabase-native User/Auth + Chat v2（契约先行）
平台 Issue：#117
API Epic：`Acongm/node-vercel-starter#32`
Chat Epic：`Acongm/chat#1`
Auth Epic：`Acongm/auth#16`

新的严格顺序：

1. **API #42 — Contract Baseline**（当前 PR #39）
   - 从真实 assistant-ui/chat 行为冻结 capability matrix / failure matrix
   - contract/state-machine/controller tests
   - UI 可见但不 durable 的能力必须进入实现任务或显式 disabled
2. **API #33 — Auth/User Durable Contract**
   - Supabase principal / `/api/user/me` / profile semantics / anonymous identity
   - real DB 验证 profile partial PATCH，不只 mock
   - 同阶段联调 `Acongm/auth#28`
3. **API #34 — Chat v2 Durable Core**
   - message id + clientMessageId/idempotency
   - runId + running/complete/cancelled/error/incomplete
   - Reload/Regenerate 不重复 user turn
   - cancel/provider/persist failure durable semantics
   - parts + standard stream
   - stable cursor pagination
   - touch/title/telemetry 辅助失败不破坏 durable success
   - Edit/Branch/Resume 若不做则 capability=false
4. **API #43 — Real Consumer Migration**
   - portal/chat/auth-client 切 Supabase access token + `/api/user/*` + `/api/chats*`
   - assistant-ui adapter/capability gating
   - server persisted history 单一 truth
   - 新旧 endpoint 流量可观察
5. **API #37 — Final Quality Gate**
   - real Supabase RLS multi-user/anonymous integration
   - real consumer E2E
   - retry/cancel/failure/pagination/error contract
   - mutation testing + performance/index + production smoke
6. **API #35 — Legacy Cleanup**
   - legacy adapter observation
   - identity/chat data backfill + semantic preservation
   - reasoning/source 迁为 parts
   - legacy 调用归零
   - backup/rollback 后删除 custom OAuth/JWT/auth_users/old threads/SSE

> destructive legacy cleanup 前至少完成可靠 backup，并验证 rollback；完整 backup/restore 治理由 Stage 5.1 `Acongm/node-vercel-starter#21` 管理。

**Capability 完整性规则：**生产 UI 的每个功能只能是 `durable-supported + tested` 或 `disabled + linked future issue`，不能存在“按钮能点但刷新/重试/跨设备后语义失效”的第三种状态。

**完成标准：** 新流量 100% 使用 Supabase Auth + RLS + durable Chat v2；real RLS/E2E/mutation gate 通过；legacy Auth/Thread/SSE 不再承担生产逻辑。

---

## Stage 2 — Shared UI Registry
平台 Issue：#118
Registry Epic：`Acongm/shadcn-ui#4`

执行顺序：
1. `Acongm/shadcn-ui#5` — semantic theme + core primitives
2. `Acongm/shadcn-ui#6` — auth-client/login/user-menu/account
3. `Acongm/shadcn-ui#7` — chat-client/message/composer/thread-list
4. portal/chat/auth consumer migration；DocHub 新项目直接消费

说明：2.1 可在 Stage 1 后半段并行；2.2/2.3 必须以 Stage 1 最终 Auth/Chat contract 为准。

**完成标准：** `Acongm/shadcn-ui` 成为唯一 registry source，不再跨仓手工复制通用 UI。

---

## Stage 3 — KB Pipeline / Knowledge Platform
Epic：#4
API 总入口：`Acongm/node-vercel-starter#1`

执行顺序：
1. API #7 — pipeline runner / CLI
2. API #8 — ingest / normalize / sourceHash
3. API #9 + #10 — analyze + index/docpack（可并行）
4. API #11 + #13 — summary artifact + query API
5. API #12 — GitHub webhook incremental job
6. API #15 — Git → DB document_versions
7. API #14 — reconcile / sync_failures
8. API #20 — KB debug API
9. `Acongm/chat#5` — retrieval debug panel

**完成标准：** 文档 commit 后自动进入可检索 KB；每一步有 source/version/run trace，失败可重试。

---

## Stage 4 — DocHub 编辑/版本/发布闭环
Platform Epic：#5
DocHub Epic：`Acongm/dochub#1`

后端先：
1. API #19 — editor/admin ACL
2. API #16 — document/tree/draft/version/conflict contract
3. API #18 — preview token
4. API #17 — DB → Git publish/PR/direct push

前端后：
5. DocHub #2 — app shell/auth gate/Vercel
6. DocHub #3 — tree/navigation
7. DocHub #4 — MDX editor/autosave/conflict/recovery
8. DocHub #7 — version history/diff/restore
9. DocHub #5 — preview page
10. DocHub #6 — publish/sync status/retry

**完成标准：** 浏览器完成 edit → preview → version → publish → Git → Portal → KB 全链路，失败不丢草稿。

---

## Stage 5 — Production Hardening / Operations
Epic：#7

执行顺序：
1. `Acongm/node-vercel-starter#21` — Backup + Restore Drill
2. `Acongm/node-vercel-starter#38` — Observability / trace / failure visibility
3. `Acongm/node-vercel-starter#40` — AI abuse / quota / cost budget
4. #11 — Uptime / Health / Supabase keepalive
5. #10 — Domain / Vercel / Supabase env + rollback runbook
6. #12 — Registry/npm/app-local shared-code governance

> Stage 5 是横向治理阶段：Stage 1 destructive migration 前需提前执行必要 backup；Stage 3/4 production 前需提前补对应 observability/security。

**完成标准：** 故障可发现、可定位、可恢复；AI/搜索成本可追踪；重大操作有 runbook。

---

## Stage 6 — Product Evolution
Epic：#119

稳定后再按真实使用反馈拆 feature Issue：
- Account：profile/avatar/password/identity/preferences
- Chat：durable edit branch/attachments/tools/search/export
- Knowledge：global search/citations/related docs/quality feedback
- DocHub：review/approval/visual diff/publish history
- Portal：global search/account chrome/docs↔chat linkage
- AI：provider routing/fallback/cost-quality/evals/tools/prompt versions

**禁止** Stage 6 功能重新建立在 legacy Auth/Thread/SSE 上。

# 执行规则
1. 默认只从**最靠前未完成 Stage**取任务。
2. Stage 内：先真实 contract/capability，再 API durable semantics，再 consumer integration，再 real DB/E2E，最后 cleanup。
3. 一个能力只保留一个 canonical Epic/Issue；重复项关闭 duplicate/superseded。
4. 每个实现 Issue 必须写依赖、测试、Definition of Done；数据/协议变更必须写 compatibility/rollback。
5. PR 合入后同步 Issue checkbox/状态；Stage Epic 只在所有 DoD 满足后关闭。
6. 任何 coverage 数字都不能单独作为“功能完成”证据。
7. 后续查看进度时，以本 Issue + 当前 Stage Epic 为准，不再依据旧 Platform v2 Phase 副本判断。

## 当前动作
**现在优先完成 #116；API 优化工作可按 Stage 1.0 `node-vercel-starter#42` / PR #39 推进契约基线，但 Stage 0 未关闭前不启动 KB/DocHub 新功能。**

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
