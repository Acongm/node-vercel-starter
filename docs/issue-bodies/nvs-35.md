> **代码对照 2026-09-03（main）** — 未开始 destructive
> **仍开着的原因：** blocked on #37。legacy `chat-threads` / JWT / SSE 仍在仓库。
> **证据：** `src/modules/chat-threads/` 仍承担持久化。

---

平台：`Acongm/portal#117`
父 Epic：#32
前置：#42 → #33 → #34 → #43 → #37。
Backup gate：`Acongm/node-vercel-starter#21`（destructive step 前至少完成可恢复备份）。

## 定位
本 Issue 不再负责第一次客户端切换；真实 consumer migration 已拆到 #43。

这里只处理：
1. legacy endpoint 变成无独立业务逻辑的兼容 adapter；
2. 旧数据完整迁移/核对；
3. 观察 legacy 调用归零；
4. 最后执行 destructive cleanup。

## Phase A — Compatibility Adapter
- [ ] `/api/chat/threads*` 只做 DTO/response adapter，内部调用新 Chat service
- [ ] legacy auth endpoint 只保留必要兼容或明确 deprecated
- [ ] legacy service 不再拥有独立 persistence/business rules
- [ ] deprecation header/log/metrics
- [ ] 禁止继续给 legacy contract 增功能

## Phase B — Data Backfill / Semantic Preservation
### Identity
- [ ] `auth_users` → Supabase identity 映射策略
- [ ] 无法映射的 identity 单独 report，不静默丢弃
- [ ] legacy anonymous/clientId 数据给出明确迁移/放弃策略

### Chat
- [ ] `chat_threads/chat_messages` → `chats/messages` backfill
- [ ] text → text part
- [ ] legacy thinking → reasoning part（不是只塞 metadata）
- [ ] legacy sources → source parts（保留可渲染语义）
- [ ] provider/model/usage 放 metadata/telemetry 的边界一致
- [ ] message ordering/version/createdAt 保留
- [ ] 若 Stage 1.2 新增 run/clientMessageId，legacy row 有可解释的 migration default/legacy marker

### Verification
- [ ] migration 前后 row count
- [ ] per-chat message count
- [ ] sample transcript semantic diff
- [ ] reasoning/source 可在新 UI 正常显示
- [ ] orphan/unmapped rows report
- [ ] migration 可重复执行/幂等

## Phase C — Observation Window
基于 #43 已切真实客户端：
- [ ] production 新 endpoint 真实流量正常
- [ ] legacy endpoint 调用量按 route/client 可见
- [ ] legacy write 调用归零
- [ ] 不存在 silent fallback 回旧数据库
- [ ] 保留明确观察窗口/发布版本，而不是刚切完立即 drop

## Phase D — Destructive Cleanup
仅在 #37 final gate 关闭、backup 可恢复、legacy 调用归零后：

- [ ] project-issued 普通用户 AccessToken issuance
- [ ] AuthUsersService / local password hash
- [ ] custom OAuth state/start/callback/exchange
- [ ] old anonymous claim 主流程
- [ ] old ChatThreadsService production path
- [ ] old private SSE controller/event contract
- [ ] Chat generic DataStore production path
- [ ] obsolete env/scripts/docs/tests
- [ ] `public.auth_users` / legacy chat tables（最后 destructive DB step）

## Rollback / Forward Fix
- [ ] destructive migration 前 backup
- [ ] schema/data snapshot verification
- [ ] rollback/forward SQL 或明确不可逆说明
- [ ] app version ↔ migration version compatibility 记录
- [ ] cleanup 后 production smoke

## Definition of Done
- [ ] legacy endpoint 无真实生产调用
- [ ] legacy data 被迁移或明确 report，不静默丢失
- [ ] reasoning/source 等产品语义在迁移后不降级
- [ ] 删除旧实现后 typecheck/contract/RLS/E2E/build 全绿
- [ ] production smoke 无回归
- [ ] Stage 1 可以正式关闭

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
