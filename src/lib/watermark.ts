// Watermark engine. Pure canvas code, no network, no storage.
// The canvas factory is injectable so the same code runs in the browser and in Node tests.

export interface Surface {
  width: number;
  height: number;
  getContext(type: "2d"): any;
}
export type MakeSurface = (w: number, h: number) => Surface;

export interface Settings {
  text: string;
  opacity: number; // 0.1 - 1
  angle: number; // degrees, default -45
  color: string;
  scale?: number; // 0.4 - 1, size of the band and text (in the corner: how far it reaches), default 1
  position?: Position; // "corner" (default): across the top-left corner only. "middle": across the whole card.
  hx?: number; // 0 - 1: slides the corner band along the card, left to right (0 = in the corner)
  vy?: number; // 0 - 1: slides the corner band down the card, top to bottom (0 = in the corner)
}
export type Position = "corner" | "middle";
export const DEFAULT_POSITION: Position = "corner";

export const CARD_MM_W = 85.6; // ID-1 card width
export const CARD_PX_W = 1011; // 300 dpi
export const A4_MM = { w: 210, h: 297 };
export const MAX_SOURCE_EDGE = 2400;
export const MAX_CARD_PX_H = 2200; // cap for very tall images
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const DEFAULT_ANGLE = -45;
export const DEFAULT_OPACITY = 0.6;
export const DEFAULT_SCALE = 1;
export const MIN_SCALE = 0.4;
export const SMALL_SCALE_WARN = 0.6;

// Colours drawn onto the ID image (see tokens.json "watermark").
export const WATERMARK_COLORS = ["#d92d20", "#111111", "#1d4ed8"] as const;
export const WATERMARK_HALO = "#ffffff";
const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export const browserSurface: MakeSurface = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

export type LoadError = "type" | "size" | "decode" | "pdf" | "password";
export class LoadFailure extends Error {
  code: LoadError;
  constructor(code: LoadError) {
    super(code);
    this.code = code;
  }
}

/** Decode a user file to a canvas, EXIF-rotated and downscaled. Never uploads anything. */
export async function loadImage(file: File, make: MakeSurface = browserSurface): Promise<Surface> {
  if (!file.type.startsWith("image/")) throw new LoadFailure("type");
  if (file.size > MAX_FILE_BYTES) throw new LoadFailure("size");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try {
      bmp = await createImageBitmap(file);
    } catch {
      throw new LoadFailure("decode");
    }
  }
  const scale = Math.min(1, MAX_SOURCE_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const out = make(w, h);
  out.getContext("2d").drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return out;
}

export type Warning = "empty" | "faint" | "heavy" | "small";
export function checkSettings(s: Settings): Warning[] {
  const w: Warning[] = [];
  if (!s.text.trim()) w.push("empty");
  if (s.opacity < 0.35) w.push("faint");
  if (s.opacity > 0.85) w.push("heavy");
  if ((s.position ?? DEFAULT_POSITION) === "middle" && (s.scale ?? DEFAULT_SCALE) < SMALL_SCALE_WARN) w.push("small");
  return w;
}

/** Length of the band's centre line that is actually visible inside a w x h card at this angle. */
export function chordLength(w: number, h: number, angleDeg: number): number {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const toEdge = Math.min(c < 1e-6 ? Infinity : w / 2 / c, s < 1e-6 ? Infinity : h / 2 / s);
  return 2 * toEdge;
}

export interface BandLayout {
  size: number; // font px
  band: number; // distance between the two lines, px
  line: string; // the text actually drawn
  chord: number;
  repeated: boolean;
}

