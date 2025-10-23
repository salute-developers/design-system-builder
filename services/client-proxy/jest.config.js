module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/__tests__/**/*.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!node_modules/**',
    '!tests/**',
    '!coverage/**',
    '!dist/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: false, // Reduced verbosity
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  // Run tests in series to avoid file system race conditions
  maxWorkers: 1,
  // Set environment variables for tests
  setupFiles: ['<rootDir>/tests/setup.ts'],
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  }
};
