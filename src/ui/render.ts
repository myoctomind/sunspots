import { type CellState, type Puzzle, idx, rowOf, colOf } from '../engine/board';
import { makeRubTracker } from './eggs';

export const REGION_NAMES = [
  'peach', 'butter', 'sage', 'sky', 'lilac', 'rose', 'mint', 'sand', 'periwinkle',
];
export const regionName = (g: number): string => `${REGION_NAMES[g % 9]} patch`;

export function borderSegments(pz: Puzzle): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const { size, regions } = pz;
  const segs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const g = regions[idx(size, r, c)];
    if (r === 0) segs.push({ x1: c, y1: 0, x2: c + 1, y2: 0 });
    if (c === 0) segs.push({ x1: 0, y1: r, x2: 0, y2: r + 1 });
    if (r === size - 1) segs.push({ x1: c, y1: size, x2: c + 1, y2: size });
    if (c === size - 1) segs.push({ x1: size, y1: r, x2: size, y2: r + 1 });
    if (c + 1 < size && regions[idx(size, r, c + 1)] !== g) {
      segs.push({ x1: c + 1, y1: r, x2: c + 1, y2: r + 1 });
    }
    if (r + 1 < size && regions[idx(size, r + 1, c)] !== g) {
      segs.push({ x1: c, y1: r + 1, x2: c + 1, y2: r + 1 });
    }
  }
  return segs;
}

const SVGNS = 'http://www.w3.org/2000/svg';
const CELL = 100;

// Simple sitting-cat silhouette in a 100×100 box (refined visually in the polish task).
const CAT_PATH =
  'M50 88 C26 88 15 73 17 55 C18.5 42 26 33 33 28 L29 11 L41 21 ' +
  'C44 19.5 47 19 50 19 C53 19 56 19.5 59 21 L71 11 L67 28 ' +
  'C74 33 81.5 42 83 55 C85 73 74 88 50 88 Z';
const TAIL_PATH = 'M82 62 C95 64 96 79 85 84';
// Tail wrapped around a curled, sleeping cat.
const CURL_TAIL = 'M84 60 C97 76 86 91 58 85';

export interface BoardCallbacks {
  onTap(i: number): void;
  /** `i` is the cell the swipe began on — it decides whether the swipe adds or erases. */
  onPaintStart(i: number): void;
  onPaintCell(i: number): void;
  onPaintEnd(): void;
  onPet(i: number, x: number, y: number): void;
}

export interface BoardViewState {
  cells: CellState[];
  autoMarks: Set<number>;
  conflicts: number[];
  highlight: number[];
  focus: number | null;
  won: boolean;
}

export class BoardView {
  private pz: Puzzle | null = null;
  private cellGroups: SVGGElement[] = [];
  private downCell = -1;
  private painting = false;
  private cats = new Set<number>();
  private petCell = -1;
  private petFired = false;
  private lastPet = 0;
  private petX = 0;
  private petY = 0;
  private rub = makeRubTracker(() => {
    const t = Date.now();
    if (this.petCell < 0 || t - this.lastPet < 1200) return;
    this.lastPet = t;
    this.petFired = true;
    this.cb.onPet(this.petCell, this.petX, this.petY);
  });

  constructor(private svg: SVGSVGElement, private cb: BoardCallbacks) {
    svg.addEventListener('pointerdown', (e) => {
      const i = this.cellAt(e);
      if (i < 0) return;
      this.downCell = i;
      this.painting = false;
      this.petFired = false;
      if (this.cats.has(i)) { this.petCell = i; this.rub.start(e.clientX); }
      else this.petCell = -1;
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (this.downCell < 0) return;
      const i = this.cellAt(e);
      if (i < 0) return;
      if (i === this.downCell) {
        if (i === this.petCell) {
          this.petX = e.clientX;
          this.petY = e.clientY;
          this.rub.move(e.clientX);
        }
        return;
      }
      this.petCell = -1;
      this.rub.stop();
      if (!this.painting) {
        this.painting = true;
        // downCell is still the cell the finger went down on — it sets add-vs-erase.
        this.cb.onPaintStart(this.downCell);
        this.cb.onPaintCell(this.downCell);
      }
      this.cb.onPaintCell(i);
      this.downCell = i;
    });
    const finish = () => {
      if (this.downCell < 0) return;
      if (this.painting) this.cb.onPaintEnd();
      else if (!this.petFired) this.cb.onTap(this.downCell);
      this.downCell = -1;
      this.painting = false;
      this.petCell = -1;
      this.rub.stop();
    };
    svg.addEventListener('pointerup', finish);
    svg.addEventListener('pointercancel', () => {
      if (this.painting) this.cb.onPaintEnd();
      this.downCell = -1;
      this.painting = false;
      this.petCell = -1;
      this.rub.stop();
    });
  }

