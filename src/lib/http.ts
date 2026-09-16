/** Shared fetch helpers: timeouts, JSON decoding, typed failures. */

export class HttpError extends Error {
  // Declared as plain fields rather than constructor parameter properties:
  // parameter properties are not erasable syntax, so they break Node's
  // type-stripping and would make this module unimportable from the test suite.
  readonly status: number;
  readonly url: string;

  constructor(status: number, url: string, message?: string) {
    super(message ?? `HTTP ${status} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

const DEFAULT_TIMEOUT_MS = 12_000;

export interface JsonRequest {
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Caller's abort signal; combined with the internal timeout. */
  signal?: AbortSignal;
}

/**
 * A signal that aborts when either `caller` or our own timeout fires.
 *
 * `AbortSignal.any([a, b])` says this in one line, and every browser and Node
 * has it — but React Native does not. It polyfills AbortController from
 * `abort-controller@3` (see `react-native/Libraries/Core/setUpXHR.js`), a 2019
 * WHATWG implementation predating both `AbortSignal.any` and
 * `AbortSignal.timeout`. On device the static is simply `undefined`, so calling
 * it throws a TypeError *before* the request is made — and because every
 * provider passes a caller signal, that turned all four sources into permanent
 * fallback-to-mock. Composing the two by hand is the portable form.
 *
 * `release()` must run in a `finally`: it stops the timer keeping the JS
 * context awake, and drops the listener that would otherwise pin this request
 * to the caller's signal for that signal's whole life.
 */
function linkSignals(caller: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const forwardAbort = () => controller.abort();
  if (caller) {
    if (caller.aborted) controller.abort();
    else caller.addEventListener('abort', forwardAbort);
  }

  return {
    signal: controller.signal,
    /** True only when *we* gave up waiting — the caller cancelling is not this. */
    get timedOut() {
      return timedOut;
    },
    release() {
      clearTimeout(timer);
      caller?.removeEventListener('abort', forwardAbort);
    },
  };
}

/**
 * GET a JSON document.
 *
 * Failure modes are deliberately kept distinct, because callers respond to them
 * very differently:
 *
 *   • caller aborted (a newer keystroke superseded this one) -> rejects with an
 *     `AbortError`, which `isAbort` reports as true. Callers discard silently.
 *   • our own timeout fired -> rejects with `HttpError(408)`. This is a real
 *     failure, so callers fall back to cached/local data instead of discarding.
 *   • non-2xx -> `HttpError(status)`.
 *
 * Conflating the first two is a subtle trap: a slow endpoint then looks exactly
 * like a cancelled keystroke, and the caller returns nothing at all rather than
 * degrading gracefully.
 */
export async function getJson<T>(url: string, init: JsonRequest = {}): Promise<T> {
  return get(url, 'application/json', init, (res) => res.json() as Promise<T>);
}

/**
 * GET a plain-text or XML document. Same failure contract as `getJson` — some
 * of our sources (the House Clerk index, SEC ownership documents) aren't JSON.
 */
export async function getText(url: string, init: JsonRequest = {}): Promise<string> {
  return get(url, 'text/plain, application/xml, text/html, */*', init, (res) => res.text());
}

/**
 * The shared body of `getJson`/`getText`.
 *
 * Kept as one function on purpose: these two used to carry independent copies
 * of the timeout-and-abort plumbing, which is how one unsupported call managed
 * to break both at once.
 *
 * `readBody` runs inside the timeout window rather than after it. Headers
 * arriving is not the same as the response being complete — a source that
 * stalls mid-body would otherwise hang the request with no deadline left to
 * cut it off.
 */
async function get<T>(
  url: string,
  accept: string,
  init: JsonRequest,
  readBody: (res: Response) => Promise<T>,
): Promise<T> {
  // A superseded keystroke can cancel before we ever reach the network. Bail
  // here rather than opening a connection whose result we would only discard.
  if (init.signal?.aborted) {
    throw Object.assign(new Error(`Aborted before request: ${url}`), { name: 'AbortError' });
  }

  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const link = linkSignals(init.signal, timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept, ...init.headers },
      signal: link.signal,
    });
    if (!res.ok) throw new HttpError(res.status, url);
    return await readBody(res);
  } catch (err) {
    // Our timer fired and the caller did not cancel: a genuine timeout.
    if (link.timedOut && !init.signal?.aborted) {
      throw new HttpError(408, url, `Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    link.release();
  }
}

/**
 * True only when the *caller* cancelled. Timeouts are excluded on purpose —
 * see `getJson`.
 */
export function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * True for the "your plan does not cover this" family of responses (401/403).
 *
 * Distinguished from ordinary failures because it is permanent for the life of
 * the key, not transient: retrying it every poll burns quota to earn the same
 * rejection. Callers latch it off and take their keyless path instead.
 */
export function isAccessDenied(err: unknown): boolean {
  return err instanceof HttpError && (err.status === 401 || err.status === 403);
}

/** Percent-encode a value for use in a query string. */
export function q(value: string): string {
  return encodeURIComponent(value.trim());
}
