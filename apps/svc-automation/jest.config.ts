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
  // The real `@hubblewave/instance-db` barrel re-exports entity files that
  // are declared on master but not yet committed (they're in-flight from a
  // parallel slice). Map the import to a unit-test stub so the runtime
  // tests can run without dragging in unrelated entities.
  moduleNameMapper: {
    '^@hubblewave/instance-db$': '<rootDir>/src/test-utils/instance-db-mock.ts',
    '^@hubblewave/authorization$': '<rootDir>/src/test-utils/authorization-mock.ts',
    '^@hubblewave/auth-guard$': '<rootDir>/src/test-utils/auth-guard-mock.ts',
    '^@hubblewave/shared-types$': '<rootDir>/src/test-utils/shared-types-mock.ts',
  },
};
