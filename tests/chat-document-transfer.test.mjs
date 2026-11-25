import assert from 'node:assert/strict';
import { test } from 'node:test';
import { receiveDocumentChunks } from '../scripts/chat-document-transfer.mjs';

test('duplicate Android bridge messages assemble the PDF once in byte order', () => {
  const requests = [];
  const documents = [];
  const receive = receiveDocumentChunks(
    (offset) => requests.push(offset),
    (bytes, format) => documents.push([new TextDecoder().decode(bytes), format])
  );
  const start = { type: 'begin', size: 8, format: 'pdf' };
  const first = { type: 'chunk', offset: 0, data: btoa('%PDF') };
  const second = { type: 'chunk', offset: 4, data: btoa('-1.7') };
  for (const message of [start, start, first, first, second, second, start]) receive(message);
  assert.deepEqual(requests, [0, 4]);
  assert.deepEqual(documents, [['%PDF-1.7', 'pdf']]);
});

test('document transfer rejects missing bytes and chunks larger than the remaining file', () => {
  const receive = receiveDocumentChunks(
    () => {},
    () => assert.fail('Invalid data was rendered')
  );
  receive({ type: 'begin', size: 4, format: 'pdf' });
  assert.throws(() => receive({ type: 'chunk', offset: 1, data: btoa('abc') }), /offset/);
  assert.throws(() => receive({ type: 'chunk', offset: 0, data: btoa('abcde') }), /size/);
});
