// Instagram auto-poster: every paid $10 feature gets its own post on @takeoverleases.
// Runs on GitHub Actions (.github/workflows/ig-autopost.yml) every 30 minutes.
//   1. asks the backend which paid features still need a post (admin action igQueue)
//   2. renders the slides (branded cover + up to 4 photos) as JPEGs into ig/<listing id>/
//   3. commits them so they're public at https://takeoverleases.com/ig/... (Instagram fetches images by URL)
//   4. publishes a carousel through the Instagram API, then reports back (admin action igPosted)
// Env: ADMIN_KEY, IG_TOKEN, IG_USER_ID, CHROME (browser path).
// Local preview: DRY_RUN=1 SAMPLE=<listing id> node .github/scripts/ig-autopost.js  (renders only, posts nothing)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const API = (fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8').match(/apiUrl:\s*['"]([^'"]+)/) || [])[1];
const SITE = 'https://takeoverleases.com';
const G = 'https://graph.facebook.com/v25.0/';
const { ADMIN_KEY, IG_TOKEN, IG_USER_ID, DRY_RUN, SAMPLE } = process.env;
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const OUT = path.join(ROOT, 'ig');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[ig]', ...a);

// Same school colors as the site (city -> school, main color, accent, hashtags)
const SCHOOLS = {
  'San Marcos, TX': ['Texas State', '#501214', '#B5975A', '#txst #texasstate #sanmarcos #sanmarcostx #txsthousing #bobcats'],
  'Austin, TX': ['UT Austin', '#BF5700', '#333F48', '#utaustin #hookem #austin #atx #westcampus'],
  'San Antonio, TX': ['UTSA', '#F15A22', '#0C2340', '#utsa #sanantonio #roadrunners #satx'],
  'College Station, TX': ['Texas A&M', '#500000', '#A7A7A7', '#tamu #texasam #aggies #collegestation'],
  'Bryan, TX': ['Texas A&M', '#500000', '#A7A7A7', '#tamu #texasam #aggies #bryantx'],
  'Houston, TX': ['UH', '#C8102E', '#76232F', '#uh #universityofhouston #houston'],
  'Denton, TX': ['UNT', '#00853E', '#005A2B', '#unt #meangreen #denton'],
  'Lubbock, TX': ['Texas Tech', '#CC0000', '#1B1B1B', '#texastech #ttu #lubbock'],
  'Waco, TX': ['Baylor', '#154734', '#FFB81C', '#baylor #sicem #waco'],
  'Arlington, TX': ['UT Arlington', '#0064B1', '#F58025', '#uta #utarlington #arlington'],
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const small = new Set(['on', 'the', 'at', 'of', 'and', 'in']);
const titleCase = (s) => String(s).trim().split(/\s+/).map((w, i) => (i && small.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
const money = (n) => '$' + Number(n).toLocaleString('en-US');
const day = (d, year) => { const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return ''; return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', year ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' }); };
const photoUrl = (id) => `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1600`;
const logo = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(ROOT, 'favicon.svg')).toString('base64');
const font = `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap" rel="stylesheet">`;

function school(l) { return SCHOOLS[l.city] || [null, '#2f5bea', '#fbbf24', '#leasetakeover #studenthousing']; }
function roomLine(l) {
  const room = l.unitType === 'unit' ? `Whole ${l.bedrooms}x${l.bathrooms}` : `Private room in a ${l.bedrooms}x${l.bathrooms}`;
  const mates = l.unitType === 'unit' ? '' : l.gender === 'Female' ? 'Girls only' : l.gender === 'Male' ? 'Guys only' : '';
  return [room, mates].filter(Boolean).join(' · ');
}

