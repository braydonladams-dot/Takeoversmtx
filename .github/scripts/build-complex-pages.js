// Builds one page per apartment complex (lease-takeover/<slug>.html), the complex index page,
// sitemap.xml and robots.txt from the live listings. Run by .github/workflows/complex-pages.yml
// every few hours, or by hand: node .github/scripts/build-complex-pages.js (from site/).
// New complexes are added to complexes.json automatically and are never removed, so a page stays
// up (showing "none right now" + alerts) after its listings are taken. Edit names there if needed.
const fs = require('fs');
const path = require('path');
const site = path.join(__dirname, '..', '..');
const C = require(path.join(site, 'complex.js'));
const { esc, money } = C;
const ORIGIN = 'https://takeoversmtx.com';
const REG = path.join(__dirname, 'complexes.json');
const OUT = path.join(site, 'lease-takeover');

const cfg = fs.readFileSync(path.join(site, 'config.js'), 'utf8');
const API = cfg.match(/apiUrl:\s*['"]([^'"]+)/)[1];
const ver = (fs.readFileSync(path.join(site, 'index.html'), 'utf8').match(/styles\.css\?v=(\d+)/) || [])[1] || '1';

async function getListings() {
  let last;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(API, { signal: AbortSignal.timeout(60000) });
      const j = JSON.parse(await r.text());
      if (Array.isArray(j.listings)) return j.listings;
      last = new Error('no listings in response');
    } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
  }
  throw last;
}

// "the view on the square" -> "The View on the Square"
const titleCase = (s) => String(s).trim().replace(/\s+/g, ' ').toLowerCase()
  .replace(/(^|[\s-])([a-z])/g, (m, p, c) => p + c.toUpperCase())
  .replace(/ (On|At|Of|The|And)\b/g, (w) => w.toLowerCase());
