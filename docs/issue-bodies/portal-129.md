> **代码对照 2026-09-03（main）** — 登录 chrome + 非阻塞 embed + mock e2e 在 main
> **仍开着的原因：** 本仓 **没有** `test:e2e:live`。Shared UI 未完全迁 registry。生产 cookie 归 #37。
> **证据：** `AuthAccountButton` + `/account#settings`；`doc-chat-embed.tsx`；`e2e/quality-gate-smoke.spec.ts`；chats/user BFF。

---

后端 Auth/User：`Acongm/node-vercel-starter#56`
后端 Chat：`Acongm/node-vercel-starter#57`
Shared UI：`Acongm/shadcn-ui#14`
Auth 产品：`Acongm/auth#50`
Chat 产品：`Acongm/chat#39`

## 最终目标
`www.acongm.com` 作为 Portal/文档主站，需要同步消费标准 Auth、Chat 与 Shared UI 能力，而不是在 Portal 内维护另一套登录、Chat、主题实现。

## Shared UI
- [ ] Header/navigation/account controls 使用共享组件与 semantic theme
- [ ] Button/Input/Dropdown/Avatar/Sheet/Dialog/Alert/Skeleton 等不重复 fork
- [ ] light/dark/system 与 Auth/Chat 一致
- [ ] loading/empty/error/disabled 状态使用同一规范
- [ ] mobile/desktop responsive

## 登录状态
- [x] 使用统一 Auth/User contract
- [x] 页面首次打开不因 session/profile 请求阻塞文档主体
- [x] header/user menu 明确 loading/anonymous/authenticated
- [ ] 登录进入 `auth.acongm.com` 并能 return_to 当前文档
- [ ] logout/identity change 后 Portal UI 状态及时更新
- [x] Account/Settings 跳统一 Auth 页面（`/account#settings`）

## Embedded Chat
### 启动性能
- [x] 打开 Drawer 后快速展示 composer/shell（FAB 始终挂载）
- [ ] anonymous/session bootstrap、chat create、history load 按需/并行，不出现长时间“准备会话”阻塞
- [x] 文档主体渲染与 Chat 初始化解耦

### 会话/历史
- [ ] 当前 pagePath 对应 chat pointer 仅用于定位
- [x] history 使用后端标准 Chat API
- [ ] history loading/error/retry 明确
- [ ] API 失败不静默生成另一份 transcript
- [ ] 文档切换 context 更新且不串历史

### 发送/交互
- [ ] send 不等待无关 sidebar/profile/history 全量请求
- [ ] optimistic user message + streaming
- [ ] Stop/Retry/Reload 与 Chat 主站语义一致（启用项）
- [ ] reasoning/source/citation UI 与 Chat shared contract 对齐
- [ ] 不复制 chat.acongm.com 完整 conversation management，只保留 embedded 必要体验

## Docs ↔ Chat
- [ ] 当前文档 title/path/module/context 注入规则明确
- [ ] citation 可回当前 Portal 文档/anchor
- [ ] history chat restore 不伪造当前页面 context

## Tests
- [x] cold page load：文档不等待 Auth/Chat（合同 + mock e2e）
- [x] anonymous/authenticated header state（mock e2e）
- [ ] login return_to 当前文档
- [x] Drawer open → send → stream → close/reopen → refresh（mock e2e）
- [ ] history failure/retry
- [ ] 文档 A/B 切换 context/chat pointer
- [ ] light/dark/mobile screenshot regression

## DoD
Portal 的文档浏览保持快速；登录和 Embedded Chat 使用 Auth/API 标准能力；UI 与 Auth/Chat 视觉和交互一致，同时不把 Portal 做成第二个 Auth/Chat 产品。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
