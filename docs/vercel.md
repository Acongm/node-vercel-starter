# Vercel Deployment Notes

This starter includes `api/index.ts` and `vercel.json` so Vercel can deploy the Nest app as a Node function.

## Recommended Environment

```env
RUNTIME_TARGET=vercel
DATA_MODE=memory
FILE_MODE=memory
AUTH_MODE=none
AI_PROVIDER=mock
```

Use `memory` only for demos and stateless features. Serverless memory is not durable across invocations.

## Filesystem

Vercel functions run from a read-only bundle. Temporary writes should go to `/tmp`, but `/tmp` is scratch space and should not be used as a database.

For durable files, add a `FileStore` adapter for:

- Vercel Blob
- AWS S3
- Cloudflare R2
- another object storage service

## Database

For shared comments, users, jobs, history, and team data, add a `DataStore` implementation for your real data backend.

Good candidates:

- Postgres for relational app data
- Redis or KV for cache and short-lived state
- MongoDB for document-style records
- external SaaS APIs when the real source of truth lives elsewhere

The template keeps these details behind `DataStore` so feature services do not import database libraries directly.

## Long-Running Work

Vercel functions have execution limits. For long-running or durable jobs, use an external queue, database, or workflow service. Keep the Vercel function as the HTTP entry point and let durable infrastructure hold job state.
