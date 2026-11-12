// Builds the live portfolio into dist/ from portfolio.html (the single source of truth).
//   node build.js          -> dist/ showing the toy set in CONFIG.toy
//   node build.js plane    -> dist/ showing another toy ("orbit", "magnets", "falling", "plane")
// dist/ is plain static files, ready for Vercel, Netlify, GitHub Pages or any static host.
//
// What it adds for search engines (SEO) and AI answer engines (AEO):
//   - the portfolio text written straight into the HTML, readable without JavaScript
//   - title, description, keywords, canonical link, Open Graph and Twitter cards with a share image
//   - JSON-LD structured data: WebSite, ProfilePage, Person, FAQPage and the project list
//   - robots.txt (AI crawlers explicitly allowed), sitemap.xml and llms.txt
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const ASSETS = path.join(ROOT, 'assets');
const TOYS = ['orbit', 'magnets', 'falling', 'plane'];
const src = fs.readFileSync(path.join(ROOT, 'portfolio.html'), 'utf8');

/* 1. Run the page's own config + template scripts in Node. */
const block = id => {
  const m = src.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`));
  if (!m) throw new Error(`portfolio.html has no <script id="${id}">`);
  return m[1];
};
const ctx = vm.createContext({});
vm.runInContext(`${block('site-config')}\n${block('site-templates')}\n;globalThis.__out = { C: normalizeConfig(CONFIG), P: sheetParts(CONFIG, { appNote: false }), esc };`, ctx);
const { C, P, esc } = ctx.__out;

const toy = process.argv.find(a => TOYS.includes(a)) || (TOYS.includes(C.toy) ? C.toy : 'orbit');
const seo = C.seo || {};
const SITE = String(seo.siteUrl || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(SITE)) throw new Error('Set CONFIG.seo.siteUrl to the live address, e.g. https://example.com');
const title = seo.title || `${C.name} · ${C.role}`;
const description = seo.description || C.bio;
const today = new Date().toISOString().slice(0, 10);
const contact = id => C.contacts.find(c => c.id === id);
const email = contact('email'), phone = contact('phone');
const [city, country = ''] = String(C.city || '').split(',').map(s => s.trim());
const [givenName, ...rest] = C.name.split(/\s+/);

/* 2. Split the artifact file into head material (fonts + styles) and the page body. */
const headStart = src.indexOf('<link rel="preconnect"');
const styleEnd = src.indexOf('</style>') + '</style>'.length;
if (headStart < 0 || styleEnd < 8) throw new Error('Unexpected portfolio.html layout');
const headPart = src.slice(headStart, styleEnd);
let body = src.slice(styleEnd).trim();
if (toy !== 'falling') body = body.replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/matter-js[^"]*"><\/script>\s*/, '');

/* 3. Pre-render: write the content into the empty containers (the page script re-renders the same HTML). */
function fill(id, inner) {
  const re = new RegExp(`(<(\\w+)\\b[^>]*\\bid="${id}"[^>]*>)(</\\2>)`);
  if (!re.test(body)) throw new Error(`No empty element with id="${id}" to fill`);
  body = body.replace(re, (m, open, tag, close) => open + inner + close);
}
fill('brand-name', esc(C.name));
fill('brand-role', esc(C.role));
fill('strip', P.strip);
fill('bio', esc(C.bio));
fill('highlights', P.highlights);
fill('facts', P.facts);
fill('work-list', P.work);
fill('skills-list', P.skills);
fill('exp-list', P.exp);
fill('edu-list', P.edu);
fill('faq-list', P.faq);
fill('hello', P.hello);
fill('foot-left', P.foot);
if (!P.edu) body = body.replace('id="education"', 'id="education" hidden');
if (!P.faq) body = body.replace('id="faq"', 'id="faq" hidden');

/* 4. Structured data for search and answer engines. */
const knowsAbout = [...new Set(Object.values(C.skills).flat())];
const sameAs = C.contacts.filter(c => /^https?:/i.test(c.href || '') && !/wa\.me/i.test(c.href) && c.id !== 'cv').map(c => c.href);
const person = {
  '@type': 'Person', '@id': `${SITE}/#person`, name: C.name, givenName, familyName: rest.join(' '),
  url: `${SITE}/`, image: `${SITE}/og-image.png`, jobTitle: C.role, description,
  address: { '@type': 'PostalAddress', addressLocality: city, addressCountry: country },
  knowsAbout,
  worksFor: C.experience.filter(x => /now/i.test(x.years)).map(x => ({ '@type': 'Organization', name: x.org })),
  alumniOf: (C.education || []).map(e => ({ '@type': 'CollegeOrUniversity', name: e.org.split(',')[0].trim() })),
  hasOccupation: { '@type': 'Occupation', name: C.role, occupationLocation: { '@type': 'City', name: city }, skills: knowsAbout.join(', ') }
};
if (email) person.email = `mailto:${email.value}`;
if (phone) person.telephone = phone.href.replace(/^tel:/, '');
if (sameAs.length) person.sameAs = sameAs;
const ld = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: C.name, description, inLanguage: 'en' },
    { '@type': 'ProfilePage', '@id': `${SITE}/#profile`, url: `${SITE}/`, name: title, inLanguage: 'en', dateModified: today,
      isPartOf: { '@id': `${SITE}/#website` }, about: { '@id': `${SITE}/#person` }, mainEntity: { '@id': `${SITE}/#person` } },
    person,
    { '@type': 'ItemList', '@id': `${SITE}/#work`, name: 'Selected work',
      itemListElement: C.projects.map((p, i) => ({ '@type': 'ListItem', position: i + 1,
        item: { '@type': 'CreativeWork', name: p.title, description: p.text, keywords: p.tags.join(', '), creator: { '@id': `${SITE}/#person` } } })) },
    ...((C.faq || []).length ? [{ '@type': 'FAQPage', '@id': `${SITE}/#faq`,
      mainEntity: C.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : [])
  ]
};
const ldJson = JSON.stringify(ld, null, 1).replace(/</g, '\\u003c');

