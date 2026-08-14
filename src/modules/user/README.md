# User Center API

Canonical identity + profile + settings for Auth / Chat / Portal.

## Auth

Send `Authorization: Bearer <supabase_access_token>`. Local `/api/auth/login` JWT is not accepted.

| Code | When |
|------|------|
| `AUTH_REQUIRED` | missing bearer |
| `INVALID_TOKEN` | token rejected and not expired |
| `TOKEN_EXPIRED` | JWT `exp` is in the past |
| `SUPABASE_AUTH_REQUIRED` | principal is not a verified Supabase user |

## Endpoints

```text
GET   /api/user/info      # getUserInfo — UI display snapshot
GET   /api/user/me        # same payload as /info
GET   /api/user/profile   # { profile, userInfo }
PATCH /api/user/profile   # { displayName, avatarUrl, preferences }
GET   /api/user/settings  # { schemaVersion, defaults, overrides, effective }
PATCH /api/user/settings  # { language, theme, defaultModel, defaultPrompt }
```

`GET /api/user/settings` returns platform `defaults`, user `overrides`, and
`effective` so clients do not merge defaults themselves. `defaultModel` must be
on the server allow-list (`AI_MODEL`). `defaultPrompt: null` resets to default.

Try these on https://api.acongm.com/ → User Center.
