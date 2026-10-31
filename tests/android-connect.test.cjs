const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

test('Android setup forwards localhost services to authorized devices and skips remote services', () => {
  const calls = [];
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../scripts/android-connect.cjs'), 'utf8'),
    {
      __dirname: path.join(__dirname, '../scripts'),
      process: { platform: 'win32', env: { LOCALAPPDATA: 'C:/Users/Test/AppData/Local' } },
      URL,
      Set,
      console: { log() {}, warn() {} },
      require(name) {
        if (name === 'node:path') return path;
        if (name === 'node:fs') return { existsSync: () => true };
        if (name === '@expo/env')
          return {
            parseProjectEnv: () => ({
              env: {
                EXPO_PUBLIC_KEYCLOAK_BASE_URL: 'http://localhost:9100',
                EXPO_PUBLIC_GATEWAY_BASE_URL: 'https://api.example.com',
              },
            }),
          };
        assert.equal(name, 'node:child_process');
        return {
          spawnSync: (command, args) => {
            calls.push(args);
            return {
              status: 0,
              stdout:
                args[0] === 'devices'
                  ? 'List of devices attached\nemulator-5554\tdevice\nphone\tunauthorized\n'
                  : '',
            };
          },
        };
      },
    }
  );
  assert.equal(calls.length, 3);
  assert.deepEqual(Array.from(calls[1]), [
    '-s',
    'emulator-5554',
    'reverse',
    'tcp:4000',
    'tcp:4000',
  ]);
  assert.deepEqual(Array.from(calls[2]), [
    '-s',
    'emulator-5554',
    'reverse',
    'tcp:9100',
    'tcp:9100',
  ]);
});
