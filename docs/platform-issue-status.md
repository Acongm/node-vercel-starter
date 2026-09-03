# Platform Issue Status（统一跟踪）

> 最后更新：2026-09-03  
> 对照仓库：`auth` / `chat` / `portal` / `node-vercel-starter` 的 `origin/main`。  
> 本文档是各仓 GitHub Issues 的**单一真相源**；GitHub 正文应以本文与 `docs/issue-bodies/` 为准。

## 方向

KB / DocHub / Stage 3–6 / Portal shadcn Avatar 换皮 **不抢主线**。

当前唯一执行入口仍是 **`#37` Final Quality Gate**。源码与 mock / live JWT 门已经齐；还没关是因为生产 cookie / 真人 OAuth / 真 LLM send，以及 issue 原文里的 capability `it.todo`、Stryker threshold。

## 执行主线（2026-09-03）

| 优先级 | 方向 | 主 Issue | 代码状态 | GitHub |
|--------|------|----------|----------|--------|
| P0 | Final Quality Gate | `#37` | API mock gate + Chat/Portal mock Playwright + Chat live JWT chrome + live API script ✅ | **OPEN** — 缺生产 cookie / `auth#48` 真人 OAuth / 真 LLM send / Stryker / capability todos |
| P0 | 匿名 → OAuth 同 uid | `auth#48` | `linkIdentity()` + 合同测试 + 冲突重试 ✅ | **OPEN** — 缺一次真人 callback 证明 `auth.uid()` 不变 |
| P0 | Auth/User API | `#56` | `/me` `/profile` `/settings` + JWKS + `TOKEN_EXPIRED` ✅ | OPEN（API 层完成，跨仓 logout/cache 仍写在 DoD） |
| P0 | Chat API | `#57` | tail-first + durable run/stream + settings 注入 ✅ | OPEN（consumer 证明归 `#37`） |
| P0 | Send critical path | `#59` | principal 复用 + `chat.first_token` + touch 不阻塞 ✅ | OPEN — `CHAT_MODEL_CONTEXT_LIMIT` 仍是 500 |
| P0 | 非阻塞 Chat 启动 | `chat#40` | 始终挂载 + tail-first + 失败不清空 + mock e2e ✅ | OPEN — 生产 cookie 归 `#37` |
| P0 | Account Profile | `auth#28` | `/account` + BFF + settings ✅ | OPEN — Auth 仓 **没有** Playwright smoke |
| P1 | Settings 产品表 | `#61` | `user_settings` migration + GET/PATCH + cache + Chat send 注入 ✅ | OPEN — 无 DELETE；skills 仍在 preferences；匿名策略未单测 |
| P0 | 结构化日志 | `#58` / `#60` | requestId + JSON `appLogger` Phase 1 ✅ | OPEN — **没有 Pino / redaction / logs 模块** |
| P2 | DocHub Stage 4 | `dochub#9` | 不抢主线 | OPEN |

---

## 已关闭（GitHub 已 completed）

| Issue | 仓库 | 关闭时间 | 说明 |
|-------|------|----------|------|
| `#52` getUserInfo 登录态 | auth | 2026-08-19 | auth-client + Chat/Portal 消费 |
| `#51` Auth Client 收口 | auth | 2026-08-19 | status machine + scoped signOut |
| `#41` 用户菜单 + getUserInfo | chat | 2026-08-19 | AuthAccountMenu + `/account#settings` |
| `#127` Embedded Chat Drawer | portal | 2026-08-19 | 与 #128 重复 |
| `#130` 顶栏 getUserInfo | portal | 2026-08-19 | AuthAccountButton + settings |
| `#43` Consumer Migration | API | 2026-08-19 | Chat/Portal/Auth 已切新 contract |
| `#42` / `#33` / `#34` | API | 2026-08-08 | Stage 1.0–1.2 |

PR 已合、不是跟踪 Issue：`chat#36`、`portal#128`、`auth#47`。

