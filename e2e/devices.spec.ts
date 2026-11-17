// Every way of getting a card in must work with a mouse (computers), a tap (phones) and a keyboard,
// by really pressing the buttons rather than injecting files into the hidden inputs.
import { PDFDocument } from "pdf-lib";
import type { Page, FileChooser } from "@playwright/test";
import { test, expect, img, openEditor, acceptConsent } from "./fixtures";

const slot = (page: Page, side: "front" | "back") => page.locator(`section[aria-labelledby=${side}-h]`);
const canvasIn = (page: Page, side: "front" | "back") => slot(page, side).locator("canvas");

// Playwright turns on file-picker interception when the first listener is added, asynchronously: register one
// before the page is used, then take pickers from a queue (waitForEvent per click races that switch-on).
const queues = new WeakMap<Page, FileChooser[]>();
test.beforeEach(async ({ page }) => {
  const q: FileChooser[] = [];
  queues.set(page, q);
  page.on("filechooser", (c) => q.push(c));
});
async function chooserFrom(page: Page, act: () => Promise<void>): Promise<FileChooser> {
  const q = queues.get(page)!;
  const before = q.length;
  await act();
  await expect.poll(() => q.length, { timeout: 5000 }).toBeGreaterThan(before);
  return q[q.length - 1];
}

async function twoCardPdf() {
  const doc = await PDFDocument.create();
  const pg = doc.addPage([595, 842]);
  for (const [label, y] of [["FRONT", 520], ["BACK", 180]] as const) {
    const png = await doc.embedPng(img(1012, 638, label).buffer);
    pg.drawImage(png, { x: 140, y, width: 315, height: 199 });
  }
  return { name: "ic.pdf", mimeType: "application/pdf", buffer: Buffer.from(await doc.save()) };
}

test.describe("D01 computer: mouse clicks open the pickers", () => {
  test("front, back, replace and PDF buttons each open a file picker and load the file", async ({ page }) => {
    await openEditor(page);
    for (const side of ["front", "back"] as const) {
      // locator.click() is a real mouse click at the button's centre, made once the layout has settled.
      const c = await chooserFrom(page, () => slot(page, side).getByLabel("Choose image", { exact: true }).click());
      await c.setFiles(img(1600, 1010, side.toUpperCase()));
      await expect(canvasIn(page, side)).toBeVisible();
    }
    const r = await chooserFrom(page, () => slot(page, "front").getByLabel("Replace", { exact: true }).click());
    await r.setFiles(img(1600, 1010, "AGAIN"));
    await expect(canvasIn(page, "front")).toBeVisible();

    await page.goto("/editor/");
    await acceptConsent(page);
    const p = await chooserFrom(page, () => page.getByLabel("Upload a PDF of your ID copy", { exact: true }).click());
    await p.setFiles(await twoCardPdf());
    await expect(canvasIn(page, "front")).toBeVisible({ timeout: 30_000 });
    await expect(canvasIn(page, "back")).toBeVisible();
  });

  test("every part of each upload button is the real file input (nothing has to open it by script)", async ({ page }) => {
    await openEditor(page);
    const hits = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".file-btn")).flatMap((b) => {
      const r = b.getBoundingClientRect();
      return [[0.1, 0.5], [0.5, 0.5], [0.9, 0.5], [0.5, 0.15], [0.5, 0.85]].map(([fx, fy]) => {
        const e = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy) as HTMLInputElement | null;
        return `${b.textContent}: ${e?.tagName}/${e?.type}`;
      });
    }));
    expect(hits.length).toBe(15);
    for (const h of hits) expect(h).toMatch(/INPUT\/file$/);
  });

  test("Space on the focused button opens the picker", async ({ page }) => {
    await openEditor(page);
    await slot(page, "front").getByLabel("Choose image", { exact: true }).focus();
    const c = await chooserFrom(page, () => page.keyboard.press("Space"));
    await c.setFiles(img(1600, 1010, "SPACE"));
    await expect(canvasIn(page, "front")).toBeVisible();
  });

  test("a photo whose type the system did not report (common on Windows) still loads", async ({ page }) => {
    await openEditor(page);
    const c = await chooserFrom(page, () => slot(page, "front").getByLabel("Choose image", { exact: true }).click());
    const f = img(1600, 1010, "NOTYPE", "jpeg");
    await c.setFiles({ name: "IMG_0001.JPG", mimeType: "", buffer: f.buffer });
    await expect(canvasIn(page, "front")).toBeVisible();
  });

  test("a picture can be pasted with Ctrl+V / Cmd+V", async ({ page }) => {
    await openEditor(page);
    const b64 = img(1600, 1010, "PASTED").buffer.toString("base64");
    await page.evaluate(async (data) => {
      const bytes = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], "image.png", { type: "image/png" }));
      document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
    }, b64);
    await expect(canvasIn(page, "front")).toBeVisible();
  });

  test("a file dropped beside the slots does not navigate away", async ({ page }) => {
    await openEditor(page);
    const left = await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(["x"], "a.png", { type: "image/png" }));
      const over = new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true });
      const drop = new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true });
      document.querySelector("h1")!.dispatchEvent(over);
      document.querySelector("h1")!.dispatchEvent(drop);
      return [over.defaultPrevented, drop.defaultPrevented];
    });
    expect(left).toEqual([true, true]);
  });
});

