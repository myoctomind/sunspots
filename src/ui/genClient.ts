import { type Difficulty } from '../engine/board';
import { type Generated } from '../engine/generate';

export interface WorkerLike {
  onmessage: ((e: { data: any }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  postMessage(data: any): void;
  terminate(): void;
}

interface Pending {
  resolve: (g: Generated) => void;
  reject: (e: unknown) => void;
  payload: { id: number; size: number; difficulty: Difficulty; seed: number };
  cacheKey: string | null; // set for prefetches
}

export class GenClient {
  private worker: WorkerLike;
  private nextId = 1;
  private seedCounter = Math.floor(Math.random() * 2 ** 31);
  private pending = new Map<number, Pending>();
  private cache = new Map<string, Generated>();
  private inflightPrefetch = new Map<string, Promise<Generated>>();
  private respawned = false;

  constructor(private makeWorker: () => WorkerLike) {
    this.worker = this.spawn();
  }

  private spawn(): WorkerLike {
    const w = this.makeWorker();
    w.onmessage = (e) => {
      if (this.worker !== w) return; // stale worker: ignore
      const { id, result } = e.data as { id: number; result: Generated };
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      this.respawned = false;
      if (p.cacheKey) this.cache.set(p.cacheKey, result);
      p.resolve(result);
    };
    w.onerror = () => {
      if (this.worker !== w) return; // late event from a terminated worker: ignore
      this.handleCrash();
    };
    return w;
  }

  private handleCrash(): void {
    this.worker.terminate();
    if (!this.respawned) {
      this.respawned = true;
      this.worker = this.spawn();
      for (const p of this.pending.values()) this.worker.postMessage(p.payload);
    } else {
      const err = new Error('puzzle generation failed');
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
      this.worker = this.spawn();
      this.respawned = false;
    }
  }

  private send(size: number, difficulty: Difficulty, cacheKey: string | null): Promise<Generated> {
    const id = this.nextId++;
    const payload = { id, size, difficulty, seed: (this.seedCounter++ >>> 0) };
    return new Promise<Generated>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, payload, cacheKey });
      this.worker.postMessage(payload);
    });
  }

  request(size: number, difficulty: Difficulty): Promise<Generated> {
    const key = `${size}:${difficulty}`;
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      return Promise.resolve(hit);
    }
    const inflight = this.inflightPrefetch.get(key);
    if (inflight) {
      this.inflightPrefetch.delete(key); // claimed: a later request must go fresh
      return inflight.then((g) => {
        this.cache.delete(key); // the prefetch cached it on resolve; we're consuming it
        return g;
      });
    }
    return this.send(size, difficulty, null);
  }

  prefetch(size: number, difficulty: Difficulty): void {
    const key = `${size}:${difficulty}`;
    if (this.cache.has(key) || this.inflightPrefetch.has(key)) return;
    const p = this.send(size, difficulty, key);
    this.inflightPrefetch.set(key, p);
    const cleanup = () => {
      if (this.inflightPrefetch.get(key) === p) this.inflightPrefetch.delete(key);
    };
    p.then(cleanup, cleanup); // also marks prefetch rejections handled (silent by design)
  }
}
