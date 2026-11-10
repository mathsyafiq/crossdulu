import { test as base, expect, type Page } from "@playwright/test";
import { createCanvas } from "@napi-rs/canvas";

// Synthetic stand-ins for ID photos. Not real documents.
export function img(w: number, h: number, label = "SAMPLE", type: "png" | "jpeg" = "png") {
  const c = createCanvas(w, h);
  const g = c.getContext("2d");
  g.fillStyle = "#cfd8dc";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#90a4ae";
  g.fillRect(w * 0.05, h * 0.2, w * 0.24, h * 0.5);
  g.fillStyle = "#263238";
  g.font = `700 ${Math.max(8, Math.round(h * 0.06))}px sans-serif`;
  g.fillText(label, w * 0.35, h * 0.3);
  const buffer = type === "png" ? c.toBuffer("image/png") : c.toBuffer("image/jpeg", 90);
  return { name: `${label}.${type === "png" ? "png" : "jpg"}`, mimeType: `image/${type}`, buffer };
}

// Anything unexpected in the console, any 5xx, any request leaving the test host fails the test.
export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page, baseURL }, use) => {
      const bad: string[] = [];
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const t = m.text();
        if (/Content Security Policy|violates the following/i.test(t)) return; // our own CSP probe
        if (/status of 404/.test(t)) return; // deliberate 404 checks
        bad.push(`console: ${t}`);
      });
      page.on("pageerror", (e) => bad.push(`pageerror: ${e.message}`));
      page.on("response", (r) => { if (r.status() >= 500) bad.push(`5xx: ${r.url()}`); });
      page.on("request", (r) => {
        const u = r.url();
        if (!u.startsWith(baseURL!) && !u.startsWith("blob:") && !u.startsWith("data:")) bad.push(`external request: ${u}`);
      });
      await use();
      expect(bad, bad.join("\n")).toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export async function acceptConsent(page: Page, lang: "ms" | "en" = "ms") {
  // The island renders client-side. Wait for it, then accept only if the dialog is really there.
  await expect(page.locator("#front-h")).toBeAttached();
  const accept = page.getByRole("button", { name: lang === "ms" ? "Saya faham, teruskan" : "I understand, continue" });
  if (await accept.isVisible()) await accept.click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

export async function openEditor(page: Page, lang: "ms" | "en" = "ms") {
  await page.goto(`/${lang}/editor/`);
  await acceptConsent(page, lang);
  await expect(page.locator("#front-h")).toBeVisible();
}

export const frontInput = (page: Page) => page.locator("section[aria-labelledby=front-h] input[type=file]").first();
export const backInput = (page: Page) => page.locator("section[aria-labelledby=back-h] input[type=file]").first();

export async function loadBoth(page: Page, front = img(1600, 1010, "FRONT"), back = img(1600, 1010, "BACK")) {
  await frontInput(page).setInputFiles(front);
  await backInput(page).setInputFiles(back);
  await expect(page.locator("#wm-text")).toBeVisible();
}

export async function paintedPixels(page: Page, side: "front" | "back", rgb: (r: number, g: number, b: number) => boolean) {
  const src = rgb.toString();
  return page.evaluate(
    ({ side, src }) => {
      const test = new Function(`return (${src})`)() as (r: number, g: number, b: number) => boolean;
      const c = document.querySelector(`section[aria-labelledby=${side}-h] canvas`) as HTMLCanvasElement;
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (test(d[i], d[i + 1], d[i + 2])) n++;
      return n;
    },
    { side, src },
  );
}
export const isRed = (r: number, g: number, b: number) => r > 180 && g < 120 && b < 120;
export const isBlue = (r: number, g: number, b: number) => b > 150 && b - r > 70; // 60% blue over a grey photo

export async function canvasSize(page: Page, side: "front" | "back") {
  return page.evaluate((side) => {
    const c = document.querySelector(`section[aria-labelledby=${side}-h] canvas`) as HTMLCanvasElement;
    return { w: c.width, h: c.height };
  }, side);
}