// Slide 1: the branded cover (1080x1350 = Instagram's 4:5)
function coverHtml(l) {
  const [sname, c1, c2] = school(l);
  const photo = (l.photos || [])[0];
  return `<!doctype html><html><head><meta charset="utf-8">${font}<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 1080px; height: 1350px; overflow: hidden; }
    body { font-family: Inter, 'Segoe UI', Roboto, Arial, sans-serif; background: #fff; color: #0f172a; position: relative; }
    .hero { position: absolute; top: 0; left: 0; right: 0; height: 690px; background: ${c1} center/cover no-repeat; }
    .hero.none { display: grid; place-items: center; } .hero.none img { width: 200px; height: 200px; border-radius: 44px; }
    .stripe { position: absolute; top: 690px; left: 0; right: 0; height: 14px; background: linear-gradient(90deg, ${c1} 0 64%, ${c2} 64% 100%); }
    .pills { position: absolute; top: 44px; left: 48px; display: flex; gap: 14px; flex-wrap: wrap; max-width: 980px; }
    .pill { padding: 14px 26px; border-radius: 999px; font-size: 30px; font-weight: 800; box-shadow: 0 6px 18px rgba(0,0,0,.25); }
    .feat { background: #fbbf24; color: #1e1b4b; } .cash { background: #16a34a; color: #fff; }
    .info { position: absolute; top: 734px; left: 60px; right: 60px; }
    .near { display: inline-flex; align-items: center; gap: 12px; padding: 10px 22px 10px 12px; border-radius: 999px; background: ${c1}; color: #fff; font-size: 26px; font-weight: 700; }
    .near i { width: 26px; height: 26px; border-radius: 50%; background: ${c2}; box-shadow: 0 0 0 3px rgba(255,255,255,.85); }
    .name { font-size: 62px; font-weight: 900; letter-spacing: -.03em; line-height: 1.05; margin: 22px 0 6px; }
    .rent { font-size: 104px; font-weight: 900; letter-spacing: -.04em; color: ${c1}; line-height: 1; }
    .rent small { font-size: 40px; color: #64748b; font-weight: 600; letter-spacing: 0; }
    .line { font-size: 33px; color: #475569; margin-top: 16px; } .line b { color: #0f172a; }
    .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 118px; background: #2f5bea; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 56px; }
    .brand { display: flex; align-items: center; gap: 16px; font-size: 40px; font-weight: 800; letter-spacing: -.02em; }
    .brand img { width: 62px; height: 62px; border-radius: 14px; }
    .brand span { font-size: 26px; padding: 6px 14px; border-radius: 10px; background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #1e1b4b; }
    .cta { font-size: 28px; font-weight: 700; opacity: .95; }
  </style></head><body>
    ${photo ? `<div class="hero" style="background-image:url('${photoUrl(photo)}')"></div>` : `<div class="hero none"><img src="${logo}"></div>`}
    <div class="stripe"></div>
    <div class="pills"><span class="pill feat">⭐ FEATURED</span>${l.incentive > 0 ? `<span class="pill cash">+ ${money(l.incentive)} to take it</span>` : ''}</div>
    <div class="info">
      ${sname ? `<span class="near"><i></i>Near ${esc(sname)}</span>` : ''}
      <div class="name">${esc(titleCase(l.complex))}</div>
      <div class="rent">${money(l.rent)}<small>/mo</small></div>
      <div class="line">${esc(roomLine(l))}</div>
      <div class="line">Move in <b>${esc(day(l.availableFrom) || 'now')}</b>${l.leaseEnds ? ` · until <b>${esc(day(l.leaseEnds, true))}</b>` : ''}</div>
    </div>
    <div class="bar"><div class="brand"><img src="${logo}">Takeover <span>Leases</span></div><div class="cta">takeoverleases.com</div></div>
  </body></html>`;
}

// Slides 2-5: the listing's photos, full bleed, with a small label
function photoHtml(l, photo, i, n) {
  const [, c1] = school(l);
  return `<!doctype html><html><head><meta charset="utf-8">${font}<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 1080px; height: 1350px; overflow: hidden; }
    body { font-family: Inter, 'Segoe UI', Roboto, Arial, sans-serif; background: #0f172a url('${photoUrl(photo)}') center/cover no-repeat; position: relative; }
    .tag { position: absolute; left: 40px; bottom: 40px; display: flex; align-items: center; gap: 14px; padding: 14px 24px 14px 14px; border-radius: 20px;
      background: rgba(15,23,42,.72); color: #fff; font-size: 28px; font-weight: 700; }
    .tag img { width: 48px; height: 48px; border-radius: 12px; }
    .tag b { color: #fde68a; }
    .count { position: absolute; right: 40px; bottom: 48px; padding: 10px 20px; border-radius: 999px; background: ${c1}; color: #fff; font-size: 26px; font-weight: 700; }
  </style></head><body>
    <div class="tag"><img src="${logo}">${esc(titleCase(l.complex))} · <b>${money(l.rent)}/mo</b></div>
    <div class="count">${i} / ${n}</div>
  </body></html>`;
}

function caption(l) {
  const [sname, , , tags] = school(l);
  const city = String(l.city || '').replace(/, TX$/, '');
  return [
    `⭐ Featured: ${titleCase(l.complex)} · ${money(l.rent)}/mo${sname ? ` · near ${sname}` : city ? ` · ${city}` : ''}`,
    '',
    `🏠 ${roomLine(l)}`,
    `📅 Move in ${day(l.availableFrom) || 'now'}${l.leaseEnds ? `, lease ends ${day(l.leaseEnds, true)}` : ''}`,
    l.incentive > 0 ? `💵 ${money(l.incentive)} to whoever takes it over` : null,
    l.listedBy ? `👤 Listed by ${l.listedBy}${l.tagInstagram ? ` (@${l.tagInstagram})` : ''}` : (l.tagInstagram ? `👤 @${l.tagInstagram}` : null),
    '',
    `Interested? Tap the link in our bio or go to takeoverleases.com to see every photo and reach the lister.`,
    '',
    `Want your place featured? List it on takeoverleases.com and pick "Yes, feature it".`,
    '',
    `${tags} #leasetakeover #sublease #studenthousing`,
  ].filter((x) => x !== null).join('\n');
}

