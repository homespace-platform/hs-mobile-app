const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/services/chatMediaApi.ts'), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }
).outputText;
const plain = (value) => JSON.parse(JSON.stringify(value));

test('chat checks the local byte count, completes the PUT, and resolves each ID in its own store', async () => {
  const calls = [];
  const asset = {
    storageId: 'chat_new',
    fileName: 'test.PDF',
    contentType: 'application/pdf',
    sizeBytes: 42,
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require(name) {
      return {
        'react-native': { Platform: { OS: 'android' } },
        'expo-file-system/legacy': {
          getInfoAsync: async () => ({ exists: true, size: 42 }),
          uploadAsync: async (...args) => {
            calls.push(['put', ...args]);
            return { status: 200 };
          },
        },
        '@/lib/axios-client': {
          async post(...args) {
            calls.push(['post', ...args]);
            return {
              data: {
                result: args[0].endsWith('/uploads')
                  ? { storageId: asset.storageId, uploadUrl: 'upload-url' }
                  : asset,
              },
            };
          },
          async get(...args) {
            calls.push(['get', ...args]);
            return { data: { result: { url: 'chat-url' } } };
          },
        },
        '@/services/storageApi': { getStorageViewUrl: async (id) => `legacy-${id}` },
        '@/services/rental/cache': {
          fileSessionGuard: () => () => {},
          withFileLease: (_uris, run) => run(),
        },
      }[name];
    },
  });

  for (const [fileName, format] of [
    ['test.PDF', 'pdf'],
    ['test.docx', 'docx'],
    ['test.doc', 'doc'],
    ['test.xlsx', undefined],
  ]) {
    assert.equal(
      exports.chatDocumentFormat({ fileName, contentType: 'application/octet-stream' }),
      format
    );
  }

  const local = await exports.prepareChatAttachment({
    uri: 'file://test',
    fileName: asset.fileName,
    contentType: '',
    sizeBytes: 40,
  });
  assert.equal(local.sizeBytes, 42);
  for (const [fileName, suppliedType, contentType, icon] of [
    ['anh.jfif', 'image/pjpeg', 'image/jpeg', 'image-outline'],
    [
      'bao-gia.xlsx',
      'application/octet-stream',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'grid-outline',
    ],
    ['gioi-thieu.ppt', '', 'application/vnd.ms-powerpoint', 'easel-outline'],
  ]) {
    const prepared = await exports.prepareChatAttachment({
      ...local,
      fileName,
      contentType: suppliedType,
    });
    assert.equal(prepared.contentType, contentType);
    assert.equal(exports.chatAttachmentIcon(prepared), icon);
  }
  await assert.rejects(
    exports.prepareChatAttachment({ ...local, contentType: 'image/heic' }),
    /JPG/
  );
  assert.deepEqual(await exports.uploadChatAttachment('a', local), asset);
  assert.equal(await exports.getChatAttachmentViewUrl('a', 'chat_new'), 'chat-url');
  assert.equal(await exports.getChatAttachmentViewUrl('a', 'old'), 'legacy-old');
  const media = '/api/v1/chat/conversations/a/media';
  assert.deepEqual(plain(calls), [
    [
      'post',
      `${media}/uploads`,
      { fileName: asset.fileName, contentType: 'application/pdf', size: 42 },
    ],
    [
      'put',
      'upload-url',
      'file://test',
      { httpMethod: 'PUT', headers: { 'Content-Type': 'application/pdf' } },
    ],
    ['post', `${media}/chat_new/complete`, {}],
    ['get', `${media}/chat_new/view-url`],
  ]);
});
