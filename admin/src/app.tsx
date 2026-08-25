import { fetchSession } from '@/services/api';
import { apiFetch } from '@/services/http';
import { redirectToLogin } from '@/utils/auth';

export async function getInitialState(): Promise<{
  session?: Awaited<ReturnType<typeof fetchSession>>;
  isAdmin?: boolean;
}> {
  const session = await fetchSession();

  if (!session.authenticated) {
    redirectToLogin();
    return { session, isAdmin: false };
  }

  const adminCheck = await apiFetch('/api/auth/roles/admin-check');
  if (!adminCheck.ok) {
    redirectToLogin();
    return { session, isAdmin: false };
  }

  return { session, isAdmin: true };
}

export const layout = () => ({
  logout: () => {
    import('@/utils/auth').then(({ redirectToLogout }) => redirectToLogout());
  },
});
