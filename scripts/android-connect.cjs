const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { parseProjectEnv } = require('@expo/env');

const projectRoot = path.resolve(__dirname, '..');
const env = {
  ...parseProjectEnv(projectRoot, { mode: 'development', silent: true }).env,
  ...process.env,
};
const sdk =
  env.ANDROID_HOME ||
  env.ANDROID_SDK_ROOT ||
  (process.platform === 'win32' && env.LOCALAPPDATA
    ? path.join(env.LOCALAPPDATA, 'Android', 'Sdk')
    : null);
const sdkAdb =
  sdk && path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const adb = sdkAdb && existsSync(sdkAdb) ? sdkAdb : 'adb';
const ports = new Set(['4000']);
for (const endpoint of [
  env.EXPO_PUBLIC_KEYCLOAK_BASE_URL || 'http://localhost:9000',
  env.EXPO_PUBLIC_GATEWAY_BASE_URL || 'http://localhost:8080',
]) {
  const url = new URL(endpoint);
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    ports.add(url.port || (url.protocol === 'https:' ? '443' : '80'));
  }
}
const devices = spawnSync(adb, ['devices'], { encoding: 'utf8', timeout: 10000 });
if (devices.error || devices.status !== 0) {
  console.warn('[Android] Cannot run adb. Check Android SDK / ANDROID_HOME.');
} else {
  const serials = devices.stdout.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^(\S+)\s+device$/);
    return match ? [match[1]] : [];
  });
  if (!serials.length)
    console.warn('[Android] Start the emulator, then run npm run android:connect.');
  for (const serial of serials) {
    for (const port of ports) {
      const result = spawnSync(adb, ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`], {
        encoding: 'utf8',
        timeout: 10000,
      });
      if (result.error || result.status !== 0) {
        console.warn(
          `[Android] Cannot forward port ${port} for ${serial}. Run npm run android:connect again.`
        );
      } else {
        console.log(`[Android] ${serial}: localhost:${port} connected`);
      }
    }
  }
}
