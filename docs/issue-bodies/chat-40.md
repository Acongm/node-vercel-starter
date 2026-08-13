## Parent
- 产品目标：#39
- 非阻塞启动：本 Issue
- Auth Client：`Acongm/auth#51`
- 后端：`Acongm/node-vercel-starter#57`（tail-first history）
- Shared UI：`Acongm/shadcn-ui#15`

## What to build
Chat 启动与历史加载不阻塞 shell/composer；长会话渐进恢复历史。

## Acceptance criteria
### Phase 1 ✅（main 2026-08-13）
- [x] `ChatFullscreen` 始终挂载，移除整页「准备安全会话/加载会话」占位
- [x] composer placeholder 提示 auth/history 同步状态
- [x] `loadHistoryProgressive`：首屏 `getChatV2` 后立即 render，后台分页
- [x] `historySyncing` + per-thread seed cache
- [x] history 错误路径不清空 `seedMessages`
- [x] 移除侧栏默认「返回文档站」链接
- [x] contract：`chat-nonblocking-startup.test.mjs`

### Phase 2 ✅（main 2026-08-13）
- [x] API tail-first / 最新一页 history（#57）
- [x] composer 真正 disabled（非仅 placeholder）
- [x] 向上滚动 lazy load older messages
- [x] API quality-gate E2E（#37 子集：`platform-v2-quality-gate.e2e-spec.ts`）
- [ ] Browser smoke E2E（#37 全量）

## Out of scope
- TTFT 后端（#59）
