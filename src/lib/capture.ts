// Pure geometry for the camera guide and for splitting a scanned page into ID cards.
// No DOM here, so it runs in the browser and in Node tests.

export const CARD_RATIO = 85.6 / 53.98; // ID-1 card, width / height

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * The guide box shown over the camera picture, in fractions (0..1) of the video frame.
 * The same function drives the overlay and the crop, so what the user sees inside the box is what is kept.
 */
export function guideRect(videoW: number, videoH: number): Rect {
  let bw = videoW * 0.86;
  let bh = bw / CARD_RATIO;
  if (bh > videoH * 0.8) {
    bh = videoH * 0.8;
    bw = bh * CARD_RATIO;
  }
  return { x: (videoW - bw) / 2 / videoW, y: (videoH - bh) / 2 / videoH, w: bw / videoW, h: bh / videoH };
}

export interface Pixels { width: number; height: number; data: Uint8ClampedArray | Uint8Array }

const INK_DISTANCE = 30; // how different from the page colour a pixel must be to count as content

function pageColour(img: Pixels): [number, number, number] {
  // Median colour of the outer ring: the paper, whatever tint the scanner gave it.
  const { width: w, height: h, data } = img;
  const edge = Math.max(1, Math.round(Math.min(w, h) * 0.01));
  const r: number[] = [], g: number[] = [], b: number[] = [];
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    r.push(data[i]); g.push(data[i + 1]); b.push(data[i + 2]);
  };
  for (let y = 0; y < h; y += 2) for (let x = 0; x < edge; x++) { take(x, y); take(w - 1 - x, y); }
  for (let x = 0; x < w; x += 2) for (let y = 0; y < edge; y++) { take(x, y); take(x, h - 1 - y); }
  const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
  return [med(r), med(g), med(b)];
}

/** Runs of indices where `on[i]` is true, with gaps shorter than `minGap` bridged. */
function runs(on: boolean[], minGap: number): [number, number][] {
  const out: [number, number][] = [];
  let start = -1, last = -1;
  for (let i = 0; i < on.length; i++) {
    if (!on[i]) continue;
    if (start < 0) start = last = i;
    else if (i - last > minGap) { out.push([start, last]); start = i; }
    last = i;
  }
  if (start >= 0) out.push([start, last]);
  return out;
}

/**
 * Finds the ID cards on a scanned page: blocks of content separated by blank paper.
 * Returns up to two rectangles (pixels), top to bottom (or left to right on a landscape page).
 * Returns [] when the page looks blank.
 */
export function findCards(img: Pixels): Rect[] {
  const { width: w, height: h, data } = img;
  const [pr, pg, pb] = pageColour(img);
  const ink = new Uint8Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    ink[p] = Math.max(Math.abs(data[i] - pr), Math.abs(data[i + 1] - pg), Math.abs(data[i + 2] - pb)) > INK_DISTANCE ? 1 : 0;
  }
  const axis = (vertical: boolean): Rect[] => {
    const along = vertical ? h : w;
    const across = vertical ? w : h;
    const count = new Array<number>(along).fill(0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ink[y * w + x]) count[vertical ? y : x]++;
    const on = count.map((c) => c > across * 0.004);
    const found = runs(on, Math.round(along * 0.025)).filter(([a, b]) => b - a + 1 >= along * 0.06);
    // Keep the two biggest blocks, in reading order.
    const biggest = found.sort((p, q) => q[1] - q[0] - (p[1] - p[0])).slice(0, 2).sort((p, q) => p[0] - q[0]);
    return biggest.map(([a, b]) => {
      // Tight bounds across the other axis, inside this block only.
      let lo = across, hi = -1;
      for (let o = 0; o < across; o++) {
        let c = 0;
        for (let k = a; k <= b; k++) c += ink[vertical ? k * w + o : o * w + k];
        if (c > (b - a + 1) * 0.004) { if (o < lo) lo = o; hi = o; }
      }
      if (hi < 0) { lo = 0; hi = across - 1; }
      const m = Math.round(Math.min(w, h) * 0.01);
      const r0 = Math.max(0, a - m), r1 = Math.min(along - 1, b + m);
      const c0 = Math.max(0, lo - m), c1 = Math.min(across - 1, hi + m);
      return vertical ? { x: c0, y: r0, w: c1 - c0 + 1, h: r1 - r0 + 1 } : { x: r0, y: c0, w: r1 - r0 + 1, h: c1 - c0 + 1 };
    });
  };
  const byRows = axis(true);
  if (byRows.length >= 2 || w <= h * 1.2) return byRows;
  const byCols = axis(false);
  return byCols.length >= 2 ? byCols : byRows;
}
