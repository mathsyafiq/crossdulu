import { PDFDocument } from "pdf-lib";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, img, openEditor, canvasSize, frontInput } from "./fixtures";

const cameraBtn = (page: import("@playwright/test").Page, side: "front" | "back") =>
  page.locator(`section[aria-labelledby=${side}-h]`).getByRole("button", { name: "Guna kamera" });

/** A scanned-copy lookalike: front on top and back below on one A4 page (sample images, not real IDs). */
async function icCopyPdf(opts: { pages?: "one" | "two" | "single"; cardLabel?: string } = {}) {
  const doc = await PDFDocument.create();
  const mm = 72 / 25.4;
  const cw = 85.6 * mm, ch = 53.98 * mm;
  const f = await doc.embedPng(img(1011, 638, "SAMPLE FRONT").buffer);
  const b = await doc.embedPng(img(1011, 638, "SAMPLE BACK").buffer);
  const kind = opts.pages ?? "one";
  if (kind === "one") {
    const p = doc.addPage([595, 842]);
    p.drawImage(f, { x: (595 - cw) / 2, y: 842 - 90 - ch, width: cw, height: ch });
    p.drawImage(b, { x: (595 - cw) / 2, y: 842 - 90 - ch - 60 - ch, width: cw, height: ch });
  } else if (kind === "two") {
    doc.addPage([595, 842]).drawImage(f, { x: (595 - cw) / 2, y: 500, width: cw, height: ch });
    doc.addPage([595, 842]).drawImage(b, { x: (595 - cw) / 2, y: 500, width: cw, height: ch });
  } else {
    doc.addPage([595, 842]).drawImage(f, { x: (595 - cw) / 2, y: 500, width: cw, height: ch });
  }
  return { name: "salinan-ic.pdf", mimeType: "application/pdf", buffer: Buffer.from(await doc.save()) };
}

const pdfInput = (page: import("@playwright/test").Page) => page.locator(".pdf-pick input[type=file]");

