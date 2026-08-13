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

Try these on https://api.acongm.com/ → Chats v2.
