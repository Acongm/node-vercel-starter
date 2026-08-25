import { history, type RunTimeLayoutConfig } from '@umijs/max';
import { LogoutOutlined } from '@ant-design/icons';
import {
  DEFAULT_LOGIN_URL,
  fetchSession,
  writeAdminToken,
  type AuthSession,
} from './services/session';

export type InitialState = {
  session?: AuthSession;
};

const LOGIN_PATH = '/user/login';
const FORBIDDEN_PATH = '/403';

function isPublicPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === FORBIDDEN_PATH;
}

export async function getInitialState(): Promise<InitialState> {
  const session = await fetchSession();
  return { session };
}

export const layout: RunTimeLayoutConfig = ({ initialState, setInitialState }) => ({
  title: 'API Admin',
  layout: 'mix',
  contentWidth: 'Fluid',
  avatarProps: {
    src: initialState?.session?.user?.avatarUrl || undefined,
    title: initialState?.session?.user?.email || initialState?.session?.user?.name || 'Admin',
    render: (_props, defaultDom) => defaultDom,
  },
  actionsRender: () => [],
  rightContentRender: undefined,
  onPageChange: () => {
    const { location } = history;
    const session = initialState?.session;
    if (isPublicPath(location.pathname)) {
      return;
    }
    if (!session?.authenticated) {
      history.replace(LOGIN_PATH);
      return;
    }
    if (!session.isAdmin) {
      history.replace(FORBIDDEN_PATH);
    }
  },
  logout: async () => {
    writeAdminToken(undefined);
    await setInitialState?.({ session: undefined });
    window.location.href = initialState?.session?.loginUrl || DEFAULT_LOGIN_URL;
  },
  menuFooterRender: () => (
    <a
      href={initialState?.session?.loginUrl || DEFAULT_LOGIN_URL}
      style={{ padding: '0 16px', color: 'inherit' }}
    >
      <LogoutOutlined /> 重新登录
    </a>
  ),
});
