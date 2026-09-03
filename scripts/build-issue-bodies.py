#!/usr/bin/env python3
"""Build updated GitHub issue bodies from /tmp/issue-audit JSON + checkbox patches."""

from __future__ import annotations

import json
from pathlib import Path

AUDIT = Path("/tmp/issue-audit")
OUT = Path(__file__).resolve().parents[1] / "docs" / "issue-bodies"
REVISION = """
---

## 修订记录（v2 · 2026-09-03 代码对照）

对照各仓 `origin/main` 更新 checkbox。未完成项保持未勾选；不因 mock/合同测试关闭生产 DoD。
统一跟踪：`docs/platform-issue-status.md`。
"""


def load(slug: str) -> tuple[str, str]:
    data = json.loads((AUDIT / f"{slug}.json").read_text())
    return data["title"], data["body"].rstrip() + "\n"


def banner(status: str, remaining: str, evidence: str) -> str:
    return (
        f"> **代码对照 2026-09-03（main）** — {status}\n"
        f"> **仍开着的原因：** {remaining}\n"
        f"> **证据：** {evidence}\n\n"
        "---\n\n"
    )


def apply(text: str, replacements: list[tuple[str, str]]) -> str:
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f"patch missed:\n{old[:120]}")
        text = text.replace(old, new, 1)
    return text


