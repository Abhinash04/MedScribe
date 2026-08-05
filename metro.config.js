const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

/**
 * Gradle output directories, kept out of Metro's file map.
 *
 * Metro watches everything under the project root, which includes eight
 * `node_modules/<pkg>/android/build` trees as well as the app's own `build`
 * and `.cxx` folders — all rewritten by Gradle on every build. A build running
 * alongside Metro therefore deletes directories mid-crawl, and on Windows,
 * where there is no watchman and Metro falls back to raw `fs.watch`, that
 * surfaces as an uncaught ENOENT that kills the bundler:
 *
 *   Error: ENOENT: no such file or directory, watch
 *     '…/op-sqlite/android/build/…/prefab/modules/op-sqlite/libs/android.armeabi-v7a'
 *
 * `--active-arch-only` is enough to trigger it: building for one ABI removes
 * the others while they are being walked.
 *
 * Nothing under these paths is ever imported by JavaScript — they hold .so, .a
 * and prefab metadata — so excluding them cannot affect module resolution, and
 * it shortens the initial crawl. The character class covers both separators
 * because Metro tests absolute paths, which are backslash-separated on Windows.
 */
const GRADLE_OUTPUT = /[\\/]android[\\/](?:build|app[\\/](?:build|\.cxx))[\\/]/;

const config = {
  resolver: {
    blockList: GRADLE_OUTPUT,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
