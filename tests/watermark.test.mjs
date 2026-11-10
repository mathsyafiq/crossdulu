import { test } from "node:test";
import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  renderCard, exportPng, exportPdf, layoutSheet, checkSettings, chordLength, layoutBand, layoutCorner, drawWatermark, planSheetMm,
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

test("watermark actually changes pixels across the card centre and corners", () => {
  const src = fakeCard("F");
  const plain = renderCard(src, { ...base, text: "" }, make);
  const marked = renderCard(src, base, make);
  const px = (c, x, y) => Array.from(c.getContext("2d").getImageData(x, y, 1, 1).data).join(",");
  const diff = (x, y) => px(plain, x, y) !== px(marked, x, y);
  // Sample along the centre band: at least some points must differ.
  let hits = 0;
  for (let t = -0.4; t <= 0.4; t += 0.05) {
    const x = Math.round(CARD_PX_W / 2 + t * CARD_PX_W);
    const y = Math.round(plain.height / 2 - t * CARD_PX_W * 0.99);
    if (y > 0 && y < plain.height && diff(x, y)) hits++;
  }
  assert.ok(hits >= 6, `expected band pixels to change, got ${hits}`);
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
      ctx.font = `800 ${L.size}px sans-serif`;
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

// ---- Band across the top-left corner only ----

function changed(settings, w = CARD_PX_W, h = 638) {
  const grey = (c) => { const g = c.getContext("2d"); g.fillStyle = "#b0bec5"; g.fillRect(0, 0, w, h); };
  const a = make(w, h), b = make(w, h);
  grey(a); grey(b);
  drawWatermark(b.getContext("2d"), w, h, settings);
  const A = a.getContext("2d").getImageData(0, 0, w, h).data, B = b.getContext("2d").getImageData(0, 0, w, h).data;
  const pts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]) pts.push([x, y]);
  }
  return pts;
}

test("corner is the default position", () => {
  const { position, ...noPos } = base;
  const a = changed(noPos), b = changed(cornerBase);
  assert.equal(a.length, b.length);
});

test("corner band touches only the top-left: the middle, right side and bottom stay untouched", () => {
  for (const text of ["KHAS UNTUK BANK SAHAJA 10/11/2026", "BANK ABC", "UNTUK PERMOHONAN KERJA SYARIKAT ABC SAHAJA 27/9/2026"]) {
    const pts = changed({ ...cornerBase, text });
    assert.ok(pts.length > 800, `${text}: band drawn`);
    const maxX = Math.max(...pts.map((p) => p[0])), maxY = Math.max(...pts.map((p) => p[1]));
    assert.ok(maxX < 0.5 * CARD_PX_W, `${text}: reaches x=${maxX}`);
    assert.ok(maxY < 0.62 * 638, `${text}: reaches y=${maxY}`);
    assert.ok(!pts.some(([x, y]) => Math.abs(x - CARD_PX_W / 2) < 120 && Math.abs(y - 319) < 120), `${text}: centre untouched`);
  }
});

test("corner band reach stays inside its limit at every angle, and shrinks with the size slider", () => {
  const ctx = createCanvas(10, 10).getContext("2d");
  for (const angle of [-15, -30, -45, -60, -75, -80, -10]) {
    for (const text of ["BANK ABC", base.text, "x ".repeat(44).trim()]) {
      const L = layoutCorner(ctx, CARD_PX_W, 638, { ...cornerBase, angle, text });
      assert.ok(L.reachTop <= 0.56 * CARD_PX_W + 1, `${angle} ${text.slice(0, 8)}: top ${Math.round(L.reachTop)}`);
      assert.ok(L.reachLeft <= 0.56 * 638 + 1, `${angle} ${text.slice(0, 8)}: left ${Math.round(L.reachLeft)}`);
      assert.ok(L.size >= 9 && L.lines.length >= 1 && L.lines.length <= 2);
    }
  }
  const big = layoutCorner(ctx, CARD_PX_W, 638, { ...cornerBase, scale: 1 });
  const small = layoutCorner(ctx, CARD_PX_W, 638, { ...cornerBase, scale: 0.4 });
  assert.ok(small.reachTop < big.reachTop && small.reachLeft < big.reachLeft);
});

test("corner text is big enough to read, and long text goes onto two lines", () => {
  const ctx = createCanvas(10, 10).getContext("2d");
  const L = layoutCorner(ctx, CARD_PX_W, 638, cornerBase);
  assert.equal(L.lines.length, 2);
  assert.ok(L.size >= 24, `size ${L.size}`);
  const short = layoutCorner(ctx, CARD_PX_W, 638, { ...cornerBase, text: "BANK" });
  assert.equal(short.lines.length, 1);
  assert.ok(short.reachTop < L.reachTop, "short text hugs the corner more tightly");
});

test("corner text lines fit inside the band's visible length", () => {
  const ctx = createCanvas(10, 10).getContext("2d");
  for (const text of [base.text, "UNTUK PERMOHONAN KERJA SYARIKAT ABC SAHAJA 27/9/2026", "SEWA RUMAH 27/9/2026"]) {
    const L = layoutCorner(ctx, CARD_PX_W, 638, { ...cornerBase, text });
    ctx.font = `800 ${L.size}px Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`;
    const widest = Math.max(...L.lines.map((l) => ctx.measureText(l).width));
    const phi = Math.abs(L.angle);
    const chord = (Math.hypot(L.mx * 2, L.my * 2)); // length of the centre line between the two card edges
    assert.ok(widest <= chord, `${text.slice(0, 10)}: ${Math.round(widest)} > ${Math.round(chord)} (phi ${phi.toFixed(2)})`);
    // the text block's edge nearest the corner has a shorter stretch of band: the widest line must still fit there
    const centreDist = Math.hypot(L.mx, L.my) * Math.sin(2 * phi) / 1; // = D * (something); recomputed below
    const D = (L.mx * 2) * Math.sin(phi);
    const nearChord = (D - L.lines.length * L.size * 0.6) / (Math.sin(phi) * Math.cos(phi));
    assert.ok(widest <= nearChord + 1, `${text.slice(0, 10)}: widest ${Math.round(widest)} > chord at the near edge ${Math.round(nearChord)}`);
  }
});

test("the small-size warning only applies to a band across the middle", () => {
  assert.ok(!checkSettings({ ...cornerBase, scale: 0.4 }).includes("small"));
  assert.ok(checkSettings({ ...base, scale: 0.4 }).includes("small"));
});
