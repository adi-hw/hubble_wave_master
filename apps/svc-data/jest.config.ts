export default {
  displayName: 'svc-data',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/svc-data',
  passWithNoTests: true,
  // The 'uuid' package is shipped as ESM-only. Mock it for unit tests
  // that don't actually need real UUID generation.
  moduleNameMapper: {
    '^uuid$': '<rootDir>/src/test-utils/uuid-mock.js',
  },
};
