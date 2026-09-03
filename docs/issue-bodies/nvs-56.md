> **代码对照 2026-09-03（main）** — API 层完成，跨仓 DoD 未关
> **仍开着的原因：** 服务端 logout / consumer cache 失效仍属跨仓；Settings 细节见 #61。
> **证据：** `user.controller.ts` / `supabase-auth.service.ts` JWKS / `user_settings` / `test/user.contract.spec.ts` / `test/chat.send-critical-path.spec.ts`。

---

父目标：#55
消费者：`Acongm/auth` / `Acongm/chat` / `Acongm/portal`

## 最终目标
把登录与用户相关能力收敛成标准 Auth/User 模块。Supabase Auth 负责 identity/session/provider，本模块负责应用侧统一 principal、用户信息、Profile/Settings、session state 与 authorization contract。

## 标准能力
### Identity / login state
- [x] authenticated / anonymous / unauthenticated 三态 contract（Guard + AuthPrincipal）
- [x] Supabase access token 校验与 request principal（JWKS + getUser fallback）
- [ ] `session_id` / token expiry 可观测，不重复实现 refresh token provider
- [x] expired/invalid/revoked session 有稳定 error code（`TOKEN_EXPIRED`）

### User/Profile
- [x] `GET /api/user/me`
- [x] `GET/PATCH /api/user/profile`
- [x] displayName/avatar/preferences 等应用信息
- [x] id/email/provider/role/tier 等身份/授权字段只读
- [x] no-profile-row 首次写入与 partial update/clear 语义

### Settings
- [x] `GET/PATCH /api/user/settings`
- [x] 通用用户设置 schema（theme/language/model/prompt；skills 仍在 preferences）
- [x] server defaults + user overrides 语义明确
- [x] settings cache/version/invalidation 明确（uid + schemaVersion）

### Session / cache / logout
- [x] access token/JWT verification cache TTL ≤ token `exp`
- [x] user/profile/settings cache key 按 `auth.uid` 隔离
- [ ] auth state change/logout 后 consumer cache 可立即失效
- [ ] logout 使用 Supabase标准 scope（global/local/others），不自建 logout token protocol
- [ ] 如业务要求强注销，按 `session_id` 验证真实 session 存在性，而不是仅依赖旧 JWT 自然过期

## 性能
- [ ] 常规 authenticated API 不重复串行拉取完整 profile/session
- [ ] principal verification / profile / settings 可独立缓存
- [ ] anonymous bootstrap 不阻塞不需要身份数据的静态页面

## Tests
- [x] anonymous/authenticated/invalid/expired token（合同/单测）
- [x] profile partial patch / clear / no-row create
- [x] settings defaults/override/cache invalidation
- [ ] logout 后状态/cache 行为
- [ ] user A/B 隔离与 role escalation negative cases

## 当前实现队列
1. `#59` — Chat send 复用 guard 已验证 principal，消除一次请求重复 Supabase Auth 校验；同时评估 `getClaims/JWKS` 性能路径。
2. `Acongm/auth#51` — 统一 consumer session/anonymous state machine，消除 Auth/Chat/Portal auth-client 源码漂移。
3. Settings API — 在前两项 identity/session contract 稳定后实现 `/api/user/settings` 与 cache/invalidation。

## 参考
- Supabase Sessions: https://supabase.com/docs/guides/auth/sessions
- Supabase Sign Out: https://supabase.com/docs/guides/auth/signout
- Supabase getClaims: https://supabase.com/docs/reference/javascript/auth-getclaims

## DoD
Portal/Auth/Chat 都只消费这一套用户与登录态 contract；新增用户信息/设置不再各仓库各写一套。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
