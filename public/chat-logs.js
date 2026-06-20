(function () {
  const TOKEN_KEY = 'chat_logs_access_token';
  let currentOffset = 0;
  let lastTotal = 0;

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(value) {
    if (value) {
      sessionStorage.setItem(TOKEN_KEY, value);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }

  function truncate(text, max) {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function formatTime(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('zh-CN');
    } catch {
      return value;
    }
  }

  function setStatus(message) {
    const statusLine = document.getElementById('status-line');
    if (statusLine) statusLine.textContent = message;
  }

  function setAuthState(authenticated, username) {
    const loginPanel = document.getElementById('login-panel');
    const filtersPanel = document.getElementById('filters-panel');
    const userLine = document.getElementById('auth-user-line');
    if (loginPanel instanceof HTMLElement) {
      loginPanel.hidden = authenticated;
    }
    if (filtersPanel instanceof HTMLElement) {
      filtersPanel.hidden = !authenticated;
    }
    if (userLine) {
      userLine.textContent = authenticated
        ? `已登录：${username || 'admin'}`
        : '未登录';
    }
  }

  function buildQuery(offset) {
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
      if (value) params.set(paramName, value);
    }

    if (!params.has('limit')) {
      params.set('limit', '200');
    }
    params.set('offset', String(offset ?? currentOffset));

    return params.toString();
  }

  function renderDetail(record) {
    const panel = document.getElementById('detail-panel');
    const output = document.getElementById('detail-output');
    if (!(panel instanceof HTMLElement) || !(output instanceof HTMLElement)) return;
    panel.hidden = false;
    output.textContent = JSON.stringify(record, null, 2);
  }

  function renderRows(items) {
    const body = document.getElementById('logs-body');
    if (!(body instanceof HTMLElement)) return;
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

  function updatePaginationControls(itemsLength) {
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const limitInput = document.getElementById('filter-limit');
    const limit = limitInput instanceof HTMLInputElement ? Number(limitInput.value || 200) : 200;

    if (prevBtn instanceof HTMLButtonElement) {
      prevBtn.disabled = currentOffset <= 0;
    }
    if (nextBtn instanceof HTMLButtonElement) {
      nextBtn.disabled = currentOffset + itemsLength >= lastTotal;
    }

    setStatus(
      `共 ${lastTotal} 条，当前第 ${Math.floor(currentOffset / limit) + 1} 页，显示 ${itemsLength} 条（offset=${currentOffset}）。`,
    );
  }

  async function apiFetch(url, options) {
    const token = getToken();
    const headers = { ...(options?.headers || {}) };
    if (token) headers.authorization = `Bearer ${token}`;
    if (options?.body && !headers['content-type']) {
      headers['content-type'] = 'application/json';
    }
    return fetch(url, { ...options, headers, body: options?.body ? JSON.stringify(options.body) : undefined });
  }

  async function login() {
    const usernameEl = document.getElementById('login-username');
    const passwordEl = document.getElementById('login-password');
    const username = usernameEl instanceof HTMLInputElement ? usernameEl.value.trim() : '';
    const password = passwordEl instanceof HTMLInputElement ? passwordEl.value : '';

    if (!username || !password) {
      setStatus('请输入账号和密码。');
      return;
    }

    setStatus('登录中…');
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus(`登录失败：HTTP ${response.status} ${body.message || ''}`.trim());
      return;
    }

    setToken(body.accessToken);
    setAuthState(true, body.user?.username);
    currentOffset = 0;
    setStatus('登录成功，正在加载全部记录…');
    await loadLogs(0);
  }

  async function loadLogs(offset) {
    if (!getToken()) {
      setStatus('请先登录。');
      setAuthState(false);
      return;
    }

    currentOffset = offset ?? 0;
    setStatus('加载中…');

    const query = buildQuery(currentOffset);
    const response = await apiFetch(`/api/ai/chat/logs?${query}`);
    const body = await response.json().catch(() => ({}));

    if (response.status === 401) {
      setToken('');
      setAuthState(false);
      setStatus('会话已过期，请重新登录。');
      renderRows([]);
      return;
    }

    if (!response.ok) {
      setStatus(`请求失败：HTTP ${response.status} ${body.message || ''}`.trim());
      renderRows([]);
      return;
    }

    const items = Array.isArray(body.items) ? body.items : [];
    lastTotal = Number(body.total ?? items.length);
    renderRows(items);
    updatePaginationControls(items.length);
  }

  async function restoreSession() {
    if (!getToken()) {
      setAuthState(false);
      return;
    }

    const response = await apiFetch('/api/auth/me');
    const body = await response.json().catch(() => ({}));

    if (!response.ok || !body.authenticated) {
      setToken('');
      setAuthState(false);
      return;
    }

    setAuthState(true, body.user?.username);
    await loadLogs(0);
  }

  function logout() {
    setToken('');
    setAuthState(false);
    currentOffset = 0;
    lastTotal = 0;
    renderRows([]);
    setStatus('已退出登录。');
  }

  function boot() {
    document.getElementById('login-btn')?.addEventListener('click', () => {
      void login();
    });
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.getElementById('load-logs-btn')?.addEventListener('click', () => {
      currentOffset = 0;
      void loadLogs(0);
    });
    document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
      for (const id of [
        'filter-client-id',
        'filter-call-source',
        'filter-page-path',
        'filter-from',
        'filter-to',
      ]) {
        const element = document.getElementById(id);
        if (element instanceof HTMLInputElement) element.value = '';
      }
      const limit = document.getElementById('filter-limit');
      if (limit instanceof HTMLInputElement) limit.value = '200';
      currentOffset = 0;
      setStatus('筛选已清空，将加载全部记录。');
    });
    document.getElementById('prev-page-btn')?.addEventListener('click', () => {
      const limitInput = document.getElementById('filter-limit');
      const limit = limitInput instanceof HTMLInputElement ? Number(limitInput.value || 200) : 200;
      void loadLogs(Math.max(0, currentOffset - limit));
    });
    document.getElementById('next-page-btn')?.addEventListener('click', () => {
      const limitInput = document.getElementById('filter-limit');
      const limit = limitInput instanceof HTMLInputElement ? Number(limitInput.value || 200) : 200;
      void loadLogs(currentOffset + limit);
    });

    void restoreSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
