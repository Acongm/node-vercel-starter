(function () {
  function renderResponse(targetId, result) {
    const el = document.getElementById(targetId);
    if (!el) {
      return;
    }

    const lines = [
      `HTTP ${result.status} ${result.statusText}`,
      `Duration: ${result.durationMs}ms`,
      '',
      typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2),
    ];
    el.textContent = lines.join('\n');
    el.dataset.ok = result.ok ? 'true' : 'false';
  }

  async function apiFetch(url, options) {
    const started = performance.now();
    const headers = { ...(options?.headers || {}) };

    let body = options?.body;
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

  function bindClick(id, handler, outputId) {
    const el = document.getElementById(id);
    if (!el) {
      console.error(`Missing button: #${id}`);
      return;
    }

    el.addEventListener('click', async () => {
      el.disabled = true;
      try {
        await handler();
      } catch (error) {
        renderResponse(outputId || id.replace(/-btn$/, '-output'), {
          ok: false,
          status: 0,
          statusText: 'Client Error',
          durationMs: 0,
          body: error instanceof Error ? error.message : String(error),
        });
      } finally {
        el.disabled = false;
      }
    });
  }

  function readValue(id) {
    return document.getElementById(id)?.value.trim() ?? '';
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
      const username = readValue('auth-username');
      const password = readValue('auth-password');
      const body = username.includes('@')
        ? { email: username, password }
        : { username, password };
      const result = await apiFetch('/api/auth/login', {
        method: 'POST',
        body,
      });
      renderResponse('auth-output', result);
      if (result.body?.accessToken) {
        const tokenInput = document.getElementById('auth-token');
        if (tokenInput) tokenInput.value = result.body.accessToken;
      }
    });

    bindClick('auth-me-btn', async () => {
      const token = readValue('auth-token');
      const headers = token ? { authorization: `Bearer ${token}` } : {};
      renderResponse('auth-output', await apiFetch('/api/auth/me', { headers }));
    });

    function supabaseHeaders() {
      const token = readValue('supabase-token');
      return token ? { authorization: `Bearer ${token}` } : {};
    }

    bindClick('user-info-btn', async () => {
      renderResponse('user-output', await apiFetch('/api/user/info', {
        headers: supabaseHeaders(),
      }));
    }, 'user-output');

    bindClick('user-me-btn', async () => {
      renderResponse('user-output', await apiFetch('/api/user/me', {
        headers: supabaseHeaders(),
      }));
    }, 'user-output');

    bindClick('user-profile-btn', async () => {
      renderResponse('user-output', await apiFetch('/api/user/profile', {
        headers: supabaseHeaders(),
      }));
    }, 'user-output');

    bindClick('user-profile-patch-btn', async () => {
      const displayName = readValue('user-display-name');
      renderResponse('user-output', await apiFetch('/api/user/profile', {
        method: 'PATCH',
        headers: supabaseHeaders(),
        body: { displayName: displayName || undefined },
      }));
    }, 'user-output');

    bindClick('user-settings-btn', async () => {
      renderResponse('user-output', await apiFetch('/api/user/settings', {
        headers: supabaseHeaders(),
      }));
    }, 'user-output');

    bindClick('user-settings-patch-btn', async () => {
      const theme = readValue('user-theme') || 'system';
      renderResponse('user-output', await apiFetch('/api/user/settings', {
        method: 'PATCH',
        headers: supabaseHeaders(),
        body: { theme },
      }));
    }, 'user-output');

    bindClick('chats-list-btn', async () => {
      const result = await apiFetch('/api/chats?limit=20', {
        headers: supabaseHeaders(),
      });
      renderResponse('chats-output', result);
      const first = Array.isArray(result.body?.chats) ? result.body.chats[0] : null;
      if (first?.id) {
        document.getElementById('chat-id').value = first.id;
      }
    }, 'chats-output');

    bindClick('chats-create-btn', async () => {
      const result = await apiFetch('/api/chats', {
        method: 'POST',
        headers: supabaseHeaders(),
        body: { title: readValue('chat-title') || 'API console chat' },
      });
      renderResponse('chats-output', result);
      if (result.body?.id) {
        document.getElementById('chat-id').value = result.body.id;
      }
    }, 'chats-output');

    bindClick('chats-get-btn', async () => {
      const id = readValue('chat-id');
      const result = await apiFetch(
        `/api/chats/${encodeURIComponent(id)}?order=desc&limit=50`,
        { headers: supabaseHeaders() },
      );
      renderResponse('chats-output', result);
      if (result.body?.prevCursor) {
        document.getElementById('chat-before').value = result.body.prevCursor;
      }
    }, 'chats-output');

    bindClick('chats-messages-btn', async () => {
      const id = readValue('chat-id');
      const before = readValue('chat-before');
      const query = new URLSearchParams({ order: 'desc', limit: '50' });
      if (before) query.set('before', before);
      renderResponse(
        'chats-output',
        await apiFetch(
          `/api/chats/${encodeURIComponent(id)}/messages?${query.toString()}`,
          { headers: supabaseHeaders() },
        ),
      );
    }, 'chats-output');

    bindClick('chats-stream-btn', async () => {
      const id = readValue('chat-id');
      const result = await apiFetch(
        `/api/chats/${encodeURIComponent(id)}/messages/stream`,
        {
          method: 'POST',
          headers: supabaseHeaders(),
          body: {
            content: readValue('chat-content') || 'hello from api console',
            enableThinking: true,
          },
        },
      );
      renderResponse('chats-output', result);
    }, 'chats-output');

    bindClick('oauth-providers-btn', async () => {
      renderResponse('oauth-output', await apiFetch('/api/auth/oauth/providers'));
    });

    bindClick('site-config-btn', async () => {
      renderResponse('site-config-output', await apiFetch('/api/config/site'));
    });

    bindClick('upload-post-btn', async () => {
      const input = document.getElementById('upload-file');
      const file = input?.files?.[0];
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
