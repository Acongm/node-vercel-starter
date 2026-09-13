# Operational logs vs ChatLogs

Two log channels stay separate on purpose.

## Operational logs (`appLogger` / Pino)

JSON lines on stdout/stderr. Used for request tracing and Chat send lifecycle:

- `http.request` — method, path, status, duration. No bodies, cookies, or tokens.
- `auth.verify.ok` / `auth.verify.fail` — principal id/role after a cache miss. Never the access token.
- `chat.send.start` — `requestId`, `chatId`, `userId`, optional `clientMessageId` and `runId`.
- `chat.first_token` — first thinking/delta timing with `requestId`, `chatId`, `userId`, `runId`, `durationMs`.
- `chat.stream.done` — successful SSE completion with the same ids and `durationMs`.
- `chat.stream.cancel` — client disconnect / abort without a synthetic error frame.
- `chat.stream.error` — provider or persistence failure with ids, `durationMs`, and a safe message.
- `chat.persist.error` — ChatLogs DB write failed; send still succeeds when the durable run completed.

Pino redacts `authorization`, `access_token`, `refresh_token`, `password`, and `cookie` (including `headers.*` and one-level nested copies).

## ChatLogs (product transcript)

`ChatLogWriterService` persists user/assistant text to the ChatLogs table for the admin console. That is a product record, not an operational log. Do not copy those fields into `appLogger`.

## Vercel log lookup

1. Open the deployment → **Logs** (Runtime Logs).
2. Filter by the failing `requestId` from the client response header or SSE error frame metadata.
3. Chain the same `runId` across `chat.send.start` → `chat.first_token` → `chat.stream.done|cancel|error`.
4. Confirm no log line contains message bodies, cookies, or bearer tokens; redacted fields appear as `[Redacted]`.
5. For auth issues on the same request, match `auth.verify.ok|fail` entries sharing the `requestId`.

Example filter:

```text
requestId:"req_abc123" OR runId:"11111111-1111-4111-8111-111111111111"
```
