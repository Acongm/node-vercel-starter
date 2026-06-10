# API Debug Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `https://api.acongm.com/` serve a complete HTML API debug console that lists every backend endpoint and lets you exercise full Comments CRUD against Supabase.

**Architecture:** Keep Vercel static routing (`/` → `public/index.html`). Replace the minimal demo page with a structured API console: one HTML shell, a shared `api-demo.js` fetch helper (JSON + multipart + status codes), and sectioned forms for each controller route. Comments CRUD is the primary database workflow; other modules get request/response panels. No backend code changes required unless CORS or routing gaps appear.

**Tech Stack:** Static HTML/CSS/ES modules, `fetch` API, existing NestJS routes, Vercel static + serverless routing.

---

## Current Gap

| Endpoint | Current demo | Needed |
|----------|-------------|--------|
| `GET /api/health` | partial | show runtime config |
| `POST /api/ai/chat` | partial | keep |
| `POST /v1/chat/completions` | missing | add OpenAI-style form |
| `POST /api/openai/v1/chat/completions` | missing | add alias button |
| `GET/POST /api/comments` | partial | keep |
| `GET/PATCH/DELETE /api/comments/:id` | missing | full CRUD UI |
| `GET /api/auth/mode` | missing | add |
| `POST /api/auth/login` | missing | add |
| `POST /api/upload` | missing | multipart form |
| `GET /api/upload/:key` | missing | preview/download |
| `POST /api/proxy/:provider` | missing | add with allowlist hint |
| IndexedDB local history | exists | remove (not a backend API) |

`vercel.json` already routes `/` to `public/index.html` and `/*` to `public/*`. Same-origin fetches from `api.acongm.com` do not need CORS changes.

---

## File Map

| File | Responsibility |
|------|----------------|
| `public/index.html` | Page shell, endpoint index nav, section markup |
| `public/api-demo.css` | Layout, method badges, response panels |
| `public/api-demo.js` | `apiFetch`, response renderer, per-section handlers |
| `public/client-db.js` | **Delete usage** from index; file can remain unused |
| `vercel.json` | Verify static routes (likely no change) |
| `README.md` | Document the debug console |
| `test/static-demo.spec.ts` | Smoke test that `public/index.html` references all endpoint groups |

---

### Task 1: Shared Fetch Helper

**Files:**
- Create: `public/api-demo.js`
- Test: `test/static-demo.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('API debug console assets', () => {
  it('includes all endpoint groups in index.html', () => {
    const html = readFileSync(join(process.cwd(), 'public/index.html'), 'utf8');
    const groups = [
      '/api/health',
      '/api/ai/chat',
      '/v1/chat/completions',
      '/api/comments',
      '/api/auth',
      '/api/upload',
      '/api/proxy',
    ];
    for (const group of groups) {
      expect(html).toContain(group);
    }
  });

  it('loads api-demo.js module', () => {
    const html = readFileSync(join(process.cwd(), 'public/index.html'), 'utf8');
    expect(html).toContain('./api-demo.js');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand test/static-demo.spec.ts`
Expected: FAIL — `index.html` missing endpoint groups and `api-demo.js`

- [ ] **Step 3: Create `public/api-demo.js`**

```javascript
export function renderResponse(targetId, result) {
  const el = document.getElementById(targetId);
  const lines = [
    `HTTP ${result.status} ${result.statusText}`,
    `Duration: ${result.durationMs}ms`,
    '',
    typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2),
  ];
  el.textContent = lines.join('\n');
  el.dataset.ok = result.ok ? 'true' : 'false';
}

export async function apiFetch(url, options = {}) {
  const started = performance.now();
  const headers = { ...(options.headers || {}) };

  let body = options.body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers['content-type'] = headers['content-type'] || 'application/json';
    if (typeof body !== 'string') {
      body = JSON.stringify(body);
    }
  }

  const response = await fetch(url, { ...options, headers, body });
  const durationMs = Math.round(performance.now() - started);
  const contentType = response.headers.get('content-type') || '';

  let parsed;
  if (response.status === 204) {
    parsed = null;
  } else if (contentType.includes('application/json')) {
    parsed = await response.json();
  } else if (contentType.startsWith('text/')) {
    parsed = await response.text();
  } else {
    const blob = await response.blob();
    parsed = `[binary ${blob.type || 'unknown'} ${blob.size} bytes]`;
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    durationMs,
    body: parsed,
  };
}

export function bindClick(id, handler) {
  document.getElementById(id).addEventListener('click', handler);
}

export function readValue(id) {
  return document.getElementById(id).value.trim();
}
```

