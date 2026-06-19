/**
 * VuePress chat client helper.
 * Copy this file into your VuePress project (e.g. docs/.vuepress/utils/chat-client.js)
 * and import chatRequest() at each chat call site with a unique callSource.
 */

const CLIENT_ID_KEY = 'acongm_client_id';
const API_BASE_URL = 'https://api.acongm.com';

export function getClientId() {
  if (typeof localStorage === 'undefined') {
    return 'server-side';
  }

  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function getConversationId(pagePath) {
  const normalizedPath = pagePath || '/';
  if (typeof sessionStorage === 'undefined') {
    return normalizedPath;
  }

  const key = `acongm_conv_${normalizedPath}`;
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export async function chatRequest(path, body, callSource) {
  const pagePath = body?.context?.pagePath ?? '/';

  return fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-client-id': getClientId(),
      'x-call-source': callSource,
      'x-conversation-id': getConversationId(pagePath),
    },
    body: JSON.stringify(body),
  });
}

/**
 * Example call sites — replace fetch() in VuePress with unique callSource values:
 *
 * // Article sidebar assistant
 * await chatRequest('/api/ai/chat', payload, 'vuepress:article-sidebar');
 *
 * // Module index assistant
 * await chatRequest('/api/ai/chat', payload, 'vuepress:module-index');
 *
 * // Reading assistant (v1)
 * await chatRequest('/api/ai/v1/chat/stream', payload, 'vuepress:reading-assistant');
 */
