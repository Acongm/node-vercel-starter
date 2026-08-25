export const AI_CALLER_HEADERS = {
  'x-client-id': 'GA1.1.e2etest00000000.1',
  'x-call-source': 'portal:e2e',
} as const;

export const PORTAL_CI_CALLER_HEADERS = {
  'x-service-id': 'portal-ci',
  'x-service-key': 'test-portal-ci-key',
  'x-call-source': 'portal:ci:summaries',
  'x-request-id': 'req-portal-ci-test',
} as const;
