import AxeBuilder from "@axe-core/playwright";
import { test, expect, img, openEditor, loadBoth, acceptConsent } from "./fixtures";
import type { Page } from "@playwright/test";

const PAGES = ["/", "/editor/", "/privacy/", "/terms/"];
const OLD: Record<string, string> = {
  "/ms/": "/", "/ms/editor/": "/editor/", "/ms/privasi/": "/privacy/", "/ms/terma/": "/terms/",
  "/en/": "/", "/en/editor/": "/editor/", "/en/privacy/": "/privacy/", "/en/terms/": "/terms/",
};

async function axe(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")}`), label).toEqual([]);
}

test.describe("F05 find and learn", () => {
  test("F05-H1 home start button opens the editor", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Watermark a copy" }).first().click();
    await expect(page).toHaveURL(/\/editor\/$/);
  });

  test("F05-H2 old /ms/ and /en/ links land on the English page", async ({ page }) => {
    for (const [from, to] of Object.entries(OLD)) {
      await page.goto(from);
      await expect(page, from).toHaveURL(new RegExp(`localhost:4321${to.replace(/\//g, "\\/")}$`));
      await expect(page.locator("html")).toHaveAttribute("lang", "en-MY");
    }
  });

  test("F05-H3 no language switch and no Malay pages remain", async ({ page }) => {
    for (const p of PAGES) {
      await page.goto(p);
      await expect(page.getByRole("link", { name: "MS", exact: true })).toHaveCount(0);
      expect(await page.locator("link[rel=alternate][hreflang]").count(), p).toBe(0);
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
    expect(seen.size).toBeGreaterThan(4);
  });

  test("F05-E2 root is the home page", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mark your IC copy before you send it.");
  });

  test("F05-E3 skip link and FAQ work with the keyboard", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
    const summary = page.getByText("Is it really free?");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Yes, with no limits and no account.")).toBeVisible();
  });

  test("F05-E4 unknown URL gives a real 404 page with a way home", async ({ page }) => {
    const res = await page.goto("/no-such-page/");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
  });

  test("F05-S1 title, description and lang on every page", async ({ page }) => {
    const titles = new Set<string>();
    for (const p of PAGES) {
      await page.goto(p);
      const title = await page.title();
      expect(title.length, `${p} title`).toBeGreaterThan(10);
      titles.add(title);
      const desc = await page.locator('meta[name=description]').getAttribute("content");
      expect((desc || "").length, `${p} description`).toBeGreaterThan(30);
      await expect(page.locator("html")).toHaveAttribute("lang", "en-MY");
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
    await page.goto("/editor/");
    await expect(page.getByRole("dialog")).toBeVisible();
    await axe(page, "editor consent");
    await page.getByRole("button", { name: "I understand, continue" }).click();
    await axe(page, "editor empty");
    await loadBoth(page, img(1600, 1010, "AF"), img(1600, 1010, "AB"));
    await page.getByLabel("Watermark text").fill("BANK ABC");
    await page.waitForTimeout(300);
    await axe(page, "editor both loaded");
  });

  test("F01-A2 editor at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openEditor(page);
    await loadBoth(page);
    await axe(page, "editor phone");
  });
});
