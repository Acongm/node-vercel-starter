# Vercel Deployment Notes

This starter includes `api/index.ts` and `vercel.json` so Vercel can deploy the Nest app as a Node function.

## Recommended Environment

```env
RUNTIME_TARGET=vercel
DATA_MODE=supabase
FILE_MODE=memory
AUTH_MODE=jwt
AUTH_JWT_SECRET=replace-me
AUTH_ADMIN_USERNAME=admin
AUTH_ADMIN_PASSWORD=
AUTH_SESSION_TTL=7d
# AUTH_GITHUB_CLIENT_ID=
# AUTH_GITHUB_CLIENT_SECRET=
# AUTH_GOOGLE_CLIENT_ID=
# AUTH_GOOGLE_CLIENT_SECRET=
# AUTH_OAUTH_REDIRECT_BASE=https://api.acongm.com
AI_PROVIDER=custom
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-pro
AI_API_KEY=as-xxx
CORS_ORIGINS=https://acongm.com,https://*.acongm.com
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
SUPABASE_API_KEY=
SUPABASE_REQUEST_SECRET=
SUPABASE_JWT_SECRET=
SUPABASE_COMMENTS_TABLE=comments
```

Use `memory` only for demos and stateless features. Serverless memory is not durable across invocations. For production, use `DATA_MODE=supabase` or another durable adapter.

## Filesystem

Vercel functions run from a read-only bundle. Temporary writes should go to `/tmp`, but `/tmp` is scratch space and should not be used as a database.

For durable files, add a `FileStore` adapter for:

- Vercel Blob
- AWS S3
- Cloudflare R2
- another object storage service

## Database

For shared comments, users, jobs, history, and team data, use a durable `DataStore` implementation.

Good candidates:

- Supabase Postgres for the built-in comments CRUD adapter
- Postgres for relational app data
- Redis or KV for cache and short-lived state
- MongoDB for document-style records
- external SaaS APIs when the real source of truth lives elsewhere

The template keeps these details behind `DataStore` so feature services do not import database libraries directly.

Apply migrations under `supabase/migrations/` before deploying with
`DATA_MODE=supabase` (comments, chat logs/threads, platform v2 tables,
`auth_users`). Prefer `SUPABASE_SERVICE_ROLE_KEY`. If unavailable, set
`SUPABASE_API_KEY` + `SUPABASE_REQUEST_SECRET`; RLS checks the internal
`x-api-secret` header.

OAuth callback URLs (API-hosted):

- `https://api.acongm.com/api/auth/oauth/github/callback`
- `https://api.acongm.com/api/auth/oauth/google/callback`

Seed local users (registration closed) from a trusted environment:

`npm run seed:auth-user -- --email you@acongm.com --password '...' --role viewer`

## Domain

Assign `api.acongm.com` to the Vercel project. Keep `CORS_ORIGINS` scoped to
`https://acongm.com,https://*.acongm.com` so frontends under `acongm.com` can call
the API without exposing Supabase credentials.

## OpenAI-Compatible AI

Set `AI_PROVIDER=custom`, `AI_BASE_URL=https://api.deepseek.com`,
`AI_MODEL=deepseek-v4-pro`, and `AI_API_KEY` to the DeepSeek key. The placeholder
`as-xxx` is useful for deployment plumbing tests: the public endpoint should call
the upstream provider and return its authentication error, proving the request is
not served by the local mock provider.

Public routes:

- `POST /v1/chat/completions`
- `POST /api/openai/v1/chat/completions`

## Long-Running Work

Vercel functions have execution limits. For long-running or durable jobs, use an external queue, database, or workflow service. Keep the Vercel function as the HTTP entry point and let durable infrastructure hold job state.
