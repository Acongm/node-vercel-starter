module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/.*\\.(e2e-)?spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/modules/auth/bearer-token.ts',
    'src/modules/auth/supabase-auth.service.ts',
    'src/modules/auth/supabase-request-client.service.ts',
    'src/modules/user/user.service.ts',
    'src/modules/chat/chat.service.ts',
    'src/modules/chat/chat.repository.ts',
    'src/modules/chat/chat.types.ts',
    'src/modules/ai/chat-rate-limit.service.ts',
  ],
  coverageReporters: ['text', 'text-summary', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 95,
      lines: 90,
      statements: 90,
    },
    './src/modules/chat/chat.repository.ts': {
      branches: 70,
      functions: 100,
      lines: 90,
      statements: 85,
    },
    './src/modules/chat/chat.service.ts': {
      branches: 80,
      functions: 100,
      lines: 90,
      statements: 90,
    },
  },
};
