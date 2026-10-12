/**
 * A PDF viewer page for the in-app browser, on Android.
 *
 * iOS's web view draws a PDF itself. Android's does not: pointed at a House
 * Clerk disclosure it shows a blank page, or hands the file to a download. So
 * on Android the app fetches the PDF's bytes itself — a native request, with no
 * CORS to get in the way — and opens this page instead, which draws them with
 * pdf.js.
 *
 * The page is loaded with pdf.js's own CDN folder as its base URL, which makes
 * the worker script same-origin: browsers refuse a worker from anywhere else,
 * and pdf.js would fall back to parsing on the page's one thread. The document
 * travels inside the page as base64, so the CDN is only ever asked for pdf.js.
 *
 * Pure strings, no React Native, so it is tested directly.
 */

/** Pinned to the `pdfjs-dist` version in `package.json`, served as-is by jsDelivr. */
export const PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/';

/** True when a URL names a PDF file by its path. */
export function isPdfUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

/** Bytes to base64, in chunks so a large file never builds one huge argument list. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * The viewer page: every page of the document, drawn to fit the width, on a
 * plain grey ground like a desktop PDF reader. Pinch to zoom is the web view's
 * own. A failure posts `pdf-error` back, so the window can offer its retry.
 */
export function pdfViewerHtml(base64: string): string {
  // base64 has no quote, backslash or angle bracket, so it sits safely inside
  // a JS string in a script element. Checked rather than assumed.
  if (!/^[A-Za-z0-9+/=]*$/.test(base64)) throw new Error('Not base64');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes">
<style>
  html, body { margin: 0; padding: 0; background: #E6E6EA; }
  #pages { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0 24px; }
  canvas { display: block; width: calc(100vw - 16px); height: auto; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
</style>
</head>
<body>
<div id="pages"></div>
<script type="module">
  const post = (m) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(m);
  try {
    const pdfjs = await import('./pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';
    const raw = atob('${base64}');
    const data = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);
    const doc = await pdfjs.getDocument({ data }).promise;
    const holder = document.getElementById('pages');
    const cssWidth = window.innerWidth - 16;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.setAttribute('aria-label', 'Page ' + n + ' of ' + doc.numPages);
      holder.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }
    post('pdf-ready');
  } catch (e) {
    post('pdf-error');
  }
</script>
</body>
</html>`;
}
