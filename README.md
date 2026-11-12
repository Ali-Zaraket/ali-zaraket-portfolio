# Ali Zaraket · Portfolio

Personal site of Ali Zaraket, AI & full-stack engineer in Beirut, Lebanon.
It opens on an interactive orbit: contact details circle the name like planets. You can fling them, tap them to open, or play a 20-second comet game.

## Edit the content

Everything (name, title, contacts, projects, experience, skills, FAQ, SEO keywords) lives in one `CONFIG` block at the top of the `<script id="site-config">` in [`portfolio.html`](portfolio.html).

To show a different toy, set `toy` in the config to `"orbit"`, `"magnets"`, `"falling"` or `"plane"`.

## Build

```bash
node build.js
```

This writes the static site to `dist/`: `index.html`, `robots.txt`, `sitemap.xml`, `llms.txt` and the icons. It needs no dependencies. `node build.js plane` builds with another toy without editing the config.

What the build adds for search engines and AI answer engines:

- The portfolio text written into the HTML, so crawlers that don't run JavaScript can still read it
- Title, description, keywords, a canonical link, and Open Graph/Twitter cards with a share image
- JSON-LD structured data: WebSite, ProfilePage, Person, the project list and the FAQ
- `robots.txt` that allows search and AI crawlers, plus `sitemap.xml` and `llms.txt`

Set `seo.siteUrl` in the config to the live address so canonical links and the sitemap point to the right place.

## Deploy

Vercel builds the site on every push to `main`, using [`vercel.json`](vercel.json): it runs `node build.js` and serves `dist/`.

## Images

`assets/og-image.png` (1200×630 share image) and `assets/apple-touch-icon.png` are screenshots of `assets/og-card.html` and `assets/touch-icon.html`. Re-capture them after changing the name or title.
