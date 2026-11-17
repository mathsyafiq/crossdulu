import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";

// Static output only. No server, no API routes, nothing that receives images.
// BASE_PATH and SITE_URL are set by the GitHub Pages workflow (project sites live under /<repo>/).
// Leave them unset for a root domain.
const base = process.env.BASE_PATH || "/";
const site = process.env.SITE_URL || undefined;
const root = base.replace(/\/$/, "");

export default defineConfig({
  output: "static",
  base,
  site,
  integrations: [preact()],
  // The site used to live under /ms/ and /en/. Old links (shared, bookmarked) land on the English page.
  redirects: Object.fromEntries(
    [
      ["/ms", ""], ["/ms/editor", "editor/"], ["/ms/privasi", "privacy/"], ["/ms/terma", "terms/"],
      ["/en", ""], ["/en/editor", "editor/"], ["/en/privacy", "privacy/"], ["/en/terms", "terms/"],
    ].map(([from, to]) => [from, `${root}/${to}`]),
  ),
  build: { inlineStylesheets: "auto" },
});
