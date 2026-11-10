import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { test, expect, img, openEditor, loadBoth, frontInput, backInput, paintedPixels, isRed, isBlue, canvasSize } from "./fixtures";
import type { Page } from "@playwright/test";

const PNG_BTN = /Muat turun PNG/;
const PDF_BTN = /Muat turun PDF/;

async function save(page: Page, button: RegExp, path: string) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: button }).click()]);
  await dl.saveAs(path);
  return { bytes: readFileSync(path), name: dl.suggestedFilename() };
}
const isPng = (b: Buffer) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
const isPdf = (b: Buffer) => b.subarray(0, 5).toString() === "%PDF-";
const out = (n: string) => `${process.env.E2E_TMP || "/tmp/palang-e2e"}/${n}`;

test.describe("F01 happy paths", () => {
  test("F01-H1 full flow to PNG", async ({ page }) => {
    await openEditor(page);
    await expect(page.locator("#wm-text")).toBeHidden(); // settings need both sides
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("KHAS UNTUK BANK ABC SAHAJA");
    const { bytes, name } = await save(page, PNG_BTN, out("h1.png"));
    expect(isPng(bytes)).toBe(true);
    expect(name).toBe("salinan-berpalang.png");
    await expect(page.getByRole("status")).toContainText("dimuat turun");
  });

  test("F01-H2 full flow to PDF", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("KHAS UNTUK SEWA RUMAH");
    const { bytes } = await save(page, PDF_BTN, out("h2.pdf"));
    expect(isPdf(bytes)).toBe(true);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  test("F01-H3 preset fills the text", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.getByRole("button", { name: "KHAS UNTUK PERMOHONAN KERJA" }).click();
    await expect(page.getByLabel("Teks palang")).toHaveValue("KHAS UNTUK PERMOHONAN KERJA");
    await expect(page.getByRole("button", { name: "KHAS UNTUK PERMOHONAN KERJA" })).toHaveAttribute("aria-pressed", "true");
  });

  test("F01-H4 colour choice changes the watermark colour", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("BANK ABC");
    await page.waitForTimeout(250);
    expect(await paintedPixels(page, "front", isBlue)).toBeLessThan(50);
    await page.getByRole("radio", { name: "Biru" }).click();
    await page.waitForTimeout(250);
    expect(await paintedPixels(page, "front", isBlue)).toBeGreaterThan(1500);
    expect(await paintedPixels(page, "front", isRed)).toBeLessThan(50);
  });

  test("F01-H5 size and angle sliders update the preview and labels", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("BANK ABC");
    await page.waitForTimeout(250);
    const base = await paintedPixels(page, "front", isRed);
    await page.locator("#wm-sz").fill("50");
    await page.locator("#wm-an").fill("-30");
    await page.waitForTimeout(250);
    await expect(page.getByText("Saiz palang: 50%")).toBeVisible();
    await expect(page.getByText("Sudut: -30°")).toBeVisible();
    expect(await paintedPixels(page, "front", isRed)).toBeLessThan(base);
  });
});

