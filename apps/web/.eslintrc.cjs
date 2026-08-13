module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  rules: {
    // Unused variables/params are already enforced by tsc (strict + noUnusedLocals/Parameters);
    // underscore-prefixed names are the codebase convention for intentional placeholders
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

    // Keep the enforced set small and meaningful — the codebase leans on `any`
    // liberally and predates strict linting, so stay pragmatic on the noisy rules.
    'no-var': 'error',
    'prefer-const': 'error',
    'no-debugger': 'error',
    'no-duplicate-imports': 'error',
    'no-unreachable': 'error',
    'no-constant-condition': 'error',
    eqeqeq: ['error', 'smart'],
    'react-hooks/rules-of-hooks': 'error',

    // Noisy rules that don't fit this codebase
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'react-refresh/only-export-components': 'off',
    'react-hooks/exhaustive-deps': 'off',
  },
  ignorePatterns: ['dist', 'node_modules', 'build', 'public'],
};