- [ ] **Step 4: Re-run test**

Run: `npm test -- --runInBand test/static-demo.spec.ts`
Expected: still FAIL until Task 2 updates `index.html`

- [ ] **Step 5: Commit**

```bash
git add public/api-demo.js test/static-demo.spec.ts
git commit -m "feat: add api demo fetch helper and static asset test"
```

---

### Task 2: API Console Page Shell

**Files:**
- Create: `public/api-demo.css`
- Modify: `public/index.html`
- Test: `test/static-demo.spec.ts`

- [ ] **Step 1: Create `public/api-demo.css`**

```css
:root {
  --bg: #f7f8fb;
  --card: #ffffff;
  --border: #d9deea;
  --text: #172033;
  --muted: #5b6477;
  --primary: #265bdc;
  --danger: #c62828;
  --get: #0f766e;
  --post: #1d4ed8;
  --patch: #b45309;
  --delete: #b91c1c;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text);
  background: var(--bg);
}

.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 20px;
  width: min(1200px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 24px 0 48px;
}

nav {
  position: sticky;
  top: 16px;
  align-self: start;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
}

nav a {
  display: block;
  margin: 6px 0;
  color: var(--primary);
  text-decoration: none;
  font-size: 14px;
}

section {
  margin-bottom: 16px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
}

.method {
  display: inline-block;
  min-width: 64px;
  margin-right: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

.method-get { background: var(--get); }
.method-post { background: var(--post); }
.method-patch { background: var(--patch); }
.method-delete { background: var(--delete); }

label { display: block; margin: 10px 0 4px; font-weight: 600; font-size: 14px; }
input, textarea, select, button { font: inherit; }
input, textarea, select {
  width: 100%;
  border: 1px solid #c7cfdd;
  border-radius: 6px;
  padding: 10px;
}

.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }

button {
  border: 0;
  border-radius: 6px;
  padding: 10px 14px;
  color: white;
  background: var(--primary);
  cursor: pointer;
}

button.secondary { background: #475467; }
button.danger { background: var(--danger); }

pre {
  overflow: auto;
  margin-top: 12px;
  padding: 12px;
  border-radius: 6px;
  background: #101828;
  color: #f3f6fc;
  font-size: 13px;
  min-height: 72px;
}

pre[data-ok="false"] { outline: 2px solid var(--danger); }

.hint { color: var(--muted); font-size: 13px; margin: 0 0 8px; }

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  nav { position: static; }
}
```

- [ ] **Step 2: Replace `public/index.html` with full endpoint index**

