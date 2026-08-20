module.exports = {
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
  plugins: [
    ['@babel/plugin-transform-private-methods', { loose: true }],
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './',
          'tailwind.config': './tailwind.config.js',
        },
      },
    ],
  ],
};
