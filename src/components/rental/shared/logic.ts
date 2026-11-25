// Pure rules behind the shared rental UI (no React Native imports): tests/rental-ui.test.cjs.
import { toneClasses, type Tone } from '@/lib/rental/rental-labels';
import { parsePastedVnd, formatVndInput, canonicalVnd } from '@/lib/rental/vnd-input';
import type { LocalFile } from '@/services/storageApi';

/** RN does not inherit text colour from a View, so a tone is split into its box and text classes. */
export function toneParts(tone: Tone) {
  const classes = toneClasses[tone].split(' ');
  return {
    box: classes.filter((name) => !name.startsWith('text-')).join(' '),
    text: classes.filter((name) => name.startsWith('text-')).join(' '),
  };
}

// --- askReason (web components/common/ActionDialog.tsx) ---

export function reasonState(text: string, minLength = 10, maxLength = 500) {
  const trimmed = text.trim();
  const missing = Math.max(0, minLength - trimmed.length);
  return {
    trimmed,
    valid: missing === 0,
    hint: missing > 0 ? `Cần nhập thêm ${missing} ký tự` : 'Đã đủ nội dung',
    counter: `${trimmed.length}/${maxLength}`,
  };
}

// --- VND money (web components/ui/vnd-money-input.tsx) ---

const VND_TYPED_ERROR = 'Chỉ nhập số tiền VNĐ nguyên, không dùng số âm hoặc ký hiệu e.';
const VND_PASTE_ERROR = 'Dán số tiền VNĐ nguyên; không nhập số âm hoặc phần thập phân.';

export type TextSelection = { start: number; end: number };

type VndEdit = { value: string; caret: number } | { error: string };

function editAtSelection(
  display: string,
  next: string,
  selection: TextSelection,
  expectedCaret?: number
) {
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > display.length)
    return;
  const ranges =
    start === end && next.length < display.length
      ? [
          [start - 1, start],
          [start, start + 1],
        ]
      : [[start, end]];
  for (const [from, to] of ranges) {
    if (from < 0 || to > display.length) continue;
    const head = display.slice(0, from);
    const tail = display.slice(to);
    if (next.length < head.length + tail.length || !next.startsWith(head) || !next.endsWith(tail))
      continue;
    const inserted = next.slice(from, next.length - tail.length);
    if (expectedCaret !== undefined && from + inserted.length !== expectedCaret) continue;
    let before = head.replace(/\D/g, '');
    let after = tail.replace(/\D/g, '');
    if (inserted === '' && start === end && display[from] === '.') {
      if (from < start) before = before.slice(0, -1);
      else after = after.slice(1);
    }
    const pasted = inserted ? parsePastedVnd(inserted) : '';
    if (pasted === null) {
      const error =
        inserted.length === 1 && !/^[.,\s]$/.test(inserted) ? VND_TYPED_ERROR : VND_PASTE_ERROR;
      return { error };
    }
    const digits = before + pasted + after;
    const value = digits.replace(/^0+(?=\d)/, '');
    const digitsBefore = Math.max(
      0,
      before.length + pasted.length - (digits.length - value.length)
    );
    const formatted = formatVndInput(value);
    let caret = 0;
    for (let count = 0; caret < formatted.length && count < digitsBefore; caret++) {
      if (/\d/.test(formatted[caret])) count++;
    }
    return { value, caret };
  }
}

/** The native replacement must fit the pre-edit selection. A post-edit caret can corroborate it. */
export function editVndText(
  display: string,
  next: string,
  selections: readonly TextSelection[] = [],
  after?: TextSelection,
  preEditConfirmed = false
): VndEdit {
  const refused = { error: VND_PASTE_ERROR };
  if (after && after.start !== after.end) return refused;
  const latest =
    selections[selections.length - 1] ?? (display === '' ? { start: 0, end: 0 } : undefined);
  if (!latest) return refused;
  // At the dot, an untagged caret can be either before Delete or after Backspace.
  if (
    !preEditConfirmed &&
    latest.start === latest.end &&
    display[latest.start] === '.' &&
    next === display.slice(0, latest.start) + display.slice(latest.start + 1)
  )
    return refused;

  const safeEdit = (selection: TextSelection, caret?: number) => {
    const edit = editAtSelection(display, next, selection, caret);
    // Native can report the same text without an edit (including a stale selection event).
    if (next === display && edit && 'value' in edit && edit.value !== display.replaceAll('.', ''))
      return refused;
    return edit;
  };
  const edit = safeEdit(latest, after?.start);
  if (after) return edit ?? refused;

  // Android's untagged caret may be the result of an edit at the previous selection.
  const earlier = selections[selections.length - 2];
  if (earlier && latest.start === latest.end) {
    const previousEdit = safeEdit(earlier, latest.start);
    if (previousEdit && edit) {
      if ('value' in previousEdit && 'value' in edit && previousEdit.value === edit.value)
        return edit;
      return refused;
    }
    if (previousEdit) return previousEdit;
  }
  return edit ?? refused;
}