Key structure (implement fully, not abbreviated):

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API Debug Console · api.acongm.com</title>
    <link rel="stylesheet" href="./api-demo.css" />
  </head>
  <body>
    <div class="layout">
      <nav>
        <strong>Endpoints</strong>
        <a href="#health">Health</a>
        <a href="#ai-chat">AI Chat</a>
        <a href="#openai">OpenAI Compatible</a>
        <a href="#comments">Comments CRUD</a>
        <a href="#auth">Auth</a>
        <a href="#upload">Upload</a>
        <a href="#proxy">Proxy</a>
      </nav>

      <main>
        <h1>API Debug Console</h1>
        <p class="hint">Vercel + Supabase backend demo. All requests use same-origin <code>/api/*</code> and <code>/v1/*</code> routes.</p>

        <!-- Health, AI, OpenAI, Comments, Auth, Upload, Proxy sections -->
        <!-- Each section: method badge + path + inputs + action buttons + <pre id="...-output"> -->
      </main>
    </div>
    <script type="module" src="./api-demo.js"></script>
  </body>
</html>
```

Required section IDs and output `<pre>` targets:

| Section `id` | Buttons `id` | Output `id` |
|--------------|--------------|-------------|
| `health` | `health-btn` | `health-output` |
| `ai-chat` | `ai-chat-btn` | `ai-chat-output` |
| `openai` | `openai-btn`, `openai-alias-btn` | `openai-output` |
| `comments` | `comments-list-btn`, `comments-create-btn`, `comments-get-btn`, `comments-update-btn`, `comments-delete-btn` | `comments-output` |
| `auth` | `auth-mode-btn`, `auth-login-btn` | `auth-output` |
| `upload` | `upload-post-btn`, `upload-get-btn` | `upload-output` |
| `proxy` | `proxy-btn` | `proxy-output` |

Comments form fields:

- `comment-author` (default `API Demo`)
- `comment-content`
- `comment-id` (auto-filled after create/list; used for GET/PATCH/DELETE)
- `comment-update-content`

OpenAI form fields:

- `openai-model` (default from health response or `deepseek-v4-pro`)
- `openai-messages` (textarea JSON default `[{"role":"user","content":"Hello"}]`)

Auth fields: `auth-username`, `auth-password`

Upload fields: `upload-file` (`<input type="file" name="file">`), `upload-key`

Proxy fields: `proxy-provider`, `proxy-path`, `proxy-method`, `proxy-body` (JSON textarea)

- [ ] **Step 3: Run static test**

Run: `npm test -- --runInBand test/static-demo.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/api-demo.css
git commit -m "feat: add api debug console page shell"
```

---

### Task 3: Wire All Endpoint Handlers

**Files:**
- Modify: `public/api-demo.js`

- [ ] **Step 1: Append section handlers to `api-demo.js`**

```javascript
import { apiFetch, bindClick, readValue, renderResponse } from './api-demo.js';

// At bottom of api-demo.js, after exports:

function boot() {
  bindClick('health-btn', async () => {
    renderResponse('health-output', await apiFetch('/api/health'));
  });

  bindClick('ai-chat-btn', async () => {
    renderResponse('ai-chat-output', await apiFetch('/api/ai/chat', {
      method: 'POST',
      body: { prompt: readValue('ai-prompt') },
    }));
  });

  bindClick('openai-btn', async () => {
    renderResponse('openai-output', await apiFetch('/v1/chat/completions', {
      method: 'POST',
      body: buildOpenAiBody(),
    }));
  });

  bindClick('openai-alias-btn', async () => {
    renderResponse('openai-output', await apiFetch('/api/openai/v1/chat/completions', {
      method: 'POST',
      body: buildOpenAiBody(),
    }));
  });

  bindClick('comments-list-btn', async () => {
    const result = await apiFetch('/api/comments');
    renderResponse('comments-output', result);
    const first = Array.isArray(result.body) ? result.body[0] : null;
    if (first?.id) {
      document.getElementById('comment-id').value = first.id;
    }
  });

  bindClick('comments-create-btn', async () => {
    const result = await apiFetch('/api/comments', {
      method: 'POST',
      body: {
        author: readValue('comment-author') || 'API Demo',
        content: readValue('comment-content'),
      },
    });
    renderResponse('comments-output', result);
    if (result.body?.id) {
      document.getElementById('comment-id').value = result.body.id;
    }
  });

  bindClick('comments-get-btn', async () => {
    const id = readValue('comment-id');
    renderResponse('comments-output', await apiFetch(`/api/comments/${encodeURIComponent(id)}`));
  });

  bindClick('comments-update-btn', async () => {
    const id = readValue('comment-id');
    const body = {};
    const author = readValue('comment-author');
    const content = readValue('comment-update-content');
    if (author) body.author = author;
    if (content) body.content = content;
    renderResponse('comments-output', await apiFetch(`/api/comments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
    }));
  });

  bindClick('comments-delete-btn', async () => {
    const id = readValue('comment-id');
    renderResponse('comments-output', await apiFetch(`/api/comments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }));
  });

  bindClick('auth-mode-btn', async () => {
    renderResponse('auth-output', await apiFetch('/api/auth/mode'));
  });

  bindClick('auth-login-btn', async () => {
    renderResponse('auth-output', await apiFetch('/api/auth/login', {
      method: 'POST',
      body: {
        username: readValue('auth-username'),
        password: readValue('auth-password'),
      },
    }));
  });

  bindClick('upload-post-btn', async () => {
    const input = document.getElementById('upload-file');
    const file = input.files?.[0];
    if (!file) {
      renderResponse('upload-output', { ok: false, status: 0, statusText: 'Client', durationMs: 0, body: 'Select a file first.' });
      return;
    }
    const form = new FormData();
    form.append('file', file);
    const result = await apiFetch('/api/upload', { method: 'POST', body: form });
    renderResponse('upload-output', result);
    if (result.body?.key) {
      document.getElementById('upload-key').value = result.body.key;
    }
  });

  bindClick('upload-get-btn', async () => {
    const key = readValue('upload-key');
    renderResponse('upload-output', await apiFetch(`/api/upload/${encodeURIComponent(key)}`));
  });

  bindClick('proxy-btn', async () => {
    const provider = readValue('proxy-provider');
    let body;
    try {
      body = JSON.parse(document.getElementById('proxy-body').value);
    } catch {
      renderResponse('proxy-output', { ok: false, status: 0, statusText: 'Client', durationMs: 0, body: 'proxy-body must be valid JSON.' });
      return;
    }
    renderResponse('proxy-output', await apiFetch(`/api/proxy/${encodeURIComponent(provider)}`, {
      method: 'POST',
      body,
    }));
  });

  bindClick('health-btn', async () => {
    const result = await apiFetch('/api/health');
    renderResponse('health-output', result);
    if (result.body?.aiProvider) {
      const modelInput = document.getElementById('openai-model');
      if (modelInput && !modelInput.value) {
        modelInput.placeholder = 'Uses server AI_MODEL env';
      }
    }
  });
}

function buildOpenAiBody() {
  const model = readValue('openai-model') || undefined;
  const messages = JSON.parse(document.getElementById('openai-messages').value);
  return { model, messages };
}

document.addEventListener('DOMContentLoaded', boot);
```

Fix the circular import note: keep everything in one `api-demo.js` file (exports at top, `boot()` at bottom). Remove the erroneous self-import line from the plan snippet when implementing.

- [ ] **Step 2: Manual local smoke test**

```bash
npm run build
npm run start
```

Open `http://localhost:3000/` and verify:

1. Health returns `dataMode` (expect `memory` locally)
2. Create comment → id auto-fills → GET/PATCH/DELETE work
3. Upload file → key auto-fills → GET returns binary summary
4. OpenAI route returns mock or upstream response

- [ ] **Step 3: Commit**

```bash
git add public/api-demo.js
git commit -m "feat: wire api debug console handlers for all endpoints"
```

---

### Task 4: Vercel Deploy Verification

**Files:**
- Modify: `README.md`
- Verify: `vercel.json`

- [ ] **Step 1: Confirm `vercel.json` routes (no change expected)**

```json
{ "src": "/", "dest": "/public/index.html" },
{ "src": "/(.+)", "dest": "/public/$1" }
```

- [ ] **Step 2: Update README with debug console section**

Add after Quick Start:

```markdown
## API Debug Console

Open the deployment root (`https://api.acongm.com/`) to use the built-in API console.

It covers every public route:

- Health, AI chat, OpenAI-compatible chat
- Comments full CRUD (backed by Supabase when `DATA_MODE=supabase`)
- Auth, upload, proxy

For production CRUD tests, set `DATA_MODE=supabase` and apply the Supabase migration.
```

- [ ] **Step 3: Deploy and verify production**

```bash
# After push to main / Vercel auto-deploy
curl -s https://api.acongm.com/ | grep -o 'API Debug Console'
curl -s https://api.acongm.com/api/health
```

Manual browser check on `https://api.acongm.com/`:

1. Page title shows "API Debug Console"
2. Comments: Create → List → Get → Update → Delete sequence succeeds
3. Health shows `dataMode: "supabase"` on production

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document api debug console on deployment root"
```

---

## Self-Review

| Requirement | Task |
|-------------|------|
| `api.acongm.com/` shows debug page | Task 2 + Task 4 (existing Vercel route) |
| List all project APIs | Task 2 nav + sections |
| Test Comments CRUD / Supabase | Task 3 comments handlers |
| Test other endpoints | Task 3 remaining handlers |
| Remove unrelated IndexedDB demo | Task 2 (drop `client-db.js` import) |

No backend changes required. If production health shows `dataMode: "memory"`, fix Vercel env vars (`DATA_MODE=supabase`, Supabase keys) — that is deployment config, not this plan's code scope.

---

## Production Checklist (manual)

- [ ] Vercel env: `DATA_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Migration `supabase/migrations/20260606000000_create_comments.sql` applied
- [ ] Domain `api.acongm.com` assigned to Vercel project
- [ ] `curl https://api.acongm.com/` contains `API Debug Console`
