const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const GRADLE_OUTPUT = /[\\/]android[\\/](?:build|app[\\/](?:build|\.cxx))[\\/]/;

const defaultConfig = getDefaultConfig(__dirname);

module.exports = mergeConfig(defaultConfig, {
  resolver: {
    blockList: [].concat(defaultConfig.resolver.blockList ?? [], GRADLE_OUTPUT),
  },
});