test.describe("F01 edge cases", () => {
  test("F01-E1 90 character text exports", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    const long = "KHAS UNTUK PERMOHONAN PINJAMAN PERUMAHAN BANK ABC CAWANGAN KUALA LUMPUR SAHAJA 10/11/2026 XX".slice(0, 90);
    await page.getByLabel("Teks palang").fill(long);
    expect(await page.getByLabel("Teks palang").inputValue()).toHaveLength(90);
    expect(isPng((await save(page, PNG_BTN, out("e1.png"))).bytes)).toBe(true);
  });

  test("F01-E2 accents and emoji do not break rendering", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("UNTUK PERMOHONAN ÑÉÜ 🙂 SAHAJA");
    await page.waitForTimeout(250);
    expect(await paintedPixels(page, "front", isRed)).toBeGreaterThan(1000);
    expect(isPdf((await save(page, PDF_BTN, out("e2.pdf"))).bytes)).toBe(true);
  });

  test("F01-E3 tiny image", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page, img(20, 12, "F"), img(20, 12, "B"));
    await page.getByLabel("Teks palang").fill("BANK ABC");
    expect(isPng((await save(page, PNG_BTN, out("e3.png"))).bytes)).toBe(true);
  });

  test("F01-E4 huge image is downscaled and still exports", async ({ page }) => {
    test.setTimeout(90_000);
    await openEditor(page);
    const t0 = Date.now();
    await loadBoth(page, img(6000, 4000, "BIGF"), img(6000, 4000, "BIGB"));
    await page.getByLabel("Teks palang").fill("BANK ABC");
    expect(isPng((await save(page, PNG_BTN, out("e4.png"))).bytes)).toBe(true);
    expect(Date.now() - t0).toBeLessThan(40_000);
  });

  test("F01-E5 portrait photo keeps its aspect ratio", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page, img(1000, 2000, "PF"), img(1000, 2000, "PB"));
    await page.getByLabel("Teks palang").fill("BANK ABC");
    await page.waitForTimeout(300);
    const { w, h } = await canvasSize(page, "front");
    expect(Math.abs(w / h - 0.5)).toBeLessThan(0.02);
  });

  test("F01-E6 extreme panorama fits and exports", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page, img(4000, 300, "WF"), img(4000, 300, "WB"));
    await page.getByLabel("Teks palang").fill("BANK ABC");
    expect(isPng((await save(page, PNG_BTN, out("e6.png"))).bytes)).toBe(true);
  });

  test("F01-E7 double click on download gives exactly one file", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("BANK ABC");
    let n = 0;
    page.on("download", () => n++);
    await page.getByRole("button", { name: PNG_BTN }).dblclick();
    await page.waitForTimeout(2500);
    expect(n).toBe(1);
  });

  test("F01-E8 replacing an image keeps the settings", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("BANK ABC");
    await frontInput(page).setInputFiles(img(1200, 800, "NEWFRONT"));
    await page.waitForTimeout(300);
    await expect(page.getByLabel("Teks palang")).toHaveValue("BANK ABC");
    expect(await paintedPixels(page, "front", isRed)).toBeGreaterThan(1000);
  });

  test("F01-E9 removing an image closes the settings", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.getByRole("button", { name: "Buang" }).first().click();
    await expect(page.locator("#wm-text")).toBeHidden();
    await expect(page.getByText("Tambah kedua-dua depan dan belakang")).toBeVisible();
  });

  test("F01-E10 reload clears images but keeps consent", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.reload();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("F01-E11 connection drops after the page has loaded: everything still works, including PDF", async ({ page, context }) => {
    await openEditor(page);
    await page.waitForLoadState("networkidle"); // the PDF library is preloaded once the editor opens
    await context.setOffline(true);
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("BANK ABC");
    expect(isPdf((await save(page, PDF_BTN, out("e11.pdf"))).bytes)).toBe(true);
  });

  test("F01-E12 keyboard only", async ({ page }) => {
    // Register the chooser listener before any key press: registering it per press races Playwright's interception.
    const choosers: import("@playwright/test").FileChooser[] = [];
    page.on("filechooser", (c) => choosers.push(c));
    const nextChooser = async (n: number) => { await expect.poll(() => choosers.length).toBeGreaterThanOrEqual(n); return choosers[n - 1]; };
    await openEditor(page);
    const focusFileInput = async (side: "front" | "back") => {
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press("Tab");
        const ok = await page.evaluate((s) => {
          const a = document.activeElement as HTMLInputElement;
          return a?.type === "file" && !!a.closest(`section[aria-labelledby=${s}-h]`) && !a.hasAttribute("capture");
        }, side);
        if (ok) return;
      }
      throw new Error(`could not reach the ${side} file input by keyboard`);
    };
    await focusFileInput("front");
    await page.keyboard.press("Enter");
    const c1 = await nextChooser(1);
    await c1.setFiles(img(1600, 1010, "KF"));
    await expect(page.locator("section[aria-labelledby=front-h] canvas")).toBeVisible();
    await focusFileInput("back");
    await page.keyboard.press("Enter");
    const c2 = await nextChooser(2);
    await c2.setFiles(img(1600, 1010, "KB"));
    await expect(page.locator("#wm-text")).toBeVisible();
    await page.locator("#wm-text").focus();
    await page.keyboard.type("BANK ABC");
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => (document.activeElement as HTMLElement)?.textContent?.includes("Muat turun PNG") ?? false);
    }
    expect(reached, "export button reachable by Tab").toBe(true);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
    expect(dl.suggestedFilename()).toBe("salinan-berpalang.png");
  });

  test("F01-E13 mobile width: no horizontal scroll, touch targets at least 44px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openEditor(page);
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("BANK ABC");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const small = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(".editor .btn, .editor .chip, .editor .swatch, .editor input[type=text], .editor input[type=range], .editor .check"));
      return els
        .filter((e) => e.offsetParent !== null)
        .map((e) => ({ t: (e.textContent || e.id || e.className).trim().slice(0, 30), h: Math.round(e.getBoundingClientRect().height) }))
        .filter((x) => x.h < 44);
    });
    expect(small).toEqual([]);
  });

  test("F01-E14 consent dialog: Escape, focus trap, inert background", async ({ page }) => {
    await page.goto("/ms/editor/");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true); // focus moves in on open
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
    }
    expect(await page.locator(".editor-grid").getAttribute("inert")).not.toBeNull();
  });

  test("F01-E18 consent dialog links to the full privacy page, and Shift+Tab wraps inside", async ({ page }) => {
    await page.goto("/ms/editor/");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true); // focus moves in on open
    await expect(dialog.getByRole("link", { name: "Baca penjelasan privasi penuh" })).toHaveAttribute("href", "/ms/privasi/");
    // the primary button has focus first; Shift+Tab must stay inside the dialog, wrapping to the last control
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
  });

  test("F01-E19 portrait photos export on one A4 page", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page, img(1000, 2000, "PF"), img(1000, 2000, "PB"));
    await page.getByLabel("Teks palang").fill("BANK ABC");
    const { bytes } = await save(page, PDF_BTN, out("e19.pdf"));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  test("F01-E15 empty or spaces-only text disables export", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await expect(page.getByRole("button", { name: PNG_BTN })).toBeDisabled();
    await page.getByLabel("Teks palang").fill("     ");
    await expect(page.getByRole("button", { name: PNG_BTN })).toBeDisabled();
    await page.getByLabel("Teks palang").fill("X");
    await expect(page.getByRole("button", { name: PNG_BTN })).toBeEnabled();
  });

  test("F01-E16 angle and size extremes export", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("KHAS UNTUK BANK ABC SAHAJA");
    for (const [angle, size] of [["-10", "40"], ["-80", "40"], ["-80", "100"]]) {
      await page.locator("#wm-an").fill(angle);
      await page.locator("#wm-sz").fill(size);
      await page.waitForTimeout(200);
      expect(await paintedPixels(page, "front", isRed)).toBeGreaterThan(300);
    }
    expect(isPng((await save(page, PNG_BTN, out("e16.png"))).bytes)).toBe(true);
  });

  test("F01-E17 same file chosen twice in a row loads both times", async ({ page }) => {
    await openEditor(page);
    const f = img(1600, 1010, "SAME");
    await frontInput(page).setInputFiles(f);
    await expect(page.locator("section[aria-labelledby=front-h] canvas")).toBeVisible();
    await page.getByRole("button", { name: "Buang" }).click();
    await expect(page.locator("section[aria-labelledby=front-h] canvas")).toHaveCount(0);
    await frontInput(page).setInputFiles(f);
    await expect(page.locator("section[aria-labelledby=front-h] canvas")).toBeVisible();
  });
});

test.describe("F01 negative cases", () => {
  test("F01-N1 text file", async ({ page }) => {
    await openEditor(page);
    await frontInput(page).setInputFiles({ name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
    await expect(page.getByRole("alert")).toContainText("bukan gambar");
  });

  test("F01-N2 corrupt image", async ({ page }) => {
    await openEditor(page);
    await frontInput(page).setInputFiles({ name: "a.png", mimeType: "image/png", buffer: Buffer.from("not a png at all") });
    await expect(page.getByRole("alert")).toContainText("tidak dapat dibaca");
  });

  test("F01-N3 file over 25 MB", async ({ page }) => {
    await openEditor(page);
    await frontInput(page).setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(26 * 1024 * 1024, 1) });
    await expect(page.getByRole("alert")).toContainText("terlalu besar");
  });

  test("F01-N6 error clears when a good file is chosen", async ({ page }) => {
    await openEditor(page);
    await frontInput(page).setInputFiles({ name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
    await expect(page.getByRole("alert")).toBeVisible();
    await frontInput(page).setInputFiles(img(800, 500, "OK"));
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
