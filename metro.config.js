const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable package exports resolution for ESM packages like @stomp/stompjs
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
