# Operational Logs runbook

Runtime/operational logs are structured JSON on stdout (Pino). Chat transcript
bodies live in `chats` / `messages` / `chat_runs` — not in these log lines.

## Correlation fields

| Field | Meaning |
| --- | --- |
| `requestId` | One HTTP request (`x-request-id` pass-through or generated) |
| `runId` | One Chat model run |
| `chatId` | Conversation id |
| `event` | Stable event name (e.g. `chat.first_token`) |

## Useful events

- `http.request.completed` — method/path/statusCode/durationMs
- `auth.verify.success` / `auth.verify.failure` — identity verification
- `chat.send.start` — send accepted after rate-limit
- `chat.first_token` — provider first useful stream event + `durationMs`
- `app.started` — bootstrap

## Vercel Runtime Logs examples

Filter by request:

```text
requestId:"<uuid>"
```

Filter Chat first-token latency:

```text
event:"chat.first_token"
```

Filter Auth failures:

```text
event:"auth.verify.failure"
```

Sensitive fields (`authorization`, cookies, tokens, passwords, API keys) are
redacted as `[Redacted]`. Message bodies are not logged by default.
