(function () {
  const SECRET_KEY = 'chat_logs_api_secret';

  function getSecretInput() {
    return document.getElementById('api-secret');
  }

  function getStoredSecret() {
    const input = getSecretInput();
    if (input?.value.trim()) {
      return input.value.trim();
    }
    return sessionStorage.getItem(SECRET_KEY) || '';
  }

  function persistSecret(value) {
    if (value) {
      sessionStorage.setItem(SECRET_KEY, value);
    } else {
      sessionStorage.removeItem(SECRET_KEY);
    }
  }

  function truncate(text, max) {
    if (!text) {
      return '';
    }
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function formatTime(value) {
    if (!value) {
      return '';
    }
    try {
      return new Date(value).toLocaleString('zh-CN');
    } catch {
      return value;
    }
  }

  function buildQuery() {
    const params = new URLSearchParams();
    const fields = [
      ['filter-client-id', 'clientId'],
      ['filter-call-source', 'callSource'],
      ['filter-page-path', 'pagePath'],
      ['filter-from', 'from'],
      ['filter-to', 'to'],
      ['filter-limit', 'limit'],
    ];

    for (const [elementId, paramName] of fields) {
      const element = document.getElementById(elementId);
      const value = element instanceof HTMLInputElement ? element.value.trim() : '';
      if (value) {
        params.set(paramName, value);
      }
    }

    return params.toString();
  }

  function renderDetail(record) {
    const panel = document.getElementById('detail-panel');
    const output = document.getElementById('detail-output');
    if (!(panel instanceof HTMLElement) || !(output instanceof HTMLElement)) {
      return;
    }

    panel.hidden = false;
    output.textContent = JSON.stringify(record, null, 2);
  }

  function renderRows(items) {
    const body = document.getElementById('logs-body');
    if (!(body instanceof HTMLElement)) {
      return;
    }

    body.replaceChildren();

    if (!items.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.textContent = '暂无数据。';
      row.appendChild(cell);
      body.appendChild(row);
      return;
    }

    for (const item of items) {
      const row = document.createElement('tr');
      row.dataset.id = item.id;

      const cells = [
        formatTime(item.createdAt),
        truncate(item.clientId || '—', 16),
        item.callSource || 'unknown',
        item.endpoint || '—',
        truncate(item.context?.title || item.context?.pagePath || '—', 24),
        truncate(item.userMessage || '—', 40),
      ];

      for (const value of cells) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      }

      row.addEventListener('click', () => {
        for (const selected of body.querySelectorAll('tr.selected')) {
          selected.classList.remove('selected');
        }
        row.classList.add('selected');
        renderDetail(item);
      });

      body.appendChild(row);
    }
  }

  async function loadLogs() {
    const statusLine = document.getElementById('status-line');
    const secretInput = getSecretInput();
    const secret = getStoredSecret();

    if (secretInput instanceof HTMLInputElement && secret) {
      secretInput.value = secret;
    }

    if (!secret) {
      if (statusLine) {
        statusLine.textContent = '请先输入 x-api-secret。';
      }
      return;
    }

    persistSecret(secret);

    const query = buildQuery();
    const url = query ? `/api/ai/chat/logs?${query}` : '/api/ai/chat/logs';

    if (statusLine) {
      statusLine.textContent = '加载中…';
    }

    const response = await fetch(url, {
      headers: {
        'x-api-secret': secret,
      },
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (statusLine) {
        statusLine.textContent = `请求失败：HTTP ${response.status} ${body.message || ''}`.trim();
      }
      renderRows([]);
      return;
    }

    const items = Array.isArray(body.items) ? body.items : [];
    renderRows(items);

    if (statusLine) {
      statusLine.textContent = `共 ${body.total ?? items.length} 条，当前显示 ${items.length} 条。`;
    }
  }

  function boot() {
    const secretInput = getSecretInput();
    const stored = sessionStorage.getItem(SECRET_KEY);
    if (secretInput instanceof HTMLInputElement && stored) {
      secretInput.value = stored;
    }

    document.getElementById('load-logs-btn')?.addEventListener('click', () => {
      void loadLogs();
    });

    document.getElementById('clear-secret-btn')?.addEventListener('click', () => {
      persistSecret('');
      if (secretInput instanceof HTMLInputElement) {
        secretInput.value = '';
      }
      const statusLine = document.getElementById('status-line');
      if (statusLine) {
        statusLine.textContent = 'Secret 已清除。';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
