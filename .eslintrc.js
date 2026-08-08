module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // @react-native's config globs *.js, *.jsx, *.ts and *.tsx — never *.mjs —
      // so none of its parser settings reach the proxy or the fixture suites.
      // ESLint then falls back to espree at the ES2015 default, which parses
      // arrow functions but rejects `async function` with a bare
      // "Unexpected token function". Declaring the parser options here is what
      // makes plain ESM linted rather than merely skipped.
      files: ['**/*.mjs'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      env: {
        node: true,
        es2022: true,
      },
    },
    {
      files: ['**/__tests__/**/*.jsx', '*.{spec,test}.jsx'],
      env: {
        jest: true,
        'jest/globals': true,
      },
    },
  ],
};
