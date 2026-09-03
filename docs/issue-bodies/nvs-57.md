> **代码对照 2026-09-03（main）** — Chat v2 API 核心在 main；产品 DoD 未关
> **仍开着的原因：** consumer 非阻塞 / 真 LLM / 场景矩阵归 #37；context 上限仍 500。
> **证据：** `chat.service.ts` / `chat.repository.ts` / `test/chat.pagination.spec.ts` / `test/chat.send-critical-path.spec.ts` / quality-gate e2e。

---

父目标：#55
消费者：`Acongm/chat` / `Acongm/portal`

## 最终目标
把 Chat 做成可复用、低延迟、接近成熟 ChatGPT 类产品体验的标准模块。重点不是继续增加按钮，而是让“进入页面 → 准备会话 → 发送 → stream → history → 切换会话”稳定且快。

## 开源参考
- Vercel Chatbot: https://github.com/vercel/chatbot
- assistant-ui: https://github.com/assistant-ui/assistant-ui
- assistant-ui thread/runtime/remote thread list/streaming patterns

## P0 性能目标
### Send critical path
- [ ] 发送消息前不串行等待不必要的 profile/settings/history 全量请求
- [ ] 已有 session/chat 时直接进入 message/run 创建 + provider stream
- [ ] anonymous identity/bootstrap 可缓存并复用，避免每次发送重复准备
- [ ] 首字节/首 token latency 建立可测指标与 regression test
- [x] title/touch/telemetry 等辅助任务不得阻塞 stream 首包

### 会话初始化
- [ ] 新访客快速进入可输入状态；“正在准备安全会话…”不得成为长时间阻塞页
- [ ] anonymous/authenticated 统一 conversation bootstrap contract
- [ ] 登录状态变化只重建必要 identity-bound state，不重新加载无关数据

## Conversation / History API
- [x] create/list/get/update/delete chats
- [x] cursor pagination + stable ordering
- [x] list 只返回 sidebar 所需摘要，不携带完整 transcript
- [x] messages/history 独立分页加载
- [ ] active chat 首屏只加载首屏所需消息；长历史 lazy load
- [x] 支持“最新消息首屏 → older messages 向前分页”的明确 cursor contract（`order=desc` + `prevCursor`）
- [ ] thread/chat metadata 与 transcript 分离
- [x] anonymous 与 authenticated history ownership 一致使用 `auth.uid`

## Cache strategy
- [ ] chat list cache / active history cache / model context cache 职责分离
- [ ] server durable history 是 truth，browser cache 只做提速
- [ ] create/update/delete 后精准 invalidate，不全量刷新所有历史
- [ ] identity change/logout 后清理 UID-bound cache
- [ ] 避免“加载会话…”因缓存/restore 异常进入永久错误或空白状态

## Stream / Run
- [x] 标准 message parts + UIMessage/message stream 语义
- [x] stable clientMessageId/runId/idempotency
- [ ] retry/reload 不重复 user turn
- [ ] cancel/abort/error/incomplete durable state
- [ ] provider timeout/error 与 persistence failure 分层
- [ ] done 只在 durable terminal state 后发送

## 功能 contract
- [x] 默认模型、系统/用户默认 prompt 等 settings 可从 User Settings 注入
- [ ] page/module/knowledge context 是可选 input，不污染通用 Chat domain
- [ ] web search/tool/source/reasoning 通过 parts 扩展
- [ ] 不支持的 edit/branch/resume 等能力显式 capability=false

## 当前实现队列
1. `#59` — **Send critical path**：一次 request 只验证一次 principal，压缩 pre-stream DB/Auth 路径并建立 first-token telemetry。
2. `Acongm/chat#40` — **Non-blocking consumer**：Chat shell/composer 不再被 auth/full-history 阻塞；history 首屏 + lazy pagination；错误不清空 transcript。
3. User Settings integration — 在 `#56` settings contract 后注入默认 model/prompt。
4. `#58/#60` — 把 `chat.first_token/history.load/provider/done` 纳入统一 structured logs，持续用真实数据验证性能。

## Tests：必须按用户场景设计
- [ ] anonymous 首次进入 → send，不因安全会话 bootstrap 长时间等待
- [ ] authenticated 首次进入 → sidebar/history async load，不阻塞 composer/send
- [ ] 50/500+ chats cursor list
- [ ] 长会话 history lazy pagination
- [ ] send 首 token latency regression
- [ ] refresh / switch A-B-A / delete active
- [ ] reload/retry idempotency
- [ ] cancel/provider failure/persist failure
- [ ] anonymous → login/signup ownership/cache behavior

## DoD
Chat consumer 不再为了“准备身份、加载所有 history、同步 sidebar”等前置工作拖慢消息发送；常见 ChatGPT 类会话行为都有明确接口、缓存策略和场景测试。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
