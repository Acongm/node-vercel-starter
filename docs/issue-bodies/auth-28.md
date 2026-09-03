> **代码对照 2026-09-03（main）** — 实现 AC 已勾完；部署/browser 未关
> **仍开着的原因：** auth 仓 **没有** Playwright。`#43` 已于 2026-08-19 CLOSED。browser smoke 归 `#37`。
> **证据：** `apps/auth/app/account/page.tsx`；`packages/auth-client/src/profile.ts`；`tests/contracts/account-profile.test.mjs`。

---

Auth Epic：#16
平台：`Acongm/portal#117`
Consumer Migration：`Acongm/node-vercel-starter#43`
后端前置：`Acongm/node-vercel-starter#33` ✅
实现 PR：#49 ✅ merged (`2129e94b`)

## 目标
后端 `/api/user/me` / `/api/user/profile` 已在 Stage 1.1 稳定，但“接口存在”不等于产品已使用。

本 Issue 负责让 Auth Account UI 真正消费 application profile contract：

`Supabase session/access token → /api/user/me → public.profiles → /api/user/profile`

## 已实现代码
- [x] `/account` 页面
- [x] same-origin `/api/user/[[...path]]` BFF
- [x] BFF 透传 Bearer Authorization
- [x] upstream unavailable → safe 502，不泄漏内部错误
- [x] `GET /api/user/me` 加载 account identity/profile
- [x] `PATCH /api/user/profile` 更新 application profile
- [x] displayName
- [x] avatarUrl
- [x] preferences JSON object
- [x] displayName/avatar 空值使用后端已定义的 explicit null clear
- [x] preferences 明确 replacement semantics
- [x] id/email/role/tier 只读展示
- [x] browser PATCH body 不包含 userId/email/role/tier
- [x] 不把 `user_metadata` 当 application authorization/profile truth
- [x] anonymous visitor 不编辑 permanent Account Profile

## Shared contract
新增 `packages/auth-client/src/profile.ts`：
- [x] `UserMe`
- [x] `ApplicationProfile`
- [x] `UpdateApplicationProfile`
- [x] `getUserMe`
- [x] `updateUserProfile`
- [x] empty patch stable error
- [x] writable profile type 不暴露 identity/role/tier/email

## Anti-happy-coverage gate
Account Profile contract workflow 已证明：
- [x] `/api/user/me` 使用 Supabase access token
- [x] `/api/user/profile` 只写 profile fields
- [x] identity/authorization fields read-only
- [x] preferences replacement + JSON object validation
- [x] BFF Authorization forwarding
- [x] shared writable type 无 userId/email/role/tier

Auth CI：
- [x] typecheck
- [x] build

> Backend #33 已用真实 Supabase 证明 profile partial update / RLS / no-profile-row / anonymous principal；本 Issue 不用 mock 重复冒充 DB E2E。

## Rollout / E2E
代码已合入 main，但 Vercel 当前触发 daily deployment limit，以下仍需上线后验证：
- [ ] Account 页面实际部署
- [ ] authenticated `/me` 加载
- [ ] no profile row → 可创建 profile
- [ ] display/avatar clear
- [ ] preferences replace
- [ ] refresh 后 profile 一致
- [ ] role/tier/id/email 无浏览器写入口

最终 production consumer E2E 仍进入 Stage 1.4 `node-vercel-starter#37`。

## DoD
- [x] Account Profile CI/contracts/build 全绿
- [x] PR merged
- [ ] deployed
- [ ] browser Account smoke
- [x] #43 中 `/api/user/*` consumer 项关闭（#43 CLOSED 2026-08-19）

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
