/* global __dirname */
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { buildSync } = require('esbuild');

module.exports = function buildChatDocumentViewer() {
  const assets = resolve(__dirname, '../assets');
  const output = resolve(assets, 'generated-chat-document-preview.html');
  const {
    outputFiles: [{ text }],
  } = buildSync({
    entryPoints: [resolve(__dirname, 'chat-document-renderer.mjs')],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
  });
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src about:; img-src data:; font-src data:; base-uri 'none'; form-action 'none'">
<style>body{margin:0;background:#eef2f6;color:#182230;font:14px system-ui,sans-serif}button{min-height:44px;border:1px solid #aab8c6;border-radius:8px;background:#fff;color:inherit;padding:0 12px}button:disabled{opacity:.45}nav{position:sticky;top:0;background:#eef2f6;padding:4px;text-align:center}span{display:inline-block;min-width:64px}canvas{display:block;margin:8px auto}iframe{position:fixed;inset:0;width:100%;height:100%;border:0;background:#fff}p{padding:16px;text-align:center}[hidden]{display:none!important}</style>
</head><body><p id="status" role="status">Đang tải bản xem trước…</p>
<nav id="pages" aria-label="Trang PDF" hidden><button id="back">Trang trước</button><span id="counter" aria-live="polite"></span><button id="next">Trang sau</button></nav>
<canvas aria-label="Trang PDF" hidden></canvas><script type="module">${text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  mkdirSync(assets, { recursive: true });
  if (readFileSync(output, { encoding: 'utf8', flag: 'a+' }) !== html) writeFileSync(output, html);
};

if (require.main === module) module.exports();
