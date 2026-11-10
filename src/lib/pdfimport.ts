// Reads a PDF of an ID copy in the browser (pdf.js, loaded only when needed) and returns the card pictures.
// Nothing is uploaded: the file is read from memory, drawn to a canvas and cropped.
import { findCards, type Rect } from "./capture";
import { LoadFailure, MAX_FILE_BYTES, MAX_SOURCE_EDGE, browserSurface, type Surface } from "./watermark";

const RENDER_EDGE = 3600; // long edge in px when drawing the page: a card on an A4 page comes out near 300 dpi
const DETECT_EDGE = 800; // card finding runs on a small copy of the page

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

let reader: Promise<{ pdfjs: any; worker: any }> | null = null;
function loadReader() {
  reader ??= (async () => {
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.min.mjs");
    // @ts-ignore Vite turns this into the URL of the bundled worker file
    const url: string = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = url;
    // One worker for the whole visit: later PDFs then need no network at all.
    return { pdfjs, worker: new pdfjs.PDFWorker() };
  })().catch((e) => { reader = null; throw e; });
  return reader;
}

/** Start loading the PDF reader in the background (called when the user reaches for the PDF button). */
export function preloadPdfReader(): void {
  void loadReader().catch(() => {});
}

async function renderPage(doc: any, n: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(n);
  const v1 = page.getViewport({ scale: 1 });
  const scale = Math.min(6, RENDER_EDGE / Math.max(v1.width, v1.height));
  const viewport = page.getViewport({ scale });
  const canvas = browserSurface(Math.ceil(viewport.width), Math.ceil(viewport.height)) as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport, background: "#ffffff" }).promise;
  page.cleanup();
  return canvas;
}

function detect(canvas: HTMLCanvasElement): Rect[] {
  const k = Math.min(1, DETECT_EDGE / Math.max(canvas.width, canvas.height));
  const small = browserSurface(Math.max(1, Math.round(canvas.width * k)), Math.max(1, Math.round(canvas.height * k))) as HTMLCanvasElement;
  const sctx = small.getContext("2d")!;
  sctx.drawImage(canvas, 0, 0, small.width, small.height);
  const img = sctx.getImageData(0, 0, small.width, small.height);
  return findCards(img).map((r) => ({
    x: Math.max(0, Math.round(r.x / k)), y: Math.max(0, Math.round(r.y / k)),
    w: Math.min(canvas.width, Math.round(r.w / k)), h: Math.min(canvas.height, Math.round(r.h / k)),
  }));
}

function crop(canvas: HTMLCanvasElement, r: Rect): Surface {
  const k = Math.min(1, MAX_SOURCE_EDGE / Math.max(r.w, r.h));
  const out = browserSurface(Math.max(1, Math.round(r.w * k)), Math.max(1, Math.round(r.h * k)));
  out.getContext("2d").drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, out.width, out.height);
  return out;
}

const whole = (c: HTMLCanvasElement): Rect => ({ x: 0, y: 0, w: c.width, h: c.height });

/**
 * One page with two cards gives [front, back] (top to bottom).
 * One card on page 1 plus a card on page 2 also gives two. Otherwise one picture.
 */
export async function importPdf(file: File): Promise<Surface[]> {
  if (file.size > MAX_FILE_BYTES) throw new LoadFailure("size");
  let doc: any;
  try {
    const { pdfjs, worker } = await loadReader();
    const data = new Uint8Array(await file.arrayBuffer());
    // Features that need eval, extra network fetches or font loading are off: the page's security policy forbids them.
    doc = await pdfjs.getDocument({ data, worker, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  } catch (e: any) {
    throw new LoadFailure(e?.name === "PasswordException" ? "password" : "pdf");
  }
  try {
    const first = await renderPage(doc, 1);
    const found = detect(first);
    if (found.length >= 2) return [crop(first, found[0]), crop(first, found[1])];
    const one = crop(first, found[0] ?? whole(first));
    first.width = 0;
    if (doc.numPages >= 2) {
      const second = await renderPage(doc, 2);
      const f2 = detect(second);
      const two = crop(second, f2[0] ?? whole(second));
      second.width = 0;
      return [one, two];
    }
    return [one];
  } catch (e) {
    if (e instanceof LoadFailure) throw e;
    throw new LoadFailure("pdf");
  } finally {
    doc.destroy();
  }
}
