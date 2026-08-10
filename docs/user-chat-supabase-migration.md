# User / Chat Supabase migration

This branch introduces the first mergeable slice of issue #30. New clients should use Supabase Auth directly and call the new API surface with a Supabase access token.

## Required environment

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`SUPABASE_SERVICE_ROLE_KEY` remains server-only and is not required for normal user-owned `profiles/chats/messages` requests.

Apply:

```text
supabase/migrations/20260808000000_user_chat_supabase_auth.sql
```

The migration creates:

- `profiles` — application profile data; `id` references `auth.users(id)`
- `chats` — user-owned conversations
- `messages` — extensible `parts jsonb` messages
- RLS policies based on `auth.uid()`

It keeps the legacy `auth_users/chat_threads/chat_messages` tables during the compatibility window. Legacy chats are copied only when `chat_threads.user_id` already matches a real `auth.users.id`.

## New authentication contract

Clients authenticate with Supabase SDK (`signInWithPassword`, OAuth, anonymous auth, etc.) and send:

```http
Authorization: Bearer <supabase_access_token>
```

The API validates the token using Supabase Auth `getUser(access_token)`. Authorization roles are read only from server-controlled `app_metadata` (`platform_role`, `role`, or `roles`). `user_metadata` is display-only and never drives ACL.

Legacy local/admin JWTs remain available only through the old APIs during migration.

## New User API

```text
GET   /api/user/me          # canonical account snapshot
GET   /api/user/info        # getUserInfo alias (same payload as /me)
GET   /api/user/settings
PATCH /api/user/settings
PATCH /api/user/profile
```

`GET /me` and `GET /info` return:

- identity: `id`, `email`, `name`, `role`, `tier`, `isAnonymous`
- raw `profile` row (snake_case columns for DB fidelity)
- **`userInfo`**: UI-ready `{ displayName, avatarUrl, email, accountLabel, ... }`
  for AuthAccountButton / nav / menus (profile fields win over Auth metadata)
- **`settings`**: typed `{ language, theme, preferences }` derived from profile preferences

Example profile update:

```json
{
  "displayName": "Acongm",
  "avatarUrl": "https://example.com/avatar.png",
  "preferences": {
    "language": "zh-CN"
  }
}
```

Example settings update:

```json
{
  "language": "en",
  "theme": "dark"
}
```

> Note: `GET /api/auth/me` remains a legacy principal probe (optional token, no profile).
> New clients should call `/api/user/me` or `/api/user/info` with a Supabase Bearer token.

## New Chat API

```text
GET    /api/chats
POST   /api/chats
GET    /api/chats/:id
PATCH  /api/chats/:id
DELETE /api/chats/:id
GET    /api/chats/:id/messages
POST   /api/chats/:id/messages/stream
```

The new repository queries Supabase directly with the user's JWT. It no longer performs `list all -> JavaScript filter` ownership checks. Deleting a chat relies on the `messages.chat_id -> chats.id ON DELETE CASCADE` foreign key.

Messages are stored as extensible parts:

```json
{
  "role": "assistant",
  "parts": [
    { "type": "reasoning", "text": "..." },
    { "type": "text", "text": "..." },
    { "type": "source", "source": { "title": "...", "url": "..." } }
  ]
}
```

This avoids adding a new DB column and DTO every time chat gains reasoning, sources, tools, files, or future UI parts.

## Compatibility window

The following remain available temporarily and should receive no new features except production blockers:

```text
/api/auth/login
/api/auth/oauth/*
/api/chat/threads/*
/api/ai/v1/chat*
public.auth_users
public.chat_threads
public.chat_messages
```

Follow-up PRs should migrate clients, move the remaining stream contract toward the current Vercel AI SDK message protocol, migrate remaining production history, and then remove the legacy identity/chat stack.
