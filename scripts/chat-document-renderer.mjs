import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
import { renderAsync } from 'docx-preview';
import { parseDocument } from '@office-open/doc';
import { generateDocument } from '@office-open/docx';
import { receiveDocumentChunks } from './chat-document-transfer.mjs';

const status = document.querySelector('#status');
const pages = document.querySelector('#pages');
const canvas = document.querySelector('canvas');
const back = document.querySelector('#back');
const next = document.querySelector('#next');
const counter = document.querySelector('#counter');
const send = (event) => {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(event);
  else window.parent.postMessage(event, '*');
};

function fail() {
  status.hidden = false;
  status.textContent = 'Không thể mở bản xem trước.';
  send('failed');
}

async function showPdf(data) {
  // File-backed Android WebViews cannot reliably import a blob worker module.
  globalThis.pdfjsWorker = { WorkerMessageHandler };
  const pdf = await getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
  let current = 1;

  async function draw(pageNumber) {
    back.disabled = true;
    next.disabled = true;
    const page = await pdf.getPage(pageNumber);
    const natural = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: Math.min(960, document.documentElement.clientWidth - 16) / natural.width,
    });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(viewport.width * pixelRatio);
    canvas.height = Math.ceil(viewport.height * pixelRatio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    canvas.hidden = false;
    await page.render({ canvas, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] })
      .promise;
    current = pageNumber;
    counter.textContent = `${current} / ${pdf.numPages}`;
    back.disabled = current === 1;
    next.disabled = current === pdf.numPages;
    window.scrollTo(0, 0);
  }

  back.onclick = () => void draw(current - 1).catch(fail);
  next.onclick = () => void draw(current + 1).catch(fail);
  await draw(1);
  pages.hidden = pdf.numPages < 2;
}

async function showWord(data, format) {
  const input = format === 'doc' ? await generateDocument(parseDocument(data)) : data;
  const frame = document.implementation.createHTMLDocument();
  const styles = frame.createElement('div');
  await renderAsync(input, frame.body, styles, {
    inWrapper: false,
    ignoreWidth: true,
    ignoreHeight: true,
    useBase64URL: true,
    renderAltChunks: false,
  });
  const policy = frame.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content =
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";
  const viewport = frame.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width,initial-scale=1';
  frame.head.prepend(policy, viewport);
  frame.head.append(...styles.childNodes);
  frame.body.querySelectorAll('a[href]').forEach((link) => link.removeAttribute('href'));
  const preview = document.createElement('iframe');
  preview.setAttribute('sandbox', '');
  preview.title = 'Tài liệu Word';
  preview.srcdoc = `<!doctype html>${frame.documentElement.outerHTML}`;
  document.body.appendChild(preview);
}

const receiveChunk = receiveDocumentChunks(
  (offset) => send(`read:${offset}`),
  (data, format) => {
    void (format === 'pdf' ? showPdf(data) : showWord(data, format))
      .then(() => {
        status.hidden = true;
        send('rendered');
      })
      .catch(fail);
  }
);

function receive(event) {
  if (!window.ReactNativeWebView && event.source !== window.parent) return;
  if (typeof event.data !== 'string') return;
  let message;
  try {
    message = JSON.parse(event.data);
  } catch {
    return;
  }
  try {
    receiveChunk(message);
  } catch {
    fail();
  }
}

// Android dispatches on document while WKWebView and the browser dispatch on window.
document.addEventListener('message', (event) => {
  if (window.ReactNativeWebView) receive(event);
});
window.addEventListener('message', (event) => {
  if (event.target === window) receive(event);
});
send('ready');
