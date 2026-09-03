> **代码对照 2026-09-03（main）** — 仓库设置问题，不是功能缺口
> **仍开着的原因：** Vercel Free 日限额导致 PR check 恒红。需 branch protection / ignored build，不是应用代码。
> **证据：** `docs/vercel.md` 只有部署 env，没有 merge-gate 说明。

---

## 现象

今日多个 PR 的 **Vercel** status 持续失败，GitHub Actions（`CI` / `Chat schema integration` / `Chat mutation smoke`）已通过时仍被挡住。

典型文案：

```text
Resource is limited - try again in 24 hours
(more than 100, code: "api-deployments-free-per-day")
Deployment rate limited — retry in 24 hours.
```

证据：

- PR #44 tip：`verify` / `postgres` / `mutation-smoke` = pass，**Vercel = fail**  
  https://github.com/Acongm/node-vercel-starter/pull/44
- PR #45（已合并）：同样出现 Vercel FAILURE（`upgradeToPro=build-rate-limit`）
- PR #46 关闭前评论：https://github.com/Acongm/node-vercel-starter/pull/46#issuecomment-5224374898

根因：今日 agent 高频 push（Stage 1.1/1.2 大量中间提交）触发 **Vercel Hobby 免费档每日 Preview Deployment 上限（>100）**，不是应用构建错误。

## 影响

- PR 合并被非代码检查阻塞（若 Vercel 为 required check）
- 浪费配额后，后续合法 Preview 也要等 24h

## 建议修复（任选可落地组合）

1. **本仓库（Nest API）取消/降级 Vercel 为 required status**  
   - Settings → Branches → 不要把 `Vercel` 设为 required  
   - 或 Vercel 项目关闭 Git Integration 自动 Preview（API 无前端 Preview 刚需）
2. **降低部署次数**  
   - agent 分支启用 batch push / `[skip ci]` 策略对 Vercel ignored builds  
   - Vercel Ignored Build Step：仅 `main` 或 path filter 变更才部署
3. **升级 Pro**（若必须保留每个 commit Preview）— 成本最高，优先 1/2

## 验收

- [ ] 打开任意新 PR：GitHub Actions 绿时，**不再因 rate-limit 导致整 PR 不可合并**
- [ ] 文档注明：`node-vercel-starter` 以 Actions 为 merge gate；Vercel 非必需
- [ ] 验证连续 >10 次 push 后 Vercel 不再成为 blocker（或明确 ignored）

## 关联

- Refs PR #44 / #45 / #46
- Stage Epic #32

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
