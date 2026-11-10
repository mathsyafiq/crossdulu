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
  scale?: number; // 0.4 - 1, size of the band and text, default 1
}

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

export type LoadError = "type" | "size" | "decode";
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
  if ((s.scale ?? DEFAULT_SCALE) < SMALL_SCALE_WARN) w.push("small");
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

/** Draws the band: two parallel lines with the text between them. */
export function drawWatermark(ctx: any, w: number, h: number, s: Settings): void {
  if (!s.text.trim()) return;
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
  const out = make(w, h);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source as any, 0, 0, w, h);
  drawWatermark(ctx, w, h, s);
  return out;
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
export function planSheetMm(cards: { width: number; height: number }[]): RectMm[] {
  const top = 20, gap = 12, bottom = 10;
  const maxH = (A4_MM.h - top - bottom - gap * (cards.length - 1)) / cards.length;
  const rects: RectMm[] = [];
  let y = top;
  for (const c of cards) {
    let w = CARD_MM_W;
    let h = (w * c.height) / c.width;
    if (h > maxH) {
      h = maxH;
      w = (h * c.width) / c.height;
    }
    rects.push({ x: (A4_MM.w - w) / 2, y, w, h });
    y += h + gap;
  }
  return rects;
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
    const r = rects[i];
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
    const r = rects[i];
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