/** Sizes the text so one full copy fits the visible band; repeats short text so a crop still carries it. */
export function layoutBand(ctx: any, w: number, h: number, s: Settings): BandLayout {
  const text = s.text.trim();
  const chord = chordLength(w, h, s.angle);
  const fit = chord * 0.94;
  const scale = Math.min(1, Math.max(MIN_SCALE, s.scale ?? DEFAULT_SCALE));
  const base = Math.max(10, Math.round(h * 0.11 * scale));
  ctx.font = `800 ${base}px ${FONT}`;
  const one = ctx.measureText(text).width;
  let size = one > fit ? Math.max(14, Math.floor((base * fit) / one)) : base;
  ctx.font = `800 ${size}px ${FONT}`;
  let width = ctx.measureText(text).width;
  // Text width is not exactly linear in font size (hinting, fallback fonts): re-measure and tighten until it fits.
  for (let i = 0; i < 8 && width > fit && size > 10; i++) {
    size = Math.max(10, Math.min(size - 1, Math.floor((size * fit) / width)));
    ctx.font = `800 ${size}px ${FONT}`;
    width = ctx.measureText(text).width;
  }
  let line = text;
  let repeated = false;
  if (width < fit * 0.6) {
    const unit = `${text}   •   `;
    const unitW = ctx.measureText(unit).width;
    const n = Math.max(2, Math.ceil(chord / unitW));
    line = unit.repeat(n).trimEnd();
    repeated = true;
  }
  const band = Math.round(size * 2.3);
  return { size, band, line, chord, repeated };
}


export interface Bleed { l: number; t: number; r: number; b: number }

export interface CornerLayout {
  size: number; // font px
  line: string; // the text, always on one line
  band: number; // distance between the two lines, px
  len: number; // length of the two lines, px
  mx: number; // middle of the band, px from the card's top-left
  my: number;
  angle: number; // radians
  /** How far the band sticks out past each edge of the card, px. */
  bleed: Bleed;
}

/** The band may stick out of the card by at most this share of the card's shorter side. */
export const MAX_BLEED = 0.3;

/**
 * Lays one line of text, between two parallel lines, across the top-left corner of the card.
 * The band is allowed to run out past the card's edges (the card is drawn with extra room for it),
 * so the part over the card stays small and clear of the face, name and ID number.
 * The text size follows the size slider; it is only reduced when the band would stick out too far.
 */
export function layoutCorner(ctx: any, w: number, h: number, s: Settings): CornerLayout {
  const text = s.text.trim().replace(/\s+/g, " ");
  const scale = Math.min(1, Math.max(MIN_SCALE, s.scale ?? DEFAULT_SCALE));
  const phi = (Math.min(75, Math.max(15, Math.abs(s.angle))) * Math.PI) / 180;
  const sin = Math.sin(phi), cos = Math.cos(phi);
  const limit = MAX_BLEED * Math.min(w, h);
  const hx = Math.min(1, Math.max(0, s.hx ?? 0)), vy = Math.min(1, Math.max(0, s.vy ?? 0));
  let size = Math.max(9, h * 0.065 * scale);
  for (let i = 0; i < 40; i++) {
    ctx.font = `800 ${size}px ${FONT}`;
    const width = ctx.measureText(text).width;
    const band = size * 1.5;
    const len = width + size * 1.2;
    const D = 2.5 * size; // the band's middle line is this far from the corner
    const mx0 = D / sin / 2, my0 = D / cos / 2; // middle of the band when it sits in the corner
    // The sliders move it along the card, from the corner to the opposite side (never past the same distance from that side).
    const mx = mx0 + hx * Math.max(0, w - 2 * mx0), my = my0 + vy * Math.max(0, h - 2 * my0);
    // The band's four corners: the middle point, half the length along it, half the thickness across it.
    const ux = cos, uy = -sin, nx = sin, ny = cos;
    const xs: number[] = [], ys: number[] = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      xs.push(mx + a * (len / 2) * ux + b * (band / 2) * nx);
      ys.push(my + a * (len / 2) * uy + b * (band / 2) * ny);
    }
    const bleed: Bleed = {
      l: Math.max(0, Math.ceil(-Math.min(...xs))),
      t: Math.max(0, Math.ceil(-Math.min(...ys))),
      r: Math.max(0, Math.ceil(Math.max(...xs) - w)),
      b: Math.max(0, Math.ceil(Math.max(...ys) - h)),
    };
    if (Math.max(bleed.l, bleed.t, bleed.r, bleed.b) <= limit || size <= 9) {
      return { size: Math.round(size * 10) / 10, line: text, band: Math.round(band), len: Math.round(len), mx, my, angle: -phi, bleed };
    }
    size = Math.max(9, size * 0.95);
  }
  throw new Error("unreachable");
}

