import { test } from "node:test";
import assert from "node:assert/strict";
import { guideRect, findCards, CARD_RATIO } from "../src/lib/capture.ts";

test("guide box has the ID-1 shape, is centred and stays inside the frame (portrait, landscape, square)", () => {
  for (const [w, h] of [[1080, 1920], [1920, 1080], [1000, 1000], [640, 480], [480, 640]]) {
    const g = guideRect(w, h);
    assert.ok(Math.abs((g.w * w) / (g.h * h) - CARD_RATIO) < 0.01, `${w}x${h} ratio`);
    assert.ok(g.x >= 0 && g.y >= 0 && g.x + g.w <= 1 + 1e-9 && g.y + g.h <= 1 + 1e-9, `${w}x${h} inside`);
    assert.ok(Math.abs(g.x * 2 + g.w - 1) < 1e-9 && Math.abs(g.y * 2 + g.h - 1) < 1e-9, `${w}x${h} centred`);
    assert.ok(g.w * w >= 0.4 * w, `${w}x${h} not tiny`);
  }
});

/** A page of paper colour with filled card blocks (with white "text" holes inside, like a real card). */
function page(w, h, cards, paper = [250, 250, 248]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = paper[0]; data[i * 4 + 1] = paper[1]; data[i * 4 + 2] = paper[2]; data[i * 4 + 3] = 255; }
  for (const c of cards) {
    for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) {
      const hole = x > c.x + c.w * 0.3 && x < c.x + c.w * 0.9 && y > c.y + c.h * 0.3 && y < c.y + c.h * 0.4;
      const i = (y * w + x) * 4;
      const v = hole ? paper : [170, 210, 220];
      data[i] = v[0]; data[i + 1] = v[1]; data[i + 2] = v[2];
    }
  }
  return { width: w, height: h, data };
}
const near = (r, e, tol) => Math.abs(r.x - e.x) <= tol && Math.abs(r.y - e.y) <= tol && Math.abs(r.w - e.w) <= 2 * tol && Math.abs(r.h - e.h) <= 2 * tol;

test("one A4 page with front on top and back below: two cards found, top first", () => {
  const front = { x: 150, y: 120, w: 300, h: 190 }, back = { x: 150, y: 400, w: 300, h: 190 };
  const r = findCards(page(600, 850, [front, back]));
  assert.equal(r.length, 2);
  assert.ok(near(r[0], front, 12), JSON.stringify(r[0]));
  assert.ok(near(r[1], back, 12), JSON.stringify(r[1]));
});

test("a tinted, slightly grey scan background still works", () => {
  const front = { x: 100, y: 100, w: 320, h: 200 }, back = { x: 180, y: 450, w: 320, h: 200 };
  const r = findCards(page(600, 850, [front, back], [226, 224, 214]));
  assert.equal(r.length, 2);
  assert.ok(r[0].y < r[1].y);
});

test("a page with one card gives one rectangle", () => {
  const r = findCards(page(600, 850, [{ x: 150, y: 300, w: 300, h: 190 }]));
  assert.equal(r.length, 1);
});

test("a landscape page with the cards side by side splits left to right", () => {
  const a = { x: 60, y: 150, w: 300, h: 190 }, b = { x: 440, y: 150, w: 300, h: 190 };
  const r = findCards(page(800, 500, [a, b]));
  assert.equal(r.length, 2);
  assert.ok(r[0].x < r[1].x);
});

test("a blank page finds nothing", () => {
  assert.equal(findCards(page(600, 850, [])).length, 0);
});

test("specks of dust are not mistaken for a card", () => {
  const front = { x: 150, y: 120, w: 300, h: 190 };
  const p = page(600, 850, [front, { x: 20, y: 700, w: 6, h: 6 }]);
  assert.equal(findCards(p).length, 1);
});
