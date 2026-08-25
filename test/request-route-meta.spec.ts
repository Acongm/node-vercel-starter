import { classifyRequestRoute } from '../src/common/request-route-meta';

describe('classifyRequestRoute', () => {
  it('classifies auth routes', () => {
    expect(classifyRequestRoute('/api/auth/session')).toEqual({
      routeGroup: 'auth',
      isStream: false,
    });
    expect(classifyRequestRoute('/api/user/settings')).toEqual({
      routeGroup: 'auth',
      isStream: false,
    });
  });

  it('classifies chat routes including stream endpoints', () => {
    expect(classifyRequestRoute('/api/chats/abc/messages/stream')).toEqual({
      routeGroup: 'chat',
      isStream: true,
    });
    expect(classifyRequestRoute('/api/ai/v1/chat/stream')).toEqual({
      routeGroup: 'chat',
      isStream: true,
    });
    expect(classifyRequestRoute('/api/ai/chat/logs')).toEqual({
      routeGroup: 'chat',
      isStream: false,
    });
  });

  it('classifies admin and other routes', () => {
    expect(classifyRequestRoute('/api/admin/overview')).toEqual({
      routeGroup: 'admin',
      isStream: false,
    });
    expect(classifyRequestRoute('/api/comments')).toEqual({
      routeGroup: 'other',
      isStream: false,
    });
  });
});
