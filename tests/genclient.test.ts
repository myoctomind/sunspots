import { describe, it, expect } from 'vitest';
import { GenClient, type WorkerLike } from '../src/ui/genClient';

/** Fake worker: computes synchronously on postMessage via a supplied handler. */
function fakeWorker(handler: (data: any) => any): WorkerLike {
  const w: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(data: any) {
      const out = handler(data);
      queueMicrotask(() => w.onmessage?.({ data: out }));
    },
    terminate() {},
  };
  return w;
}

const stubResult = (size: number, difficulty: string) => ({
  puzzle: { size, regions: [] },
  solution: { cols: [] },
  grade: difficulty,
  requested: difficulty,
});

describe('GenClient', () => {
  it('resolves requests through the worker', async () => {
    const client = new GenClient(() =>
      fakeWorker(({ id, size, difficulty }) => ({ id, result: stubResult(size, difficulty) })),
    );
    const g = await client.request(5, 'relaxed');
    expect(g.puzzle.size).toBe(5);
    expect(g.requested).toBe('relaxed');
  });

  it('serves a prefetched result from cache without a new worker round-trip', async () => {
    let calls = 0;
    const client = new GenClient(() =>
      fakeWorker(({ id, size, difficulty }) => { calls++; return { id, result: stubResult(size, difficulty) }; }),
    );
    client.prefetch(7, 'thinky');
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toBe(1);
    const g = await client.request(7, 'thinky');
    expect(g.puzzle.size).toBe(7);
    expect(calls).toBe(1); // cache hit, no second call
    client.request(7, 'thinky'); // cache consumed → goes to worker again
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toBe(2);
  });

  it('respawns once on worker error and re-sends pending requests', async () => {
    let spawned = 0;
    const client = new GenClient(() => {
      spawned++;
      if (spawned === 1) {
        // first worker: never answers; we trigger its onerror below via a bad message
        const w = fakeWorker(() => { throw new Error('boom'); });
        const orig = w.postMessage.bind(w);
        w.postMessage = () => queueMicrotask(() => w.onerror?.(new Error('crash')));
        void orig;
        return w;
      }
      return fakeWorker(({ id, size, difficulty }) => ({ id, result: stubResult(size, difficulty) }));
    });
    const g = await client.request(5, 'relaxed');
    expect(g.puzzle.size).toBe(5);
    expect(spawned).toBe(2);
  });
});
