/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-preset-angular',
  clearMocks: true,
  restoreMocks: true,
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!.*\\.mjs$|@angular|@ionic|@stencil|ionicons|@capacitor|rxjs)',
  ],
  testMatch: ['**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
};
