# Platform Issue Status（统一跟踪）

> 最后更新：2026-08-19  
> 本文档是各仓 GitHub Issues 的**单一真相源**；当 CI token 无法写 Issue 时，以本文为准，并手动同步到 GitHub。

## 方向修正（2026-08-13）

线上登录后不显示用户名、对话卡住、会话列表不确定是否保存，**根因不是前端菜单/滚动优化**，而是：

1. `https://api.acongm.com/` 调试台没有 `/api/user` 与 `/api/chats`，无法验证核心接口。
2. Chat/Portal 缺 `/api/user` BFF，`getUserInfo` 同源 404。
3. Chat composer 在 identity/history 未完成时会一直 disabled。

**正确执行顺序**：先完成用户中心 + Chat 会话 API，在调试台和单测验证 → 再给前端接 BFF → 最后才做 UI 打磨。KB / DocHub / Stage 3–6 **不抢主线**。

## 执行主线（当前 P0 顺序）

| 优先级 | 方向 | 主 Issue | 状态 |
|--------|------|----------|------|
| P0 | 用户中心 API + 调试台 | `#56` | **main** — GET profile + console + `TOKEN_EXPIRED` |
| P0 | Chat 会话 API + 调试台 | `#57` | **main** — tail-first + console Chats v2 |
| P0 | Chat/Portal `/api/user` BFF | `chat#41` / `portal#130` / `auth#52` | **main** — BFF + Portal 非阻塞 embed + `/account#settings` |
| P0 | 非阻塞 Chat 启动 / 首屏 history | `chat#40` | **main** — tail-first + 失败不清空 transcript |
| P0 | auth-client 唯一源 | `auth#51` | **main** — status machine + scoped signOut |
| P0 | Send critical path / TTFT | `#59` | **main** — principal once + `chat.first_token` + cache ≤ JWT exp |
| P0 | 结构化日志 | `#58` / `#60` | Phase 1 ✅ |
| P0 | Final Quality Gate | `#37` | **OPEN / 下一件** — API Bearer+cookie + Chat/Auth/Portal mock + Chat live JWT ✅；缺生产 `.acongm.com` cookie / OAuth / 真 LLM send |
| P1 | 完整 Settings 产品表 | `#61` | **Phase 4** — Auth `/account` 可写 model/prompt；Chat send 已注入 cached effective |
| P2 | DocHub Stage 4 | `dochub#9` | 不抢主线 |

---

## 已关闭 / 应关闭

| Issue | 仓库 | 关闭理由 | main 证据 |
|-------|------|----------|-----------|
| **#52** getUserInfo 登录态展示 | auth | AC 全部满足 | `210b0d8` + chat `d7cf211` + portal `39d1142` |
| **#127** Portal Embedded Chat v2 | portal | #128 已合入，contract 已绿 | `a367246` / `39d1142` |

### #52 验收清单（已完成）

- [x] `getUserInfo` / `useUserInfo` / `UserInfoView` 从 auth-client 导出
- [x] 登录后展示 profile 优先的 displayName/avatar
- [x] 匿名态 login CTA
- [x] 401 时回退，不抛未处理异常
- [x] chat/portal auth-client 已同步

### #127 验收清单（已完成）

- [x] Supabase anonymous + `/api/chats` BFF
- [x] lazy create + durable history
- [x] 无 legacy stream fallback
- [x] CI contract gate

---

## 进行中（Phase 1 完成 → Phase 2）

### `Acongm/chat#41` 用户菜单与 getUserInfo

| AC | 状态 |
|----|------|
| 侧栏 displayName/avatar 来自 `/api/user/info` | ✅ main `d7cf211` |
| 匿名/登录 CTA | ✅ |
| 用户菜单（账号/设置/退出） | ✅ AuthAccountMenu |
| Settings 入口（theme + auth account） | ✅ theme 本地；model/prompt 走 Auth `/account#settings` |
| 不阻塞 #40 | ✅ |

### `Acongm/portal#130` 顶栏账号态

| AC | 状态 |
|----|------|
| 顶栏 userInfo displayName/avatar | ✅ main `39d1142` |
| 未登录/loading/匿名 | ✅ |
| 账号/设置菜单（auth 跳转） | ✅ AuthAccountMenu + `/account#settings`；shadcn Avatar 仍可选 |
| 与 Chat/Auth 语义一致 | ✅ 三态对齐 + auth error retry |
| 嵌入 Chat 非阻塞 | ✅ FAB 始终挂载；composer 仅准备期/恢复失败禁用；tail-first history |

### `Acongm/auth#28` Account Profile

| AC | 状态 |
|----|------|
| `/account` + BFF + profile PATCH | ✅ |
| auth-client `getUserMe` / `updateUserProfile` | ✅ `210b0d8` |
| settings language/theme | ✅ `updateUserSettings` |
| browser smoke | ⏳ → #37 |

