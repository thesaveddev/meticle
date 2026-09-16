/**
 * Mobile linting.
 *
 * `@react-native` is the community config published for the React Native
 * version this app is on, so the rules follow the platform instead of a
 * hand-maintained list. It brings the react, react-hooks, react-native,
 * jest and typescript-eslint plugins with it, and ends with
 * eslint-config-prettier so formatting stays prettier's job — this reports
 * rule violations, not style preferences.
 *
 * The overrides below keep the enabled set the same shape as the web
 * workspace's (apps/web/.eslintrc.cjs): a small number of meaningful rules
 * that fail the build, and the noisy rules switched off deliberately rather
 * than tripped over on every screen.
 *
 * Generated output (android/, ios/, .expo/) is build product, not source.
 */
module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['node_modules/', '.expo/', 'android/', 'ios/', 'coverage/', 'dist/'],
  rules: {
    // Real dead code, not a style preference: an unused binding in a screen
    // usually means a half-finished refactor. `_` marks deliberate placeholders,
    // the same convention the web workspace uses.
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react-hooks/rules-of-hooks': 'error',

    // The screens load their data in a function defined in the component body
    // and call it from a mount effect; that is safe here because the tokens and
    // ids those loaders close over do not change for the life of the screen.
    // Fixing every report would mean wrapping each loader in useCallback purely
    // to satisfy the rule, so it is off — as it is in the web workspace.
    'react-hooks/exhaustive-deps': 'off',

    // Theming is inline by design: colours come from useAppColors() at render
    // time so one screen serves both light and dark mode.
    'react-native/no-inline-styles': 'off',

    // FlatList's ItemSeparatorComponent / renderItem props are where this rule
    // fires; allowAsProps lets the rule keep guarding real nested components.
    'react/no-unstable-nested-components': ['error', { allowAsProps: true }],

    // `void promise` is how this codebase marks a deliberately unawaited call,
    // and the avatar-colour hash mixes with `<<` on purpose.
    'no-void': 'off',
    'no-bitwise': 'off',
  },
}
