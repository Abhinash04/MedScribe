const preset = require('@react-native/jest-preset');

module.exports = {
  // React Native 0.86 moved its Jest preset into a separate, optional peer package.
  // Without it, `__DEV__` is undefined and anything importing react-native throws —
  // which is why the App render test could not run. The preset supplies the RN
  // environment, the module mocks and the globals Metro would otherwise inject.
  preset: '@react-native/jest-preset',

  // Mocks for this app's own TurboModules and for op-sqlite. None of them exist
  // outside a real device build, and the preset only knows about React Native's.
  setupFiles: ['<rootDir>/jest.setup.js'],

  // Chains React Native's resolver with react-native-worklets'. See jest.resolver.js.
  resolver: '<rootDir>/jest.resolver.js',

  // The preset transforms js/ts/tsx but not jsx, and every screen in this app is a
  // .jsx file. Spread rather than replace so the asset transformer survives.
  transform: {
    ...preset.transform,
    '^.+\\.jsx$': 'babel-jest',
  },

  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-community|react-native-.*|@op-engineering)/)',
  ],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],

  // The bespoke scripts/test-*.mjs suites are driven by scripts/run-all.mjs, not by
  // Jest. Picking them up here would run them twice and misreport their results.
  testPathIgnorePatterns: ['/node_modules/', '/scripts/'],
};
