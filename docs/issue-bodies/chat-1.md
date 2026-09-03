> **代码对照 2026-09-03（main）** — v2 consumer 在 main
> **仍开着的原因：** legacy `/api/chat/threads` BFF 仍在；#37/#35 未关。
> **证据：** cutover 合同 + `#36` MERGED + `#41` CLOSED。

---

平台总控：`Acongm/portal#1`
当前执行：`Acongm/portal#116` → `#117`
后端主重构：`Acongm/node-vercel-starter#32`

## 当前状态
旧 Epic 的 Next/Vercel、ChatFullscreen、assistant-ui、thread rail、移动端、reasoning/source UI、Auth 接入、匿名限额、ChatGPT workspace 等主体已经完成。

当前目标从“继续补 UI 功能”切换为：**可靠性 + 单一 server truth + Chat v2 contract**。

## Stage 0 — P0 Reliability
- [ ] #26 只保留真实未完成问题：stream 完成不清空、history 完整、refresh/switch thread 一致
- [ ] PR #25 合入并生产验证
- [ ] draft → persisted thread promotion 不重置 runtime
- [ ] 通用会话/无知识上下文会话完整恢复
- [ ] 移动端/桌面一致

## Stage 1 — Chat v2 client
- [ ] 从 legacy `/api/chat/threads*` 迁 `/api/chats*`
- [ ] Supabase session access token 作为 authenticated request credential
- [ ] list/history 使用 cursor pagination
- [ ] server persisted history 为唯一真相；sessionStorage 只做非权威 draft/cache（如仍需要）
- [ ] message model 使用 parts
- [ ] reasoning/source/tool/file/data 走统一 part adapter

## Stream
- [ ] 迁标准 UIMessage/message stream 语义
- [ ] abort/retry/failure/persisted 行为确定
- [ ] 保留 page/module knowledge context、Tavily、rate limit、usage
- [ ] 不再新增 legacy SSE event type

## Auth/Anonymous
- [ ] authenticated 状态统一 loading/anonymous/authenticated
- [ ] anonymous identity 与 API #32 的可信方案对齐
- [ ] 移除 clientId 作为最终 ownership
- [ ] account upgrade 后 history 不丢失

## Shared UI
最终对齐 `Acongm/portal#118` / `Acongm/shadcn-ui`：
- [ ] chat-client
- [ ] chat-message
- [ ] chat-composer
- [ ] thread-list
- [ ] chat aggregate block

## DoD
- [ ] stream → refresh → history 永不丢消息
- [ ] 跨设备登录后 history 可恢复
- [ ] user A 不能通过 chat id 读取 user B 会话
- [ ] portal embedded chat 与 chat.acongm.com 使用同一 contract
- [ ] legacy thread API 调用归零
- [ ] 新 Chat 能力只通过 parts/domain 扩展

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
