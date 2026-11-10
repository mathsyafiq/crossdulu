# Crossdulu

Free tool to cross (watermark) a copy of your ID before you send it. Everything runs in your browser: your images are never uploaded. No account, no credits, no payment. Bahasa Melayu and English.

- Front and back on one A4 sheet, true card size (85.6 mm wide), PNG or PDF.
- Text, date, opacity, angle, size and colour are adjustable.
- Built with Astro, Preact, Canvas and pdf-lib. Static site, no server.

## Use it
Live site: set up GitHub Pages (Settings, Pages, Source: GitHub Actions), then push to `main`. The workflow in `.github/workflows/pages.yml` builds and publishes it at `https://<username>.github.io/<repo>/`.

## Develop
```bash
npm install
npm run dev          # http://localhost:4321
npm test             # unit tests
npx astro build && npx playwright test   # end-to-end tests (needs Chrome)
```
`BASE_PATH` and `SITE_URL` env vars set the sub-path and canonical URL for builds under a sub-path. Leave them unset for a root domain.

## Privacy
The page sends nothing anywhere: `connect-src 'none'` in the Content-Security-Policy (a `<meta>` tag, plus `public/_headers` on hosts that read it, such as Cloudflare Pages and Netlify).

## Misuse
Use only your own documents. Do not use this to forge or alter documents. See the terms page.

MIT licence.