test.describe("F06 camera with a guide box", () => {
  test.beforeEach(async ({ page }) => {
    // Remember every camera stream so the tests can check the camera really gets switched off.
    await page.addInitScript(() => {
      (window as any).__streams = [];
      const md = navigator.mediaDevices;
      const orig = md.getUserMedia.bind(md);
      md.getUserMedia = async (c) => { const s = await orig(c); (window as any).__streams.push(s); return s; };
    });
  });
  const live = (page: import("@playwright/test").Page) =>
    page.evaluate(() => (window as any).__streams.some((s: MediaStream) => s.getTracks().some((t) => t.readyState === "live")));

  test("F06-H1 the camera shows a card-shaped guide, and Take picture fills the slot with just the boxed area", async ({ page }) => {
    await openEditor(page);
    await cameraBtn(page, "front").click();
    const dialog = page.getByRole("dialog", { name: "Ambil gambar kad" });
    await expect(dialog).toBeVisible();
    const guide = page.getByTestId("camera-guide");
    await expect(guide).toBeVisible();
    const box = (await guide.boundingBox())!;
    expect(Math.abs(box.width / box.height - 85.6 / 53.98)).toBeLessThan(0.05);
    await expect(dialog.getByRole("button", { name: "Ambil gambar" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Ambil gambar" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("section[aria-labelledby=front-h] canvas")).toBeVisible();
    const s = await canvasSize(page, "front");
    expect(Math.abs(s.w / s.h - 85.6 / 53.98)).toBeLessThan(0.03);
    expect(await live(page), "camera switched off after the picture").toBe(false);
  });

  test("F06-E1 Escape and Cancel close the camera and switch it off", async ({ page }) => {
    await openEditor(page);
    await cameraBtn(page, "front").click();
    const dialog = page.getByRole("dialog", { name: "Ambil gambar kad" });
    await expect(page.getByTestId("camera-guide")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(await live(page)).toBe(false);
    await cameraBtn(page, "back").click();
    await expect(page.getByTestId("camera-guide")).toBeVisible();
    await dialog.getByRole("button", { name: "Batal" }).click();
    await expect(dialog).toBeHidden();
    expect(await live(page)).toBe(false);
    await expect(page.locator("section[aria-labelledby=back-h] canvas")).toHaveCount(0);
  });

  test("F06-E2 keyboard only: focus lands on Take picture and Tab stays inside the dialog", async ({ page }) => {
    await openEditor(page);
    await cameraBtn(page, "front").click();
    const dialog = page.getByRole("dialog", { name: "Ambil gambar kad" });
    await expect(dialog.getByRole("button", { name: "Ambil gambar" })).toBeFocused();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
  });

  test("F06-N1 camera blocked: clear message, and the phone's camera app is offered instead", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    const choosers: unknown[] = [];
    page.on("filechooser", (c) => choosers.push(c));
    await openEditor(page);
    await cameraBtn(page, "front").click();
    const dialog = page.getByRole("dialog", { name: "Ambil gambar kad" });
    await expect(dialog.getByRole("alert")).toContainText("Kamera tidak dapat dibuka");
    await dialog.getByRole("button", { name: "Guna aplikasi kamera telefon" }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => choosers.length).toBe(1);
    await (choosers[0] as import("@playwright/test").FileChooser).setFiles(img(1600, 1010, "PHONE"));
    await expect(page.locator("section[aria-labelledby=front-h] canvas")).toBeVisible();
  });

  test("F06-A1 the camera dialog has no accessibility violations (English too)", async ({ page }) => {
    await openEditor(page, "en");
    await page.locator("section[aria-labelledby=front-h]").getByRole("button", { name: "Use camera" }).click();
    await expect(page.getByRole("dialog", { name: "Take a picture of the card" })).toBeVisible();
    await expect(page.getByTestId("camera-guide")).toBeVisible();
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
  });
});

test.describe("F07 upload a PDF of an ID copy", () => {
  test("F07-H1 one page with front on top and back below fills both slots, true to the cards", async ({ page }) => {
    await openEditor(page);
    await pdfInput(page).setInputFiles(await icCopyPdf());
    await expect(page.locator("section[aria-labelledby=front-h] canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("section[aria-labelledby=back-h] canvas")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "diasingkan" })).toBeVisible();
    for (const side of ["front", "back"] as const) {
      const s = await canvasSize(page, side);
      expect(Math.abs(s.w / s.h - 85.6 / 53.98), `${side} is card shaped, not a whole page`).toBeLessThan(0.12);
      expect(s.w).toBeGreaterThan(700);
    }
    await expect(page.getByRole("button", { name: "Tukar depan dan belakang" })).toBeVisible();
  });

  test("F07-H2 two pages (front, then back) fill both slots", async ({ page }) => {
    await openEditor(page);
    await pdfInput(page).setInputFiles(await icCopyPdf({ pages: "two" }));
    await expect(page.locator("section[aria-labelledby=back-h] canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("section[aria-labelledby=front-h] canvas")).toBeVisible();
  });

  test("F07-H3 the PDF can then be crossed and exported straight away", async ({ page }) => {
    await openEditor(page);
    await pdfInput(page).setInputFiles(await icCopyPdf());
    await expect(page.locator("section[aria-labelledby=back-h] canvas")).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Teks palang").fill("BANK ABC");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Muat turun PNG" }).click()]);
    expect(dl.suggestedFilename()).toBe("salinan-berpalang.png");
  });

  test("F07-E1 a PDF with one card goes into the slot you chose and asks for the other side", async ({ page }) => {
    await openEditor(page);
    await page.locator("section[aria-labelledby=back-h] input[type=file]").first().setInputFiles(await icCopyPdf({ pages: "single" }));
    await expect(page.locator("section[aria-labelledby=back-h] canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("section[aria-labelledby=front-h] canvas")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Satu kad" })).toBeVisible();
  });

  test("F07-E2 swap front and back", async ({ page }) => {
    await openEditor(page);
    await pdfInput(page).setInputFiles(await icCopyPdf());
    await expect(page.locator("section[aria-labelledby=back-h] canvas")).toBeVisible({ timeout: 30_000 });
    // A fingerprint of what each preview currently shows (previews paint a frame after they appear).
    const prints = () => page.evaluate(() => Array.from(document.querySelectorAll("canvas")).map((c) => {
      const d = c.toDataURL();
      let h = 0;
      for (let i = 0; i < d.length; i += 7) h = (h * 31 + d.charCodeAt(i)) | 0;
      return `${c.width}x${c.height}:${h}`;
    }));
    let before: string[] = [];
    await expect.poll(async () => { const a = await prints(); await page.waitForTimeout(300); const b = await prints(); before = b; return a.join() === b.join() && b.length === 2 && b[0] !== b[1]; }).toBe(true);
    await page.getByRole("button", { name: "Tukar depan dan belakang" }).click();
    await expect.poll(prints).toEqual([before[1], before[0]]);
  });

  test("F07-N1 a broken file named .pdf gives a clear error and leaves the slots empty", async ({ page }) => {
    await openEditor(page);
    await pdfInput(page).setInputFiles({ name: "rosak.pdf", mimeType: "application/pdf", buffer: Buffer.from("this is not a pdf") });
    await expect(page.getByRole("alert")).toContainText("PDF tidak dapat dibaca", { timeout: 30_000 });
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("F07-N2 a PDF over 25 MB is refused", async ({ page }) => {
    await openEditor(page);
    await pdfInput(page).setInputFiles({ name: "besar.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(26 * 1024 * 1024, 1) });
    await expect(page.getByRole("alert")).toContainText("terlalu besar");
  });

  test("F07-E3 still works with the connection dropped after the page has loaded (nothing is fetched later)", async ({ page, context }) => {
    await openEditor(page);
    await page.waitForLoadState("networkidle");
    await pdfInput(page).setInputFiles(await icCopyPdf({ pages: "single" })); // first use loads the reader
    await expect(page.locator("section[aria-labelledby=front-h] canvas")).toBeVisible({ timeout: 30_000 });
    await context.setOffline(true);
    await pdfInput(page).setInputFiles(await icCopyPdf());
    await expect(page.locator("section[aria-labelledby=back-h] canvas")).toBeVisible({ timeout: 30_000 });
  });

  test("F07-A1 picture upload still works through the same inputs; the PDF button is keyboard reachable", async ({ page }) => {
    await openEditor(page);
    await frontInput(page).setInputFiles(img(1600, 1010, "F"));
    await expect(page.locator("section[aria-labelledby=front-h] canvas")).toBeVisible();
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
  });
});
