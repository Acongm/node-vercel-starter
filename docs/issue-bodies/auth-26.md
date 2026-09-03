> **代码对照 2026-09-03（main）** — 客户端有 Google OAuth
> **仍开着的原因：** 生产 Google Cloud / Supabase Provider / 回跳未验收。
> **证据：** `signInWithGoogle` + `docs/oauth-setup.md`。

---

Auth Epic：#16
平台 Stage 0：`Acongm/portal#116`
依赖：建议先完成 #25 GitHub OAuth 与 #29 redirect 基线。

## 目标
在 GitHub OAuth 稳定后启用 Google provider，复用同一 Supabase Auth / return_to / session contract，不引入第二套 provider 协议。

## 配置
- [ ] Google Cloud OAuth Web client
- [ ] Authorized redirect URI = Supabase `/auth/v1/callback`
- [ ] Supabase Google Provider Enable + Client ID/Secret
- [ ] Site URL / Redirect allow-list 与 #29 相同
- [ ] secret 只存在受控配置

## 验收
- [ ] www → auth Google → 原页
- [ ] chat → auth Google → 原页
- [ ] refresh 后 session 保持
- [ ] avatar/name/email 展示正常
- [ ] provider error 有可操作提示
- [ ] production 不回 localhost

## Definition of Done
Google 与 GitHub 共用同一 auth-client/session/profile contract，仅 provider 配置不同。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
