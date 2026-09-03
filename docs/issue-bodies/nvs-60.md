> **代码对照 2026-09-03（main）** — 与 #58 同缺口
> **仍开着的原因：** DoD 要求 Pino 模块 / auth 事件 / redaction / ChatLogs 分离 / runbook，main 都没有。
> **证据：** 同 #58。

---

父产品目标：#55 / #58
关联旧 Observability：#38

## 现状审计（main）
当前 `chat-logs` 实际承担的是“聊天内容记录”而不是标准 runtime logging：
- `ChatLogWriterService` 提取并持久化 user message、assistant message、thinking sample、sources、provider/model/tokens 等；
- `ChatLogsService.list()` 先 `DataStore.list()` 全量读取，再在 JS 中按 client/conversation/endpoint/pagePath/time 过滤和分页；
- `src/main.ts` 仍直接 `console.log()` 启动信息；
- package 当前没有 Pino/`nestjs-pino` 等 structured request logger dependency。

这会把 **conversation/audit 数据** 与 **应用运行日志** 混为一体，也无法形成 requestId/traceId 驱动的故障查询链路。

## 最终目标
建立标准 Operational Logs 模块：结构化 JSON、request correlation、敏感字段 redaction、可在 Vercel Runtime Logs/Log Drain 中查询；Chat 内容/历史属于业务数据或显式 audit，不再作为普通日志正文保存。

## 1. Logging foundation
优先采用成熟方案：
- [ ] Pino + `pino-http`/Nest integration（可选 `nestjs-pino`，按依赖复杂度评估）
- [ ] Nest bootstrap/system logger 与 application logger 使用同一输出规范
- [ ] production JSON，local pretty
- [ ] 禁止 feature code 直接 `console.log/error`（必要 bootstrap fallback 除外）
- [ ] logger interface 允许后续 exporter/Log Drain，不让 domain 依赖 Vercel SDK

参考：
- https://docs.nestjs.com/techniques/logger
- https://github.com/pinojs/pino-http

## 2. requestId / trace correlation
- [ ] 接受可信格式 `x-request-id` 或生成 UUID
- [ ] response 回写 `x-request-id`
- [ ] request child logger 自动绑定 `requestId`
- [ ] route/method/statusCode/durationMs 自动记录
- [ ] `traceId/spanId` 作为 OpenTelemetry 兼容字段；有 active span 时自动绑定
- [ ] Chat runId/conversationId 作为 domain correlation field，而不是替代 requestId

## 3. 标准事件
至少覆盖：
### Auth
- [ ] `auth.verify.start/success/failure`
- [ ] session/principal source、duration（不记录 token）
- [ ] profile/settings read/write failure

### Chat
- [ ] `chat.create`
- [ ] `chat.history.load`
- [ ] `chat.send.start`
- [ ] `chat.first_token`
- [ ] `chat.stream.done/cancel/error`
- [ ] `chat.persist.error`
- [ ] provider/model/tokens/duration/cost（可用时）
- [ ] 与 #59 的阶段 latency 对齐

## 4. Redaction / privacy
- [ ] Authorization
- [ ] Cookie / Set-Cookie
- [ ] refresh/access token
- [ ] password / secret / API key
- [ ] 默认不记录完整 request/response body
- [ ] 默认不记录 Chat user/assistant 正文和完整 reasoning
- [ ] error serializer 只输出安全字段 + stack（server logs）

## 5. ChatLogs 拆分
明确当前 `chat-logs` 的真实产品用途：
- [ ] Chat transcript 已由 `chats/messages/chat_runs` 持久化，不再重复把相同正文作为 operational log 写一份
- [ ] 若确有 admin audit/usage 产品需求，重命名/重构为明确的 `chat_audit` / usage/telemetry domain，并定义 retention/ACL
- [ ] 删除或迁移 `DataStore.list() → JS filter` 的日志查询路径
- [ ] operational logs 走 stdout → Vercel Runtime Logs / Log Drain，不同步写业务 DB
- [ ] 需要长期产品统计的数据以 structured metric/usage table 设计，不从日志正文反解析

## 6. Query / Runbook
- [ ] 能按 requestId 查询完整一次 API 调用
- [ ] 能按 runId 找到一次 Chat send 的 auth→DB→provider→persist 阶段
- [ ] 能按 route/errorCode/time range 查询
- [ ] Vercel Runtime Logs 查询示例写入 docs
- [ ] 后续若接 Log Drain/OTel backend，只替换/增加 transport，不改业务调用

## 7. Tests
- [ ] requestId generate/pass-through/response header
- [ ] standard JSON event schema
- [ ] duration/status/error level
- [ ] redaction token/cookie/password/message body
- [ ] Chat first-token/runId correlation
- [ ] Auth verify correlation
- [ ] logger failure 不影响主业务请求

## DoD
看到任意 Auth/Chat production 错误后，可以从一个 `requestId`/`runId` 定位完整调用路径和耗时，同时 operational logs 中不存在 access token、cookie、密码或默认 Chat 正文泄漏；现有 `chat-logs` 不再与 runtime logs 概念混用。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
