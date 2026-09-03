> **代码对照 2026-09-03（main）** — 邮箱 UI + 匿名门闩在 main
> **仍开着的原因：** 生产 SMTP / confirmation / resend / recovery 未做。
> **证据：** `login-form.tsx` `protectAnonymousEmailSignup`。

---

Auth Epic：#16
平台 Stage 0：`Acongm/portal#116`
依赖：#29 URL/callback 基线。

## 目标
让 production email signup/login 具备可用的确认邮件与恢复流程，不依赖 Supabase 默认有限发信能力或人工确认作为正常路径。

## Production
- [ ] 配置自定义 SMTP（Resend/SendGrid/其他可靠 provider 均可）
- [ ] production 保持 Confirm email 策略并明确模板/发件人
- [ ] confirmation link 回到正确 auth domain/callback
- [ ] resend confirmation
- [ ] password reset/recovery email
- [ ] 邮件发送失败有可操作错误提示

## Development / Preview
- [ ] 是否关闭 Confirm email 仅作为明确的 dev convenience
- [ ] Preview 与 Production 策略写入 env/runbook
- [ ] 不把“手动 Dashboard Confirm”作为正常产品流程

## 验收
- [ ] 新邮箱注册收到确认信
- [ ] 点击后 session/login 正常
- [ ] 未确认登录给出可操作提示与重发入口
- [ ] reset password 完整走通
- [ ] production callback 不回 localhost

## Definition of Done
email/password 能作为独立于 OAuth provider 的可靠生产登录方式。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
