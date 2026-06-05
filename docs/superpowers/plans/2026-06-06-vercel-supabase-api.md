# Vercel Supabase API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy `Acongm/node-vercel-starter` as a Vercel API at `api.acongm.com` backed by Supabase CRUD storage.

**Architecture:** Keep the existing NestJS module/controller/service shape. Add a Supabase-backed `DataStore<CommentRecord>` adapter, wire it through `DATA_MODE=supabase`, expand comments to full CRUD, and deploy through Vercel serverless functions.

**Tech Stack:** NestJS, TypeScript, Jest/Supertest, Vercel Functions, Supabase Postgres, `@supabase/supabase-js`.

---

### Task 1: Comments CRUD Contract

**Files:**
- Modify: `test/app.e2e-spec.ts`
- Modify: `src/modules/comments/comments.controller.ts`
- Modify: `src/modules/comments/comments.service.ts`
- Create: `src/modules/comments/dto/update-comment.dto.ts`

- [ ] Add failing e2e coverage for `GET /api/comments/:id`, `PATCH /api/comments/:id`, `DELETE /api/comments/:id`, and missing-record `404`.
- [ ] Run `npm test -- --runInBand test/app.e2e-spec.ts` and confirm the new tests fail because routes do not exist.
- [ ] Add controller/service CRUD methods and update DTO validation.
- [ ] Re-run the e2e test and confirm CRUD behavior passes with memory storage.

### Task 2: Supabase Data Adapter

**Files:**
- Modify: `package.json`
- Modify: `src/config/app-config.ts`
- Modify: `src/modules/comments/comments.module.ts`
- Create: `src/adapters/data-store/supabase-data-store.ts`
- Modify: `.env.example`
- Modify: `test/app.e2e-spec.ts`

- [ ] Add failing unit/e2e coverage proving `DATA_MODE=supabase` requires Supabase env vars and wires a concrete adapter instead of `UnsupportedDataStore`.
- [ ] Install `@supabase/supabase-js`.
- [ ] Add `supabase` to `DataMode` and load `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_COMMENTS_TABLE`.
- [ ] Implement `SupabaseDataStore` mapping snake_case DB rows to camelCase API records.
- [ ] Wire comments module to create `SupabaseDataStore<CommentRecord>` when `DATA_MODE=supabase`.
- [ ] Run tests and typecheck.

### Task 3: Supabase Schema

**Files:**
- Create: `supabase/migrations/20260606000000_create_comments.sql`
- Modify: `README.md`
- Modify: `docs/vercel.md`

- [ ] Add SQL creating `public.comments` with `id`, `author`, `content`, `created_at`, `updated_at`, trigger-based `updated_at`, explicit grants, and RLS policies.
- [ ] Execute the SQL against the selected Supabase project.
- [ ] Run Supabase security and performance advisors, then fix task-relevant issues.
- [ ] Document environment variables and CRUD curl examples.

### Task 4: GitHub, Vercel, Domain, Verification

**Files:**
- Modify: source files from prior tasks only.

- [ ] Commit and push changes to `Acongm/node-vercel-starter`.
- [ ] Link or create the Vercel project from this repository.
- [ ] Set Vercel production env vars for Supabase and runtime mode.
- [ ] Deploy production and assign `api.acongm.com`.
- [ ] Verify public `GET /api/health`, then create, read, update, delete a comment over `https://api.acongm.com`.
