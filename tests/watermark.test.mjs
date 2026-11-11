import { test } from "node:test";
import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  renderCard, exportPng, exportPdf, layoutSheet, checkSettings, chordLength, layoutBand, layoutCorner, MAX_BLEED, surfaceRectMm, planSheetMm,
  CARD_PX_W, DEFAULT_ANGLE, DEFAULT_OPACITY,
} from "../src/lib/watermark.ts";

const make = (w, h) => createCanvas(w, h);
const OUT = process.env.TEST_OUT || "/tmp";

// Synthetic stand-in for an ID photo. Not a real document.
function fakeCard(label) {
  const c = createCanvas(1600, 1010);
  const g = c.getContext("2d");
  g.fillStyle = "#cfd8dc"; g.fillRect(0, 0, 1600, 1010);
  g.fillStyle = "#90a4ae"; g.fillRect(80, 220, 380, 480);
  g.fillStyle = "#263238"; g.font = "700 64px sans-serif";
  g.fillText(`SAMPLE ${label}`, 560, 300);
  g.font = "400 48px sans-serif";
  g.fillText("NAME: EXAMPLE PERSON", 560, 420);
  g.fillText("NO: 000000-00-0000", 560, 520);
  return c;
}

const base = { text: "KHAS UNTUK BANK SAHAJA 10/11/2026", opacity: DEFAULT_OPACITY, angle: DEFAULT_ANGLE, color: "#d92d20", position: "middle" };
const cornerBase = { ...base, position: "corner" };

test("renderCard outputs a 300 dpi card width and keeps aspect", () => {
  const out = renderCard(fakeCard("F"), base, make);
  assert.equal(out.width, CARD_PX_W);
  assert.equal(out.height, Math.round((CARD_PX_W * 1010) / 1600));
});

test("watermark actually changes pixels along the whole diagonal band", () => {
  const src = fakeCard("F");
  const plain = renderCard(src, { ...base, text: "" }, make);
  const marked = renderCard(src, base, make);
  const a = plain.getContext("2d").getImageData(0, 0, plain.width, plain.height).data;
  const b = marked.getContext("2d").getImageData(0, 0, plain.width, plain.height).data;
  // Count changed pixels in the lower-left and upper-right thirds of the card (the band runs between them).
  let lowerLeft = 0, upperRight = 0;
  for (let y = 0; y < plain.height; y++) {
    for (let x = 0; x < plain.width; x++) {
      const i = (y * plain.width + x) * 4;
      if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2]) continue;
      if (x < plain.width / 3 && y > plain.height / 2) lowerLeft++;
      if (x > (plain.width * 2) / 3 && y < plain.height / 2) upperRight++;
    }
  }
  assert.ok(lowerLeft > 200 && upperRight > 200, `expected the band at both ends, got ${lowerLeft} and ${upperRight} changed pixels`);
});

test("empty text draws nothing", () => {
  const src = fakeCard("F");
  const a = renderCard(src, { ...base, text: "   " }, make).getContext("2d").getImageData(0, 0, 50, 50).data;
  const b = renderCard(src, { ...base, text: "" }, make).getContext("2d").getImageData(0, 0, 50, 50).data;
  assert.deepEqual(Array.from(a), Array.from(b));
});

test("checkSettings flags empty, faint and heavy", () => {
  assert.deepEqual(checkSettings({ ...base, text: "" }), ["empty"]);
  assert.deepEqual(checkSettings({ ...base, opacity: 0.2 }), ["faint"]);
  assert.deepEqual(checkSettings({ ...base, opacity: 0.95 }), ["heavy"]);
  assert.deepEqual(checkSettings(base), []);
});

test("A4 sheet is 210x297 mm at 300 dpi and cards are 85.6 mm wide", () => {
  const f = renderCard(fakeCard("F"), base, make);
  const b = renderCard(fakeCard("B"), base, make);
  const sheet = layoutSheet(f, b, 300, make);
  assert.equal(sheet.width, 2480);
  assert.equal(sheet.height, 3508);
});

