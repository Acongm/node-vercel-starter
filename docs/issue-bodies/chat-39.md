> **代码对照 2026-09-03（main）** — #40/#41 已交付
> **仍开着的原因：** P1 rename/search/archive、真 LLM TTFT、registry 未做。执行入口仍是 #37。
> **证据：** 非阻塞 + AuthAccountMenu + Agent settings 在 main。

---

后端 Chat 标准：`Acongm/node-vercel-starter#57`
后端 Auth/User：`Acongm/node-vercel-starter#56`
Shared UI：`Acongm/shadcn-ui#14`
当前 P0：#40 / `Acongm/node-vercel-starter#59` / `Acongm/auth#51`

## 最终目标
把 `chat.acongm.com` 做成接近成熟 ChatGPT 类产品的稳定 Chat 前端：打开快、能立即输入、历史异步加载、发送低延迟、登录/匿名一致、设置完整、交互清晰。

优先解决当前真实体验问题，而不是继续做迁移型工作。

## 当前已确认根因
- `ChatWorkspaceApp` 目前在 `!authIdentity` 时完全不挂载 `ChatFullscreen`，直接显示“正在准备安全会话…”；
- active thread restore 时 `seedStatus=loading` 同样完全替换 Chat UI 为“加载会话…”；
- `loadDurableHistory()` 会循环分页直到把完整 history（最多 5000 条）全部取完才 render；
- history load error 会把 seed 重置成 `[]`；
- sidebar 当前确实通过 `portalHref` 渲染“返回文档站”；
- Auth client 在 Auth/Chat 仓库已经产生不同实现，session/anonymous 行为存在源码漂移。

这些不是“线上偶发慢”，而是当前实现方式本身需要调整；执行入口见 #40 / Auth #51 / API #59。

## P0-1 启动/登录态性能
- [ ] #40：页面先快速进入可交互 shell/composer，不把全部 Auth/Profile/History 请求作为阻塞条件
- [ ] anonymous session 已存在时直接复用
- [ ] session restore/profile/settings/chat list 并行或按需加载
- [ ] 明确 loading timeout/error/retry，不永久停在“准备安全会话”
- [ ] 登录态变化只刷新 identity-bound 数据
- [ ] Auth state machine 使用 `Acongm/auth#51` 唯一实现，不再维护 Chat 私有 fork

## P0-2 会话列表与历史
- [ ] #40：sidebar chat list 使用轻量 summary API + cursor pagination
- [ ] active history 独立加载，不要求先加载全部会话/全部 transcript
- [ ] 当前 chat 先显示首屏/cache/optimistic state，再与 server truth reconcile
- [ ] loading/empty/error/retry UI 明确
- [ ] API 失败不清空已有有效 transcript
- [ ] 长 history lazy load，不一次拉全
- [ ] thread A → B → A 不串会话、不重复请求全量数据

## P0-3 Send / Streaming / Interaction
- [ ] API #59：消除重复 principal verification 与不必要 pre-stream round trip
- [ ] 发送前不等待不必要的 profile/history/sidebar 请求
- [ ] send 后立即 optimistic 显示 user message
- [ ] 首 token latency 可测并优化
- [ ] stream 稳定增量显示
- [ ] Stop/Cancel 明确可用
- [ ] Retry/Reload 不重复 user message
- [ ] provider/error/persistence failure 有清晰状态与 retry
- [ ] Markdown/code/reasoning/source/action 交互一致
- [ ] composer 多行、快捷键、disabled/loading 行为合理

## P0-4 页面信息架构
- [ ] #40：去除 Header/Sidebar 中“返回文档站”入口
- [ ] 增加清晰的用户头像/名称/登录状态入口
- [ ] User Menu：Account / Settings / Theme / Logout
- [ ] anonymous 状态有清晰登录/注册入口，但不阻塞使用 Chat

## P1 Settings
对接统一 User Settings contract：
- [ ] 默认模型
- [ ] 默认系统/用户提示词（default prompt）
- [ ] theme
- [ ] 其他 Chat 真正需要的 preferences
- [ ] reset to defaults
- [ ] 保存 loading/success/error
- [ ] settings 更新后新会话/新请求按明确规则生效

## P1 Conversation management
- [ ] new chat
- [ ] rename
- [ ] delete
- [ ] search/filter（数据量需要时）
- [ ] pagination
- [ ] 可选 archive/pin 后续按真实需求

## Shared UI
- [ ] Button/Input/Textarea/Dropdown/Avatar/Sheet/Dialog/Alert/Skeleton/Tooltip 等使用 `Acongm/shadcn-ui`
- [ ] Chat 专用 composer/message/thread-list 可复用部分进入 shared registry，但产品布局保持 app-local
- [ ] light/dark/system
- [ ] mobile/desktop
- [ ] streaming/loading/error/cancel 状态视觉规范统一

## 场景测试
必须以用户流程而不是组件 coverage 为主：
- [ ] anonymous cold start → composer 可见 → identity ready → send
- [ ] existing anonymous warm start
- [ ] authenticated cold/warm start
- [ ] 500+ message thread 首屏 bounded load
- [ ] chat list 请求失败/超时/retry
- [ ] history 请求失败但已显示消息不被清空
- [ ] send → stream → done → refresh
- [ ] Stop / Retry / Reload
- [ ] switch A-B-A / delete / pagination
- [ ] login/logout/identity switch
- [ ] settings default model/prompt 生效

## DoD
用户打开 Chat 后不再被“准备安全会话/加载会话”长时间卡住；发送和历史加载互不阻塞；登录态、用户入口、设置与对话操作达到成熟 Chat 产品的基础体验。

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