test.describe("D02 computer: camera problems are explained and recoverable", () => {
  test("no camera: says so and offers a picture picker", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("none", "NotFoundError"));
    });
    await openEditor(page);
    await slot(page, "front").getByRole("button", { name: "Use camera" }).click();
    const dialog = page.getByRole("dialog", { name: "Take a picture of the card" });
    await expect(dialog.getByRole("alert")).toContainText("No camera was found");
    await expect(dialog.getByRole("button", { name: "Try again" })).toHaveCount(0);
    const c = await chooserFrom(page, () => dialog.getByLabel("Choose a picture instead", { exact: true }).click());
    await c.setFiles(img(1600, 1010, "PICKED"));
    await expect(canvasIn(page, "front")).toBeVisible();
  });

  test("camera busy in another app, then Try again opens it", async ({ page }) => {
    await page.addInitScript(() => {
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      let n = 0;
      navigator.mediaDevices.getUserMedia = (c) => (++n <= 2 ? Promise.reject(new DOMException("busy", "NotReadableError")) : real(c));
    });
    await openEditor(page);
    await slot(page, "front").getByRole("button", { name: "Use camera" }).click();
    const dialog = page.getByRole("dialog", { name: "Take a picture of the card" });
    await expect(dialog.getByRole("alert")).toContainText("being used by another app");
    await dialog.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("camera-guide")).toBeVisible();
    await dialog.getByRole("button", { name: "Take picture" }).click();
    await expect(canvasIn(page, "front")).toBeVisible();
  });

  test("a webcam that refuses the size hints still opens", async ({ page }) => {
    await page.addInitScript(() => {
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (c: any) =>
        c?.video?.width ? Promise.reject(new DOMException("constraints", "OverconstrainedError")) : real(c);
    });
    await openEditor(page);
    await slot(page, "front").getByRole("button", { name: "Use camera" }).click();
    await expect(page.getByTestId("camera-guide")).toBeVisible();
  });
});

test.describe("D03 short laptop window", () => {
  test.use({ viewport: { width: 1280, height: 420 } });
  test("the consent and camera dialogs scroll so their buttons can be reached", async ({ page }) => {
    await page.goto("/editor/");
    await expect(page.locator("#front-h")).toBeAttached();
    await page.getByRole("button", { name: "I understand, continue" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await slot(page, "front").getByRole("button", { name: "Use camera" }).click();
    const dialog = page.getByRole("dialog", { name: "Take a picture of the card" });
    await dialog.getByRole("button", { name: "Take picture" }).click();
    await expect(canvasIn(page, "front")).toBeVisible();
  });
});

test.describe("D04 phone: taps open the pickers, and the phone camera app is the fallback", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("tap to choose, tap the PDF button, and camera fallback names the camera app", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    await openEditor(page);
    const c = await chooserFrom(page, () => slot(page, "front").getByLabel("Choose image", { exact: true }).tap());
    await c.setFiles(img(1600, 1010, "TAP"));
    await expect(canvasIn(page, "front")).toBeVisible();
    const p = await chooserFrom(page, () => page.getByLabel("Upload a PDF of your ID copy", { exact: true }).tap());
    await p.setFiles(await twoCardPdf());
    await expect(canvasIn(page, "back")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Remove" }).first().tap();
    await slot(page, "front").getByRole("button", { name: "Use camera" }).tap();
    const dialog = page.getByRole("dialog", { name: "Take a picture of the card" });
    await expect(dialog.getByRole("alert")).toContainText("Camera access is blocked");
    const f = await chooserFrom(page, () => dialog.getByLabel("Use the phone's camera app", { exact: true }).tap());
    await f.setFiles(img(1600, 1010, "CAMAPP"));
    await expect(canvasIn(page, "front")).toBeVisible();
  });
});
