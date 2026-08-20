const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Include the shared package directory so Metro can resolve @neuraline/shared
// which lives outside the mobile project root as a file: dependency.
config.watchFolders = [path.resolve(__dirname, '..', 'shared')];

// Allow Metro to resolve dependencies (like @babel/runtime) from the mobile
// project's node_modules when bundling files from the shared package.
// Without this, Metro only looks in shared/node_modules and fails to find
// @babel/runtime/helpers/interopRequireDefault that Babel injects.
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '..', 'shared', 'node_modules'),
];

// Keep the default resolver fields including 'react-native'.
// Native modules like react-native-safe-area-context use the 'react-native'
// field to point to TypeScript source that contains codegen type annotations.
// The @react-native/babel-plugin-codegen needs these types to generate
// component configs. Stripping 'react-native' (as we tried previously)
// forces compiled JS which has types stripped and breaks codegen.
// The @tanstack/query-core TS-source issue is now handled by the
// @babel/plugin-transform-private-methods plugin in babel.config.js.
config.resolver.resolverMainFields = ['react-native', 'module', 'main'];

// Polyfill Node.js core modules that some dependencies (e.g.
// react-native-quick_crypto -> readable-stream) reference.
// Without this, Metro fails with "Unable to resolve module stream".
config.resolver.extraNodeModules = {
  stream: path.resolve(__dirname, 'node_modules/stream-browserify'),
};

// Limit workers for machines with limited RAM (8GB).
// Default scales with CPU cores which can cause OOM and extreme slowdowns.
config.maxWorkers = 2;

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
