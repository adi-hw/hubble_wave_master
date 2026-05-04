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
  testPathIgnorePatterns: ['/node_modules/'],
};
