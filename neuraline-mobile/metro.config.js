const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Force Metro to resolve compiled JS instead of TypeScript source.
// Some packages (e.g. @tanstack/query-core) set "react-native": "src/index.ts"
// in package.json, which makes Metro try to transpile TS source with private
// class methods that the default Babel config can't handle.
// By clearing the "react-native" resolver field, Metro falls back to the
// "module" / "main" fields which point to pre-compiled JS.
config.resolver.resolverMainFields = ['module', 'main'];

// Limit workers for machines with limited RAM (8GB).
// Default scales with CPU cores which can cause OOM and extreme slowdowns.
config.maxWorkers = 2;

// Increase cache size to reduce re-bundling
config.transformer.cacheStores = undefined;

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
