const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration for neuraline-mobile.
 * Allows importing from the sibling `shared/` package.
 */
const defaultConfig = getDefaultConfig(__dirname);

const sharedDir = path.resolve(__dirname, '..', 'shared');

const config = {
  watchFolders: [__dirname, sharedDir],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);
