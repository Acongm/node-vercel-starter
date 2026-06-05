# Node Vercel Starter

NestJS + TypeScript starter for projects that need one backend shape across local Node servers and Vercel serverless deployments.

It keeps the useful backend structure from a Nest project:

- controller: HTTP boundary
- service: application logic
- module: dependency wiring
- DTO: request validation
- adapter: replaceable provider for data, files, AI, auth, and proxy calls

It does not require a database by default.

## Quick Start

```bash
npm install
cp .env.example .env
npm run build
npm test
npm run start
```

Open `http://localhost:3000`.

## Environment Modes

```env
RUNTIME_TARGET=node
DATA_MODE=memory
FILE_MODE=memory
AUTH_MODE=none
AI_PROVIDER=mock
```

### Data

`DATA_MODE` controls shared backend data:

- `none`: run without external state, using memory for demo modules
- `memory`: in-memory store, good for demos and tests
- `file`: JSON file store, good for local single-server prototypes
- `supabase`: Supabase Postgres through the server-side `DataStore` adapter
- `mongo`, `postgres`, `redis`: extension points; add concrete adapters before production use

Application services depend on `DataStore`, not on a database library.

For Supabase-backed comments:

```env
DATA_MODE=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
SUPABASE_COMMENTS_TABLE=comments
CORS_ORIGINS=https://acongm.com,https://*.acongm.com
```

Apply `supabase/migrations/20260606000000_create_comments.sql` to create the
`comments` table with RLS enabled and backend-only `service_role` access.

If a service role key is not available to the deploy environment, use:

```env
SUPABASE_API_KEY=your-publishable-or-anon-key
SUPABASE_REQUEST_SECRET=server-only-random-secret
```

Then insert the SHA-256 hash of `SUPABASE_REQUEST_SECRET` into
`private.api_secrets` for `name = 'comments'`. The Vercel function sends the
secret in an internal `x-api-secret` header, and RLS denies direct Supabase Data
API calls that do not include it.

### Files

`FILE_MODE` controls upload storage:

- `memory`: in-memory upload demo
- `local`: local filesystem upload demo
- `vercel-blob`, `s3`: extension points for durable object storage

On Vercel, durable uploads should use Blob, S3, R2, or another object store. Serverless local disk is temporary.

### Auth

`AUTH_MODE` controls login behavior:

- `none`: anonymous identity
- `jwt`: issue a demo JWT with `AUTH_JWT_SECRET`
- `external`: extension point for Clerk, Auth.js, OAuth, or another identity provider

### AI

`AI_PROVIDER` controls chat provider:

- `mock`: local echo provider
- `openai`: OpenAI-compatible `/chat/completions` endpoint
- `custom`: another OpenAI-compatible endpoint

Set:

```env
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4.1-mini
```

## Endpoints

- `GET /api/health`
- `POST /api/ai/chat`
- `POST /api/proxy/:provider`
- `POST /api/upload`
- `GET /api/upload/:key`
- `GET /api/auth/mode`
- `POST /api/auth/login`
- `GET /api/comments`
- `POST /api/comments`
- `GET /api/comments/:id`
- `PATCH /api/comments/:id`
- `DELETE /api/comments/:id`

Comment CRUD example:

```bash
curl https://api.acongm.com/api/health

created_id="$(
  curl -s https://api.acongm.com/api/comments \
    -H 'content-type: application/json' \
    -d '{"author":"Acongm","content":"Supabase CRUD works."}' |
  node -pe "JSON.parse(require('fs').readFileSync(0, 'utf8')).id"
)"

curl "https://api.acongm.com/api/comments/$created_id"

curl -X PATCH "https://api.acongm.com/api/comments/$created_id" \
  -H 'content-type: application/json' \
  -d '{"content":"Updated through the public API."}'

curl -X DELETE "https://api.acongm.com/api/comments/$created_id"
```

## Proxy Allowlist

The proxy endpoint is not open by default. Configure explicit upstreams:

```env
PROXY_ALLOWLIST=github=https://api.github.com,example=https://api.example.com
```

Then call:

```bash
curl -X POST http://localhost:3000/api/proxy/example \
  -H 'content-type: application/json' \
  -d '{"path":"/v1/items","method":"POST","body":{"hello":"world"}}'
```

## Project Shape

```text
api/index.ts              Vercel serverless entry
public/                   Static frontend demo and IndexedDB helper
src/adapters/             Replaceable provider implementations
src/common/               Shared tokens, filters, middleware
src/config/               Environment-driven app config
src/modules/*             Feature modules with controllers/services/DTOs
src/runtime/              Shared local/Vercel app setup
test/                     E2E tests
```

## Design Rule

Controllers should not know provider details. Services should not import Mongoose, Prisma, Redis, S3, or a vendor SDK directly. Add those details behind adapters, then wire them in modules based on environment variables.
