module.exports = {
  displayName: 'control-plane',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/control-plane',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};