async function admin(action, extra) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', body: JSON.stringify({ type: 'admin', key: ADMIN_KEY, action, ...extra }) });
  return JSON.parse(await r.text());
}
async function ig(pathPart, params, method = 'POST') {
  const url = G + pathPart + (method === 'GET' ? '?' + new URLSearchParams({ ...params, access_token: IG_TOKEN }) : '');
  const r = await fetch(url, method === 'GET' ? {} : { method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...params, access_token: IG_TOKEN }) });
  const j = await r.json();
  if (j.error) throw new Error(pathPart + ': ' + j.error.message);
  return j;
}

async function render(l) {
  let puppeteer;
  try { puppeteer = require('puppeteer-core'); } catch (_) { execSync('npm i --no-save --silent puppeteer-core@23', { cwd: ROOT, stdio: 'inherit' }); puppeteer = require(path.join(ROOT, 'node_modules', 'puppeteer-core')); }
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const dir = path.join(OUT, l.id);
  fs.mkdirSync(dir, { recursive: true });
  const photos = (l.photos || []).slice(1, 5);
  const pages = [coverHtml(l), ...photos.map((p, i) => photoHtml(l, p, i + 2, photos.length + 1))];
  const files = [];
  for (let i = 0; i < pages.length; i++) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350 });
    await page.setContent(pages[i], { waitUntil: 'networkidle0', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(dir, (i + 1) + '.jpg');
    await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
    files.push(file);
    await page.close();
  }
  await browser.close();
  return files;
}

async function waitLive(url) {
  for (let i = 0; i < 60; i++) {
    const r = await fetch(url + '?v=' + Date.now(), { method: 'HEAD' }).catch(() => null);
    if (r && r.ok && /image\/jpeg/.test(r.headers.get('content-type') || '')) return true;
    await sleep(15000);
  }
  throw new Error('image never went live: ' + url);
}

async function publish(l, files) {
  const urls = files.map((f) => `${SITE}/ig/${l.id}/${path.basename(f)}`);
  for (const u of urls) await waitLive(u);
  let creation;
  if (urls.length === 1) {
    creation = (await ig(`${IG_USER_ID}/media`, { image_url: urls[0], caption: caption(l) })).id;
  } else {
    const kids = [];
    for (const u of urls) kids.push((await ig(`${IG_USER_ID}/media`, { image_url: u, is_carousel_item: 'true' })).id);
    creation = (await ig(`${IG_USER_ID}/media`, { media_type: 'CAROUSEL', children: kids.join(','), caption: caption(l) })).id;
  }
  for (let i = 0; i < 24; i++) {
    const st = await ig(creation, { fields: 'status_code' }, 'GET');
    if (st.status_code === 'FINISHED') break;
    if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new Error('container ' + st.status_code);
    await sleep(5000);
  }
  const media = await ig(`${IG_USER_ID}/media_publish`, { creation_id: creation });
  const info = await ig(media.id, { fields: 'permalink' }, 'GET');
  return info.permalink;
}

(async () => {
  if (!SAMPLE && (!ADMIN_KEY || !IG_TOKEN)) return log('ADMIN_KEY / IG_TOKEN secrets are not set yet, so nothing to do');
  let items;
  if (SAMPLE) {
    const pub = await (await fetch(API)).json();
    const l = pub.listings.find((x) => String(x.id) === SAMPLE);
    if (!l) throw new Error('no listing ' + SAMPLE);
    items = [{ ...l, city: l.city || 'San Marcos, TX', tagInstagram: '' }];
  } else {
    const q = await admin('igQueue', {});
    if (!q.ok) throw new Error('queue: ' + (q.error || 'failed'));
    items = q.items || [];
  }
  if (!items.length) return log('nothing to post');
  for (const l of items.slice(0, 3)) {
    log('rendering', l.id, l.complex);
    const files = await render(l);
    log('caption:\n' + caption(l));
    if (DRY_RUN) { log('DRY RUN: rendered', files.length, 'slides into', path.join(OUT, l.id)); continue; }
    execSync(`git add ig/${l.id} && git -c user.name="github-actions[bot]" -c user.email="41898299+github-actions[bot]@users.noreply.github.com" commit -q -m "Instagram post images: ${l.id}" && git pull -q --rebase origin main && git push -q origin HEAD:main`, { cwd: ROOT, stdio: 'inherit' });
    try {
      const link = await publish(l, files);
      log('posted', link);
      const done = await admin('igPosted', { id: l.id, url: link });
      log('marked posted', JSON.stringify(done));
    } catch (err) {
      log('FAILED', l.id, err.message);
      process.exitCode = 1;
    }
  }
})().catch((e) => { console.error('[ig] crashed:', e.message); process.exit(1); });
