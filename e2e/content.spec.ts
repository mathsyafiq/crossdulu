import AxeBuilder from "@axe-core/playwright";
import { test, expect, img, openEditor, loadBoth, acceptConsent } from "./fixtures";
import type { Page } from "@playwright/test";

const PAGES = ["/ms/", "/ms/editor/", "/ms/privasi/", "/ms/terma/", "/en/", "/en/editor/", "/en/privacy/", "/en/terms/"];
const PAIR: Record<string, string> = {
  "/ms/": "/en/", "/ms/editor/": "/en/editor/", "/ms/privasi/": "/en/privacy/", "/ms/terma/": "/en/terms/",
};

async function axe(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")}`), label).toEqual([]);
}

test.describe("F05 find and learn", () => {
  test("F05-H1 home start button opens the editor", async ({ page }) => {
    await page.goto("/ms/");
    await page.getByRole("link", { name: "Mula palang sekarang" }).first().click();
    await expect(page).toHaveURL(/\/ms\/editor\/$/);
  });

  test("F05-H2 language toggle goes to the same page and back", async ({ page }) => {
    for (const [ms, en] of Object.entries(PAIR)) {
      await page.goto(ms);
      if (ms.includes("editor")) await acceptConsent(page, "ms");
      await page.getByRole("link", { name: "EN", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(en.replace(/\//g, "\\/") + "$"));
      await expect(page.locator("html")).toHaveAttribute("lang", "en-MY");
      if (en.includes("editor")) await acceptConsent(page, "en");
      await page.getByRole("link", { name: "MS", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(ms.replace(/\//g, "\\/") + "$"));
      await expect(page.locator("html")).toHaveAttribute("lang", "ms-MY");
    }
  });

  test("F05-E1 every internal link returns 200", async ({ page, request }) => {
    const seen = new Set<string>();
    for (const p of PAGES) {
      await page.goto(p);
      const hrefs = await page.$$eval("a[href], link[rel=icon][href]", (els) => els.map((e) => e.getAttribute("href")!));
      for (const h of hrefs) {
        if (!h.startsWith("/")) continue;
        const u = h.split("#")[0];
        if (!u || seen.has(u)) continue;
        seen.add(u);
        const r = await request.get(u);
        expect(r.status(), `${p} -> ${u}`).toBe(200);
      }
    }
    expect(seen.size).toBeGreaterThan(8);
  });

  test("F05-E2 root redirects to /ms/", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/ms\/$/);
  });

  test("F05-E3 skip link and FAQ work with the keyboard", async ({ page }) => {
    await page.goto("/ms/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Terus ke kandungan" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
    const summary = page.getByText("Adakah alat ini percuma?");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Ya, tanpa had dan tanpa akaun.")).toBeVisible();
  });

  test("F05-E4 unknown URL gives a real 404 page with a way home", async ({ page }) => {
    const res = await page.goto("/ms/tiada-halaman/");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Ke laman utama" })).toHaveAttribute("href", "/ms/");
    await expect(page.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/en/");
  });

  test("F05-S1 title, description, lang and hreflang on every page", async ({ page }) => {
    const titles = new Set<string>();
    for (const p of PAGES) {
      await page.goto(p);
      const title = await page.title();
      expect(title.length, `${p} title`).toBeGreaterThan(10);
      titles.add(title);
      const desc = await page.locator('meta[name=description]').getAttribute("content");
      expect((desc || "").length, `${p} description`).toBeGreaterThan(30);
      expect(await page.locator("link[rel=alternate][hreflang]").count(), `${p} hreflang`).toBe(2);
    }
    expect(titles.size).toBe(PAGES.length);
  });
});

test.describe("accessibility (axe, serious and critical)", () => {
  for (const p of PAGES.filter((x) => !x.includes("editor"))) {
    test(`F05-A1 ${p}`, async ({ page }) => {
      await page.goto(p);
      await axe(page, p);
    });
  }

  test("F01-A1 editor: consent open, empty, both loaded", async ({ page }) => {
    await page.goto("/ms/editor/");
    await expect(page.getByRole("dialog")).toBeVisible();
    await axe(page, "editor consent");
    await page.getByRole("button", { name: "Saya faham, teruskan" }).click();
    await axe(page, "editor empty");
    await loadBoth(page, img(1600, 1010, "AF"), img(1600, 1010, "AB"));
    await page.getByLabel("Teks palang").fill("BANK ABC");
    await page.waitForTimeout(300);
    await axe(page, "editor both loaded");
  });

  test("F01-A2 English editor", async ({ page }) => {
    await openEditor(page, "en");
    await loadBoth(page);
    await axe(page, "en editor");
  });
});
