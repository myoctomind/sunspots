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

/** Fake worker that fires onerror (asynchronously) for every message posted. */
function crashingWorker(): WorkerLike {
  const w: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage() {
      queueMicrotask(() => w.onerror?.(new Error('crash')));
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

const okWorker = (onCall?: () => void) =>
  fakeWorker(({ id, size, difficulty }) => {
    onCall?.();
    return { id, result: stubResult(size, difficulty) };
  });

describe('GenClient', () => {
  it('resolves requests through the worker', async () => {
    const client = new GenClient(() => okWorker());
    const g = await client.request(5, 'relaxed');
    expect(g.puzzle.size).toBe(5);
    expect(g.requested).toBe('relaxed');
  });

  it('serves a prefetched result from cache without a new worker round-trip', async () => {
    let calls = 0;
    const client = new GenClient(() => okWorker(() => calls++));
    client.prefetch(7, 'thinky');
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toBe(1);
    const g = await client.request(7, 'thinky');
    expect(g.puzzle.size).toBe(7);
    expect(calls).toBe(1);
    client.request(7, 'thinky');
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toBe(2);
  });

  it('dedupes overlapping prefetches of the same key', async () => {
    let calls = 0;
    const client = new GenClient(() => okWorker(() => calls++));
    client.prefetch(7, 'thinky');
    client.prefetch(7, 'thinky');
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toBe(1);
  });

  it('a request issued during an in-flight prefetch shares its round-trip', async () => {
    let calls = 0;
    const client = new GenClient(() => okWorker(() => calls++));
    client.prefetch(7, 'thinky');
    const g = await client.request(7, 'thinky');
    expect(g.puzzle.size).toBe(7);
    expect(calls).toBe(1);
    await client.request(7, 'thinky');
    expect(calls).toBe(2);
  });

  it('respawns once on worker error and re-sends pending requests', async () => {
    let spawned = 0;
    const client = new GenClient(() => {
      spawned++;
      return spawned === 1 ? crashingWorker() : okWorker();
    });
    const g = await client.request(5, 'relaxed');
    expect(g.puzzle.size).toBe(5);
    expect(spawned).toBe(2);
  });

  it('two in-flight messages on one crashing worker cause one respawn, not two', async () => {
    let spawned = 0;
    const client = new GenClient(() => {
      spawned++;
      return spawned === 1 ? crashingWorker() : okWorker();
    });
    const [a, b] = await Promise.all([
      client.request(5, 'relaxed'),
      client.request(6, 'thinky'),
    ]);
    expect(a.puzzle.size).toBe(5);
    expect(b.puzzle.size).toBe(6);
    expect(spawned).toBe(2); // the dead worker's second onerror is ignored
  });

  it('a second crash rejects all pending and recovers for future requests', async () => {
    let spawned = 0;
    const client = new GenClient(() => {
      spawned++;
      return spawned <= 2 ? crashingWorker() : okWorker();
    });
    await expect(client.request(5, 'relaxed')).rejects.toThrow('puzzle generation failed');
    const g = await client.request(5, 'relaxed');
    expect(g.puzzle.size).toBe(5);
    expect(spawned).toBe(3);
  });
});
