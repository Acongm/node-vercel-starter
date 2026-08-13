# User / Chat UI contract testing

This document defines the observable backend contract that must be proven before coverage percentages are treated as meaningful for the Supabase-native User and Chat modules.

The contract is derived from the real `Acongm/chat` assistant-ui behavior rather than hypothetical CRUD requirements.

## Current frontend boundary

The chat application currently uses:

- `@assistant-ui/react` LocalRuntime
- `@acongm/chat-ui`
- `@acongm/agent-session-sdk`
- `@acongm/auth-client`
- Supabase Auth

The visible UI exposes send, stop/cancel, edit, reload/regenerate, reasoning and thread navigation. Primary consumers (`Acongm/chat`, `Acongm/portal` embedded Drawer, `Acongm/auth` account chrome) migrated to `/api/chats` and `/api/user/info` on main (Aug 2026). Remaining product gaps are browser E2E proof (#37) and capability items still gated in contract todos.

## Stage 1.2 capability matrix

| Capability | Durable backend contract | Consumer status |
| --- | --- | --- |
| list/create/get/rename/delete chats | supported + tested | migrated (`Acongm/chat#36`, `Acongm/portal#128`) |
| message history | persisted + stable cursor pagination | migrated; lazy first-screen still #40 |
| send + stream | durable state-machine contract | migrated |
| text/reasoning/source parts | persisted + tested | migrated |
| retry delivery | `clientMessageId` idempotency | migrated |
| reload/regenerate | reuses persisted user turn; new run/assistant result | migrated; browser E2E pending #37 |
| stop/cancel | upstream abort + durable cancelled run | migrated; browser E2E pending #37 |
| provider/persistence failure | durable error state; no fake completion | supported |
| edit/branch parent relation | `parentMessageId` durable relation + branch-aware model context | UI update/delete semantics still gated |
| resume/reconnect interrupted run | unsupported | capability=false until future implementation |
| ThreadHistoryAdapter update/delete | not a complete public durable API yet | capability=false |
| attachments/tools | parts schema is extensible; end-to-end contract not implemented | future capability |
| login-state display (`userInfo`) | `GET /api/user/info` + profile/settings PATCH | migrated (`Acongm/auth#52`, chat/portal auth-client sync) |

The UI must never imply durable support for a capability that is only local runtime behavior.

## Durable message and run identity

Stage 1.2 introduces explicit persistence semantics:

- server message id
- client-generated `clientMessageId` for delivery idempotency
- `parentMessageId` for durable lineage
- stable `runId`
- explicit run status (`running`, `complete`, `cancelled`, `error`)
- one completed run references at most one durable assistant completion

Required retry semantics:

1. same `clientMessageId` + same content/parent reuses the user turn;
2. same client id + different content/parent is a conflict;
3. completed `runId` replay does not call the provider again;
4. a running `runId` cannot start a second concurrent generation;
5. cancelled/error runs are terminal; retry creates a new run;
6. regenerate reuses the existing user turn rather than appending a duplicate user message.

## Chat state-machine contract

Successful generation:

```text
accepted
  -> authorization/rate-limit checks
  -> chat ownership/read
  -> user message resolved/persisted
  -> run running
  -> provider
  -> assistant persisted
  -> run complete
  -> persisted event
  -> done event
  -> best-effort auxiliary touch/title/telemetry
```

Required invariants:

1. Rate-limit failure occurs before durable chat/message/run writes for the attempted generation.
2. Missing or RLS-inaccessible chat fails before user-message persistence.
3. Provider failure after user persistence records an error run and never fabricates a completed assistant message.
4. Client abort/disconnect records a cancelled run where persistence is still possible.
5. Assistant persistence failure cannot emit `persisted` or terminal success.
6. Provider completion without protocol `done` is `CHAT_STREAM_INCOMPLETE`.
7. Empty provider output is `CHAT_EMPTY_RESPONSE`, never silent success.
8. `done` is observable only after assistant persistence and run completion.
9. `touch`, automatic title and telemetry are auxiliary; their failure cannot reverse an already durable successful answer.
10. Persisted history pagination and bounded model-context projection are separate concerns.

## Stable pagination

### Chat list

- order: `updated_at DESC, id DESC`
- opaque cursor contains the stable boundary
- query uses `limit + 1` to derive `nextCursor`
- matching index: `(user_id, updated_at DESC, id DESC)`

### Message history

- order: `created_at ASC, id ASC`
- opaque cursor + deterministic id tie-breaker
- bounded page using `limit + 1`
- matching index: `(chat_id, created_at ASC, id ASC)`

Equal timestamps must not produce duplicate or missing rows across page boundaries.

## User contract

Supabase Auth remains the identity source. `public.profiles` stores only application profile data.

`GET /api/user/me` (and alias `GET /api/user/info`) exposes the verified Supabase identity plus application role/tier, `isAnonymous`, nullable profile, UI-ready `userInfo`, and typed `settings`.

`userInfo` resolution order:

1. `profiles.display_name` / `profiles.avatar_url`
2. Auth principal display name / OAuth avatar metadata
3. email local-part / `访客` fallback for anonymous

`GET/PATCH /api/user/settings` reads and merges typed preferences (`language`, `theme`) without requiring a full profile replace. PATCH responses include refreshed `userInfo` for display sync.

`PATCH /api/user/profile` returns `{ profile, userInfo }` so clients can refresh nav/avatar without a second `/info` round trip.
Profile PATCH semantics are explicit:

- owner id always comes from verified principal
- existing rows use partial update; missing rows are inserted
- omitted fields remain unchanged
- `displayName: null` / `avatarUrl: null` explicitly clear nullable fields
- supplied `preferences` replaces the preferences object; null is rejected
- body input cannot change userId/email/role/tier
- blank display names and invalid avatar URLs are rejected

Stage 1.1 also locks stable auth errors:

- missing bearer token -> `401 AUTH_REQUIRED`
- invalid/expired/malformed Supabase principal -> `401 INVALID_TOKEN`

## Test layers

### Contract/state-machine tests

`npm run test:contracts`

These verify observable behavior and side-effect ordering. They are intentionally independent from coverage reporting.

### Core coverage

`npm run test:core`

Coverage is a regression guard, not a completeness metric. Critical files have explicit per-file thresholds.

### PostgreSQL / RLS integration

Stage 1.2 includes real schema/RLS workflow fixtures that execute migrations against PostgreSQL/Supabase-compatible infrastructure and verify ownership using distinct principals. Final production-path JWT/Data API E2E remains part of #37 after the real consumer is migrated.

### Mutation testing

A focused mutation smoke workflow targets high-value Chat decision points. #37 remains responsible for the final mutation threshold and survivor review across the production consumer path.

## Migration target

The intended product path is:

```text
Supabase Auth (including anonymous identity)
  -> /api/user/*
  -> /api/chats/*
  -> assistant-ui thread/history adapters
```

Stage 1.2 proves the durable backend core. Stage 1.3 consumer migration (`Acongm/node-vercel-starter#43`) merged on main for Chat, Portal embedded Drawer, and auth-client `getUserInfo` consumers. Remaining work: browser E2E (#37), non-blocking startup (#40), auth-client single source (#51), and capabilities still marked false in contract todos.

See #32 for the Stage 1 sequence and #37 for the final quality gate.
