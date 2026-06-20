(function () {
  const TOKEN_KEY = 'chat_logs_access_token';
  let currentPage = 1;
  let lastTotal = 0;
  let lastTotalPages = 0;
  let lastPageSize = 50;
  let editingClientId = '';

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

  function datetimeLocalToIso(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  }

  function toDatetimeLocalValue(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function applyDefaultDateFilters() {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);

    const fromEl = document.getElementById('filter-from');
    const toEl = document.getElementById('filter-to');
    if (fromEl instanceof HTMLInputElement) {
      fromEl.value = toDatetimeLocalValue(from);
    }
    if (toEl instanceof HTMLInputElement) {
      toEl.value = toDatetimeLocalValue(now);
    }
  }

  function buildPageUrl(record) {
    const path = record.context?.pagePath;
    if (!path) return null;
    const base = (record.origin || 'https://www.acongm.com').replace(/\/$/, '');
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  function setStatus(message) {
    const statusLine = document.getElementById('status-line');
    if (statusLine) statusLine.textContent = message;
  }

  function setLabelStatus(message) {
    const statusLine = document.getElementById('label-status-line');
    if (statusLine) statusLine.textContent = message;
  }

  function setAuthState(authenticated, username) {
    const loginPanel = document.getElementById('login-panel');
    const filtersPanel = document.getElementById('filters-panel');
    const labelsPanel = document.getElementById('client-labels-panel');
    const userLine = document.getElementById('auth-user-line');
    if (loginPanel instanceof HTMLElement) {
      loginPanel.hidden = authenticated;
    }
    if (filtersPanel instanceof HTMLElement) {
      filtersPanel.hidden = !authenticated;
    }
    if (labelsPanel instanceof HTMLElement) {
      labelsPanel.hidden = !authenticated;
    }
    if (userLine) {
      userLine.textContent = authenticated
        ? `已登录：${username || 'admin'}`
        : '未登录';
    }
  }

  function buildQuery(page) {
    const params = new URLSearchParams();
    const fields = [
      ['filter-client-id', 'clientId'],
      ['filter-page-path', 'pagePath'],
    ];

    for (const [elementId, paramName] of fields) {
      const element = document.getElementById(elementId);
      const value = element instanceof HTMLInputElement ? element.value.trim() : '';
      if (value) params.set(paramName, value);
    }

    const fromEl = document.getElementById('filter-from');
    const toEl = document.getElementById('filter-to');
    const fromValue =
      fromEl instanceof HTMLInputElement ? datetimeLocalToIso(fromEl.value) : '';
    const toValue =
      toEl instanceof HTMLInputElement ? datetimeLocalToIso(toEl.value) : '';
    if (fromValue) params.set('from', fromValue);
    if (toValue) params.set('to', toValue);

    params.set('page', String(page ?? currentPage));
    return params.toString();
  }

  function renderDetail(record) {
    const panel = document.getElementById('detail-panel');
    const output = document.getElementById('detail-output');
    if (!(panel instanceof HTMLElement) || !(output instanceof HTMLElement)) return;
    panel.hidden = false;
    output.textContent = JSON.stringify(record, null, 2);
  }

  function renderClientIdCell(record) {
    const cell = document.createElement('td');
    const idText = document.createTextNode(record.clientId || '—');
    cell.appendChild(idText);

    if (record.clientLabel?.label) {
      const badge = document.createElement('span');
      badge.className = 'client-label-badge';
      badge.textContent = record.clientLabel.label;
      badge.title = record.clientLabel.note || record.clientLabel.label;
      cell.appendChild(badge);
    }

    return cell;
  }

  function renderPagePathCell(record) {
    const cell = document.createElement('td');
    const pagePath = record.context?.pagePath;
    if (!pagePath) {
      cell.textContent = '—';
      return cell;
    }

    const url = buildPageUrl(record);
    if (url) {
      const link = document.createElement('a');
      link.className = 'page-link';
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = truncate(pagePath, 32);
      link.title = url;
      link.addEventListener('click', (event) => {
        event.stopPropagation();
      });
      cell.appendChild(link);
    } else {
      cell.textContent = truncate(pagePath, 32);
    }

    return cell;
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

      const timeCell = document.createElement('td');
      timeCell.textContent = formatTime(item.createdAt);
      row.appendChild(timeCell);
      row.appendChild(renderClientIdCell(item));
      row.appendChild(renderPagePathCell(item));

      const endpointCell = document.createElement('td');
      endpointCell.textContent = item.endpoint || '—';
      row.appendChild(endpointCell);

      const titleCell = document.createElement('td');
      titleCell.textContent = truncate(
        item.context?.title || item.context?.pagePath || '—',
        24,
      );
      row.appendChild(titleCell);

      const messageCell = document.createElement('td');
      messageCell.textContent = truncate(item.userMessage || '—', 40);
      row.appendChild(messageCell);

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

    if (prevBtn instanceof HTMLButtonElement) {
      prevBtn.disabled = currentPage <= 1;
    }
    if (nextBtn instanceof HTMLButtonElement) {
      nextBtn.disabled =
        lastTotalPages === 0 || currentPage >= lastTotalPages;
    }

    if (lastTotal === 0) {
      setStatus('共 0 条。');
      return;
    }

    setStatus(
      `共 ${lastTotal} 条，第 ${currentPage} / ${lastTotalPages} 页，本页 ${itemsLength} 条。`,
    );
  }

  async function apiFetch(url, options) {
    const token = getToken();
    const headers = { ...(options?.headers || {}) };
    if (token) headers.authorization = `Bearer ${token}`;
    if (options?.body && !headers['content-type']) {
      headers['content-type'] = 'application/json';
    }
    return fetch(url, {
      ...options,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
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
    currentPage = 1;
    applyDefaultDateFilters();
    setStatus('登录成功，正在加载记录…');
    await Promise.all([loadLogs(1), loadClientLabels()]);
  }

  async function loadLogs(page) {
    if (!getToken()) {
      setStatus('请先登录。');
      setAuthState(false);
      return;
    }

    currentPage = page ?? 1;
    setStatus('加载中…');

    const query = buildQuery(currentPage);
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
    lastTotalPages = Number(body.totalPages ?? 0);
    lastPageSize = Number(body.pageSize ?? 50);
    currentPage = Number(body.page ?? currentPage);
    renderRows(items);
    updatePaginationControls(items.length);
  }

  function getLabelFormValues() {
    const clientIdEl = document.getElementById('label-client-id');
    const labelEl = document.getElementById('label-text');
    const noteEl = document.getElementById('label-note');
    return {
      clientId:
        clientIdEl instanceof HTMLInputElement ? clientIdEl.value.trim() : '',
      label: labelEl instanceof HTMLInputElement ? labelEl.value.trim() : '',
      note: noteEl instanceof HTMLInputElement ? noteEl.value.trim() : '',
    };
  }

  function fillLabelForm(record) {
    const clientIdEl = document.getElementById('label-client-id');
    const labelEl = document.getElementById('label-text');
    const noteEl = document.getElementById('label-note');
    editingClientId = record?.clientId || '';
    if (clientIdEl instanceof HTMLInputElement) {
      clientIdEl.value = record?.clientId || '';
    }
    if (labelEl instanceof HTMLInputElement) {
      labelEl.value = record?.label || '';
    }
    if (noteEl instanceof HTMLInputElement) {
      noteEl.value = record?.note || '';
    }
  }

  function clearLabelForm() {
    editingClientId = '';
    fillLabelForm({ clientId: '', label: '', note: '' });
  }

  function renderLabelRows(items) {
    const body = document.getElementById('labels-body');
    if (!(body instanceof HTMLElement)) return;
    body.replaceChildren();

    if (!items.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.textContent = '暂无标记。';
      row.appendChild(cell);
      body.appendChild(row);
      return;
    }

    for (const item of items) {
      const row = document.createElement('tr');
      row.dataset.clientId = item.clientId;
      const cells = [
        item.clientId,
        item.label || '—',
        item.note || '—',
        formatTime(item.updatedAt || item.createdAt),
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
        fillLabelForm(item);
      });
      body.appendChild(row);
    }
  }

  async function loadClientLabels() {
    if (!getToken()) {
      setLabelStatus('请先登录。');
      return;
    }

    setLabelStatus('加载中…');
    const response = await apiFetch('/api/ai/chat/client-labels');
    const body = await response.json().catch(() => ({}));

    if (response.status === 401) {
      setLabelStatus('会话已过期，请重新登录。');
      renderLabelRows([]);
      return;
    }

    if (!response.ok) {
      setLabelStatus(
        `请求失败：HTTP ${response.status} ${body.message || ''}`.trim(),
      );
      renderLabelRows([]);
      return;
    }

    const items = Array.isArray(body) ? body : [];
    renderLabelRows(items);
    setLabelStatus(`共 ${items.length} 条 clientId 标记。`);
  }

  async function createClientLabel() {
    const values = getLabelFormValues();
    if (!values.clientId || !values.label) {
      setLabelStatus('请填写 clientId 与标记。');
      return;
    }

    setLabelStatus('新增中…');
    const response = await apiFetch('/api/ai/chat/client-labels', {
      method: 'POST',
      body: {
        clientId: values.clientId,
        label: values.label,
        note: values.note || undefined,
      },
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setLabelStatus(`新增失败：HTTP ${response.status} ${body.message || ''}`.trim());
      return;
    }

    editingClientId = values.clientId;
    setLabelStatus('新增成功。');
    await loadClientLabels();
  }

  async function saveClientLabel() {
    const values = getLabelFormValues();
    const clientId = editingClientId || values.clientId;
    if (!clientId) {
      setLabelStatus('请选择或填写要编辑的 clientId。');
      return;
    }

    setLabelStatus('保存中…');
    const response = await apiFetch(
      `/api/ai/chat/client-labels/${encodeURIComponent(clientId)}`,
      {
        method: 'PATCH',
        body: {
          label: values.label || undefined,
          note: values.note || undefined,
        },
      },
    );
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setLabelStatus(`保存失败：HTTP ${response.status} ${body.message || ''}`.trim());
      return;
    }

    setLabelStatus('保存成功。');
    await loadClientLabels();
  }

  async function deleteClientLabel() {
    const values = getLabelFormValues();
    const clientId = editingClientId || values.clientId;
    if (!clientId) {
      setLabelStatus('请选择或填写要删除的 clientId。');
      return;
    }

    setLabelStatus('删除中…');
    const response = await apiFetch(
      `/api/ai/chat/client-labels/${encodeURIComponent(clientId)}`,
      { method: 'DELETE' },
    );

    if (response.status === 401) {
      setLabelStatus('会话已过期，请重新登录。');
      return;
    }

    if (!response.ok && response.status !== 204) {
      const body = await response.json().catch(() => ({}));
      setLabelStatus(`删除失败：HTTP ${response.status} ${body.message || ''}`.trim());
      return;
    }

    clearLabelForm();
    setLabelStatus('删除成功。');
    await loadClientLabels();
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
    applyDefaultDateFilters();
    await Promise.all([loadLogs(1), loadClientLabels()]);
  }

  function logout() {
    setToken('');
    setAuthState(false);
    currentPage = 1;
    lastTotal = 0;
    lastTotalPages = 0;
    editingClientId = '';
    renderRows([]);
    renderLabelRows([]);
    clearLabelForm();
    setStatus('已退出登录。');
    setLabelStatus('已退出登录。');
  }

  function boot() {
    document.getElementById('login-btn')?.addEventListener('click', () => {
      void login();
    });
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.getElementById('load-logs-btn')?.addEventListener('click', () => {
      currentPage = 1;
      void loadLogs(1);
    });
    document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
      for (const id of ['filter-client-id', 'filter-page-path']) {
        const element = document.getElementById(id);
        if (element instanceof HTMLInputElement) element.value = '';
      }
      applyDefaultDateFilters();
      currentPage = 1;
      setStatus('筛选已重置为最近 7 天。');
      void loadLogs(1);
    });
    document.getElementById('prev-page-btn')?.addEventListener('click', () => {
      if (currentPage > 1) {
        void loadLogs(currentPage - 1);
      }
    });
    document.getElementById('next-page-btn')?.addEventListener('click', () => {
      if (lastTotalPages > 0 && currentPage < lastTotalPages) {
        void loadLogs(currentPage + 1);
      }
    });
    document.getElementById('label-create-btn')?.addEventListener('click', () => {
      void createClientLabel();
    });
    document.getElementById('label-save-btn')?.addEventListener('click', () => {
      void saveClientLabel();
    });
    document.getElementById('label-delete-btn')?.addEventListener('click', () => {
      void deleteClientLabel();
    });
    document.getElementById('label-refresh-btn')?.addEventListener('click', () => {
      void loadClientLabels();
    });
    document.getElementById('label-clear-btn')?.addEventListener('click', () => {
      clearLabelForm();
      setLabelStatus('表单已清空。');
    });

    void restoreSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
