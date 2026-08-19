const PROJECT_REF = 'ejprvntpxlyydkzsjqnv';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const USER_AGENT = 'acongm-live-quality-gate/1.0';

export { PROJECT_REF, SUPABASE_URL };

export async function request(url, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: { 'User-Agent': USER_AGENT, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: response.status, json, text };
}

function adminHeaders(serviceRole) {
  return {
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
    'Content-Type': 'application/json',
  };
}

export async function loadProjectKeys(managementToken) {
  const result = await request(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`,
    { headers: { Authorization: `Bearer ${managementToken}`, Accept: 'application/json' } },
  );
  if (!Array.isArray(result.json)) {
    throw new Error(`management api-keys failed (${result.status})`);
  }
  const serviceRole = result.json.find((key) => key.name === 'service_role')?.api_key;
  const anon = result.json.find((key) => key.name === 'anon')?.api_key;
  if (!serviceRole || !anon) {
    throw new Error('management api-keys missing service_role or anon');
  }
  return { serviceRole, anon };
}

export async function createEphemeralUser(serviceRole) {
  const stamp = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const email = `qg-${stamp}@acongm.com`;
  const password = `Qg-${crypto.randomUUID().slice(0, 18)}!`;
  const result = await request(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(serviceRole),
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: 'Quality Gate Live' },
    },
  });
  if (result.status >= 300 || !result.json?.id) {
    throw new Error(`failed to create ephemeral user (${result.status})`);
  }
  return { id: result.json.id, email, password };
}

export async function passwordLogin(anon, email, password) {
  const result = await request(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
    },
    body: { email, password },
  });
  if (!result.json?.access_token) {
    throw new Error(`password login failed (${result.status})`);
  }
  return result.json;
}

export async function deleteEphemeralUser(serviceRole, userId) {
  const result = await request(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: adminHeaders(serviceRole),
  });
  if (result.status >= 300) {
    throw new Error(`failed to delete ephemeral user (${result.status})`);
  }
}

export async function mintLiveUser(managementToken) {
  const keys = await loadProjectKeys(managementToken);
  const user = await createEphemeralUser(keys.serviceRole);
  const session = await passwordLogin(keys.anon, user.email, user.password);
  return {
    ...keys,
    user,
    session,
    async cleanup() {
      await deleteEphemeralUser(keys.serviceRole, user.id);
    },
  };
}
