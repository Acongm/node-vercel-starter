# Public quality gate (#37)

Unauthenticated production smoke. It does not sign in, create users, or change Auth settings.

```bash
npm run test:public-quality-gate
```

Checks:

- `GET https://api.acongm.com/api/health`
- `GET /api/user/info` and `GET /api/chats` without a token → `401 AUTH_REQUIRED`
- `GET /api/chat/capabilities` when deployed; 404 is recorded as pending deploy
- `https://chat.acongm.com`, `https://www.acongm.com`, `https://auth.acongm.com` return HTML

Authenticated Send / Retry / Reload / Edit / Cancel and anonymous → OAuth same-uid remain separate #37 items.

## Browser evidence (2026-08-14, unauthenticated)

| Surface | Observed |
| --- | --- |
| `chat.acongm.com` | Sidebar 「登录」 visible. Composer placeholder stays `正在准备安全会话...`; thread list stays `加载会话...`. Matches production Anonymous Auth = off. |
| `www.acongm.com` | Header has search / GitHub / theme / account icon. Homepage has no Chat FAB/drawer. |
| `auth.acongm.com/login` | Email + Google + GitHub buttons render. No login was submitted. |
| `GET /api/health` | `ok=true`, `dataMode=supabase`. |
| `GET /api/chat/capabilities` | Production 404 until this branch deploys. |
