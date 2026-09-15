/**
 * Mobile test runner (jest + jest-expo).
 *
 * Version note: package.json pins jest-expo, @react-native/jest-preset and
 * react-test-renderer exactly on purpose. react-native 0.86.0 declares
 * @react-native/jest-preset 0.86.0 as a peer, while jest-expo 57.0.3 and later
 * require ^0.86.2 — only jest-expo 57.0.1/57.0.2 accept the preset the installed
 * React Native asks for. Widening any of those ranges makes `npm ci` fail with
 * ERESOLVE, so bump them together (or bump react-native first).
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts?(x)'],
  clearMocks: true,
  // These are whole-screen renders, so a single test can run several seconds on
  // a slower (CI) machine. The default 5s budget is a flake waiting to happen;
  // this matches the API suite's allowance.
  testTimeout: 30_000,
};
