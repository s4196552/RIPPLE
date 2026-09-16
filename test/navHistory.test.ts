import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  selectCanGoBack,
  selectCanGoForward,
  useNavHistory,
} from '../src/store/navHistory.ts';

/** Visit each path in order, as the recorder would. */
function walk(...paths: string[]) {
  for (const p of paths) useNavHistory.getState().visit(p);
}

function state() {
  return useNavHistory.getState();
}

describe('navigation history', () => {
  beforeEach(() => {
    useNavHistory.setState({ entries: [], index: -1 });
  });

  it('starts with nowhere to go in either direction', () => {
    assert.equal(selectCanGoBack(state()), false);
    assert.equal(selectCanGoForward(state()), false);
  });

  it('records the first visit without offering a back', () => {
    walk('/');
    assert.deepEqual(state().entries, ['/']);
    assert.equal(state().index, 0);
    assert.equal(selectCanGoBack(state()), false, 'nothing precedes the first screen');
  });

  it('ignores a repeat visit to the current path', () => {
    walk('/', '/subject/stocks/NVDA', '/subject/stocks/NVDA');
    assert.deepEqual(state().entries, ['/', '/subject/stocks/NVDA']);
    assert.equal(state().index, 1);
  });

  it('offers a back once a second screen is visited', () => {
    walk('/', '/watchlist');
    assert.equal(selectCanGoBack(state()), true);
    assert.equal(selectCanGoForward(state()), false, 'a fresh trail has no future');
  });

  it('moves the cursor on a back instead of rewriting the trail', () => {
    walk('/', '/watchlist', '/add');
    walk('/watchlist');

    assert.deepEqual(state().entries, ['/', '/watchlist', '/add'], 'trail is preserved');
    assert.equal(state().index, 1);
    assert.equal(selectCanGoForward(state()), true, 'the popped screen is reachable again');
  });

  it('restores the cursor on a forward', () => {
    walk('/', '/watchlist', '/add');
    walk('/watchlist');
    walk('/add');

    assert.equal(state().index, 2);
    assert.deepEqual(state().entries, ['/', '/watchlist', '/add']);
    assert.equal(selectCanGoForward(state()), false);
  });

  it('drops the forward trail when a back is followed by a new destination', () => {
    walk('/', '/watchlist', '/add');
    walk('/watchlist'); // back
    walk('/subject/stocks/NVDA'); // somewhere new

    assert.deepEqual(state().entries, ['/', '/watchlist', '/subject/stocks/NVDA']);
    assert.equal(selectCanGoForward(state()), false, '/add is no longer reachable');
  });

  it('can walk the whole trail back to the start', () => {
    walk('/', '/watchlist', '/add', '/add/stocks');
    walk('/add', '/watchlist', '/');

    assert.equal(state().index, 0);
    assert.equal(selectCanGoBack(state()), false);
    assert.equal(selectCanGoForward(state()), true);
  });

  it('caps the trail so a long session cannot grow without bound', () => {
    walk(...Array.from({ length: 60 }, (_, i) => `/subject/stocks/S${i}`));

    assert.equal(state().entries.length, 50);
    assert.equal(state().index, 49);
    assert.equal(state().entries[0], '/subject/stocks/S10', 'oldest entries fall off the back');
    assert.equal(state().entries.at(-1), '/subject/stocks/S59');
  });

  /**
   * Documents the known divergence from a browser rather than asserting the
   * browser's behaviour: without reading the navigator's internals a repeat of
   * the previous path is indistinguishable from a back.
   */
  it('treats a navigation to the previous path as a back, not a third entry', () => {
    walk('/', '/watchlist', '/');

    assert.deepEqual(state().entries, ['/', '/watchlist']);
    assert.equal(state().index, 0);
    assert.equal(selectCanGoForward(state()), true);
  });
});
