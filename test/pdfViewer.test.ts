import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bytesToBase64, isPdfUrl, pdfViewerHtml } from '../src/lib/pdfViewer.ts';

describe('isPdfUrl', () => {
  it('spots a House Clerk disclosure by its path', () => {
    assert.equal(isPdfUrl('https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20031234.pdf'), true);
    assert.equal(isPdfUrl('https://example.com/FILE.PDF?x=1'), true);
  });

  it('leaves web pages and junk alone', () => {
    assert.equal(isPdfUrl('https://www.federalregister.gov/documents/2026/01/01/x'), false);
    assert.equal(isPdfUrl('https://example.com/?file=a.pdf'), false);
    assert.equal(isPdfUrl('not a url'), false);
  });
});

describe('bytesToBase64', () => {
  it('matches Node’s own encoding, across chunk boundaries', () => {
    const bytes = new Uint8Array(70_000).map((_, i) => (i * 31) % 256);
    assert.equal(bytesToBase64(bytes), Buffer.from(bytes).toString('base64'));
  });
});

describe('pdfViewerHtml', () => {
  it('carries the document and loads pdf.js relative to its base', () => {
    const html = pdfViewerHtml('JVBERi0=');
    assert.match(html, /atob\('JVBERi0='\)/);
    assert.match(html, /import\('\.\/pdf\.min\.mjs'\)/);
    assert.match(html, /pdf\.worker\.min\.mjs/);
  });

  it('refuses anything that is not base64, rather than writing it into a script', () => {
    assert.throws(() => pdfViewerHtml("');alert(1);//"));
  });
});
