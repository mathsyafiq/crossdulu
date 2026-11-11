import { test, expect, img, openEditor, loadBoth } from "./fixtures";
import type { Page } from "@playwright/test";

/** Count red pixels inside a box given as fractions of the preview (x0, y0, x1, y1). */
async function redIn(page: Page, side: "front" | "back", box: [number, number, number, number]) {
  return page.evaluate(
    ({ side, box }) => {
      const c = document.querySelector(`section[aria-labelledby=${side}-h] canvas`) as HTMLCanvasElement;
      const [pl, pt, pr, pb] = (c.dataset.pad ?? "0,0,0,0").split(",").map(Number); // room around the card
      const cw = c.width - pl - pr, ch = c.height - pt - pb;
      const x0 = pl + Math.round(box[0] * cw), y0 = pt + Math.round(box[1] * ch);
      const w = Math.max(1, Math.round((box[2] - box[0]) * cw)), h = Math.max(1, Math.round((box[3] - box[1]) * ch));
      const d = c.getContext("2d")!.getImageData(x0, y0, w, h).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 120 && d[i + 2] < 120) n++;
      return n;
    },
    { side, box },
  );
}
const CORNER: [number, number, number, number] = [0, 0, 0.3, 0.45];
const MIDDLE: [number, number, number, number] = [0.3, 0.3, 0.8, 0.8];

test.describe("F08 band position", () => {
  test("F08-H1 by default the band is only in the top-left corner and leaves the middle of the card clear", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("KHAS UNTUK BANK ABC");
    await expect(page.getByRole("radio", { name: "Sudut kiri atas" })).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => redIn(page, "front", CORNER)).toBeGreaterThan(500);
    expect(await redIn(page, "front", MIDDLE), "front middle").toBe(0);
    expect(await redIn(page, "front", [0.5, 0, 1, 1]), "front right half").toBe(0);
    expect(await redIn(page, "back", MIDDLE), "back middle").toBe(0);
    await expect(page.getByText("dalam satu baris")).toBeVisible();
    // the band runs out past the card: the preview has room around the card
    const pad = await page.locator("section[aria-labelledby=front-h] canvas").getAttribute("data-pad");
    expect(pad!.split(",").map(Number).slice(0, 2).every((n) => n > 0), `room around the card: ${pad}`).toBe(true);
  });

  test("F08-H2 choosing the middle puts the band across the card, and back to the corner clears it again", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("KHAS UNTUK BANK ABC");
    await page.getByRole("radio", { name: "Tengah kad" }).click();
    await expect.poll(() => redIn(page, "front", MIDDLE)).toBeGreaterThan(500);
    await expect(page.getByLabel(/Saiz palang/)).toHaveValue("100");
    await page.getByRole("radio", { name: "Sudut kiri atas" }).click();
    await expect.poll(() => redIn(page, "front", MIDDLE)).toBe(0);
    await expect(page.getByLabel(/Saiz palang/)).toHaveValue("75");
  });

  test("F08-E1 the size slider changes the band size; every angle keeps the lower right of the card clear", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("KHAS UNTUK BANK ABC");
    const sz = page.getByLabel(/Saiz palang/);
    await sz.fill("40");
    await expect.poll(() => redIn(page, "front", [0.3, 0, 1, 1])).toBe(0);
    const small = await redIn(page, "front", CORNER);
    await sz.fill("100");
    await expect.poll(() => redIn(page, "front", [0, 0, 0.6, 0.8])).toBeGreaterThan(small);
    for (const a of ["-10", "-45", "-80"]) {
      await page.getByLabel(/Sudut/).fill(a);
      await expect.poll(() => redIn(page, "front", [0.62, 0.62, 1, 1]), `angle ${a}`).toBe(0);
    }
  });

  test("F08-E2 a PNG can be exported with the corner band", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("BANK ABC");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Muat turun PNG" }).click()]);
    expect(dl.suggestedFilename()).toBe("salinan-berpalang.png");
  });

  test("F08-E3 English labels and the position choice work by keyboard", async ({ page }) => {
    await openEditor(page, "en");
    await loadBoth(page, img(1600, 1010, "F"), img(1600, 1010, "B"));
    await page.getByLabel("Watermark text").fill("FOR BANK ABC ONLY");
    const mid = page.getByRole("radio", { name: "Across the middle" });
    await mid.focus();
    await page.keyboard.press("Enter");
    await expect(mid).toHaveAttribute("aria-checked", "true");
  });

  test("F08-E4 the horizontal and vertical sliders move the band where the user wants it", async ({ page }) => {
    await openEditor(page);
    await loadBoth(page);
    await page.getByLabel("Teks palang").fill("BANK ABC");
    const hx = page.getByLabel(/Kedudukan mendatar/), vy = page.getByLabel(/Kedudukan menegak/);
    await expect.poll(() => redIn(page, "front", [0, 0, 0.3, 0.45])).toBeGreaterThan(300); // starts in the corner
    await hx.fill("100");
    await expect.poll(() => redIn(page, "front", [0, 0, 0.5, 1])).toBe(0);
    await expect.poll(() => redIn(page, "front", [0.7, 0, 1, 0.5])).toBeGreaterThan(300);
    await hx.fill("0");
    await vy.fill("100");
    await expect.poll(() => redIn(page, "front", [0, 0, 1, 0.5])).toBe(0);
    await expect.poll(() => redIn(page, "front", [0, 0.5, 0.3, 1])).toBeGreaterThan(300);
    // the same position is used for the back card, and for the middle option the sliders are not shown
    await expect.poll(() => redIn(page, "back", [0, 0.5, 0.3, 1])).toBeGreaterThan(300);
    await page.getByRole("radio", { name: "Tengah kad" }).click();
    await expect(hx).toBeHidden();
  });

  test("F08-E5 the position sliders can be used by keyboard and have labels in English", async ({ page }) => {
    await openEditor(page, "en");
    await loadBoth(page);
    await page.getByLabel("Watermark text").fill("BANK ABC");
    const hx = page.getByLabel(/Horizontal position/);
    await hx.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
    await expect(hx).toHaveValue("10");
    await expect(page.getByLabel(/Vertical position/)).toBeVisible();
  });
});