过期未合 PR：[`node-vercel-starter#63`](https://github.com/Acongm/node-vercel-starter/pull/63)（2026-08-13 后无更新）。main 已吸收其中的 settings / principal-once / first-token；**Pino / redaction / context=120 仍只在该 PR**。

---

## `#37` Final Quality Gate（对照 main，纠正 2026-08-18 文档）

| AC | 状态 | 证据 / 纠正 |
|----|------|-------------|
| API mock quality-gate | ✅ | `test/platform-v2-quality-gate.e2e-spec.ts` |
| Chat mock Playwright | ✅ | `chat` `e2e/quality-gate-smoke.spec.ts` |
| Portal mock Playwright | ✅ | `portal` `e2e/quality-gate-smoke.spec.ts` |
| Auth mock Playwright | ❌ | **auth 仓没有** `e2e/`（旧文档写错） |
| Chat live JWT chrome | ✅ | `chat` `pnpm test:e2e:live`（注入 session，不是生产 cookie） |
| Portal live JWT | ❌ | **portal 仓没有** `test:e2e:live`（旧文档写错） |
| 线上 `/api/user` `/api/chats` token 冒烟 | ✅ | `scripts/live-quality-gate.mjs`（无 stream/send） |
| 生产 `user_settings` | ✅（2026-08-19 生产评论） | 表 + RLS 已在 `ejprvntpxlyydkzsjqnv` |
| 生产 migration-history | ✅（2026-08-19 生产评论） | 已补 `20260606000000_create_comments` |
| Manual Linking / anonymous users | ✅ 配置 | Dashboard 已开；**真人同 uid 仍缺** → `auth#48` |
| Site URL / Redirect allow-list | ✅ 配置 | `https://auth.acongm.com` |
| Capability `it.todo` 清零 | ❌ | `test/assistant-ui-capabilities.todo.spec.ts` 仍有 8 条 |
| Stryker mutation threshold | ❌ | 仅有 `.github/scripts/chat-mutation-smoke.mjs` |
| 生产 cookie / OAuth browser | ❌ | 需 `*.acongm.com` |
| 生产真 LLM Send/Retry/Reload/Edit/Cancel | ❌ | mock / chrome 不能代替 |

**不要做**：KB / DocHub / Stage 3–6 / Portal shadcn Avatar 换皮。

---

## 源码已在 main、GitHub 仍 OPEN（更新正文，不关）

这些 Issue 的**实现 AC 已满足**，DoD 还挂着生产证明或父 Epic 范围，所以保持 OPEN，只改 checkbox / 状态段。

| Issue | 已在 main | 还不能关的原因 |
|-------|-----------|----------------|
| `auth#48` | `linkOAuthIdentity` / `protectAnonymousEmailSignup` / 合同测试 | 真人 OAuth 同 uid；`anonymous-identity-upgrade.test.mjs` 仍有 `test.todo` |
| `auth#28` | Account + BFF + settings | 无 Auth Playwright；browser smoke → `#37` |
| `auth#29` | `oauth-setup.md` + `isAllowedReturnTo` | 生产回跳回归 |
| `chat#40` | 非阻塞 shell + tail-first + mock e2e | 生产 cookie → `#37` |
| `chat#26` | v2 history / 失败不清空 / mock e2e | 生产 5-round stream；P1 context chip 未做 |
| `#56` | User API + JWKS + settings | 服务端 logout / 跨仓 cache DoD |
| `#57` | Chat v2 durable + tail-first | consumer / `#37` |
| `#59` | principal once + `chat.first_token` | context 上限 500；无 verifier-once 集成测试 |
| `#61` | `user_settings` + GET/PATCH + send 注入 | DELETE、skills 列、匿名策略单测 |

---

## 仍有代码缺口（保持 OPEN，正文标明缺口）

| Issue | 缺口 |
|-------|------|
| `#58` / `#60` | 无 Pino；无 redaction；ChatLogs 仍写消息正文；无 `docs/operational-logs.md` |
| `#35` | legacy `chat-threads` / JWT / SSE 仍在；等 `#37` 后才能 destructive |
| `#47` | Vercel Free 日限额 — 仓库设置/文档，不是代码 |
| `#48`（API CI） | workflow 仍写死 migration 路径 |
| `#49` | 无 CONTRIBUTING / agent 推送策略 |
| `auth#25` `#26` `#27` | 生产 GitHub / Google / Email SMTP |
| `portal#116` | Stage 0 生产连续可用，依赖上面几条 |

---

## Epic（等 `#37` / Stage 0，只更新快照）

| Epic | 快照 |
|------|------|
| `portal#1` | 总控；Stage 0 未关，Stage 1.3 代码已在 main |
| `portal#117` | 1.3 ✅；1.4 `#37` / 1.5 `#35` 未关 |
| `portal#129` | chrome + 非阻塞 embed + mock e2e ✅；生产 / live JWT / registry 未关 |
| `chat#1` | v2 consumer ✅；legacy `/api/chat/threads` BFF 仍在 |
| `chat#39` | `#40`/`#41` 已交付；P1 rename/search 未做 |
| `auth#16` | auth-client Supabase-only ✅；Stage 0 生产未关 |
| `auth#50` | session + account ✅；Security 页 / registry 未做 |
| `#32` / `#55` | `#42–#43` 已关；`#37` `#35` `#58` 未关 |

---

## 明确不做（不抢主线）

- DocHub：`dochub#1–#9`，`nvs#16–#19`，`portal#5`
- KB：`nvs#7–#15` `#20`，`chat#5`，`portal#4`
- Stage 2：`portal#118`
- Stage 5–6：`nvs#21` `#38` `#40` `#41`，`portal#7` `#10–#12` `#119` `#121` `#122`，`auth#42`，`chat#33`

`Acongm/agents` 当前 0 个开放 Issue。

---

## 同步 GitHub

正文文件在 `docs/issue-bodies/`。有写权限时：

```bash
bash scripts/gh-sync-issue-status.sh
```
