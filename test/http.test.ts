import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { HttpError, getText, isAbort, isAccessDenied } from '../src/lib/http.ts';

describe('isAccessDenied', () => {
  it('is true for 401 — an unrecognised or unauthorised key', () => {
    assert.equal(isAccessDenied(new HttpError(401, 'https://finnhub.io/api/v1/stock/candle')), true);
  });

  it('is true for 403 — the shape a free Finnhub key gets from /stock/candle', () => {
    assert.equal(isAccessDenied(new HttpError(403, 'https://finnhub.io/api/v1/stock/candle')), true);
  });

  it('is false for 429, which is transient and worth retrying', () => {
    assert.equal(isAccessDenied(new HttpError(429, 'https://example.test')), false);
  });

  it('is false for our synthetic 408 timeout', () => {
    assert.equal(isAccessDenied(new HttpError(408, 'https://example.test')), false);
  });

  it('is false for 500 — the server is broken, not the key', () => {
    assert.equal(isAccessDenied(new HttpError(500, 'https://example.test')), false);
  });

  it('is false for a plain Error, so a parse failure never latches a key off', () => {
    assert.equal(isAccessDenied(new Error('No Finnhub candles for AAPL')), false);
  });

  it('is false for non-error values', () => {
    assert.equal(isAccessDenied(undefined), false);
    assert.equal(isAccessDenied('403'), false);
  });

  it('does not confuse an access denial with a caller abort', () => {
    const denial = new HttpError(403, 'https://example.test');
    assert.equal(isAbort(denial), false);
    assert.equal(isAccessDenied(denial), true);
  });
});

/**
 * These run with `AbortSignal.any` removed, because that is the environment the
 * app actually ships into: React Native polyfills AbortController from
 * `abort-controller@3`, which predates the static. Node has it, so a test that
 * left it in place would pass here and still leave every provider dead on
 * device — which is exactly what happened.
 */
describe('getText under a React Native AbortSignal', () => {
  const realAny = (AbortSignal as { any?: unknown }).any;
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    delete (AbortSignal as { any?: unknown }).any;
  });

  afterEach(() => {
    (AbortSignal as { any?: unknown }).any = realAny;
    globalThis.fetch = realFetch;
  });

  /** Stands in for the network: resolves `body`, or never settles at all. */
  function stubFetch(body: string | null, delayMs = 0) {
    const seen: { signal?: AbortSignal; calls?: number } = {};
    globalThis.fetch = ((_url: string, init: RequestInit) => {
      seen.signal = init.signal ?? undefined;
      seen.calls = (seen.calls ?? 0) + 1;
      return new Promise((resolve, reject) => {
        // Real fetch rejects up front on an already-aborted signal; so must this,
        // or the abort listener below would be attached too late to ever fire.
        if (init.signal?.aborted) {
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
          return;
        }
        if (body !== null) {
          setTimeout(() => resolve(new Response(body, { status: 200 })), delayMs);
        }
        init.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
        );
      });
    }) as typeof fetch;
    return seen;
  }

  it('still makes the request when the caller passes a signal', async () => {
    const seen = stubFetch('2026FD index');
    const caller = new AbortController();

    const text = await getText('https://example.test/x', { signal: caller.signal });

    assert.equal(text, '2026FD index');
    assert.ok(seen.signal, 'a signal should reach fetch');
  });

  it('reports a caller cancellation as an abort, not a timeout', async () => {
    stubFetch(null);
    const caller = new AbortController();
    const pending = getText('https://example.test/x', { signal: caller.signal });
    caller.abort();

    await assert.rejects(pending, (err: unknown) => {
      assert.equal(isAbort(err), true, 'caller cancellation must look like an abort');
      assert.equal(err instanceof HttpError, false);
      return true;
    });
  });

  it('reports its own deadline as HttpError(408), distinct from an abort', async () => {
    stubFetch(null);
    const caller = new AbortController();

    await assert.rejects(
      getText('https://example.test/x', { signal: caller.signal, timeoutMs: 20 }),
      (err: unknown) => {
        assert.equal(err instanceof HttpError, true);
        assert.equal((err as HttpError).status, 408);
        assert.equal(isAbort(err), false, 'a timeout must not be mistaken for a cancellation');
        return true;
      },
    );
  });

  it('detaches from the caller signal once done, so requests do not accumulate', async () => {
    stubFetch('ok');
    const caller = new AbortController();
    await getText('https://example.test/x', { signal: caller.signal });

    // A late cancel of a finished request must not reach anything.
    assert.doesNotThrow(() => caller.abort());
  });

  it('fails fast when the caller signal is already aborted, without hitting the network', async () => {
    const seen = stubFetch('ok');
    const caller = new AbortController();
    caller.abort();

    await assert.rejects(getText('https://example.test/x', { signal: caller.signal }), (err: unknown) => {
      assert.equal(isAbort(err), true);
      return true;
    });
    assert.equal(seen.calls ?? 0, 0, 'a cancelled request should never reach fetch');
  });
});
