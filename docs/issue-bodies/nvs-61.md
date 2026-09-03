> **代码对照 2026-09-03（main）** — API + migration 在 main；产品表未关
> **仍开着的原因：** 无 DELETE/reset-by-key；skills 仍写 preferences；匿名策略/同 uid 保留未 live 证。生产表已在 2026-08-19 评论中确认存在。
> **证据：** `supabase/migrations/20260814010000_user_settings.sql`；`UserService`；`test/user-settings*.spec.ts`；Chat `loadSendSettings`。

---

父目标：#55 / #56 / #57
消费者：`Acongm/auth#50` / `Acongm/chat#39` / `Acongm/portal#129`

## 背景
当前 application profile 已有 `/api/user/me`、`/api/user/profile`，但没有独立、稳定的 User Settings contract。Chat 当前 `ChatSettingsSlot` 实际只有 ThemeToggle，无法保存用户级默认模型、默认 Prompt 等跨设备偏好。

## 最终目标
提供与 identity/profile 分离的通用 User Settings API：server defaults + user overrides + versioned schema + cache/invalidation。Auth 作为完整管理页面，Chat/Portal 只消费自己需要的 settings。

## 1. 数据模型
建议独立 `user_settings`（或等价明确结构），不要无限膨胀 `profiles.preferences`：
- [x] `user_id` PK/FK → auth user/profile ownership
- [x] `schema_version`
- [x] `theme`（server-sync 列存在；Chat 主题仍可本地）
- [x] `language`（启用时）
- [x] `chat.default_model`
- [x] `chat.default_prompt`
- [ ] 未来 settings 使用 namespaced JSON/typed columns 的边界明确
- [x] timestamps
- [x] RLS owner-only

不得存：password/token/provider secret/role authorization。

## 2. API contract
- [x] `GET /api/user/settings`
- [x] `PATCH /api/user/settings`
- [ ] 可选 `DELETE /api/user/settings/:key` 或 reset semantics，优先简单明确 contract
- [x] response 同时给 `effective` 与必要的 `overrides`/defaults version
- [x] partial PATCH；omitted != clear/reset
- [x] default prompt 明确长度上限/空值/reset 语义
- [x] model 必须来自 server model capability/allow-list
- [ ] unknown/obsolete setting 有 migration/version 策略

## 3. Defaults / override
- [x] platform defaults 有单一配置来源
- [x] user overrides 覆盖 defaults
- [x] reset 后立即回 default（PATCH null）
- [x] 默认模型不可用时 fallback 规则稳定
- [x] default prompt 只作为用户偏好注入，不能覆盖 server security/system policy
- [ ] page/module Chat context 与 user prompt 分层，不拼成不可追踪字符串

## 4. Cache / invalidation
- [x] settings 按 `auth.uid + schemaVersion` 缓存
- [x] PATCH/reset 精准 invalidate/update
- [ ] logout/UID switch 清理 consumer cache
- [x] send critical path 不为每条消息重新 remote fetch settings（服务端 cache）
- [ ] Chat 可在 session ready 后预取/缓存 effective settings；发送只读取已解析值

## 5. Chat integration
- [x] request DTO/AI orchestration 接受经过 server validation 的 effective model/default prompt
- [x] default prompt 注入位置和 server system prompt precedence 有测试
- [ ] settings change 对“当前正在进行的 run / 下一条 message / 新 conversation”的生效规则明确
- [ ] provider/model 不可用时 stable error/fallback

## 6. Tests
- [x] no settings row → defaults
- [x] partial overrides
- [x] prompt set/clear/reset/length validation
- [x] allowed/disallowed model
- [x] cache hit + PATCH invalidation
- [ ] user A/B RLS
- [ ] anonymous settings policy（允许持久化到 anonymous UID 或只用 defaults，需要明确）
- [ ] anonymous → same UID signup 保留 settings
- [ ] login existing UID switch 不串 settings
- [ ] default prompt 不能覆盖安全 system instructions

## DoD
Auth/Chat/Portal 不再各自使用 localStorage/yaml 临时保存用户级通用偏好；默认 model/prompt 等设置有统一 API、RLS、缓存和测试，并且不会增加每次 Chat send 的前置网络开销。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
