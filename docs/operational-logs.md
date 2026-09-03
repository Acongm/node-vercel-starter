# Operational logs vs ChatLogs

Two log channels stay separate on purpose.

## Operational logs (`appLogger` / Pino)

JSON lines on stdout/stderr. Used for request tracing and Chat send lifecycle:

- `http.request` — method, path, status, duration. No bodies, cookies, or tokens.
- `auth.verify.ok` / `auth.verify.fail` — principal id/role after a cache miss. Never the access token.
- `chat.send.start`, `chat.first_token`, `chat.stream.done`, `chat.stream.error` — ids and timings only. No prompt or completion text.

Pino redacts `authorization`, `access_token`, `refresh_token`, `password`, and `cookie` (including `headers.*` and one-level nested copies).

## ChatLogs (product transcript)

`ChatLogWriterService` persists user/assistant text to the ChatLogs table for the admin console. That is a product record, not an operational log. Do not copy those fields into `appLogger`.