function drawCorner(ctx: any, w: number, h: number, s: Settings): void {
  const L = layoutCorner(ctx, w, h, s);
  ctx.save();
  ctx.translate(L.mx, L.my);
  ctx.rotate(L.angle);
  ctx.globalAlpha = s.opacity;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = Math.max(2, Math.round(h * 0.008 * Math.min(1, Math.max(MIN_SCALE, s.scale ?? DEFAULT_SCALE))));
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-L.len / 2, (side * L.band) / 2);
    ctx.lineTo(L.len / 2, (side * L.band) / 2);
    ctx.stroke();
  }
  ctx.font = `800 ${L.size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = WATERMARK_HALO;
  ctx.lineWidth = Math.max(3, L.size * 0.16);
  ctx.strokeText(L.line, 0, 0);
  ctx.fillStyle = s.color;
  ctx.fillText(L.line, 0, 0);
  ctx.restore();
}

/** Draws the band: two parallel lines with the text between them. */
export function drawWatermark(ctx: any, w: number, h: number, s: Settings): void {
  if (!s.text.trim()) return;
  if ((s.position ?? DEFAULT_POSITION) === "corner") return drawCorner(ctx, w, h, s);
  ctx.save();
  const L = layoutBand(ctx, w, h, s);
  const diag = Math.hypot(w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate((s.angle * Math.PI) / 180);
  ctx.globalAlpha = s.opacity;

  ctx.strokeStyle = s.color;
  ctx.lineWidth = Math.max(2, Math.round(h * 0.008 * Math.min(1, Math.max(MIN_SCALE, s.scale ?? DEFAULT_SCALE))));
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-diag / 2, (side * L.band) / 2);
    ctx.lineTo(diag / 2, (side * L.band) / 2);
    ctx.stroke();
  }

  ctx.font = `800 ${L.size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = WATERMARK_HALO;
  ctx.lineWidth = Math.max(3, L.size * 0.16);
  ctx.strokeText(L.line, 0, 0);
  ctx.fillStyle = s.color;
  ctx.fillText(L.line, 0, 0);
  ctx.restore();
}

/** One function for preview and export, so what you see is what you download. Keeps the photo's aspect ratio. */
export function renderCard(source: Surface | ImageBitmap, s: Settings, make: MakeSurface = browserSurface): Surface {
  const sw = (source as any).width as number;
  const sh = (source as any).height as number;
  let w = CARD_PX_W;
  let h = Math.max(1, Math.round((w * sh) / sw));
  if (h > MAX_CARD_PX_H) {
    h = MAX_CARD_PX_H;
    w = Math.max(1, Math.round((h * sw) / sh));
  }
  let bleed: Bleed = { l: 0, t: 0, r: 0, b: 0 };
  if (s.text.trim() && (s.position ?? DEFAULT_POSITION) === "corner") bleed = layoutCorner(make(1, 1).getContext("2d"), w, h, s).bleed;
  const out = make(w + bleed.l + bleed.r, h + bleed.t + bleed.b);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.translate(bleed.l, bleed.t);
  ctx.drawImage(source as any, 0, 0, w, h);
  drawWatermark(ctx, w, h, s);
  (out as any).bleed = bleed;
  return out;
}

/** Where the card itself sits inside a rendered surface (the band may add room around it). */
export function cardBox(c: { width: number; height: number; bleed?: Bleed }): { x: number; y: number; w: number; h: number } {
  const b = c.bleed ?? { l: 0, t: 0, r: 0, b: 0 };
  return { x: b.l, y: b.t, w: c.width - b.l - b.r, h: c.height - b.t - b.b };
}

