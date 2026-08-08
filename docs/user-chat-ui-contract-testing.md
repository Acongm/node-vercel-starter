# User / Chat UI contract testing

This document defines the backend behavior that must be proven before coverage percentages are treated as meaningful for the new Supabase-native User and Chat modules.

The contract is derived from the current `Acongm/chat` application, not from hypothetical CRUD requirements.

## Current frontend contract

The current chat application uses:

- `@assistant-ui/react` LocalRuntime
- `@acongm/chat-ui`
- `@acongm/agent-session-sdk`
- `@acongm/auth-client`
- Supabase Auth

The visible thread UI currently exposes:

- send
- stop/cancel while a run is active
- edit a user message
- reload/regenerate an assistant message
- reasoning parts
- new/select/delete/refresh thread

The current frontend persistence SDK still targets the legacy `/api/chat/threads` API. The new backend `/api/chats` API therefore cannot be considered production-compatible merely because its service methods have high line coverage.

## Capability matrix

| Capability | Current new backend | Durable contract status |
| --- | --- | --- |
| list chats | supported | tested |
| create chat | supported | tested |
| load chat/messages | supported | tested |
| rename/update chat | supported | partially tested |
| delete chat | supported | tested, FK cascade invariant |
| send + stream message | supported | state-machine contract tests |
| reasoning/text/source parts | supported | tested |
| stop/cancel run | signal forwarded | partial: no durable run status yet |
| reload/regenerate | LocalRuntime can invoke | **not durable/idempotent yet** |
| edit user message | UI exposed | **no durable branching/update contract yet** |
| resume interrupted run | unsupported | planned |
| attachments/tools | schema can extend parts | API contract not implemented yet |
| thread archive | unsupported | planned if required by adapter |
| history update/delete | unsupported | planned for durable assistant-ui history adapter |
| cursor pagination | unsupported | planned |

The UI must not silently imply that a capability is durable when the backend only supports it locally.

## Chat state-machine contract

Successful stream:

```text
accepted
  -> authorization/rate-limit checks
  -> chat ownership/read
  -> user persisted
  -> user-persisted event
  -> provider running
  -> assistant persisted
  -> telemetry best effort
  -> persisted event
  -> done event
```

Required invariants:

1. Rate-limit failure occurs before any chat/message write.
2. Missing or RLS-inaccessible chat occurs before user-message persistence.
3. Provider failure after user persistence must not create a fake completed assistant row.
4. Assistant persistence failure must not emit `persisted` or terminal `done`.
5. Telemetry failure must not turn a durably persisted assistant answer into a failed UI run.
6. The caller AbortSignal must reach the model provider.
7. A closed HTTP connection must abort the provider and must not emit a synthetic SSE error after disconnect.
8. `done` must never be visible before durable assistant persistence.
9. Model context truncation and persisted history pagination are different concerns.

## Missing message/run contract

The next schema/API slice should introduce explicit identifiers/status so assistant-ui retry/regeneration cannot accidentally append duplicate turns:

- `clientMessageId` or equivalent idempotency key
- server message id
- run id
- message/run status (`running`, `complete`, `cancelled`, `error` or equivalent)
- optional parent message/run id if durable branching is supported

Until that exists, Edit/Reload should be documented as local/non-durable behavior or disabled where that distinction would otherwise corrupt history.

## User contract

Supabase Auth remains the identity source. The application `profiles` table stores only non-auth business/profile data.

Required `/api/user/me` behavior:

- verified Supabase `userId`
- optional email/name
- role/tier
- profile or `null`
- anonymous Supabase users remain valid stable users

Required profile update behavior:

- owner id always comes from the verified principal
- omitted fields remain omitted from the upsert patch
- write/RLS errors surface to the caller
- blank display names are rejected
- invalid avatar URLs are rejected
- role/email/userId cannot be changed through profile input

Preferences currently use replacement semantics for the supplied `preferences` object. If merge semantics are desired later, that must be introduced as an explicit contract and test rather than inferred client-side.

## Test layers

### Contract/state-machine tests

`npm run test:contracts`

These tests verify observable behavior and side-effect order, including negative paths. They are intentionally separate from coverage reporting so a test can fail even when all relevant lines were executed.

### Core coverage

`npm run test:core`

Coverage remains a regression guard, not a completeness metric. Per-file thresholds are used for critical services so unrelated files cannot average away weak coverage.

### Database/RLS integration — still required

Static SQL invariant tests do not prove real Postgres/Supabase behavior. A subsequent integration suite must execute the migration and verify at minimum:

- user A cannot read/write user B chats/messages/profile
- anonymous user A cannot read anonymous user B data
- FK cascade works in the real database
- migration preserves eligible legacy data

### Mutation testing — planned

A restricted StrykerJS suite should target Auth/User/Chat decision logic. Mutation survivors are more useful than another increase in line coverage because they identify branches whose behavior can change without making tests fail.

## Migration target for `Acongm/chat`

The frontend currently still uses legacy `/api/chat/threads` and `claimAnonymousThreads`. The intended end state is:

```text
Supabase Auth (including anonymous identity)
  -> /api/user/*
  -> /api/chats/*
  -> assistant-ui thread/history adapters
```

The frontend migration should happen only after the new API proves the thread/history/run contracts needed by the visible assistant-ui controls.

See issue #37 for the staged implementation plan.
