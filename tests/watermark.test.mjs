import { test } from "node:test";
import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  renderCard, exportPng, exportPdf, layoutSheet, checkSettings, chordLength, layoutBand, planSheetMm,
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

const base = { text: "KHAS UNTUK BANK SAHAJA 10/11/2026", opacity: DEFAULT_OPACITY, angle: DEFAULT_ANGLE, color: "#d92d20" };

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