export function vndRangeError(value: unknown, min = 0, max = 1_000_000_000) {
  const raw = canonicalVnd(value);
  const numeric = Number(raw);
  return raw &&
    (!/^\d+$/.test(raw) || !Number.isSafeInteger(numeric) || numeric < min || numeric > max)
    ? `Nhập số tiền VNĐ nguyên từ ${formatVndInput(min)} đến ${formatVndInput(max)} đ.`
    : '';
}

// --- Decimal input (vi-VN keyboards type ","; web values use ".") ---

/** The "."-form of a text still being typed, or null when the keystroke must be refused. */
export function decimalDraft(text: string, maxDecimals = 3): string | null {
  const value = text.replace(',', '.');
  return new RegExp(`^\\d*(\\.\\d{0,${maxDecimals}})?$`).test(value) ? value : null;
}

/** A finished non-negative decimal, with "," or "."; null when empty or not a number. */
export function parseDecimal(text: string): number | null {
  const value = text.trim().replace(',', '.');
  return /^(\d+(\.\d*)?|\.\d+)$/.test(value) ? Number(value) : null;
}

// --- Date keys "yyyy-MM-dd" (the value of web <input type="date">) ---

const two = (value: number) => String(value).padStart(2, '0');

export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;

/** Local midnight of the key; undefined for anything that is not a real calendar date. */
export function fromDateKey(key: string | null | undefined): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key ?? '');
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toDateKey(date) === key ? date : undefined;
}

export const dateKeyLabel = (key: string) =>
  fromDateKey(key) ? key.split('-').reverse().join('/') : '';

export const isDateKeyInRange = (key: string, min?: string, max?: string) =>
  (!min || key >= min) && (!max || key <= max);

// --- Evidence files ---

export const EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const EVIDENCE_MAX_BYTES = 15 * 1024 * 1024;

const TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const extension = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? '';

function uriName(uri: string) {
  const last = uri.split(/[?#]/)[0].split('/').pop() ?? '';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/**
 * A picker result as the LocalFile the rental services upload. The image picker re-encodes HEIC to
 * JPEG (quality < 1) but Android still reports the source MIME and name, so the output file's
 * extension wins. A HEIC that was not converted stays HEIC and fails the type check.
 */
export function normalizeFile(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}): LocalFile {
  let fileName = asset.fileName?.trim() || uriName(asset.uri) || 'tep';
  let contentType = asset.mimeType?.trim().toLowerCase() ?? '';
  if (contentType === 'image/jpg') contentType = 'image/jpeg';
  if (!contentType || contentType === 'application/octet-stream')
    contentType =
      TYPE_BY_EXTENSION[extension(fileName)] ??
      TYPE_BY_EXTENSION[extension(uriName(asset.uri))] ??
      'application/octet-stream';
  if (/^image\/hei[cf]/.test(contentType) && /^jpe?g$/.test(extension(uriName(asset.uri))))
    contentType = 'image/jpeg';
  if (contentType === 'image/jpeg' && !/^jpe?g$/.test(extension(fileName)))
    fileName = `${fileName.replace(/\.[a-z0-9]+$/i, '')}.jpg`;
  return { uri: asset.uri, fileName, contentType, sizeBytes: asset.sizeBytes ?? 0 };
}

/** The web's wording differs per screen: one string for every failure, or one per rule. */
export type FileMessages = string | { type: string; size: string; count: string };

export interface FileRules {
  types: readonly string[];
  maxBytes: number;
  maxCount: number;
  /** The web screens that test the file name rather than the MIME type. */
  namePattern?: RegExp;
}

/** Why the whole picked batch is refused (as on web), or null. `existing` = files already counted. */
export function fileSelectionError(
  files: readonly (Pick<LocalFile, 'contentType' | 'sizeBytes'> & { fileName?: string })[],
  existing: number,
  rules: FileRules,
  messages: FileMessages
): string | null {
  const text = (rule: 'type' | 'size' | 'count') =>
    typeof messages === 'string' ? messages : messages[rule];
  if (files.length + existing > rules.maxCount) return text('count');
  for (const file of files) {
    if (!rules.types.includes(file.contentType)) return text('type');
    if (rules.namePattern && !rules.namePattern.test(file.fileName ?? '')) return text('type');
    if (!(file.sizeBytes > 0 && file.sizeBytes <= rules.maxBytes)) return text('size');
  }
  return null;
}

export const fileSizeLabel = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