### `Acongm/node-vercel-starter#43` Consumer Migration

| 阶段 | 状态 |
|------|------|
| Chat #36 / Portal #128 / Auth profile | ✅ 源码已合入 |
| getUserInfo 全端消费 | ✅ 2026-08-13 |
| Live OAuth same-UID E2E | ⏳ |
| Browser smoke（Chat/Portal/Account） | ⏳ → #37 |

**建议**：源码迁移完成后可将 #43 标为 `completed`，live proof  sole 跟踪 #37。

### `Acongm/node-vercel-starter#56` Auth/User 模块

| 能力 | 状态 |
|------|------|
| `/me` `/info` `userInfo` | ✅ |
| profile PATCH + semantics | ✅ |
| settings GET/PATCH (preferences) | ✅ Phase 1 |
| PATCH 返回 refreshed `userInfo` | ✅ `5fad8cd` |
| 独立 settings 表 / cache / model prompt | ✅ UserService 读写 `user_settings` + uid/schemaVersion cache；缺行回退 preferences |

### `Acongm/node-vercel-starter#37` Final Quality Gate（当前唯一 P0）

| AC | 状态 | 阻塞 |
|----|------|------|
| API path：user + chats quality-gate | ✅ `platform-v2-quality-gate.e2e-spec.ts` | — |
| Chat Playwright mock smoke（composer / send / reload / edit / cancel / persist） | ✅ `e2e/quality-gate-smoke.spec.ts` | 仍是 mock，不是生产 JWT |
| Portal Playwright mock smoke（登录 chrome / FAB / send / restore / reload+edit） | ✅ `portal` `e2e/quality-gate-smoke.spec.ts` | 仍是 mock，不是生产 JWT |
| Auth Playwright mock smoke（登录 chrome / Account 资料+偏好） | ✅ `auth` `e2e/quality-gate-smoke.spec.ts` | 仍是 mock，不是生产 JWT |
| Keycloak 式 `/api/auth/session` + cookie userinfo | 🔄 API cookie live ✅；生产 browser cookie 仍缺 | `scripts/live-quality-gate.mjs` 现同时打 Bearer、`acongm_access_token`、Supabase SSR cookie |
| 线上 `/api/user` `/api/chats` 有 token 冒烟 | ✅ `scripts/live-quality-gate.mjs` | Management token 铸造临时用户 JWT，跑完删除 |
| 生产 `user_settings` migration | ⏳ | 需 Supabase 项目权限 + `#61` |
| 生产 migration-history 修复 | ⏳ | Supabase 项目权限 |
| Manual Linking + 匿名→OAuth 同 uid | ⏳ | `auth#48` + Dashboard，代码已在 #47 |
| Browser：Account 显示用户名 / settings | 🔄 mock ✅；live JWT 脚本 ✅ | `auth` `pnpm test:e2e` / `test:e2e:live`；缺生产 `.acongm.com` cookie |
| Browser：Chat Send / Retry / Reload / Edit / Cancel | 🔄 mock ✅；live JWT chrome ✅ | `chat` `pnpm test:e2e:live` 注入 session；缺生产 cookie / 真 LLM send |
| Browser：Portal 顶栏登录态 + Drawer 会话持久化 | 🔄 mock ✅；live JWT 脚本 ✅ | `portal` `pnpm test:e2e` / `test:e2e:live`；缺生产 cookie |
| Chat / Account 用户自定义 Agent（系统提示词 + skills） | ✅ | `PATCH /api/user/settings` 的 `skills`；Chat 侧栏 / Auth `#settings` 可编辑；send 注入为用户偏好，不并入 system policy |

**不要做**：KB / DocHub / Stage 3–6 / Portal shadcn Avatar 换皮（不阻塞）。

---

## Epic 子项快照

| Epic | Issue | 备注 |
|------|-------|------|
| Portal Stage 1 | `portal#117` | 1.3 代码完成；剩 #37 |
| Chat 产品 | `chat#39` | 依赖 #40 |
| Auth 产品 | `auth#50` | 依赖 #51 |
| API Stage 1 | `node-vercel-starter#32` | 等待 #37 gate |
| Program | `portal#1` | 见上表 P0 顺序 |

---

## 手动同步 GitHub（有写权限时执行）

```bash
# 关闭已完成
gh issue close 52 --repo Acongm/auth -c "getUserInfo 全端已合入 main，见 node-vercel-starter/docs/platform-issue-status.md" -r completed
gh issue close 127 --repo Acongm/portal -c "PR #128 已合入，见 platform-issue-status.md" -r completed

# 更新进行中 issue 正文（使用本仓库 docs 内各仓 AC 表）
gh issue edit 41 --repo Acongm/chat --body-file ...
gh issue edit 130 --repo Acongm/portal --body-file ...
```

Issue 正文模板已生成于 agent 会话 `/tmp/issue-chat-41.md`、`/tmp/issue-portal-130.md`。
