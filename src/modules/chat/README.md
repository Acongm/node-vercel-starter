# Chat session API

Durable chats owned by `auth.uid()`.

## Auth

Same Supabase bearer contract as User Center (`AUTH_REQUIRED` / `INVALID_TOKEN` / `TOKEN_EXPIRED`).

## Endpoints

```text
GET    /api/chats
POST   /api/chats
GET    /api/chats/:id?order=desc&limit=100
PATCH  /api/chats/:id
DELETE /api/chats/:id
GET    /api/chats/:id/messages?order=desc&before=<prevCursor>
POST   /api/chats/:id/messages/stream
```

`order=desc` returns the latest page in chronological order plus `prevCursor` for older messages.

Send path (`POST /api/chats/:id/messages/stream`):

- Guard verifies the Supabase access token once; `ChatService` reuses `request.auth`.
- Model context is a bounded recent window (`CHAT_MODEL_CONTEXT_LIMIT`), separate from history pagination.
- Effective user settings come from the `UserService` cache (`uid + schemaVersion`); send does not add a second remote settings fetch after a cache hit. `defaultPrompt` is a separate user-preference message and never merges into the server system policy.
- Structured log `chat.first_token` records duration from request start to first thinking/delta.

Try these on https://api.acongm.com/ → Chats v2.
