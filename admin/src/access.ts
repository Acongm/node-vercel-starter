import type { AuthSession } from './services/session';

export default function access(initialState: { session?: AuthSession } | undefined) {
  const session = initialState?.session;
  return {
    canAdmin: session?.isAdmin === true,
  };
}
