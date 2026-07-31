module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    // Node-only test harness — not React Native app code, and the RN parser
    // preset cannot parse plain ESM .mjs. Verified by `npm run test:extraction`.
    'scripts/**/*.mjs',
    // Flow TurboModule specs, validated by React Native codegen at build time
    // (see the generated NativePdfExporterSpec.java). hermes-eslint is not
    // installed, so .js falls back to @babel/eslint-parser, whose scope
    // analysis has no visitor keys for the Flow `interface` node and dies with
    // "Cannot read properties of undefined (reading 'forEach')".
    'src/specs/**',
  ],
  overrides: [
    {
      // @react-native's jest override only globs {js,ts,tsx}; this project
      // uses .jsx for JSX files, so test globals need declaring here.
      files: ['**/__tests__/**/*.jsx', '*.{spec,test}.jsx'],
      env: {
        jest: true,
        'jest/globals': true,
      },
    },
  ],
};