  private cellAt(e: PointerEvent): number {
    if (!this.pz) return -1;
    const rect = this.svg.getBoundingClientRect();
    const size = this.pz.size;
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * size);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * size);
    if (r < 0 || r >= size || c < 0 || c >= size) return -1;
    return idx(size, r, c);
  }

  setPuzzle(pz: Puzzle): void {
    this.pz = pz;
    const { size, regions } = pz;
    const svg = this.svg;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${size * CELL} ${size * CELL}`);

    const el = (name: string, attrs: Record<string, string>, parent: Element): Element => {
      const node = document.createElementNS(SVGNS, name);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      parent.appendChild(node);
      return node;
    };

    // Region fills
    for (let i = 0; i < size * size; i++) {
      el('rect', {
        x: String(colOf(size, i) * CELL), y: String(rowOf(size, i) * CELL),
        width: String(CELL), height: String(CELL),
        class: `patch p${regions[i] % 9}`,
      }, svg);
    }
    // Inner grid (subtle)
    for (let k = 1; k < size; k++) {
      el('line', { x1: String(k * CELL), y1: '0', x2: String(k * CELL), y2: String(size * CELL), class: 'grid' }, svg);
      el('line', { x1: '0', y1: String(k * CELL), x2: String(size * CELL), y2: String(k * CELL), class: 'grid' }, svg);
    }
    // Region borders (bold rounded ink)
    for (const s of borderSegments(pz)) {
      el('line', {
        x1: String(s.x1 * CELL), y1: String(s.y1 * CELL),
        x2: String(s.x2 * CELL), y2: String(s.y2 * CELL),
        class: 'border',
      }, svg);
    }
    // Cell glyph groups
    this.cellGroups = [];
    for (let i = 0; i < size * size; i++) {
      const x = colOf(size, i) * CELL, y = rowOf(size, i) * CELL;
      const g = el('g', { transform: `translate(${x} ${y})`, class: 'cell' }, svg) as SVGGElement;
      el('rect', { x: '4', y: '4', width: '92', height: '92', rx: '14', class: 'halo' }, g);
      const paw = el('g', { class: 'paw' }, g);
      el('circle', { cx: '50', cy: '58', r: '13', class: 'pad' }, paw);
      el('circle', { cx: '35', cy: '42', r: '6', class: 'pad' }, paw);
      el('circle', { cx: '50', cy: '37', r: '6', class: 'pad' }, paw);
      el('circle', { cx: '65', cy: '42', r: '6', class: 'pad' }, paw);
      const cat = el('g', { class: 'cat' }, g);
      el('path', { d: CAT_PATH, class: 'cat-body' }, cat);
      el('path', { d: TAIL_PATH, class: 'cat-tail' }, cat);
      const eyes = el('g', { class: 'eyes' }, cat);
      el('ellipse', { cx: '41', cy: '34', rx: '6', ry: '7.5', class: 'eye-white' }, eyes);
      el('ellipse', { cx: '59', cy: '34', rx: '6', ry: '7.5', class: 'eye-white' }, eyes);
      el('circle', { cx: '41', cy: '35.5', r: '2.8', class: 'eye-pupil' }, eyes);
      el('circle', { cx: '59', cy: '35.5', r: '2.8', class: 'eye-pupil' }, eyes);
      const face = el('g', { class: 'face' }, cat);
      el('path', { d: 'M35 33 q6 6 12 0', class: 'lid' }, face);
      el('path', { d: 'M53 33 q6 6 12 0', class: 'lid' }, face);
      el('path', { d: 'M46 43 L54 43 L50 49 Z', class: 'nose' }, face);
      // The napping form, built up front and swapped in by CSS during the sun-nap egg.
      const curled = el('g', { class: 'cat-curled' }, g);
      el('ellipse', { cx: '54', cy: '65', rx: '32', ry: '23', class: 'cat-body' }, curled);
      el('path', { d: CURL_TAIL, class: 'cat-tail' }, curled);
      el('path', { d: 'M14 46 L12 28 L27 39 Z', class: 'cat-body' }, curled);
      el('path', { d: 'M33 39 L45 27 L45 44 Z', class: 'cat-body' }, curled);
      el('circle', { cx: '29', cy: '56', r: '17', class: 'cat-body' }, curled);
      el('path', { d: 'M22 57 q7 7 14 0', class: 'sleep-eye' }, curled);
      this.cellGroups.push(g);
    }
  }

  /** Briefly toggle an effect class on one cell (slow blink, win stretch). */
  private flash(i: number, cls: string, ms: number): void {
    const g = this.cellGroups[i];
    if (!g) return;
    g.classList.add(cls);
    setTimeout(() => g.classList.remove(cls), ms);
  }

  blink(i: number): void { this.flash(i, 'blink', 2600); }
  dance(i: number): void { this.flash(i, 'dance', 1700); }

  /** Sun-nap egg: swap every cat for its curled sleeping form. Purely presentational. */
  setNapping(on: boolean): void { this.svg.classList.toggle('napping', on); }

  update(s: BoardViewState): void {
    if (!this.pz) return;
    this.cats = new Set(s.cells.flatMap((st, i) => (st === 'cat' ? [i] : [])));
    const conflictSet = new Set(s.conflicts);
    const highlightSet = new Set(s.highlight);
    this.cellGroups.forEach((g, i) => {
      const state = s.cells[i];
      const showPaw = state === 'mark' || (state === 'empty' && s.autoMarks.has(i));
      g.classList.toggle('has-cat', state === 'cat');
      g.classList.toggle('has-paw', showPaw);
      g.classList.toggle('auto', state === 'empty' && s.autoMarks.has(i));
      g.classList.toggle('conflict', conflictSet.has(i));
      g.classList.toggle('hint', highlightSet.has(i));
      g.classList.toggle('kbfocus', s.focus === i);
    });
    this.svg.classList.toggle('won', s.won);
  }
}
