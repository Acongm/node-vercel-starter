> **代码对照 2026-09-03（main）** — 已被 Chat v2 主路径替代；生产 5-round 与 P1 chip 未关
> **仍开着的原因：** 不要再按 legacy PR #25 / sessionStorage 路径实现。P1 `moduleKey/pagePath` chip 恢复未做。
> **证据：** v2 `/api/chats`；`threadSeedCache`；mock e2e reload/retry/persist；`chat-v2-runtime-stability.test.mjs`。

---

关联 Epic：#1
平台 Stage 0：`Acongm/portal#116`

## 背景
原 Issue 同时记录了 stream 清空、history、登录态、暗黑模式。后续提交已经完成 OAuth 用户身份展示以及 portal/chat/auth semantic theme 统一，因此本 Issue 收敛为真正仍阻塞使用的 **Chat 数据/Runtime 一致性问题**。

## P0-1 流式结束后内容不能消失
- [ ] 合入/验证 PR #25
- [ ] draft → thread promotion 保持同一 runtimeKey/消息状态
- [ ] persisted → threads refresh 不触发空 seed 覆盖
- [ ] sessionStorage 不得用空历史覆盖有效 runtime
- [ ] 增加该复现链路的回归测试

## P0-2 Server history 完整
- [x] 普通无文档会话完整保存/读取（v2 `/api/chats`）
- [ ] text/reasoning/source 等可见 message parts 不因 `content` 空而被丢弃
- [ ] thread list 与 active history 的数据版本一致
- [x] 不依赖本地 sessionStorage 才能恢复已持久化会话
- [x] API failure 时明确显示错误，不静默回退为空历史

## P0-3 Thread 切换/刷新
- [ ] refresh 当前页面后 active thread 消息一致
- [ ] thread A → B → A 消息不串/不丢
- [ ] 新建 draft → persisted → 切换 → 返回正常
- [ ] 删除 active thread 后回到安全 draft 状态
- [ ] 移动端 sheet 与桌面 rail 行为一致

## P1 上下文恢复
- [ ] 选中历史会话时恢复 `moduleKey/pagePath/knowledge refs`
- [ ] 通用 `_general` 会话不伪造文档上下文
- [ ] context chips 与真正发送给 API 的 context 一致

## 已完成/移出本 Issue
- [x] 已登录用户 avatar/name/email 可见
- [x] login return_to / claim 顺序已经过多轮修复
- [x] portal/chat/auth light/dark/system semantic theme 已统一
- [x] 旧独立 chat theme 逻辑已被统一 ThemeToggle 取代

## 与 Chat v2 的关系
本 Issue 先保证 legacy/current UI 可稳定使用；随后 #1 / `Acongm/portal#117` 会迁移到 `/api/chats* + parts + standard stream`。

修复时禁止新增 legacy SSE event 或新的 client-side history 真相源。

## Definition of Done
- [ ] 新会话连续发送 5 轮后 stream 结束不丢消息
- [ ] refresh 后 5 轮历史一致
- [ ] 切 3 个 thread 往返无串会话
- [ ] 无文档通用会话同样通过
- [x] 至少有自动化回归覆盖 stream-end + refresh 路径（mock e2e + 合同；非生产）

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
