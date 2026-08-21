const presetResolver = require('@react-native/jest-preset/jest/resolver.js');
const workletsResolver = require('react-native-worklets/jest/resolver.js');

module.exports = (request, options) => {
  const isWorklets =
    request.includes('react-native-worklets') ||
    (options.basedir && options.basedir.includes('react-native-worklets'));

  if (isWorklets) {
    return workletsResolver(request, options);
  }

  return presetResolver(request, options);
};