export async function encode(surface: Surface, type: "png" | "jpeg" = "png"): Promise<Uint8Array> {
  const s: any = surface;
  if (typeof s.toBlob === "function") {
    const blob: Blob | null = await new Promise((res) => s.toBlob(res, `image/${type}`, 0.92));
    if (!blob) throw new Error("encode failed");
    return new Uint8Array(await blob.arrayBuffer());
  }
  if (typeof s.encode === "function") {
    return new Uint8Array(await (type === "png" ? s.encode("png") : s.encode("jpeg", 92)));
  }
  throw new Error("unsupported surface");
}

const mmToPx = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);

export interface RectMm { x: number; y: number; w: number; h: number }

/**
 * Places the two cards on an A4 page (millimetres, y from the top).
 * Normal cards are 85.6 mm wide (true size). A card that would be too tall (portrait photos)
 * is scaled down to fit, never squashed.
 */
export function planSheetMm(cards: { width: number; height: number; bleed?: Bleed }[]): RectMm[] {
  const top = 28, gap = 28, bottom = 10; // room above each card for a band that runs out past its corner
  const maxH = (A4_MM.h - top - bottom - gap * (cards.length - 1)) / cards.length;
  const rects: RectMm[] = [];
  let y = top;
  for (const surface of cards) {
    const c = cardBox(surface);
    let w = CARD_MM_W;
    let h = (w * c.h) / c.w;
    if (h > maxH) {
      h = maxH;
      w = (h * c.w) / c.h;
    }
    rects.push({ x: (A4_MM.w - w) / 2, y, w, h });
    y += h + gap;
  }
  return rects;
}

/** The rectangle (mm) for the whole rendered surface, given the rectangle of the card inside it. */
export function surfaceRectMm(c: { width: number; height: number; bleed?: Bleed }, card: RectMm): RectMm {
  const box = cardBox(c);
  const k = card.w / box.w;
  return { x: card.x - box.x * k, y: card.y - box.y * k, w: c.width * k, h: c.height * k };
}

/** Lay front on top and back below on one A4 sheet. */
export function layoutSheet(front: Surface, back: Surface, dpi: number, make: MakeSurface = browserSurface): Surface {
  const W = mmToPx(A4_MM.w, dpi);
  const H = mmToPx(A4_MM.h, dpi);
  const sheet = make(W, H);
  const ctx = sheet.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingQuality = "high";
  const rects = planSheetMm([front, back]);
  [front, back].forEach((c, i) => {
    const r = surfaceRectMm(c, rects[i]);
    ctx.drawImage(c as any, mmToPx(r.x, dpi), mmToPx(r.y, dpi), mmToPx(r.w, dpi), mmToPx(r.h, dpi));
  });
  return sheet;
}

export async function exportPng(front: Surface, back: Surface, make: MakeSurface = browserSurface): Promise<Uint8Array> {
  try {
    return await encode(layoutSheet(front, back, 300, make), "png");
  } catch {
    // Low-memory phones: fall back to 150 dpi.
    return await encode(layoutSheet(front, back, 150, make), "png");
  }
}

/** Start loading the PDF library early, so PDF export still works if the connection drops later. */
export function preloadPdf(): void {
  void import("pdf-lib").catch(() => {});
}

export async function exportPdf(front: Surface, back: Surface): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const pt = (mm: number) => (mm / 25.4) * 72;
  const rects = planSheetMm([front, back]);
  for (const [i, c] of [front, back].entries()) {
    const r = surfaceRectMm(c, rects[i]);
    const img = await pdf.embedPng(await encode(c, "png"));
    page.drawImage(img, { x: pt(r.x), y: 841.89 - pt(r.y) - pt(r.h), width: pt(r.w), height: pt(r.h) });
  }
  pdf.setTitle("Salinan berpalang");
  return await pdf.save();
}

export function download(bytes: Uint8Array, name: string, mime: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
