# Platform Issue Status（统一跟踪）

> 最后更新：2026-08-14  
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
| P0 | Final Quality Gate | `#37` | **live API+schema ✅** — 剩 anonymous / Manual Linking / browser OAuth / mutation |
| P1 | 完整 Settings 产品表 | `#61` | **Phase 4 + live table ✅** — `user_settings` 已应用到 nest；Account 可写 model/prompt |
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
| 账号/设置菜单（auth 跳转） | ✅ AuthAccountMenu + `/account#settings`（`portal` `490c773`）；shadcn Avatar 仍可选 |
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
| **live `user_settings` 表** | ✅ 2026-08-14 已应用到 nest；PATCH theme/defaultPrompt 落表 |

---

## Live evidence（2026-08-14，#37）

对生产项目 `nest`（`ejprvntpxlyydkzsjqnv`）与 `https://api.acongm.com` 的只读审计 + 加性迁移 + 临时用户验收。复跑：

```bash
ACONGM_SUPABASE_ACCESS_TOKEN=... python3 scripts/live-quality-gate.py
```

详见 `docs/live-quality-gate.md`。

### 已落地（加性，未做 historical tracking repair）

- `20260808050000_comments_constraints_repair`：`comments_author_check` / `comments_content_check` 已 VALIDATE；既有 4 行 comments 全部合规
- `20260814010000_user_settings`：`public.user_settings` + owner-only RLS
- **未执行** `20260606000000_create_comments` 的 history repair（#37 仍要求显式授权）

### 已证明的生产 API 路径

| 检查 | 结果 |
|------|------|
| `GET /api/health` | `dataMode=supabase` |
| `GET /api/user/info` 无 token | 401 `AUTH_REQUIRED` |
| `GET /api/chats` 无 token | 401 `AUTH_REQUIRED` |
| `GET /api/user/info` 非法 token | 401 `INVALID_TOKEN` |
| 临时用户 `GET /api/user/info` | 200，`userInfo` 有 display 字段 |
| `GET/PATCH /api/user/settings` | 200，`effective.theme=dark`，`user_settings` 行存在 |
| `POST/GET/DELETE /api/chats` | 201 / 200 / 204 |
| 用户 B 读用户 A 的 chat | 404（不泄漏） |
| 临时用户清理 | 2 个 admin user 已删除 |

### 仍阻塞 #37 关闭的生产项

| 项 | 现状 | 为何还不能关 |
|----|------|----------------|
| Anonymous Auth | `external_anonymous_users_enabled=false` | Chat/Portal guest bootstrap 无法在生产走 `signInAnonymously()` |
| Manual Linking | `security_manual_linking_enabled=false` | `auth#48` same-uid OAuth upgrade 无法 live 证明 |
| Redirect allow-list | `uri_allow_list` 为空 | OAuth 回跳只靠 `site_url=https://auth.acongm.com/callback` |
| Browser E2E | 未跑真实 GitHub/Google 登录 | 需要浏览器 + 真人 OAuth；本 run 不改 Auth 开关 |
| Mutation suite | 代码侧 sibling 分支在补 contracts | 不替代 live Auth/JWT 证明 |
| History repair | `20260606000000` 仍缺 tracking | 按 #37 评论：约束修复之后仍需显式授权 |

本 run **没有**打开 anonymous / Manual Linking，也没有改 OAuth client 配置。

---

## Epic 子项快照

| Epic | Issue | 备注 |
|------|-------|------|
| Portal Stage 1 | `portal#117` | 1.3 代码完成；剩 #40/#37 |
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
