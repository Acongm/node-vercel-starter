> **代码对照 2026-09-03（main）** — 代码基线部分被 v2 覆盖
> **仍开着的原因：** 生产 login→chat→stream→history 连续走通未关；依赖 auth#25–#29。
> **证据：** Chat/Portal mock e2e；生产 OAuth 仍 OPEN。

---

关联总控：#1

## 目标
在继续做架构迁移/KB/DocHub 前，先冻结一个稳定的线上基线。验收路径必须能够连续完成：

`www/chat → auth 登录 → 回跳 → 新建会话 → 流式回答 → 刷新 → 历史恢复 → 切换会话 → 退出/重新登录`

## 子任务（按执行顺序）

### 0.1 Chat P0
1. [ ] 合入并验证 `Acongm/chat#25`：流式结束后消息不消失
2. [ ] 收口 `Acongm/chat#26`：history、refresh、thread switch、通用会话一致性
3. [ ] 刷新、切 thread、draft → persisted thread 不丢消息
4. [ ] 移动端/桌面行为一致

### 0.2 Auth production baseline
1. [ ] `Acongm/auth#29` Site URL / Redirect allow-list / return_to
2. [ ] `Acongm/auth#25` GitHub OAuth production
3. [ ] `Acongm/auth#27` Email SMTP / confirmation / recovery
4. [ ] `Acongm/auth#26` Google OAuth（GitHub 基线稳定后；不阻塞 GitHub/email 主流程时可作为 P1）
5. [ ] 当前 account control 能稳定区分 loading / anonymous / authenticated，并展示已有 identity 信息

> `Acongm/auth#28` Profile 编辑依赖 Stage 1 `/api/user/profile`，不作为 Stage 0 blocker。

### 0.3 CI/Deploy
- [ ] portal main build/deploy 通过
- [ ] chat main build/deploy 通过
- [ ] auth main typecheck/build/deploy 通过
- [ ] API test/typecheck/deploy 通过
- [ ] 清理已经被 main 覆盖的旧 PR

### 0.4 Issue 治理
- [x] 关闭旧 Phase 0/1/4 已完成任务
- [x] 关闭已识别的重复/被 supersede 的 Chat/API legacy Issue
- [x] 建立新的 Stage 0~6 总控与跨仓 Epic
- [x] `Acongm/platform` 改名信息已在总控中明确；仅保留必要历史迁移说明

## 不做
- 不在本阶段新增 Chat 新能力
- 不启动 DocHub 产品开发
- 不在 legacy Thread/Auth contract 上增加功能
- 不把 Account/Profile 新功能当作稳定性 blocker

## Definition of Done
- [ ] 线上核心流程连续走通至少 2 次且刷新后状态一致
- [ ] 四个核心仓库主分支 CI/Build 无已知 blocker
- [ ] P0 bug 有回归测试
- [ ] 本 Issue 关闭后才进入 #117 Stage 1

---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
