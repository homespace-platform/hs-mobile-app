const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/lib/chat-threads.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
).outputText;
const module_ = { exports: {} };
vm.runInNewContext(source, { exports: module_.exports, Date, Map, Number, Array });
const { chatMessageCaption, dedupeConversationsByParticipant, shouldAttachPendingListing } = module_.exports;

test('legacy attachment text is hidden while captions and standalone text stay visible', () => {
  const file = { fileName: 'proof.pdf' };
  const caption = (content, attachments) => chatMessageCaption({ content, attachments });
  assert.equal(caption('Đã gửi proof.pdf', [file]), '');
  assert.equal(caption('Đã gửi tệp đính kèm', [file]), '');
  assert.equal(caption('Đã gửi 2 tệp đính kèm', [file, file]), '');
  assert.equal(caption('', [file]), '');
  assert.equal(caption('Đã gửi proof.pdf để bạn xem', [file]), 'Đã gửi proof.pdf để bạn xem');
  assert.equal(caption('Đã gửi proof.pdf', []), 'Đã gửi proof.pdf');
});

const conv = (id, participantId, lastMessageAt, unreadCount = 0) => ({
  id,
  participantId,
  lastMessageAt,
  unreadCount,
});

test('dedupe keeps the most recent conversation per participant and sums unread', () => {
  const result = dedupeConversationsByParticipant([
    conv('a', 'p1', '2026-01-02T00:00:00Z', 1),
    conv('b', 'p2', '2026-01-01T00:00:00Z', 0),
    conv('c', 'p1', '2026-01-03T00:00:00Z', 2),
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.map((item) => [item.id, item.unreadCount]))), [
    ['c', 3],
    ['b', 0],
  ]);
});

test('dedupe keeps the preferred id when it belongs to the group and leaves unique rows alone', () => {
  const items = [conv('a', 'p1', '2026-01-02T00:00:00Z'), conv('c', 'p1', '2026-01-03T00:00:00Z')];
  assert.equal(dedupeConversationsByParticipant(items, 'a')[0].id, 'a');
  assert.equal(dedupeConversationsByParticipant(items, 'zzz')[0].id, 'c');
  const single = [conv('x', 'p9')];
  assert.equal(dedupeConversationsByParticipant(single)[0], single[0]);
});

test('pending listing attaches unless my latest listing card is the same listing', () => {
  const l1 = { id: 'L1' };
  const l2 = { id: 'L2' };
  const msg = (senderId, listing) => ({ senderId, listing });
  assert.equal(shouldAttachPendingListing(null, [], 'me'), false);
  assert.equal(shouldAttachPendingListing(l1, [], 'me'), true);
  assert.equal(shouldAttachPendingListing(l1, [msg('me', l1), msg('me')], 'me'), false);
  assert.equal(shouldAttachPendingListing(l1, [msg('me', l1), msg('me', l2)], 'me'), true);
  assert.equal(shouldAttachPendingListing(l1, [msg('other', l1)], 'me'), true);
});
