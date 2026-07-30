module.exports = {
  root: true,
  extends: '@react-native',
  // Node-only test harness — not React Native app code, and the RN parser
  // preset cannot parse plain ESM .mjs. Verified by `npm run test:extraction`.
  ignorePatterns: ['scripts/**/*.mjs'],
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
