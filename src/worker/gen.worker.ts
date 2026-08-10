import { generatePuzzle } from '../engine/generate';

self.onmessage = (e: MessageEvent) => {
  const { id, size, difficulty, seed } = e.data;
  const result = generatePuzzle(size, difficulty, seed);
  (self as unknown as { postMessage(d: unknown): void }).postMessage({ id, result });
};
