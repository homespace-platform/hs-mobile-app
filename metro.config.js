// Include MetaMask's async modules in the first dev bundle so the tunnel cannot serve mismatched module IDs.
process.env.EXPO_NO_METRO_LAZY ??= '1';

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');
require('./scripts/build-chat-document-viewer.cjs')();

const config = getDefaultConfig(__dirname);
const emptyModule = path.join(__dirname, 'src/lib/empty-module.js');
const nodeOnlyModules = ['crypto', 'http', 'https', 'net', 'tls', 'zlib', 'os', 'dns', 'assert', 'url', 'path', 'fs'];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...Object.fromEntries(nodeOnlyModules.map((name) => [name, emptyModule])),
  stream: require.resolve('readable-stream'),
};
const nativeWebSocket = path.join(__dirname, 'src/lib/metamask-websocket.js');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Metro also resolves the SDK's Node fallback; native already provides WebSocket.
  if (platform !== 'web' && moduleName === 'ws' && /[/\\]@metamask[/\\]/.test(context.originModulePath)) {
    return { type: 'sourceFile', filePath: nativeWebSocket };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