/* 5. The page. */
const a = s => esc(String(s));
const hasTouchIcon = fs.existsSync(path.join(ASSETS, 'apple-touch-icon.png'));
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${a(title)}</title>
<meta name="description" content="${a(description)}">
<meta name="keywords" content="${a((seo.keywords || []).join(', '))}">
<meta name="author" content="${a(C.name)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<link rel="canonical" href="${SITE}/">
<meta name="theme-color" content="#0b0c0f">
<meta name="geo.placename" content="${a(city)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="${a(C.name)}">
<meta property="og:locale" content="en_US">
<meta property="og:url" content="${SITE}/">
<meta property="og:title" content="${a(title)}">
<meta property="og:description" content="${a(description)}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${a(`${C.name}, ${C.role}`)}">
<meta property="profile:first_name" content="${a(givenName)}">
<meta property="profile:last_name" content="${a(rest.join(' '))}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${a(title)}">
<meta name="twitter:description" content="${a(description)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
${hasTouchIcon ? '<link rel="apple-touch-icon" href="apple-touch-icon.png">\n' : ''}<script>window.SITE_MODE = "${toy}";</script>
<script type="application/ld+json">
${ldJson}
</script>
${headPart}
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>
</head>
<body>
${body}
</body>
</html>
`;

/* 6. Crawler files. */
const robots = `# Search engines and AI answer engines are welcome to read this site.
User-agent: *
Allow: /
${['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended']
  .map(b => `\nUser-agent: ${b}\nAllow: /`).join('\n')}

Sitemap: ${SITE}/sitemap.xml
`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>
</urlset>
`;
const md = [`# ${C.name}`, '', `> ${description}`, ''];
if ((C.faq || [])[0]) md.push(C.faq[0].a, '');
md.push('## Contact');
if (email) md.push(`- Email: ${email.value}`);
if (phone) md.push(`- Phone and WhatsApp: ${phone.value}`);
md.push(`- Location: ${C.city} (${C.timezone})`, `- Website: ${SITE}/`, '');
if ((C.highlights || []).length) md.push('## Highlights', ...C.highlights.map(h => `- ${h.n} ${h.label}`), '');
md.push('## Experience', ...C.experience.map(x => `- **${x.role}, ${x.org}** (${x.years}): ${x.text}`), '');
md.push('## Selected work', ...C.projects.map(p => `- **${p.title}** (${p.year}): ${p.text} Stack: ${p.tags.join(', ')}.`), '');
md.push('## Skills', ...Object.entries(C.skills).map(([g, l]) => `- ${g}: ${l.join(', ')}`), '');
if ((C.education || []).length) md.push('## Education', ...C.education.map(e => `- ${e.title}, ${e.org}`), '');
if ((C.faq || []).length) md.push('## FAQ', '', ...C.faq.flatMap(f => [`### ${f.q}`, f.a, '']));

/* 7. Write dist/. */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const write = (name, data) => { fs.writeFileSync(path.join(OUT, name), data); console.log(`dist/${name}`.padEnd(28), `${(Buffer.byteLength(data) / 1024).toFixed(1)} KB`); };
write('index.html', html);
write('robots.txt', robots);
write('sitemap.xml', sitemap);
write('llms.txt', md.join('\n'));
for (const f of ['favicon.svg', 'og-image.png', 'apple-touch-icon.png']) {
  const p = path.join(ASSETS, f);
  if (fs.existsSync(p)) write(f, fs.readFileSync(p));
  else console.warn(`(missing assets/${f})`);
}
console.log(`\nBuilt "${toy}" for ${SITE}/`);
