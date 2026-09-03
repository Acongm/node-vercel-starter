> **代码对照 2026-09-03（main）** — Phase 1 only
> **仍开着的原因：** 无 Pino；无 redaction；无独立 logs 模块；ChatLogs 仍持久化消息正文。PR #63 未合。
> **证据：** `request-id.middleware.ts` + `http-request-log.middleware.ts` + `app-logger.ts`；`chat.first_token`。

---

父目标：#55
关联旧 Observability：#38
实现主任务：#60

## 最终目标
把当前零散 `console` / Logger 调用收敛成标准 Logs 模块，使 API/Auth/Chat/未来 KB/DocHub 的日志格式统一、可关联、可查询，并且不会泄漏 token/password/message 等敏感信息。

## 技术基线
优先使用成熟标准，而不是自建 logger：
- NestJS Logger abstraction
- Pino / pino-http structured JSON logging
- requestId / traceId propagation
- OpenTelemetry 作为 trace/metrics 集成边界（JS Logs SDK 不作为第一阶段强依赖）

## 重要边界
当前 `chat-logs` 是 conversation/audit-like 数据记录，不等于 operational logs。#60 负责拆分：
- Runtime/operational log → structured stdout / Runtime Logs / Log Drain
- Chat transcript → `chats/messages/chat_runs`
- 真有产品需求的 audit/usage → 独立 schema/retention/ACL，不重复保存默认聊天正文当“日志”

## Logging contract
每条应用日志至少约定：
- timestamp
- level
- service / module / context
- event / message
- requestId
- traceId/spanId（存在时）
- userId/anonymousId（允许且已脱敏时）
- route/method/statusCode/durationMs
- error code/class/stack（error only）
- deployment/environment/version

## HTTP logging
- [ ] requestId 接收 `x-request-id` 或生成 UUID，并回写 response
- [ ] request start/completed/error 自动记录
- [ ] 4xx/5xx level 策略统一
- [ ] duration 可查询
- [ ] child logger 自动绑定 requestId/trace/user/module

## Domain events
- [ ] Auth：login/session/token/profile/settings/logout failure/success（不记录 credential/token）
- [ ] Chat：create/send/first-token/done/cancel/provider-error/persist-error/history-load
- [ ] AI：provider/model/latency/token usage/cost fields
- [ ] DB/RLS：只记录必要 operation/result/error，不 dump SQL secret/data

## Sensitive data
- [ ] Authorization/Cookie/refresh token/password/secret 默认 redact
- [ ] request/response body 默认不完整记录
- [ ] Chat message正文默认不进入 production logs
- [ ] error object 使用标准 serializer

## Query strategy
- [ ] 本地开发：pretty console
- [ ] Vercel production：structured stdout 可在 Runtime Logs 查询
- [ ] 长期检索/聚合：Log Drain/OTel exporter 接集中式 backend，不把所有日志同步写业务 DB
- [ ] 按 requestId/traceId/user/module/errorCode/time range 的查询方法/runbook
- [ ] admin/debug API 只查询安全聚合/业务 audit，不代理完整平台日志

## 当前执行队列
1. `#60` — Pino/requestId/trace/redaction + ChatLogs 拆分。
2. `#59` — 接入 `auth.verify` / `chat.send.start` / `chat.first_token` 分段耗时。
3. 后续根据真实查询需求再决定 Log Drain / OTel backend，不提前引入重型平台。

## Tests
- [ ] requestId propagation
- [ ] child logger fields
- [ ] error serialization
- [ ] redaction（token/cookie/password）
- [ ] Chat/Auth 标准 event schema
- [ ] production JSON 可被 parser/query backend 正确解析

## 参考
- NestJS Logger: https://docs.nestjs.com/techniques/logger
- Pino HTTP: https://github.com/pinojs/pino-http
- OpenTelemetry JS: https://opentelemetry.io/docs/languages/js/

## DoD
看到一个 Auth/Chat 错误时，可以用 requestId/traceId 在统一日志中找到完整调用链和耗时；日志字段稳定、可检索、无敏感信息泄漏。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
