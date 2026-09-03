> **代码对照 2026-09-03（main）** — session + account 已落地
> **仍开着的原因：** Security/Session 产品页、shadcn registry、browser 矩阵未做。
> **证据：** `session-status.ts`；`account-profile-form.tsx`；无 e2e。

---

后端标准：`Acongm/node-vercel-starter#56`
Shared UI：`Acongm/shadcn-ui#14`
当前 P0：#51 / `Acongm/node-vercel-starter#59`
消费者：Portal / Chat

## 最终目标
`auth.acongm.com` 成为整个 `.acongm.com` 的统一账号中心，而不是只有一个登录页。

目标包括：
1. 登录/注册/回跳稳定且有明确 loading/error 状态；
2. 用户信息、Profile、Settings、身份/Session 管理页面完整；
3. 所有页面使用 Shared UI/semantic theme；
4. Portal/Chat 能复用同一登录态与用户设置 contract。

## 当前已确认架构问题
Auth 与 Chat 仓库目前各自维护一份 `packages/auth-client`，且行为已经不同：Chat fork 自动 `ensureAnonymousSession/signInAnonymously`，Auth 自身只恢复已有 session。当前首要任务 #51 是把 session/anonymous/logout state machine 收为唯一实现，再继续扩 Account/Settings。

## 登录体验
- [ ] #51：统一 session state machine 与 consumer policy
- [ ] login/signup intent 清晰
- [ ] email/password、GitHub/Google（启用项）状态一致
- [ ] OAuth 跳转前、callback、session restore 都有 loading，而不是点击后无响应
- [ ] callback/error/conflict/expired session 有明确提示与 retry
- [ ] `return_to` 正确回 Portal/Chat 原页面
- [ ] anonymous → signup 与登录已有账号的行为明确区分
- [ ] logout 后各站登录状态同步刷新

## Session/UI state
- [ ] app 启动统一为 `restoring → anonymous | authenticated | unauthenticated | error`
- [ ] session restore 不阻塞整个页面不必要内容
- [ ] 避免重复 `getSession/getUser` 请求造成 UI 抖动
- [ ] auth state change 后统一刷新 user/profile/settings cache
- [ ] Chat/Portal 使用同一 Auth client 版本，不复制 hooks/client 目录后分别修改

## Account Center
### Profile
- [ ] 用户头像/名称/email/provider/role/tier 展示
- [ ] displayName/avatar 修改
- [ ] profile save loading/success/error

### Settings
- [ ] 通用 Settings 页面，对接 API `/api/user/settings`
- [ ] theme/language（实际启用项）
- [ ] Chat 默认模型
- [ ] Chat 默认提示词/default prompt
- [ ] settings defaults / reset / save / refresh

### Security / Session
- [ ] 当前身份/provider 信息
- [ ] logout current / logout all（按产品需要暴露 Supabase scope）
- [ ] password recovery/change（Email Auth 启用时）
- [ ] identity link/unlink（确认安全策略后）

## Shared UI
- [ ] Login/Card/Form/Input/Button/Alert/Avatar/Menu/Settings layout 来自 `Acongm/shadcn-ui` 公开 contract
- [ ] light/dark/system 一致
- [ ] loading skeleton/spinner/button pending 统一
- [ ] mobile/desktop responsive
- [ ] 不因 Auth 特例 fork 基础 Button/Form API

## 当前实现顺序
1. #51 Auth Client/session state machine 收口。
2. API #56/#59 principal/session 性能收口。
3. User Settings API + Auth Settings 页面。
4. Shared UI loading/account/settings components 同步到 Portal/Chat。

## Tests
- [ ] 首次访问 session restore loading
- [ ] login success/failure/callback failure
- [ ] logout 后状态立即变化
- [ ] profile/settings load/save/error/cache invalidation
- [ ] Portal/Chat return_to
- [ ] light/dark + mobile UI smoke

## DoD
用户从任意 `.acongm.com` 项目进入 Auth 后，都能明确看到当前登录状态、完成登录/退出、管理用户信息与通用设置；全过程无“点了没反应”的空白等待，并与 Portal/Chat 使用同一用户 contract。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
