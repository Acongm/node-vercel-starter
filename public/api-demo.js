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

function buildOpenAiBody() {
  const model = readValue('openai-model') || undefined;
  const messages = JSON.parse(document.getElementById('openai-messages').value);
  return { model, messages };
}

function boot() {
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
      renderResponse('upload-output', {
        ok: false,
        status: 0,
        statusText: 'Client',
        durationMs: 0,
        body: 'Select a file first.',
      });
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
      renderResponse('proxy-output', {
        ok: false,
        status: 0,
        statusText: 'Client',
        durationMs: 0,
        body: 'proxy-body must be valid JSON.',
      });
      return;
    }
    renderResponse('proxy-output', await apiFetch(`/api/proxy/${encodeURIComponent(provider)}`, {
      method: 'POST',
      body,
    }));
  });
}

document.addEventListener('DOMContentLoaded', boot);