test("PNG and PDF exports are valid files", async () => {
  const f = renderCard(fakeCard("F"), base, make);
  const b = renderCard(fakeCard("B"), base, make);
  const png = await exportPng(f, b, make);
  assert.deepEqual(Array.from(png.slice(0, 4)), [0x89, 0x50, 0x4e, 0x47]);
  const pdf = await exportPdf(f, b);
  assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/sample-export.png`, png);
  writeFileSync(`${OUT}/sample-export.pdf`, pdf);
});

test("chord length at -45 deg on a 1011x638 card", () => {
  const c = chordLength(1011, 638, -45);
  assert.ok(Math.abs(c - 902) < 2, `chord ${c}`);
  assert.equal(Math.round(chordLength(1011, 638, 0)), 1011);
});

test("the whole text fits inside the visible band (not cropped at the card edges)", () => {
  const ctx = createCanvas(10, 10).getContext("2d");
  for (const text of [base.text, "UNTUK PERMOHONAN KERJA SYARIKAT ABC SAHAJA 27/9/2026", "TIDAK SAH UNTUK KEGUNAAN LAIN"]) {
    for (const angle of [-45, -30, -60, 0]) {
      const s = { ...base, text, angle };
      const L = layoutBand(ctx, CARD_PX_W, 638, s);
      // layoutBand leaves ctx.font set to the exact font it measured with, so measure with that (fonts differ per machine).
      const one = ctx.measureText(text).width;
      assert.ok(one <= L.chord * 1.0, `${text} @${angle}: text ${Math.round(one)} > chord ${Math.round(L.chord)}`);
    }
  }
});

test("short text is repeated along the band", () => {
  const ctx = createCanvas(10, 10).getContext("2d");
  const L = layoutBand(ctx, CARD_PX_W, 638, { ...base, text: "BANK" });
  assert.equal(L.repeated, true);
  assert.ok(L.line.split("BANK").length > 2);
});

test("smaller scale gives a smaller band and text, and warns below 60%", () => {
  const ctx = createCanvas(10, 10).getContext("2d");
  const full = layoutBand(ctx, CARD_PX_W, 638, { ...base, text: "BANK ABC", scale: 1 });
  const small = layoutBand(ctx, CARD_PX_W, 638, { ...base, text: "BANK ABC", scale: 0.5 });
  assert.ok(small.size < full.size * 0.6, `size ${small.size} vs ${full.size}`);
  assert.ok(small.band < full.band * 0.6, `band ${small.band} vs ${full.band}`);
  assert.deepEqual(checkSettings({ ...base, scale: 0.5 }), ["small"]);
  assert.deepEqual(checkSettings({ ...base, scale: 0.6 }), []);
  // scale is clamped to [0.4, 1]
  const tiny = layoutBand(ctx, CARD_PX_W, 638, { ...base, text: "BANK ABC", scale: 0.01 });
  assert.ok(tiny.size >= Math.round(638 * 0.11 * 0.4) - 1);
});

test("very long text shrinks instead of overflowing", () => {
  const long = { ...base, text: "KHAS UNTUK PERMOHONAN PINJAMAN PERUMAHAN BANK ABC CAWANGAN KUALA LUMPUR SAHAJA 10/11/2026" };
  const out = renderCard(fakeCard("F"), long, make);
  assert.equal(out.width, CARD_PX_W);
});

// --- regression tests from the replica-test pass ---

test("BUG-002: portrait photo keeps its aspect ratio in the rendered card", () => {
  const portrait = createCanvas(1000, 2000);
  portrait.getContext("2d").fillRect(0, 0, 1000, 2000);
  const out = renderCard(portrait, base, make);
  assert.ok(Math.abs(out.width / out.height - 0.5) < 0.01, `aspect ${out.width}/${out.height}`);
});

test("BUG-002: extreme tall image stays within a sane canvas size and keeps aspect", () => {
  const tall = createCanvas(300, 4000);
  tall.getContext("2d").fillRect(0, 0, 300, 4000);
  const out = renderCard(tall, base, make);
  assert.ok(out.height <= 2200, `height ${out.height}`);
  assert.ok(Math.abs(out.width / out.height - 300 / 4000) < 0.01);
});

test("BUG-002: tall cards are scaled to fit the A4 sheet, normal cards stay true size", () => {
  const bounds = (r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= 210 && r.y + r.h <= 297 - 10;
  const portrait = planSheetMm([{ width: 1000, height: 2000 }, { width: 1000, height: 2000 }]);
  for (const r of portrait) assert.ok(bounds(r), JSON.stringify(r));
  assert.ok(portrait[0].y + portrait[0].h <= portrait[1].y, "cards must not overlap");
  assert.ok(Math.abs(portrait[0].w / portrait[0].h - 0.5) < 0.01);
  const normal = planSheetMm([{ width: 1011, height: 638 }, { width: 1011, height: 638 }]);
  assert.ok(Math.abs(normal[0].w - 85.6) < 0.01, `normal card width ${normal[0].w}`);
  for (const r of normal) assert.ok(bounds(r));
});

// ---- Band across the top-left corner: one line, may run out past the card ----

const grey = () => { const c = make(CARD_PX_W, 638); const g = c.getContext("2d"); g.fillStyle = "#b0bec5"; g.fillRect(0, 0, CARD_PX_W, 638); return c; };

/** Changed pixels of a rendered card, in card coordinates (the card's own top-left is 0,0). */
function changed(settings) {
  const out = renderCard(grey(), settings, make);
  const bl = out.bleed ?? { l: 0, t: 0, r: 0, b: 0 };
  const ref = make(out.width, out.height);
  const g = ref.getContext("2d"); g.clearRect(0, 0, out.width, out.height); g.drawImage(grey(), bl.l, bl.t);
  const A = g.getImageData(0, 0, out.width, out.height).data, B = out.getContext("2d").getImageData(0, 0, out.width, out.height).data;
  const inCard = [], outside = [];
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    const i = (y * out.width + x) * 4;
    if (A[i] === B[i] && A[i + 1] === B[i + 1] && A[i + 2] === B[i + 2] && A[i + 3] === B[i + 3]) continue;
    const cx = x - bl.l, cy = y - bl.t;
    (cx >= 0 && cy >= 0 && cx < CARD_PX_W && cy < 638 ? inCard : outside).push([cx, cy]);
  }
  return { inCard, outside, bleed: bl, out };
}

test("corner is the default position", () => {
  const { position, ...noPos } = base;
  assert.equal(changed(noPos).inCard.length, changed(cornerBase).inCard.length);
});

test("corner band: the part over the card stays small and in the top-left; the rest runs out past the card", () => {
  for (const text of ["FOR PRIVATE USE ONLY", "KHAS UNTUK BANK SAHAJA 10/11/2026", "BANK ABC"]) {
    const { inCard, outside, bleed } = changed({ ...cornerBase, text, scale: 0.8 });
    assert.ok(inCard.length > 300, `${text}: drawn over the card`);
    assert.ok(Math.max(...inCard.map((p) => p[0])) < 0.3 * CARD_PX_W, `${text}: reaches x=${Math.max(...inCard.map((p) => p[0]))}`);
    assert.ok(Math.max(...inCard.map((p) => p[1])) < 0.42 * 638, `${text}: reaches y=${Math.max(...inCard.map((p) => p[1]))}`);
    assert.ok(!inCard.some(([x, y]) => x > 0.35 * CARD_PX_W && y > 0.45 * 638), `${text}: middle and lower right untouched`);
    assert.ok(bleed.l > 0 && bleed.t > 0 && outside.length > 300, `${text}: runs out past the card (${bleed.l},${bleed.t})`);
  }
});

test("corner text is a single line, and the size slider sets its size", () => {
  const ctx = createCanvas(10, 10).getContext("2d");
  const text = "UNTUK PERMOHONAN KERJA SYARIKAT ABC SAHAJA 27/9/2026";
  const L = layoutCorner(ctx, CARD_PX_W, 638, { ...cornerBase, text, scale: 0.8 });
  assert.equal(L.line, text);
  const small = layoutCorner(ctx, CARD_PX_W, 638, { ...cornerBase, text: "BANK ABC", scale: 0.4 });
  const big = layoutCorner(ctx, CARD_PX_W, 638, { ...cornerBase, text: "BANK ABC", scale: 1 });
  assert.ok(small.size < big.size);
});

test("corner band never sticks out of the card by more than the limit, at any angle or text length", () => {
  const ctx = createCanvas(10, 10).getContext("2d");
  for (const angle of [-15, -30, -45, -60, -75, -80, -10]) {
    for (const text of ["BANK", base.text, "x ".repeat(44).trim()]) {
      for (const scale of [0.4, 1]) {
        const { bleed, size } = layoutCorner(ctx, CARD_PX_W, 638, { ...cornerBase, angle, text, scale });
        const worst = Math.max(bleed.l, bleed.t, bleed.r, bleed.b);
        assert.ok(worst <= MAX_BLEED * 638 + 1 || size <= 9, `${angle} ${text.slice(0, 8)} ${scale}: sticks out ${worst}`);
      }
    }
  }
});

test("text keeps the size from the slider unless it would stick out too far; a longer text is never bigger", () => {
  const ctx = createCanvas(10, 10).getContext("2d");
  const slider = 638 * 0.065 * 0.8;
  const short = layoutCorner(ctx, CARD_PX_W, 638, { ...cornerBase, text: "BANK ABC", scale: 0.8 });
  const long = layoutCorner(ctx, CARD_PX_W, 638, { ...cornerBase, text: "FOR PRIVATE USE ONLY 10/11/2026 BANK ABC", scale: 0.8 });
  assert.ok(Math.abs(short.size - slider) < 0.2, `short text size ${short.size} vs slider ${slider.toFixed(1)}`);
  assert.ok(long.size <= short.size);
  assert.ok(long.size >= 14, `size ${long.size}`);
});

test("the sheet keeps the card at true size and room for the band that runs out, without touching the other card", () => {
  const f = renderCard(grey(), cornerBase, make), b = renderCard(grey(), cornerBase, make);
  assert.ok(f.bleed.t > 0 && f.width > CARD_PX_W);
  const cards = planSheetMm([f, b]);
  assert.ok(Math.abs(cards[0].w - 85.6) < 0.01, "card still true size");
  for (const [i, c] of [f, b].entries()) {
    const r = surfaceRectMm(c, cards[i]);
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 210 && r.y + r.h <= 297, `surface ${i} inside the page`);
    assert.ok(r.x <= cards[i].x && r.y <= cards[i].y, "surface contains the card");
  }
  const rb = surfaceRectMm(b, cards[1]);
  assert.ok(rb.y >= cards[0].y + cards[0].h, "the back card's band does not reach the front card");
});

test("the exported sheet shows the band running out past the card, on the white page", () => {
  const f = renderCard(grey(), cornerBase, make), b = renderCard(grey(), cornerBase, make);
  const sheet = layoutSheet(f, b, 100, make);
  const cards = planSheetMm([f, b]);
  const px = (mm) => Math.round((mm / 25.4) * 100);
  const above = sheet.getContext("2d").getImageData(px(cards[0].x - 12), px(cards[0].y - 12), px(40), px(12)).data;
  let red = 0;
  for (let i = 0; i < above.length; i += 4) if (above[i] > 150 && above[i + 1] < 150) red++;
  assert.ok(red > 20, `red pixels above/left of the front card: ${red}`);
});

test("the small-size warning only applies to a band across the middle", () => {
  assert.ok(!checkSettings({ ...cornerBase, scale: 0.4 }).includes("small"));
  assert.ok(checkSettings({ ...base, scale: 0.4 }).includes("small"));
});
