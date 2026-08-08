module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: [
    'scripts/**/*.mjs',
  ],
  overrides: [
    {
      files: ['**/__tests__/**/*.jsx', '*.{spec,test}.jsx'],
      env: {
        jest: true,
        'jest/globals': true,
      },
    },
  ],
};
