> **代码对照 2026-09-03（main）** — Stage 1 代码部分完成
> **仍开着的原因：** Stage 0 生产 OAuth/Email 与 #37 未关。
> **证据：** auth-client 已是 Supabase-only；#51/#52 CLOSED；#48/#28 源码在 main。

---

平台总控：`Acongm/portal#1`
当前阶段：`Acongm/portal#116` → `#117`

## 当前状态
旧 Epic 中的 workspace、`apps/auth`、`auth-client`、config、Vercel/auth.acongm.com、跨子域 return_to 等基础已经落地；后续不再维护 API 自研 OAuth/JWT identity，而以 **Supabase Auth 为唯一普通用户身份源**。

## Stage 0 — Production Auth 收口（按顺序）
1. [ ] #29 Site URL / Redirect allow-list / return_to 安全基线
2. [ ] #25 GitHub OAuth provider 启用并生产验证
3. [ ] #27 Email confirmation / SMTP / recovery
4. [ ] #26 Google OAuth provider（GitHub 稳定后）
5. [ ] #28 profile 最小可用能力（可与 Stage 1 API profile 联调）

并统一验证：
- [ ] OAuth callback / return_to / open redirect 回归测试
- [ ] Preview/Production env 区分清楚

## Stage 1 — Supabase-native Account/Profile
- [ ] 对接 API `GET /api/user/me`
- [ ] 对接 API `PATCH /api/user/profile`
- [ ] `auth.users` identity 与 `public.profiles` application profile 边界明确
- [ ] viewer/editor/admin 角色只从可信 server-controlled metadata 获取
- [ ] portal/chat 账号组件统一显示 profile/session 状态

## Supabase-native migration
- [ ] `auth-client` 只负责 Supabase client/session/helper，不再依赖 API 自签 access token
- [ ] 登录方式全部调用 Supabase Auth
- [ ] password reset/change 走 Supabase 标准能力
- [ ] anonymous identity 与 `Acongm/node-vercel-starter#32/#33` 对齐
- [ ] 旧 API OAuth/claim/access-token compatibility 调用归零后删除

## Shared UI
最终迁移到 `Acongm/portal#118` / `Acongm/shadcn-ui#6`：
- [ ] auth-login
- [ ] user-menu
- [ ] auth-client
- [ ] account-profile

## 测试 / DoD
- [ ] email/password + GitHub 全流程通过；Google 如启用同样通过
- [ ] www/chat → auth → 原页 return_to 稳定
- [ ] refresh/relogin 后 session 一致
- [ ] profile 修改后 portal/chat 同步展示
- [ ] invalid/expired token 有明确状态
- [ ] 无 open redirect / role escalation
- [ ] legacy identity contract 不再有新调用

旧版 `P0-03~06` 子任务只作为历史记录，不再作为当前执行入口。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
