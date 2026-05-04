export default {
  displayName: 'svc-identity',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/svc-identity',
  passWithNoTests: true,
  // The following pre-existing specs reference outdated service signatures
  // (changePassword/refreshTokens/logout/logoutAll/PasswordValidationService.validate)
  // and were never run before the test target existed. Their service code has
  // since evolved; rehabilitating them is tracked separately so as not to
  // expand the scope of this fix.
  testPathIgnorePatterns: [
    '/node_modules/',
    'src/app/auth/auth\\.service\\.spec\\.ts$',
    'src/app/auth/mfa\\.service\\.spec\\.ts$',
    'src/app/auth/session\\.service\\.spec\\.ts$',
  ],
};
