export default {
  displayName: 'svc-automation',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        // isolatedModules avoids cross-file type-checking through path
        // mappings into the (unrelated) instance-db barrel, which references
        // entity files outside the svc-automation surface.
        isolatedModules: true,
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/svc-automation',
  passWithNoTests: true,
};
