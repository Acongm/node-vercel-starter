# Platform Issue Status（统一跟踪）

> 最后更新：2026-08-13  
> 本文档是各仓 GitHub Issues 的**单一真相源**；当 CI token 无法写 Issue 时，以本文为准，并手动同步到 GitHub。

## 执行主线（当前 P0 顺序）

| 优先级 | 方向 | 主 Issue | 状态 |
|--------|------|----------|------|
| P0 | 非阻塞 Chat 启动 / 首屏 history | `Acongm/chat#40` | OPEN — Phase 1 ✅ shell + 渐进 history |
| P0 | auth-client 唯一源、消除 fork 漂移 | `Acongm/auth#51` | OPEN — AuthAccountMenu 用户菜单 ✅ |
| P0 | chat 模块唯一源、portal 接入 | `Acongm/chat#39` | OPEN — integration 层 + #41 菜单 ✅ |
| P0 | Send critical path / TTFT | `Acongm/node-vercel-starter#59` | OPEN — token cache + parallel history load ✅ |
| P0 | 结构化请求/Chat 日志（Vercel 可见） | `Acongm/node-vercel-starter#58` / `#60` | **Phase 1 ✅** JSON `http.request` + `chat.send.*` |
| P0 | Final Quality Gate（browser + RLS E2E） | `Acongm/node-vercel-starter#37` | OPEN |
| P1 | 完整 Settings 产品（独立表/model/prompt） | `Acongm/node-vercel-starter#61` | OPEN |
| P2 | DocHub Stage 4 启动 | `Acongm/dochub#9` | OPEN（gate 未满足，不抢主线） |

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
| 用户菜单（账号/设置/退出） | ⏳ Phase 2 |
| Settings 入口（theme + auth account） | ⏳ Phase 2 |
| 不阻塞 #40 | ⏳ 待 #40 |

### `Acongm/portal#130` 顶栏账号态

| AC | 状态 |
|----|------|
| 顶栏 userInfo displayName/avatar | ✅ main `39d1142` |
| 未登录/loading/匿名 | ✅ |
| 账号/设置菜单（auth 跳转） | ⏳ Phase 2（待 shadcn #15） |
| 与 Chat/Auth 语义一致 | ✅ 三态对齐 |

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
| 独立 settings 表 / cache / model prompt | ⏳ → #61 |

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
