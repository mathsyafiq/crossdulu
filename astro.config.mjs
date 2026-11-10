import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";

// Static output only. No server, no API routes, nothing that receives images.
// BASE_PATH and SITE_URL are set by the GitHub Pages workflow (project sites live under /<repo>/).
// Leave them unset for a root domain.
const base = process.env.BASE_PATH || "/";
const site = process.env.SITE_URL || undefined;

export default defineConfig({
  output: "static",
  base,
  site,
  integrations: [preact()],
  redirects: { "/": `${base.replace(/\/$/, "")}/ms/` },
  build: { inlineStylesheets: "auto" },
});