const slugify = (name) => name.toLowerCase().replace(/['’]/g, '').replace(/^the\s+/, '').replace(/\bsan marcos\b/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const inSM = (name) => (/san marcos/i.test(name) ? name : name + ', San Marcos');

const ig = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/></svg>';

function layout({ title, desc, canonical, body, jsonld, scripts = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta name="theme-color" content="#ffffff">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${ORIGIN}/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/styles.css?v=${ver}">
  <script src="/preview.js"></script>
  <script data-goatcounter="https://takeoversmtx.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>${jsonld ? `
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/"><img src="/favicon.svg" alt="" width="30" height="30">Takeover<span>SMTX</span></a>
    <nav class="nav">
      <a class="btn btn-ghost" href="/#board">Browse</a>
      <a class="btn btn-primary" href="/#list">List your lease</a>
    </nav>
  </header>

  <main class="page cp-page">
${body}
  </main>

  <footer class="footer">
    <p><strong>Takeover SMTX</strong> is an independent listing board. It is not affiliated with Texas State University or any apartment complex. We don't negotiate leases, and every takeover must be approved by the property.</p>
    <p><a href="/lease-takeover/">Lease takeovers by complex</a> · <a href="/how-it-works">How it works</a> · <a href="/get-featured">Get featured on Instagram</a></p>
    <p><a class="ig-link" href="https://instagram.com/takeoversmtx" target="_blank" rel="noopener">${ig}<span>Follow <b>@takeoversmtx</b> on Instagram</span></a></p>
  </footer>
  <a class="feedback-fab" href="/#feedback" aria-label="Send feedback">💬 Feedback</a>${scripts}
</body>
</html>
`;
}

function faqFor(name) {
  return [
    [`How do I get out of my ${name} lease?`,
      `Ask the ${name} leasing office whether your lease can be transferred to someone else and what the transfer fee is. Then list your lease free on Takeover SMTX. Students looking for a place get alerted when it fits their budget and contact you directly. The new person applies with ${name} like any other transfer.`],
    [`Can I take over a lease at ${name}?`,
      `Yes, when someone is leaving. Every takeover listed above is from a current resident. Tap one to see the photos, the details and how to contact them. You still apply and get approved through the ${name} office.`],
    [`What if nothing is listed at ${name} right now?`,
      `Turn on free alerts with your budget and move-in date. We text or email you the moment a takeover that fits is listed at ${name} or anywhere else in San Marcos.`],
    ['Does it cost anything?', 'No. Listing your lease and browsing takeovers on Takeover SMTX are both free.'],
  ];
}

function complexPage(c, list, all) {
  const name = c.name;
  const canonical = `${ORIGIN}/lease-takeover/${c.slug}`;
  const min = list.length ? Math.min(...list.map((l) => Number(l.rent))) : 0;
  const title = `${name} Lease Takeovers & Subleases | ${/san marcos/i.test(name) ? 'Takeover SMTX' : 'San Marcos'}`;
  const desc = list.length
    ? `${list.length} lease ${list.length === 1 ? 'takeover' : 'takeovers'} at ${inSM(name)} from ${money(min)}/mo. Take over a lease from a current resident, or list yours free.`
    : `Lease takeovers and subleases at ${inSM(name)}. Get free alerts when one is listed, or list your own lease free.`;
  const faq = faqFor(name);
  const others = all.filter((o) => o.slug !== c.slug)
    .map((o) => `<a href="/lease-takeover/${o.slug}">${esc(o.name)}${o.count ? ` <small>(${o.count})</small>` : ''}</a>`).join('');
  const body = `    <nav class="crumbs"><a href="/">Home</a> › <a href="/lease-takeover/">By complex</a> › ${esc(name)}</nav>
    <div class="page-intro">
      <h1>${esc(name)} lease takeovers</h1>
      <p>Current ${esc(name)} residents who need to leave their lease list it here. Take one over to move in mid-lease, often for less than a new lease, sometimes with a cash incentive.</p>
      <p class="cp-summary" id="cp-summary">${C.summary(list, name)}</p>
    </div>

    <div id="cp-listings" class="grid cp-grid" data-key="${esc(c.key)}" data-name="${esc(name)}">${list.map(C.card).join('')}</div>
    <div id="cp-empty" class="empty"${list.length ? ' hidden' : ''}>
      <p><b>Nothing at ${esc(name)} right now.</b><br>New takeovers go up every week. Get a text or email the moment one fits you.</p>
      <a class="btn btn-primary" href="/#alerts">Get free alerts</a>
    </div>

    <div class="two-col cp-ctas">
      <section class="panel">
        <h2>Need out of your ${esc(name)} lease?</h2>
        <p>List it free in about 2 minutes. Students looking for a place get alerted when it fits their budget.</p>
        <a class="btn btn-primary" href="/#list">List your lease</a>
      </section>
      <section class="panel">
        <h2>Looking at ${esc(name)}?</h2>
        <p>Get a text or email when a takeover at ${esc(name)}, or anywhere in San Marcos, fits your budget and move-in date.</p>
        <a class="btn btn-outline" href="/#alerts">Get free alerts</a>
      </section>
    </div>

    <section class="panel cp-faq">
      <h2>Questions</h2>
${faq.map(([q, a]) => `      <h3>${esc(q)}</h3>\n      <p>${esc(a)}</p>`).join('\n')}
    </section>

    <section class="cp-others">
      <h2>Other San Marcos complexes</h2>
      <div class="cp-links">${others}</div>
      <p><a class="btn btn-outline" href="/#board">See every takeover in San Marcos</a></p>
    </section>`;
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  return layout({ title, desc, canonical, body, jsonld, scripts: `\n  <script src="/config.js?v=${ver}"></script>\n  <script src="/complex.js?v=${ver}"></script>` });
}

function indexPage(all, total) {
  const body = `    <nav class="crumbs"><a href="/">Home</a> › By complex</nav>
    <div class="page-intro">
      <h1>San Marcos lease takeovers by complex</h1>
      <p>Lease takeovers and subleases from current residents at apartment complexes near Texas State. ${total} available right now.</p>
    </div>
    <div class="cp-index">
${all.map((c) => `      <a class="panel cp-row" href="/lease-takeover/${c.slug}"><b>${esc(c.name)}</b><span>${c.count ? `${c.count} available · from ${money(c.min)}/mo` : 'None right now · get alerts'}</span></a>`).join('\n')}
    </div>
    <div class="cta">
      <a class="btn btn-primary btn-lg" href="/#board">Browse all takeovers</a>
      <a class="btn btn-outline btn-lg" href="/#list">List your lease</a>
    </div>`;
  return layout({
    title: 'San Marcos Lease Takeovers by Apartment Complex | Takeover SMTX',
    desc: `Lease takeovers and subleases at ${all.length} San Marcos apartment complexes near Texas State. Find one or list yours free.`,
    canonical: `${ORIGIN}/lease-takeover/`, body,
  });
}

(async () => {
  const listings = await getListings();
  const reg = fs.existsSync(REG) ? JSON.parse(fs.readFileSync(REG, 'utf8')) : [];
  // Register complexes we haven't seen. The shortest spelling wins as the display name.
  const seen = {};
  listings.forEach((l) => { const k = C.key(l.complex); if (k) (seen[k] = seen[k] || []).push(titleCase(l.complex)); });
  Object.entries(seen).forEach(([k, names]) => {
    if (reg.some((c) => c.key === k)) return;
    const name = names.sort((a, b) => a.length - b.length)[0];
    let slug = slugify(name) || k;
    while (reg.some((c) => c.slug === slug)) slug += '-2';
    reg.push({ key: k, name, slug });
  });
  reg.sort((a, b) => a.name.replace(/^the /i, '').localeCompare(b.name.replace(/^the /i, '')));
  fs.writeFileSync(REG, JSON.stringify(reg, null, 2) + '\n');

  const live = listings.filter(C.isLive);
  const all = reg.map((c) => {
    const list = live.filter((l) => C.key(l.complex) === c.key).sort((a, b) => a.rent - b.rent);
    return { ...c, list, count: list.length, min: list.length ? Math.min(...list.map((l) => Number(l.rent))) : 0 };
  });

  fs.mkdirSync(OUT, { recursive: true });
  const keep = new Set(['index.html']);
  all.forEach((c) => { fs.writeFileSync(path.join(OUT, c.slug + '.html'), complexPage(c, c.list, all)); keep.add(c.slug + '.html'); });
  fs.writeFileSync(path.join(OUT, 'index.html'), indexPage(all, live.length));
  fs.readdirSync(OUT).forEach((f) => { if (!keep.has(f)) fs.rmSync(path.join(OUT, f)); });

  const urls = ['/', '/how-it-works', '/get-featured', '/lease-takeover/', ...all.map((c) => '/lease-takeover/' + c.slug)];
  fs.writeFileSync(path.join(site, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${ORIGIN}${u}</loc></url>`).join('\n')}
</urlset>
`);
  fs.writeFileSync(path.join(site, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
  console.log(`built ${all.length} complex pages (${live.length} live listings)`);
})().catch((e) => { console.error('build failed: ' + e.message); process.exit(1); });