def write(name: str, body: str) -> None:
    path = OUT / name
    path.write_text(body.rstrip() + "\n")
    print(f"wrote {path.relative_to(OUT.parent.parent)}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # --- API #37 ---
    _, body = load("node-vercel-starter-37")
    body = banner(
        "部分完成，保持 OPEN",
        "生产 cookie / 真人 OAuth 同 uid / 真 LLM send；capability `it.todo` 8 条；无 Stryker threshold。Auth/Portal 没有 live Playwright（旧跟踪文档写错）。",
        "`test/platform-v2-quality-gate.e2e-spec.ts`；chat/portal mock e2e；chat `test:e2e:live`；`scripts/live-quality-gate.mjs`；2026-08-19 生产评论已落地 user_settings / migration-history / Manual Linking。",
    ) + apply(
        body,
        [
            ("- [ ] typecheck\n", "- [x] typecheck\n"),
            ("- [ ] unit\n", "- [x] unit\n"),
            ("- [ ] `test:contracts`\n", "- [x] `test:contracts`\n"),
            (
                "- [ ] DB/RLS integration\n",
                "- [x] DB/RLS integration（CI `supabase-auth-rls-integration.yml`；capability todo 仍要求更多 invariant）\n",
            ),
            ("- [ ] build\n", "- [x] build\n"),
            (
                "- [ ] 真实 consumer path 已使用新 contract\n",
                "- [x] 真实 consumer path 已使用新 contract（#43 CLOSED；Chat/Portal/Auth BFF）\n",
            ),
        ],
    )
    write(
        "nvs-37.md",
        body
        + """
### 2026-09-03 进度（不要用旧 platform-issue-status 8/18 表）

- [x] API mock quality-gate
- [x] Chat mock Playwright
- [x] Portal mock Playwright
- [ ] Auth mock Playwright（**auth 仓无 e2e/**）
- [x] Chat live JWT chrome（注入 session）
- [ ] Portal live JWT（**portal 仓无 test:e2e:live**）
- [x] 线上 user/chats token 冒烟（无 stream）
- [x] 生产 `user_settings` + comments history repair + Manual Linking 配置（2026-08-19）
- [ ] 生产 cookie / 真人 OAuth 同 uid（`auth#48`）
- [ ] 生产真 LLM Send/Retry/Reload/Edit/Cancel
- [ ] `test/assistant-ui-capabilities.todo.spec.ts` 清零或能力显式 disabled
- [ ] Stryker threshold（现仅 mutation smoke）
"""
        + REVISION,
    )

    # --- API #32 ---
    _, body = load("node-vercel-starter-32")
    body = banner(
        "1.0–1.3 已关；Epic 等 #37/#35",
        "#37 Final Quality Gate 与 #35 Legacy Cleanup 仍 OPEN。",
        "GitHub：#42 #33 #34 #43 CLOSED。",
    ) + apply(
        body,
        [
            ("- [ ] #42 closed\n", "- [x] #42 closed\n"),
            ("- [ ] #33 closed\n", "- [x] #33 closed\n"),
            ("- [ ] #34 closed\n", "- [x] #34 closed\n"),
            ("- [ ] #43 closed\n", "- [x] #43 closed\n"),
            (
                "- [ ] portal/chat 只使用新 User/Chat contract\n",
                "- [x] portal/chat 主路径已使用新 User/Chat contract（legacy threads BFF 仍在 chat）\n",
            ),
        ],
    )
    write("nvs-32.md", body + REVISION)

    # --- API #56 ---
    _, body = load("node-vercel-starter-56")
    body = banner(
        "API 层完成，跨仓 DoD 未关",
        "服务端 logout / consumer cache 失效仍属跨仓；Settings 细节见 #61。",
        "`user.controller.ts` / `supabase-auth.service.ts` JWKS / `user_settings` / `test/user.contract.spec.ts` / `test/chat.send-critical-path.spec.ts`。",
    ) + apply(
        body,
        [
            (
                "- [ ] authenticated / anonymous / unauthenticated 三态 contract\n",
                "- [x] authenticated / anonymous / unauthenticated 三态 contract（Guard + AuthPrincipal）\n",
            ),
            (
                "- [ ] Supabase access token 校验与 request principal\n",
                "- [x] Supabase access token 校验与 request principal（JWKS + getUser fallback）\n",
            ),
            (
                "- [ ] expired/invalid/revoked session 有稳定 error code\n",
                "- [x] expired/invalid/revoked session 有稳定 error code（`TOKEN_EXPIRED`）\n",
            ),
            ("- [ ] `GET /api/user/me`\n", "- [x] `GET /api/user/me`\n"),
            ("- [ ] `GET/PATCH /api/user/profile`\n", "- [x] `GET/PATCH /api/user/profile`\n"),
            (
                "- [ ] displayName/avatar/preferences 等应用信息\n",
                "- [x] displayName/avatar/preferences 等应用信息\n",
            ),
            (
                "- [ ] id/email/provider/role/tier 等身份/授权字段只读\n",
                "- [x] id/email/provider/role/tier 等身份/授权字段只读\n",
            ),
            (
                "- [ ] no-profile-row 首次写入与 partial update/clear 语义\n",
                "- [x] no-profile-row 首次写入与 partial update/clear 语义\n",
            ),
            ("- [ ] `GET/PATCH /api/user/settings`\n", "- [x] `GET/PATCH /api/user/settings`\n"),
            (
                "- [ ] 通用用户设置 schema，可扩展 theme/language/default model/default prompt 等\n",
                "- [x] 通用用户设置 schema（theme/language/model/prompt；skills 仍在 preferences）\n",
            ),
            (
                "- [ ] server defaults + user overrides 语义明确\n",
                "- [x] server defaults + user overrides 语义明确\n",
            ),
            (
                "- [ ] settings cache/version/invalidation 明确\n",
                "- [x] settings cache/version/invalidation 明确（uid + schemaVersion）\n",
            ),
            (
                "- [ ] access token/JWT verification cache 有明确 TTL，上限不得超过 token validity\n",
                "- [x] access token/JWT verification cache TTL ≤ token `exp`\n",
            ),
            (
                "- [ ] user/profile/settings cache key 按 `auth.uid` 隔离\n",
                "- [x] user/profile/settings cache key 按 `auth.uid` 隔离\n",
            ),
            (
                "- [ ] anonymous/authenticated/invalid/expired token\n",
                "- [x] anonymous/authenticated/invalid/expired token（合同/单测）\n",
            ),
            (
                "- [ ] profile partial patch / clear / no-row create\n",
                "- [x] profile partial patch / clear / no-row create\n",
            ),
            (
                "- [ ] settings defaults/override/cache invalidation\n",
                "- [x] settings defaults/override/cache invalidation\n",
            ),
        ],
    )
    write("nvs-56.md", body + REVISION)

    # --- API #57 ---
    _, body = load("node-vercel-starter-57")
    body = banner(
        "Chat v2 API 核心在 main；产品 DoD 未关",
        "consumer 非阻塞 / 真 LLM / 场景矩阵归 #37；context 上限仍 500。",
        "`chat.service.ts` / `chat.repository.ts` / `test/chat.pagination.spec.ts` / `test/chat.send-critical-path.spec.ts` / quality-gate e2e。",
    ) + apply(
        body,
        [
            (
                "- [ ] title/touch/telemetry 等辅助任务不得阻塞 stream 首包\n",
                "- [x] title/touch/telemetry 等辅助任务不得阻塞 stream 首包\n",
            ),
            (
                "- [ ] create/list/get/update/delete chats\n",
                "- [x] create/list/get/update/delete chats\n",
            ),
            (
                "- [ ] cursor pagination + stable ordering\n",
                "- [x] cursor pagination + stable ordering\n",
            ),
            (
                "- [ ] list 只返回 sidebar 所需摘要，不携带完整 transcript\n",
                "- [x] list 只返回 sidebar 所需摘要，不携带完整 transcript\n",
            ),
            (
                "- [ ] messages/history 独立分页加载\n",
                "- [x] messages/history 独立分页加载\n",
            ),
            (
                "- [ ] 支持“最新消息首屏 → older messages 向前分页”的明确 cursor contract\n",
                "- [x] 支持“最新消息首屏 → older messages 向前分页”的明确 cursor contract（`order=desc` + `prevCursor`）\n",
            ),
            (
                "- [ ] anonymous 与 authenticated history ownership 一致使用 `auth.uid`\n",
                "- [x] anonymous 与 authenticated history ownership 一致使用 `auth.uid`\n",
            ),
            (
                "- [ ] 标准 message parts + UIMessage/message stream 语义\n",
                "- [x] 标准 message parts + UIMessage/message stream 语义\n",
            ),
            (
                "- [ ] stable clientMessageId/runId/idempotency\n",
                "- [x] stable clientMessageId/runId/idempotency\n",
            ),
            (
                "- [ ] 默认模型、系统/用户默认 prompt 等 settings 可从 User Settings 注入\n",
                "- [x] 默认模型、系统/用户默认 prompt 等 settings 可从 User Settings 注入\n",
            ),
        ],
    )
    write("nvs-57.md", body + REVISION)

    # --- API #59 ---
    _, body = load("node-vercel-starter-59")
    body = banner(
        "主路径已落地，性能调参未关",
        "`CHAT_MODEL_CONTEXT_LIMIT` 仍为 500；无 `verifyAccessToken` 只调用一次的集成测试；无 Pino 查询 runbook。",
        "`AiV1Service.enforceRateLimit(req, principal)`；`chat.first_token`；`test/chat.send-critical-path.spec.ts`；JWKS verify。",
    ) + apply(
        body,
        [
            (
                "- [ ] `SupabaseAuthGuard` 成功后，业务层直接消费 `request.auth`\n",
                "- [x] `SupabaseAuthGuard` 成功后，业务层直接消费 `request.auth`\n",
            ),
            (
                "- [ ] `AiV1Service.enforceRateLimit` 改为接受已验证 `AuthPrincipal`（或独立 `RateLimitContext`），不再次调用 `JwtAuthService.resolvePrincipal`\n",
                "- [x] `AiV1Service.enforceRateLimit` 接受已验证 `AuthPrincipal`，Chat v2 不再次 resolve\n",
            ),
            (
                "- [ ] controller/guard/service 之间 principal contract 单一\n",
                "- [x] controller/guard/service 之间 principal contract 单一\n",
            ),
            (
                "- [ ] legacy `/api/ai/v1/*` 若仍需自行 resolve principal，保留显式兼容入口，不污染 `/api/chats*` 新路径\n",
                "- [x] legacy `/api/ai/v1/*` 仍自行 resolve，不污染 `/api/chats*`\n",
            ),
            (
                "- [ ] `title/touch/telemetry` 等非首包必要工作不得阻塞 provider stream\n",
                "- [x] `title/touch/telemetry` 等非首包必要工作不得阻塞 provider stream\n",
            ),
            (
                "- [ ] verified principal exactly once\n",
                "- [x] verified principal exactly once（单测：`enforceRateLimit` 带 principal 只调一次；无 verifier 集成计数）\n",
            ),
            (
                "- [ ] anonymous send\n",
                "- [x] anonymous send（合同/单测）\n",
            ),
            (
                "- [ ] authenticated send\n",
                "- [x] authenticated send（合同/单测）\n",
            ),
            (
                "- [ ] auxiliary title/touch/telemetry slow/failure 不影响 first token\n",
                "- [x] auxiliary title/touch/telemetry slow/failure 不影响 first token\n",
            ),
            (
                "- [ ] provider first-token timing hook 可在 Logs #58 查询\n",
                "- [x] provider first-token timing hook 已打 `chat.first_token`（Pino/#58 查询未完成）\n",
            ),
        ],
    )
    write("nvs-59.md", body + REVISION)

    # --- API #61 ---
    _, body = load("node-vercel-starter-61")
    body = banner(
        "API + migration 在 main；产品表未关",
        "无 DELETE/reset-by-key；skills 仍写 preferences；匿名策略/同 uid 保留未 live 证。生产表已在 2026-08-19 评论中确认存在。",
        "`supabase/migrations/20260814010000_user_settings.sql`；`UserService`；`test/user-settings*.spec.ts`；Chat `loadSendSettings`。",
    ) + apply(
        body,
        [
            ("- [ ] `user_id` PK/FK → auth user/profile ownership\n", "- [x] `user_id` PK/FK → auth user/profile ownership\n"),
            ("- [ ] `schema_version`\n", "- [x] `schema_version`\n"),
            ("- [ ] `theme`（若决定 server-sync；否则明确保持 client-only）\n", "- [x] `theme`（server-sync 列存在；Chat 主题仍可本地）\n"),
            ("- [ ] `language`（启用时）\n", "- [x] `language`（启用时）\n"),
            ("- [ ] `chat.default_model`\n", "- [x] `chat.default_model`\n"),
            ("- [ ] `chat.default_prompt`\n", "- [x] `chat.default_prompt`\n"),
            ("- [ ] timestamps\n", "- [x] timestamps\n"),
            ("- [ ] RLS owner-only\n", "- [x] RLS owner-only\n"),
            ("- [ ] `GET /api/user/settings`\n", "- [x] `GET /api/user/settings`\n"),
            ("- [ ] `PATCH /api/user/settings`\n", "- [x] `PATCH /api/user/settings`\n"),
            (
                "- [ ] response 同时给 `effective` 与必要的 `overrides`/defaults version，consumer 不自己拼默认值\n",
                "- [x] response 同时给 `effective` 与必要的 `overrides`/defaults version\n",
            ),
            ("- [ ] partial PATCH；omitted != clear/reset\n", "- [x] partial PATCH；omitted != clear/reset\n"),
            (
                "- [ ] default prompt 明确长度上限/空值/reset 语义\n",
                "- [x] default prompt 明确长度上限/空值/reset 语义\n",
            ),
            (
                "- [ ] model 必须来自 server model capability/allow-list，不能保存任意 provider injection 字符串\n",
                "- [x] model 必须来自 server model capability/allow-list\n",
            ),
            ("- [ ] platform defaults 有单一配置来源\n", "- [x] platform defaults 有单一配置来源\n"),
            ("- [ ] user overrides 覆盖 defaults\n", "- [x] user overrides 覆盖 defaults\n"),
            ("- [ ] reset 后立即回 default\n", "- [x] reset 后立即回 default（PATCH null）\n"),
            (
                "- [ ] 默认模型不可用时 fallback 规则稳定\n",
                "- [x] 默认模型不可用时 fallback 规则稳定\n",
            ),
            (
                "- [ ] default prompt 只作为用户偏好注入，不能覆盖 server security/system policy\n",
                "- [x] default prompt 只作为用户偏好注入，不能覆盖 server security/system policy\n",
            ),
            (
                "- [ ] settings 按 `auth.uid + schemaVersion` 缓存\n",
                "- [x] settings 按 `auth.uid + schemaVersion` 缓存\n",
            ),
            ("- [ ] PATCH/reset 精准 invalidate/update\n", "- [x] PATCH/reset 精准 invalidate/update\n"),
            (
                "- [ ] send critical path 不为每条消息重新 remote fetch settings\n",
                "- [x] send critical path 不为每条消息重新 remote fetch settings（服务端 cache）\n",
            ),
            (
                "- [ ] request DTO/AI orchestration 接受经过 server validation 的 effective model/default prompt\n",
                "- [x] request DTO/AI orchestration 接受经过 server validation 的 effective model/default prompt\n",
            ),
            (
                "- [ ] default prompt 注入位置和 server system prompt precedence 有测试\n",
                "- [x] default prompt 注入位置和 server system prompt precedence 有测试\n",
            ),
            ("- [ ] no settings row → defaults\n", "- [x] no settings row → defaults\n"),
            ("- [ ] partial overrides\n", "- [x] partial overrides\n"),
            (
                "- [ ] prompt set/clear/reset/length validation\n",
                "- [x] prompt set/clear/reset/length validation\n",
            ),
            ("- [ ] allowed/disallowed model\n", "- [x] allowed/disallowed model\n"),
            ("- [ ] cache hit + PATCH invalidation\n", "- [x] cache hit + PATCH invalidation\n"),
        ],
    )
    write("nvs-61.md", body + REVISION)

    # --- API #58 / #60 / #55 — banner only (code gap) ---
    for slug, name, status, remaining, evidence in [
        (
            "node-vercel-starter-58",
            "nvs-58.md",
            "Phase 1 only",
            "无 Pino；无 redaction；无独立 logs 模块；ChatLogs 仍持久化消息正文。PR #63 未合。",
            "`request-id.middleware.ts` + `http-request-log.middleware.ts` + `app-logger.ts`；`chat.first_token`。",
        ),
        (
            "node-vercel-starter-60",
            "nvs-60.md",
            "与 #58 同缺口",
            "DoD 要求 Pino 模块 / auth 事件 / redaction / ChatLogs 分离 / runbook，main 都没有。",
            "同 #58。",
        ),
        (
            "node-vercel-starter-55",
            "nvs-55.md",
            "Auth/Chat 子模块部分完成；Logs 未完成",
            "子 Issue #58/#60/#37 仍 OPEN。",
            "#56/#57/#59/#61 API 层已在 main。",
        ),
    ]:
        _, body = load(slug)
        write(name, banner(status, remaining, evidence) + body + REVISION)

    # --- auth #48 ---
    _, body = load("auth-48")
    body = banner(
        "实现 + 合同测试在 main；live 未证",
        "缺一次真人匿名 → OAuth，证明 callback 后 `auth.uid()` 不变。`anonymous-identity-upgrade.test.mjs` 仍有 live `test.todo`。",
        "`packages/auth-client/src/client.ts` `linkOAuthIdentity`；`login-form.tsx` `protectAnonymousEmailSignup`；冲突自动改 sign-in。生产已开 Manual Linking（2026-08-19）。",
    ) + apply(
        body,
        [
            (
                "- [ ] 若当前 session 是 anonymous 且 mode=signup：使用 `linkIdentity(provider)`\n",
                "- [x] 若当前 session 是 anonymous 且 mode=signup：使用 `linkIdentity(provider)`\n",
            ),
            (
                "- [ ] Chat/Profile ownership 无需搬迁\n",
                "- [x] Chat/Profile ownership 无需搬迁（设计：同 uid；live 未证）\n",
            ),
            (
                "- [ ] link identity conflict 显示明确错误，不 silent fallback 普通 sign-in\n",
                "- [x] link identity conflict 显示明确错误；`identity_already_exists` 自动改 sign-in 重试\n",
            ),
            (
                "- [ ] mode=signin 继续普通 Supabase sign-in\n",
                "- [x] mode=signin 继续普通 Supabase sign-in\n",
            ),
            (
                "- [ ] 明确这是 identity switch\n",
                "- [x] 明确这是 identity switch\n",
            ),
            (
                "- [ ] 不调用 legacy `x-client-id` claim\n",
                "- [x] 不调用 legacy `x-client-id` claim\n",
            ),
            (
                "- [ ] 不 silent merge/double-write anonymous chats\n",
                "- [x] 不 silent merge/double-write anonymous chats\n",
            ),
            (
                "- [ ] 在 #27 完成前，anonymous session 下的 email signup 不得静默创建另一个 UID\n",
                "- [x] 在 #27 完成前，anonymous session 下的 email signup 不得静默创建另一个 UID\n",
            ),
            (
                "- [ ] UI 明确提示使用 OAuth 保留当前匿名历史，或登录已有账号切换身份\n",
                "- [x] UI 明确提示使用 OAuth 保留当前匿名历史，或登录已有账号切换身份\n",
            ),
            (
                "- [ ] OAuth signup + anonymous session chooses `linkIdentity`, not `signInWithOAuth`\n",
                "- [x] OAuth signup + anonymous session chooses `linkIdentity`, not `signInWithOAuth`\n",
            ),
            (
                "- [ ] OAuth signin chooses `signInWithOAuth`\n",
                "- [x] OAuth signin chooses `signInWithOAuth`\n",
            ),
            (
                "- [ ] non-anonymous signup remains ordinary OAuth signup\n",
                "- [x] non-anonymous signup remains ordinary OAuth signup\n",
            ),
            (
                "- [ ] link conflict does not fallback silently\n",
                "- [x] link conflict does not fallback silently\n",
            ),
            (
                "- [ ] anonymous email signup is explicitly gated until #27\n",
                "- [x] anonymous email signup is explicitly gated until #27\n",
            ),
            (
                "- [ ] existing-account login is explicit identity switch\n",
                "- [x] existing-account login is explicit identity switch\n",
            ),
            (
                "- [ ] no legacy anonymous claim is reintroduced\n",
                "- [x] no legacy anonymous claim is reintroduced\n",
            ),
        ],
    )
    write("auth-48.md", body + REVISION)

    # --- auth #28 ---
    _, body = load("auth-28")
    body = banner(
        "实现 AC 已勾完；部署/browser 未关",
        "auth 仓 **没有** Playwright。`#43` 已于 2026-08-19 CLOSED。browser smoke 归 `#37`。",
        "`apps/auth/app/account/page.tsx`；`packages/auth-client/src/profile.ts`；`tests/contracts/account-profile.test.mjs`。",
    ) + apply(
        body,
        [
            (
                "- [ ] #43 中 `/api/user/*` consumer 项关闭\n",
                "- [x] #43 中 `/api/user/*` consumer 项关闭（#43 CLOSED 2026-08-19）\n",
            ),
        ],
    )
    write("auth-28.md", body + REVISION)

    # --- auth #29 / #25 — banner ---
    _, body = load("auth-29")
    write(
        "auth-29.md",
        banner(
            "代码与文档完成；生产回跳未关",
            "Site URL / allow-list 已在 2026-08-19 配到生产；缺 www/chat 真人回跳与外部 redirect 拦截回归。",
            "`docs/oauth-setup.md`；`isAllowedReturnTo` / `sanitizeReturnTo`；`apps/auth/app/callback/route.ts`。",
        )
        + body
        + REVISION,
    )
    _, body = load("auth-25")
    write(
        "auth-25.md",
        banner(
            "客户端走 Supabase OAuth；生产 Provider 验收未关",
            "GitHub OAuth App + 跨站回跳必须在 `*.acongm.com` 点出来。",
            "`signInWithOAuth` / `linkIdentity`；`docs/oauth-setup.md`；`scripts/configure-supabase-github-auth.sh`。",
        )
        + body
        + REVISION,
    )

    # --- chat #40 ---
    _, body = load("chat-40")
    body = banner(
        "P0 实现 + mock e2e 在 main",
        "生产 cookie / 真 LLM 归 `node-vercel-starter#37`。",
        "`chat-workspace-app.tsx` 始终挂载；`composerDisabled` 仅 restoring/error；`loadOlderMessages`；`chat-nonblocking-startup.test.mjs`；`e2e/quality-gate-smoke.spec.ts`。",
    ) + apply(
        body,
        [
            (
                "- [ ] `ChatFullscreen`/composer 不再由 `authIdentity` 是否 ready 决定是否挂载\n",
                "- [x] `ChatFullscreen`/composer 不再由 `authIdentity` 是否 ready 决定是否挂载\n",
            ),
            (
                "- [ ] anonymous bootstrap 作为 background state machine：`restoring → anonymous/authenticated → error/retry`\n",
                "- [x] anonymous bootstrap 作为 background state machine：`restoring → anonymous/authenticated → error/retry`\n",
            ),
            (
                "- [ ] session 未就绪时 composer 可显示明确 pending/disabled 状态，但页面主体、输入区域、导航不能整块消失\n",
                "- [x] session 未就绪时 composer pending/disabled，shell 仍在\n",
            ),
            (
                "- [ ] `selectThread()` 不再等待 0..5000 条历史全部恢复\n",
                "- [x] `selectThread()` 不再等待 0..5000 条历史全部恢复\n",
            ),
            (
                "- [ ] 打开 thread 只获取最新/首屏所需 message page 后立即 render\n",
                "- [x] 打开 thread 只获取最新/首屏所需 message page 后立即 render\n",
            ),
            (
                "- [ ] older messages 使用 cursor lazy load（向上滚动/明确 Load older）\n",
                "- [x] older messages 使用 cursor lazy load（向上滚动）\n",
            ),
            (
                "- [ ] history 请求失败时保留当前 cache/已显示 messages\n",
                "- [x] history 请求失败时保留当前 cache/已显示 messages\n",
            ),
            (
                "- [ ] 禁止 error path 将有效 transcript 重置为 `[]`\n",
                "- [x] 禁止 error path 将有效 transcript 重置为 `[]`\n",
            ),
            (
                "- [ ] Chat 主 sidebar 去除“返回文档站”链接\n",
                "- [x] Chat 主 sidebar 去除“返回文档站”链接（workspace 不再传 `portalHref`）\n",
            ),
            (
                "- [ ] `portalHref` 从 Chat 产品默认 preset/API 中移除或改为显式 opt-in\n",
                "- [x] `portalHref` 从 Chat 产品默认 preset 移除（组件仍接受 opt-in）\n",
            ),
            (
                "- [ ] no session cold start：shell/composer 立即存在，anonymous bootstrap 后可 send\n",
                "- [x] no session cold start：shell/composer 立即存在（mock e2e + 合同）\n",
            ),
            (
                "- [ ] 500+ message thread：首屏不全量拉取\n",
                "- [x] 500+ message thread：首屏不全量拉取（合同 + mock e2e long thread）\n",
            ),
            (
                "- [ ] history request failure：已有 transcript 不清空，retry 恢复\n",
                "- [x] history request failure：已有 transcript 不清空（合同）\n",
            ),
        ],
    )
    write("chat-40.md", body + REVISION)

    # --- chat #26 ---
    _, body = load("chat-26")
    body = banner(
        "已被 Chat v2 主路径替代；生产 5-round 与 P1 chip 未关",
        "不要再按 legacy PR #25 / sessionStorage 路径实现。P1 `moduleKey/pagePath` chip 恢复未做。",
        "v2 `/api/chats`；`threadSeedCache`；mock e2e reload/retry/persist；`chat-v2-runtime-stability.test.mjs`。",
    ) + apply(
        body,
        [
            (
                "- [ ] 普通无文档会话完整保存/读取\n",
                "- [x] 普通无文档会话完整保存/读取（v2 `/api/chats`）\n",
            ),
            (
                "- [ ] 不依赖本地 sessionStorage 才能恢复已持久化会话\n",
                "- [x] 不依赖本地 sessionStorage 才能恢复已持久化会话\n",
            ),
            (
                "- [ ] API failure 时明确显示错误，不静默回退为空历史\n",
                "- [x] API failure 时明确显示错误，不静默回退为空历史\n",
            ),
            (
                "- [ ] 至少有自动化回归覆盖 stream-end + refresh 路径\n",
                "- [x] 至少有自动化回归覆盖 stream-end + refresh 路径（mock e2e + 合同；非生产）\n",
            ),
        ],
    )
    write("chat-26.md", body + REVISION)

    # --- portal #129 ---
    _, body = load("portal-129")
    body = banner(
        "登录 chrome + 非阻塞 embed + mock e2e 在 main",
        "本仓 **没有** `test:e2e:live`。Shared UI 未完全迁 registry。生产 cookie 归 #37。",
        "`AuthAccountButton` + `/account#settings`；`doc-chat-embed.tsx`；`e2e/quality-gate-smoke.spec.ts`；chats/user BFF。",
    ) + apply(
        body,
        [
            (
                "- [ ] 使用统一 Auth/User contract\n",
                "- [x] 使用统一 Auth/User contract\n",
            ),
            (
                "- [ ] 页面首次打开不因 session/profile 请求阻塞文档主体\n",
                "- [x] 页面首次打开不因 session/profile 请求阻塞文档主体\n",
            ),
            (
                "- [ ] header/user menu 明确 loading/anonymous/authenticated\n",
                "- [x] header/user menu 明确 loading/anonymous/authenticated\n",
            ),
            (
                "- [ ] Account/Settings 跳统一 Auth 页面，不在 Portal 重复实现账号中心\n",
                "- [x] Account/Settings 跳统一 Auth 页面（`/account#settings`）\n",
            ),
            (
                "- [ ] 打开 Drawer 后快速展示 composer/shell\n",
                "- [x] 打开 Drawer 后快速展示 composer/shell（FAB 始终挂载）\n",
            ),
            (
                "- [ ] 文档主体渲染与 Chat 初始化解耦\n",
                "- [x] 文档主体渲染与 Chat 初始化解耦\n",
            ),
            (
                "- [ ] history 使用后端标准 Chat API\n",
                "- [x] history 使用后端标准 Chat API\n",
            ),
            (
                "- [ ] cold page load：文档不等待 Auth/Chat\n",
                "- [x] cold page load：文档不等待 Auth/Chat（合同 + mock e2e）\n",
            ),
            (
                "- [ ] anonymous/authenticated header state\n",
                "- [x] anonymous/authenticated header state（mock e2e）\n",
            ),
            (
                "- [ ] Drawer open → send → stream → close/reopen → refresh\n",
                "- [x] Drawer open → send → stream → close/reopen → refresh（mock e2e）\n",
            ),
        ],
    )
    write("portal-129.md", body + REVISION)

    # --- lighter banners for epics / stage 0 ---
    for slug, name, status, remaining, evidence in [
        (
            "auth-16",
            "auth-16.md",
            "Stage 1 代码部分完成",
            "Stage 0 生产 OAuth/Email 与 #37 未关。",
            "auth-client 已是 Supabase-only；#51/#52 CLOSED；#48/#28 源码在 main。",
        ),
        (
            "auth-50",
            "auth-50.md",
            "session + account 已落地",
            "Security/Session 产品页、shadcn registry、browser 矩阵未做。",
            "`session-status.ts`；`account-profile-form.tsx`；无 e2e。",
        ),
        (
            "auth-26",
            "auth-26.md",
            "客户端有 Google OAuth",
            "生产 Google Cloud / Supabase Provider / 回跳未验收。",
            "`signInWithGoogle` + `docs/oauth-setup.md`。",
        ),
        (
            "auth-27",
            "auth-27.md",
            "邮箱 UI + 匿名门闩在 main",
            "生产 SMTP / confirmation / resend / recovery 未做。",
            "`login-form.tsx` `protectAnonymousEmailSignup`。",
        ),
        (
            "chat-39",
            "chat-39.md",
            "#40/#41 已交付",
            "P1 rename/search/archive、真 LLM TTFT、registry 未做。执行入口仍是 #37。",
            "非阻塞 + AuthAccountMenu + Agent settings 在 main。",
        ),
        (
            "chat-1",
            "chat-1.md",
            "v2 consumer 在 main",
            "legacy `/api/chat/threads` BFF 仍在；#37/#35 未关。",
            "cutover 合同 + `#36` MERGED + `#41` CLOSED。",
        ),
        (
            "portal-117",
            "portal-117.md",
            "1.3 代码完成",
            "1.4 #37、1.5 #35 未关。",
            "Portal/Chat/Auth 已切 `/api/user` + `/api/chats`；#43 CLOSED。",
        ),
        (
            "portal-116",
            "portal-116.md",
            "代码基线部分被 v2 覆盖",
            "生产 login→chat→stream→history 连续走通未关；依赖 auth#25–#29。",
            "Chat/Portal mock e2e；生产 OAuth 仍 OPEN。",
        ),
        (
            "portal-1",
            "portal-1.md",
            "总控保持 OPEN",
            "Stage 0 #116 未关。Stage 1.3 代码已在 main，不要把焦点切到 KB/DocHub。",
            "见 `docs/platform-issue-status.md` 2026-09-03。",
        ),
        (
            "node-vercel-starter-35",
            "nvs-35.md",
            "未开始 destructive",
            "blocked on #37。legacy `chat-threads` / JWT / SSE 仍在仓库。",
            "`src/modules/chat-threads/` 仍承担持久化。",
        ),
        (
            "node-vercel-starter-47",
            "nvs-47.md",
            "仓库设置问题，不是功能缺口",
            "Vercel Free 日限额导致 PR check 恒红。需 branch protection / ignored build，不是应用代码。",
            "`docs/vercel.md` 只有部署 env，没有 merge-gate 说明。",
        ),
        (
            "node-vercel-starter-48",
            "nvs-48.md",
            "文件已改名但 workflow 仍写死路径",
            "`.github/workflows/chat-schema-integration.yml` 仍枚举四个 migration 文件。",
            "`test/supabase-migration-order.spec.ts` 只校验仓库文件，不校验 workflow。",
        ),
        (
            "node-vercel-starter-49",
            "nvs-49.md",
            "流程 AC 未做",
            "无 CONTRIBUTING / pre-push / agent 推送策略。",
            "CI 仍对每次 push 跑全套。",
        ),
    ]:
        _, body = load(slug)
        write(name, banner(status, remaining, evidence) + body + REVISION)


if __name__ == "__main__":
    main()
