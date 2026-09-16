module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    // react-native-worklets/plugin must stay last in the plugin list.
    plugins: ['react-native-worklets/plugin'],
  };
};
