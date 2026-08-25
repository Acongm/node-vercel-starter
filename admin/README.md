# API Admin Console

Umi Max + Ant Design Pro dashboard for `api.acongm.com`.

## Features

| Route | Description |
|-------|-------------|
| `/fe/dashboard` | Health + auth mode overview |
| `/fe/data` | Supabase table browser |
| `/fe/chat-logs` | AI chat log viewer |
| `/fe/debug` | API request debugger (Ant Design cards/tabs) |

## Auth

1. Unauthenticated visitors are redirected to `https://auth.acongm.com/login`
2. After SSO login, the shared `.acongm.com` cookie is sent to `/api/auth/session`
3. `GET /api/auth/roles/admin-check` must pass (role `admin`)

Built-in admin emails (see `src/modules/auth/admin-emails.ts`):

- `o.arvin.peng@gmail.com`
- `acongm@126.com`

## Development

```bash
cd admin
npm install
npm run dev
```

Production build (from repo root):

```bash
npm run build:admin
```

Output is written to `../public/`; legacy HTML console is copied to `../public/legacy/`.
