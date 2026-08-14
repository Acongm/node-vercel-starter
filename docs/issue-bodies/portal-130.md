## Parent
- 产品目标：#129
- Auth：`Acongm/auth#50/#51` ✅
- Shared UI：`Acongm/shadcn-ui#15`
- 后端：`Acongm/node-vercel-starter#56` ✅

## Acceptance criteria
- [x] 顶栏显示服务端 `displayName` / `avatarUrl`
- [x] 已登录菜单含账号/设置（`/account#settings`）/退出（`AuthAccountMenu`）
- [x] 未登录显示登录入口，loading 态不闪错
- [x] 与 Chat/Auth 文案与视觉语义一致
- [x] 嵌入 Chat 非阻塞：FAB 始终挂载；composer 仅准备期/恢复失败禁用

## 进度（2026-08-14）
**main 已完成**。可选 polish：shadcn Avatar。Browser smoke → #37。
