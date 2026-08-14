## Parent
- 产品目标：#39
- 非阻塞启动：#40 ✅
- Auth Client：`Acongm/auth#51` / getUserInfo：`Acongm/auth#52` ✅
- 后端：`Acongm/node-vercel-starter#56` ✅
- Shared UI：`Acongm/shadcn-ui#15`

## What to build
Chat 侧栏账号区与用户菜单使用服务端 `userInfo`，并提供 Account/Settings 入口；Theme 不再冒充完整 Settings。

## Acceptance criteria
- [x] 侧栏展示 `displayName` / `avatarUrl` / 账号（来自 `/api/user/info`）
- [x] 已登录有用户菜单：账号、设置、退出（`AuthAccountMenu`）
- [x] 匿名/访客态可区分，登录 CTA 清晰
- [x] Settings 入口：本地 theme + 跳转 Auth `/account#settings`（`ChatSettingsSlot`）
- [x] 不阻塞 #40 的非阻塞启动路径

## 进度（2026-08-14）
**main 已完成**。剩余 browser smoke 由 #37 统一跟踪。
