> **代码对照 2026-09-03（main）** — 文件已改名但 workflow 仍写死路径
> **仍开着的原因：** `.github/workflows/chat-schema-integration.yml` 仍枚举四个 migration 文件。
> **证据：** `test/supabase-migration-order.spec.ts` 只校验仓库文件，不校验 workflow。

---

## 现象

`Chat schema integration` 在中间 commit 失败：

```text
psql: error: supabase/migrations/20260808020000_chat_cursor_indexes.sql: No such file or directory
```

失败 run：https://github.com/Acongm/node-vercel-starter/actions/runs/31238323858  
分支：`agent/chat-idempotent-runs` @ `0427d00`（`fix(chat): remove duplicate migration version`）

后续 commit `e683995`（`ci(chat): execute canonical stable pagination migration`）把 workflow 改回 `20260808020000_chat_stable_pagination.sql` 后恢复绿色。

## 根因

`.github/workflows/chat-schema-integration.yml` **逐步硬编码** migration 文件名：

- `20260808000000_user_chat_supabase_auth.sql`
- `20260808010000_chat_runs_idempotency.sql`
- `20260808020000_chat_stable_pagination.sql`

当某次提交 **重命名/删除 migration**，但未同步改 workflow（或分两个 commit 推送），Postgres job 立刻红。这是 CI 脆弱性，不是业务逻辑 bug。

## 建议修复

1. **按字典序执行** `supabase/migrations/20260808*.sql`（或全部 `*.sql` + fixture 前置），禁止在 workflow 里写死单个新文件名  
2. 或引入 `scripts/ci-apply-chat-migrations.sh`，单一入口；workflow 只调脚本  
3. 增加契约测试：`test/sql` 或 unit 断言「workflow/script 引用的每个 path 在仓库存在」  
4. 重命名 migration 必须 **同 commit** 更新脚本（PR checklist）

## 验收

- [ ] 重命名任一 `20260808*.sql` 后，无需手改 workflow YAML 步骤名/路径（或同 commit 由脚本自动发现）
- [ ] 故意引用不存在文件时，本地/CI 有清晰失败信息
- [ ] PR #44 tip 及以后的 schema job 保持绿

## 关联

- PR #44 Stage 1.2
- 失败 run 31238323858

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
