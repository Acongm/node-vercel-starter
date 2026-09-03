> **代码对照 2026-09-03（main）** — 客户端走 Supabase OAuth；生产 Provider 验收未关
> **仍开着的原因：** GitHub OAuth App + 跨站回跳必须在 `*.acongm.com` 点出来。
> **证据：** `signInWithOAuth` / `linkIdentity`；`docs/oauth-setup.md`；`scripts/configure-supabase-github-auth.sh`。

---

Auth Epic：#16
平台 Stage 0：`Acongm/portal#116`
Runbook：`Acongm/portal#10`

## 目标
让 GitHub 登录成为可重复验证的生产 Supabase Auth provider 配置；应用只调用 Supabase OAuth，不增加 API 自研 OAuth protocol。

## 配置
- [ ] GitHub OAuth App
  - Homepage: `https://auth.acongm.com`
  - Callback: Supabase project `/auth/v1/callback`
- [ ] Supabase Authentication → Providers → GitHub Enable
- [ ] Client ID / Secret 只存在受控配置，不进前端仓库
- [ ] Supabase Site URL = `https://auth.acongm.com`
- [ ] Redirect allow-list 覆盖 auth/www/chat/未来 dochub 与本地开发

## 验收路径
- [ ] www → auth GitHub → 回 www 原页
- [ ] chat → auth GitHub → 回 chat 原页
- [ ] 直接 auth/login → 登录后进入 account/auth 默认页
- [ ] refresh 后 session 保持
- [ ] provider avatar/name/email 正常展示
- [ ] invalid return_to / localhost production redirect 被拒绝

## 自动化/文档
- [ ] 与 #29 共用唯一配置文档
- [ ] provider/redirect 生产 smoke checklist

## Definition of Done
GitHub 登录线上完整走通，且不依赖 `node-vercel-starter` 的 custom OAuth start/callback/token exchange。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
