> **代码对照 2026-09-03（main）** — 代码与文档完成；生产回跳未关
> **仍开着的原因：** Site URL / allow-list 已在 2026-08-19 配到生产；缺 www/chat 真人回跳与外部 redirect 拦截回归。
> **证据：** `docs/oauth-setup.md`；`isAllowedReturnTo` / `sanitizeReturnTo`；`apps/auth/app/callback/route.ts`。

---

Auth Epic：#16
平台 Stage 0：`Acongm/portal#116`
平台 Runbook：`Acongm/portal#10`

## 目标
把 Supabase Auth URL Configuration、跨子域 return_to 和生产/本地差异固化为单一事实来源。所有 OAuth provider 必须建立在本基线上。

## 配置基线
- [ ] Production Site URL = `https://auth.acongm.com`
- [ ] Redirect allow-list：
  - `https://auth.acongm.com/callback`
  - `https://www.acongm.com/**`
  - `https://chat.acongm.com/**`
  - `https://dochub.acongm.com/**`（启用 DocHub 时）
  - 明确允许的 localhost dev callback
- [ ] Preview 环境策略明确：使用专用 allow-list 或统一可控 preview callback

## return_to 安全
- [ ] 只允许 `.acongm.com` 受信任 host + 明确 localhost dev
- [ ] production 拒绝 localhost
- [ ] 拒绝任意外部 open redirect
- [ ] callback code/session 失败有明确 fallback/error

## 文档/检查
- [ ] `docs/oauth-setup.md` 为单一事实来源
- [ ] deploy checklist 引用同一文档，不复制配置
- [ ] 可选只读诊断脚本/health 输出当前 app domain 配置（不能暴露 secret）

## 验收
- [ ] www → auth → www 原页
- [ ] chat → auth → chat 原页
- [ ] 直接 auth/login 正常
- [ ] invalid external return_to 被拒绝
- [ ] production 不再出现 OAuth 回 localhost

## Definition of Done
#25/#26 provider 只需配置 provider credentials，不再各自解决 redirect/return_to 基础问题。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
