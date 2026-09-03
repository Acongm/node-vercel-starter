> **代码对照 2026-09-03（main）** — P0 实现 + mock e2e 在 main
> **仍开着的原因：** 生产 cookie / 真 LLM 归 `node-vercel-starter#37`。
> **证据：** `chat-workspace-app.tsx` 始终挂载；`composerDisabled` 仅 restoring/error；`loadOlderMessages`；`chat-nonblocking-startup.test.mjs`；`e2e/quality-gate-smoke.spec.ts`。

---

父产品目标：#39
后端性能：`Acongm/node-vercel-starter#57/#59`

## 现状审计（main）
当前 `ChatWorkspaceApp` 的 main 区域存在两个硬阻塞：

1. `!authIdentity` 时整个 `ChatFullscreen` 不挂载，只显示“正在准备安全会话…”；
2. 有 active thread 且 `seedStatus=loading` 时整个 Chat UI 不挂载，只显示“加载会话…”。

同时 `use-chat-threads.ts` 的 `loadDurableHistory()` 会从首个 messages page 开始循环读取所有 cursor，直到完整恢复全部历史（上限 5000 条）才返回；因此打开历史会话的等待时间会随 transcript 变长。

load error 当前还会 `setSeedMessages([])`，这会把错误路径变成空 seed，而不是保留已有可用 transcript/cache。

另外 `ThreadSidebar` 明确通过 `portalHref` 渲染“返回文档站”链接，当前 `ChatWorkspaceApp` 始终传入 `portalBase`。

## 最终目标
达到成熟 ChatGPT 类产品的启动体验：**shell/composer 先可用，身份和 sidebar 异步准备；打开历史会话只加载首屏必要消息，旧消息按滚动/操作 lazy 加载；错误不摧毁已有 UI 状态。**

## P0-1 移除整页 Auth blocking
- [x] `ChatFullscreen`/composer 不再由 `authIdentity` 是否 ready 决定是否挂载
- [x] anonymous bootstrap 作为 background state machine：`restoring → anonymous/authenticated → error/retry`
- [x] session 未就绪时 composer pending/disabled，shell 仍在
- [ ] warm session 直接复用，不重复 anonymous bootstrap
- [ ] bootstrap timeout/error 有 retry，不永久显示“正在准备安全会话…”
- [ ] login/logout/UID change 只 invalidate identity-bound data

## P0-2 History 首屏 + lazy pagination
- [x] `selectThread()` 不再等待 0..5000 条历史全部恢复
- [x] 打开 thread 只获取最新/首屏所需 message page 后立即 render
- [x] older messages 使用 cursor lazy load（向上滚动）
- [ ] active branch 所需 parent/linkage 在分页情况下仍正确
- [ ] sidebar metadata/list 与 message history 分离
- [ ] 500/5000 message conversation 进入首屏的请求次数保持 bounded

如当前 backend cursor 方向不适合“最新一页 → 向旧加载”，在 `node-vercel-starter#57` 补充明确 contract，而不是前端循环把全量历史拉回来。

## P0-3 Loading / error / retry
- [ ] sidebar list loading 不阻塞 active composer
- [ ] history loading 使用 Skeleton/Thread loading state，而不是替换整个 workspace
- [x] history 请求失败时保留当前 cache/已显示 messages
- [x] 禁止 error path 将有效 transcript 重置为 `[]`
- [ ] chat list/history 独立 error + retry
- [ ] 切换 A→B→A 时可复用 identity-scoped cache，并后台 revalidate

## P0-4 移除不必要 Portal 入口
- [x] Chat 主 sidebar 去除“返回文档站”链接（workspace 不再传 `portalHref`）
- [x] `portalHref` 从 Chat 产品默认 preset 移除（组件仍接受 opt-in）
- [ ] 不影响 Portal embedded Chat 自身 docs↔chat linkage

## P0-5 用户流程测试
新增行为测试而非仅源码 contract：
- [x] no session cold start：shell/composer 立即存在（mock e2e + 合同）
- [ ] warm anonymous session：无明显“安全会话”阻塞
- [ ] authenticated warm/cold start
- [x] 500+ message thread：首屏不全量拉取（合同 + mock e2e long thread）
- [ ] history page 2/3 lazy load 顺序正确
- [x] history request failure：已有 transcript 不清空（合同）
- [ ] sidebar request failure 不影响当前 conversation
- [ ] A→B→A cache/revalidate
- [ ] logout 后创建新 anonymous identity，旧 UID cache 不串

## 参考
- assistant-ui Thread Runtime：`isLoading`/`isRunning` 是 thread state，不要求用一个整页占位替换整个 Chat UI
- assistant-ui RemoteThreadListRuntime：backend-owned thread metadata/history 可独立管理
- Vercel Chatbot：认证、持久化 history 与 Chat UI 分层

## DoD
线上不再长时间停留在“正在准备安全会话…”或“加载会话…”；历史长度不会线性增加进入会话的等待；sidebar/history/Auth 任一路径失败都不会让整个 Chat 页面不可用。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
