> **代码对照 2026-09-03（main）** — 实现 + 合同测试在 main；live 未证
> **仍开着的原因：** 缺一次真人匿名 → OAuth，证明 callback 后 `auth.uid()` 不变。`anonymous-identity-upgrade.test.mjs` 仍有 live `test.todo`。
> **证据：** `packages/auth-client/src/client.ts` `linkOAuthIdentity`；`login-form.tsx` `protectAnonymousEmailSignup`；冲突自动改 sign-in。生产已开 Manual Linking（2026-08-19）。

---

平台：`Acongm/portal#117`
API Consumer Migration：`Acongm/node-vercel-starter#43`
Auth Epic：#16
关联 Chat：`Acongm/chat#36`

## 背景
Chat v2 会在未登录时创建真实 Supabase anonymous user，并以 `auth.uid()` 作为 chats/messages/RLS ownership。

当前 `auth.acongm.com/login` 无论 signup/signin 都直接调用 `signInWithOAuth` / `signInWithPassword` / `signUp`。这不能证明 anonymous user 会原地升级；普通 sign-in 可能切成另一个 user id，使匿名 Chat 历史在新身份下不可见。

Supabase 官方契约：
- anonymous → OAuth permanent：`linkIdentity()`，保持 user id；需要开启 manual linking
- anonymous → email permanent：先 `updateUser({ email })` 验证邮箱，再设置 password
- 登录已有账号属于 identity switch，需要应用自己决定数据冲突/迁移策略

## Stage 1.3 决策
### OAuth signup / bind
- [x] 若当前 session 是 anonymous 且 mode=signup：使用 `linkIdentity(provider)`
- [ ] callback 后保持同一 `auth.uid()`
- [x] Chat/Profile ownership 无需搬迁（设计：同 uid；live 未证）
- [x] link identity conflict 显示明确错误；`identity_already_exists` 自动改 sign-in 重试

### Sign in existing account
- [x] mode=signin 继续普通 Supabase sign-in
- [x] 明确这是 identity switch
- [x] 不调用 legacy `x-client-id` claim
- [x] 不 silent merge/double-write anonymous chats
- [ ] Chat consumer 按新 auth.uid 清 active/cache

### Email signup
邮箱匿名原地升级需要“email verification → set password”闭环，与 #27 SMTP/confirmation/recovery 同步完成。
- [x] 在 #27 完成前，anonymous session 下的 email signup 不得静默创建另一个 UID
- [x] UI 明确提示使用 OAuth 保留当前匿名历史，或登录已有账号切换身份

## Tests
- [x] OAuth signup + anonymous session chooses `linkIdentity`, not `signInWithOAuth`
- [x] OAuth signin chooses `signInWithOAuth`
- [x] non-anonymous signup remains ordinary OAuth signup
- [x] link conflict does not fallback silently
- [x] anonymous email signup is explicitly gated until #27
- [ ] return_to/callback safety unchanged

## DoD
- [ ] anonymous → OAuth signup preserves auth.uid by contract
- [x] existing-account login is explicit identity switch
- [x] no legacy anonymous claim is reintroduced
- [ ] Chat #36 can rely on identityKey change semantics without guessing ownership migration

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
