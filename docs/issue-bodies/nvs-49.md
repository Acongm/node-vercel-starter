> **代码对照 2026-09-03（main）** — 流程 AC 未做
> **仍开着的原因：** 无 CONTRIBUTING / pre-push / agent 推送策略。
> **证据：** CI 仍对每次 push 跑全套。

---

## 现象

今日 `agent/chat-idempotent-runs`（PR #44）与 `agent/user-chat-contract-tests`（PR #39）产生大量 **中间态 CI 失败**（最终 tip 已绿）。代表性根因：

| 失败类型 | 示例 run | 信号 |
|----------|----------|------|
| Contract mock 落后于 API | [31235428707](https://github.com/Acongm/node-vercel-starter/actions/runs/31235428707) | `listRecentMessages is not a function`；分页返回值形状变更后测试未同步 |
| Typecheck 半成品 | [31235282888](https://github.com/Acongm/node-vercel-starter/actions/runs/31235282888) | `Property 'at' does not exist`；`listMessages` 返回 page 对象但仍当数组用 |
| Coverage 阈值 | [31234886800](https://github.com/Acongm/node-vercel-starter/actions/runs/31234886800)、[31234004314](https://github.com/Acongm/node-vercel-starter/actions/runs/31234004314) | repository/service 或 global functions 未达阈值 |
| 测试基建 | [31233959068](https://github.com/Acongm/node-vercel-starter/actions/runs/31233959068) | `Reflect.getMetadata is not a function`（缺 `reflect-metadata`） |
| 类型契约 | [31235812192](https://github.com/Acongm/node-vercel-starter/actions/runs/31235812192) | `HttpException` payload 不允许 `null`（TS2345） |

这些在最终 tip（如 `194d545`）已修复；问题是 **推送粒度过细 → CI 噪音大 + 加剧 Vercel 配额消耗**（见配套 Vercel rate-limit Issue）。

## 建议修复（流程/护栏，非回滚业务）

1. Agent/本地推送前强制：`npm run typecheck && npm test && npm run test:contracts`（或 pre-push hook）  
2. 同一逻辑变更尽量 **squash 到可绿 commit** 再 push；避免「先改 service、后补 mock」分两次远程触发  
3. 文档化：coverage threshold 变更与实现同 commit；禁止「先降阈值再补测」以外的逆向操作  
4. 可选：对 `agent/**` 分支使用 `workflow_dispatch` / path filter / 合并后再跑重型 job（需权衡反馈速度）

## 验收

- [ ] 贡献指南写明 push 前最低本地门禁命令
- [ ] 连续实现 Stage 类大 PR 时，中间红 run 比例明显下降（主观可接受：非「每 commit 必红」）
- [ ] 与 Vercel rate-limit Issue 联调：降低无效部署次数

## 关联

- PR #44 / #39
- 配套：[CI][P0] Vercel Free 日部署限额

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
