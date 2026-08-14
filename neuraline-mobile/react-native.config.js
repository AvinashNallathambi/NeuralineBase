/**
 * React Native CLI configuration
 */
const androidPlatform = require('@react-native-community/cli-platform-android');

module.exports = {
  platforms: {
    android: {
      npmPackageName: '@react-native-community/cli-platform-android',
      projectConfig: androidPlatform.projectConfig,
      dependencyConfig: androidPlatform.dependencyConfig,
      linkConfig: androidPlatform.linkConfig,
    },
  },
  project: {
    android: {
      packageName: 'com.neuralinemobile',
      sourceDir: 'android',
    },
  },
};
