const ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

function decodeEntities(value: string) {
  return value.replace(/&(amp|apos|gt|lt|nbsp|quot|#\d+|#x[\da-f]+);/gi, (entity, name: string) => {
    const code = name.toLowerCase();
    if (!code.startsWith('#')) return ENTITIES[code];
    const point = code.startsWith('#x') ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });
}

function decodeTag(value: string) {
  return /["']/.test(value)
    ? value.replace(/^&lt;/i, '<').replace(/&gt;$/i, '>')
    : decodeEntities(value);
}

export function readNewsInlineImage(value: string | null) {
  const source = value?.trim() ?? '';
  const tag = /^&lt;img\s/i.test(source) ? decodeTag(source) : source;
  const image = /^<img\s+((?:[^"'<>]|"[^"]*"|'[^']*')*)>$/i.exec(tag);
  if (!image) return null;

  const attributes = new Map<string, string>();
  for (const [, name, quoted, singleQuoted] of image[1].matchAll(
    /(?:^|\s)([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  )) {
    attributes.set(name.toLowerCase(), decodeEntities(quoted ?? singleQuoted));
  }

  const src = attributes.get('src');
  // Match only HTTPS publisher CDNs, with no user info or custom port.
  if (!src || !/^https:\/\/(?:[\w-]+\.)*(?:cafefcdn\.com|vnecdn\.net)(?:\/|$)/i.test(src)) {
    return null;
  }
  return { src, alt: attributes.get('alt') || 'Ảnh trong bài viết' };
}

const INLINE_STYLES: Record<string, string> = {
  b: 'font-bold',
  strong: 'font-bold',
  i: 'italic',
  em: 'italic',
  u: 'underline',
  s: 'line-through',
  strike: 'line-through',
};

function spanStyles(attributes: string) {
  const css = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attributes);
  const style = css?.[1] ?? css?.[2] ?? '';
  return [
    /font-weight\s*:\s*(?:bold|bolder|[6-9]00)\b/i.test(style) && 'font-bold',
    /font-style\s*:\s*(?:italic|oblique)\b/i.test(style) && 'italic',
    /text-decoration(?:-line)?\s*:[^;]*\bunderline\b/i.test(style) && 'underline',
    /text-decoration(?:-line)?\s*:[^;]*\bline-through\b/i.test(style) && 'line-through',
  ]
    .filter(Boolean)
    .join(' ');
}

export function newsTextParts(value?: string | null) {
  const source = (value ?? '').replace(
    /&lt;\/?(?:span|br|img)(?=\s|\/|&gt;)(?:(?!&lt;|&gt;)[^<>])*&gt;/gi,
    decodeTag
  );
  const parts: { text: string; style: string }[] = [];
  const active: { tag: string; style: string }[] = [];
  const append = (text: string) => {
    if (text)
      parts.push({ text: decodeEntities(text), style: active.map((item) => item.style).join(' ') });
  };
  let cursor = 0;
  for (const match of source.matchAll(
    /<(\/?)([a-z][a-z\d]*)(?=\s|\/?>)((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  )) {
    const [token, close, name, attributes] = match;
    const tag = name.toLowerCase();
    append(source.slice(cursor, match.index));
    cursor = match.index + token.length;
    if (tag === 'br') append('\n');
    else if (close) {
      const index = active.map((item) => item.tag).lastIndexOf(tag);
      if (index !== -1) active.splice(index, 1);
    } else if (tag === 'span' || Object.prototype.hasOwnProperty.call(INLINE_STYLES, tag)) {
      active.push({ tag, style: tag === 'span' ? spanStyles(attributes) : INLINE_STYLES[tag] });
    }
  }
  append(source.slice(cursor));
  return parts;
}

export function newsPlainText(value?: string | null) {
  return newsTextParts(value)
    .map((part) => part.text)
    .join('')
    .trim();
}
