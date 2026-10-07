// const { getDefaultConfig } = require('expo/metro-config');

// /**
//  * Metro configuration
//  * https://reactnative.dev/docs/metro
//  *
//  * @type {import('metro-config').MetroConfig}
//  */
// const config = getDefaultConfig(__dirname);

// module.exports = config;

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Prioritize CommonJS/React Native builds over ESM to avoid import.meta errors in Hermes/Metro
config.resolver.unstable_conditionNames = [
  'browser',
  'require',
  'react-native',
];

module.exports = withNativeWind(config, {
  input: "./global.css",
});