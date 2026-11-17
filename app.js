(() => {
  const CFG = window.TAKEOVER_CONFIG || {};
  const API = (CFG.apiUrl || '').trim();
  const DEMO = !API;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // Sample data shown only in demo mode (no apiUrl set). Complex names are made up.
  const DEMO_LISTINGS = [
    { id: 'demo1', submittedAt: '2026-11-03', verified: true, transferConfirmed: true, arrangement: 'takeover', complex: 'Sample Complex A (4x4)', unitType: 'bed', bedrooms: 4, bathrooms: 4, rent: 629, availableFrom: '2026-12-20', leaseEnds: '2027-07-31', gender: 'Female', furnished: 'Yes', incentive: 300, takeoverFee: '$300 transfer fee', description: 'Private bed + bath, roommates are chill. Shuttle stop out front. Leaving for an internship in Dallas.', contactMethod: 'instagram', contact: '@sample.handle' },
    { id: 'demo2', submittedAt: '2026-11-02', verified: true, transferConfirmed: false, arrangement: 'takeover', complex: 'Sample Complex B (1x1)', unitType: 'unit', bedrooms: 1, bathrooms: 1, rent: 925, availableFrom: '2027-01-05', leaseEnds: '2027-08-15', gender: 'Any', furnished: 'No', incentive: 0, takeoverFee: '80% of one month', description: 'Whole 1 bed / 1 bath, washer/dryer in unit, covered parking.', contactMethod: 'text', contact: '512-555-0100' },
    { id: 'demo3', submittedAt: '2026-11-01', verified: false, transferConfirmed: false, arrangement: 'sublease', complex: 'Sample House near The Square', unitType: 'bed', bedrooms: 3, bathrooms: 2, rent: 550, availableFrom: '2026-12-15', leaseEnds: '2027-05-31', gender: 'Male', furnished: 'No', incentive: 150, takeoverFee: 'Landlord just needs an application', description: 'Room in a 3/2 house, walkable to campus and The Square. Big backyard.', contactMethod: 'snapchat', contact: 'samplesnap' },
    { id: 'demo4', submittedAt: '2026-10-30', verified: true, transferConfirmed: false, arrangement: 'unsure', complex: 'Sample Complex C (2x2)', unitType: 'bed', bedrooms: 2, bathrooms: 2, rent: 699, availableFrom: '2027-01-10', leaseEnds: '2027-07-31', gender: 'Any', furnished: 'Yes', incentive: 500, takeoverFee: "Don't know", description: 'Transferring schools. Will cover your first month ($500) if you take it by January.', contactMethod: 'email', contact: 'sample@example.com' },
  ];

  // Show takeoversmtx.com instead of takeoversmtx.com/index.html in the address bar.
  if (/\/index\.html$/.test(location.pathname)) history.replaceState(null, '', location.pathname.replace(/index\.html$/, '') + location.search + location.hash);

  // Analytics (GoatCounter): counts an event like "view/abc123". Never breaks the page.
  function track(path, title) {
    try {
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: path, title: title || path, event: true });
    } catch (_) { /* ignore */ }
  }

  // Interested visitors: remember their info and the contacts they've unlocked (this device only).
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode */ } },
  };
  const revealed = () => store.get('tsmtx_revealed', {});

  // The main button on a listing: "I'm interested" until they share their info, then the real contact.
  // "👀 3 people interested" (🔥 at 3+). Only shown once someone has tapped it.
  function interestLine(l, cls) {
    const n = Number(l.interested) || 0;
    if (!n) return '';
    return '<p class="' + cls + (n >= 3 ? ' hot' : '') + '">' + (n >= 3 ? '🔥' : '👀') + ' <b>' + n + '</b> ' + (n === 1 ? 'person' : 'people') + ' interested</p>';
  }

  function contactBtn(l, size) {
    const r = revealed()[l.id];
    if (r && r.contact) {
      const c = contactLink({ contactMethod: r.contactMethod, contact: r.contact });
      return `<a class="btn btn-primary btn-${size}" href="${esc(c.href)}" target="_blank" rel="noopener" data-contact="${esc(l.id)}">${esc(c.label)}</a>`;
    }
    return `<button type="button" class="btn btn-primary btn-${size}" data-interest="${esc(l.id)}">I'm interested</button>`;
  }

  function openInterest(id) {
    const l = all.find((x) => x.id === id);
    if (!l) return;
    const f = $('#interest-form');
    f.reset();
    const me = store.get('tsmtx_me', {});
    ['name', 'phone', 'email'].forEach((k) => { if (me[k]) f[k].value = me[k]; });
    f.listingId.value = id;
    $$('#interest-dialog .interest-first').forEach((el) => (el.textContent = l.listedBy || 'the lister'));
    $('#interest-sub').textContent = `${l.complex} · ${money(l.rent)}/mo`;
    openDialog('interest-dialog');
  }

  async function submitInterest(form) {
    const err = $('.form-error', form);
    const msg = validate(form, 'interest');
    if (msg) { err.textContent = msg; err.hidden = false; return; }
    err.hidden = true;
    const data = Object.fromEntries(new FormData(form).entries());
    data.type = 'interest';
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    btn.textContent = 'One sec…';
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) });
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || 'failed');
      store.set('tsmtx_me', { name: data.name, phone: data.phone, email: data.email });
      const rv = revealed();
      const tapped = all.find((x) => x.id === data.listingId);
      if (tapped && !rv[data.listingId]) tapped.interested = (Number(tapped.interested) || 0) + 1;
      rv[data.listingId] = { contact: out.contact, contactMethod: out.contactMethod };
      store.set('tsmtx_revealed', rv);
      const c = contactLink({ contactMethod: out.contactMethod, contact: out.contact });
      $('#interest-contact').innerHTML = `<a class="btn btn-primary btn-lg btn-block" href="${esc(c.href)}" target="_blank" rel="noopener" data-contact="${esc(data.listingId)}">${esc(c.label)}</a>`;
      form.hidden = true;
      $('.form-success', form.closest('dialog')).hidden = false;
      offerSave('#interest-dialog', data.email);
      track('interest/' + data.listingId, 'Interested: ' + ((all.find((x) => x.id === data.listingId) || {}).complex || data.listingId));
      render();
      if (!$('#focus').hidden) focusFromHash();
    } catch (e) {
      console.error(e);
      err.textContent = e.message === 'too many' ? "You've checked a lot of listings today. Try again tomorrow."
        : e.message === 'gone' ? 'This listing was just taken or removed.'
        : 'Something went wrong. Check your connection and try again.';
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Show contact info';
    }
  }

  // "today", "yesterday", "3 days ago", "2 weeks ago" from a yyyy-mm-dd date.
  function postedAgo(v) {
    const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    const posted = new Date(+m[1], +m[2] - 1, +m[3]);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((today - posted) / 864e5);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return days + ' days ago';
    if (days < 60) return Math.floor(days / 7) + ' weeks ago';
    return Math.floor(days / 30) + ' months ago';
  }
  function byLine(l, bold) {
    const ago = postedAgo(l.submittedAt);
    const who = l.listedBy ? 'Listed by ' + (bold ? '<b>' + esc(l.listedBy) + '</b>' : esc(l.listedBy)) : 'Listed';
    return `<p class="by">${who}${ago ? ' · ' + ago : ''}</p>`;
  }

  let all = [];
  let loaded = false;
  let stats = {};
  const MIN_LOOKING_TO_SHOW = 5; // hide the "students looking" count until it's at least this
  let stories = [];

  const ARRANGEMENT = {
    takeover: { label: 'Takeover', hint: 'The lease moves into your name' },
    sublease: { label: 'Sublease', hint: 'The current tenant stays on the lease and you pay them' },
    unsure: { label: 'Takeover or sublease', hint: 'Depends on what the complex allows' },
  };

  // ---------- helpers ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
  const toDate = (iso) => (iso ? new Date(String(iso).slice(0, 10) + 'T00:00:00') : null);
  const fmtDate = (iso) => {
    const d = toDate(iso);
    return d && !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  };

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2500);
  }

  // Cities: "City, ST". Listings from before multi-city have none, so they're San Marcos.
  const DEFAULT_CITY = 'San Marcos, TX';
  function normCity(v) {
    const raw = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!raw) return DEFAULT_CITY;
    const parts = raw.split(',').map((x) => x.trim()).filter(Boolean);
    const city = parts[0].toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
    const st = parts[1] ? (/^texas$/i.test(parts[1]) ? 'TX' : parts[1].toUpperCase().slice(0, 2)) : 'TX';
    return city + ', ' + st;
  }
  const cityName = (v) => normCity(v).replace(/, TX$/, '');
  // Cities that have open places, most places first
  function openCities() {
    const m = new Map();
    all.forEach((l) => { if (!l.taken) m.set(l.city, (m.get(l.city) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([city, n]) => ({ city, n }));
  }

  function normalize(l) {
    return {
      ...l,
      city: normCity(l.city),
      id: String(l.id),
      rent: Number(l.rent) || 0,
      incentive: Number(l.incentive) || 0,
      bedrooms: l.bedrooms === '' ? '' : Number(l.bedrooms),
      bathrooms: l.bathrooms === '' ? '' : Number(l.bathrooms),
      verified: l.verified === true || String(l.verified).toLowerCase() === 'true',
      transferConfirmed: l.transferConfirmed === true || String(l.transferConfirmed).toLowerCase() === 'true',
      photos: Array.isArray(l.photos) ? l.photos.filter(Boolean) : [],
      taken: l.taken === true,
    };
  }

  // Photos are stored in Google Drive; these are two public ways to show a shared Drive image.
  const photoUrl = (id) => `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1200`;
  const photoFallbackUrl = (id) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`;

  // 5125550123 / (512) 555-0123 / +1 512... -> 512-555-0123 (partial input formats as you type)
  function formatPhone(v) {
    let d = String(v || '').replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    d = d.slice(0, 10);
    if (d.length > 6) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
    if (d.length > 3) return d.slice(0, 3) + '-' + d.slice(3);
    return d;
  }

  function contactLink(l) {
    const c = String(l.contact || '').trim();
    const handle = c.replace(/^@/, '');
    switch (l.contactMethod) {
      case 'text': return { href: 'sms:' + c.replace(/[^\d+]/g, ''), label: 'Text ' + (c.replace(/\D/g, '').length >= 10 ? formatPhone(c) : c) };
      case 'instagram': return { href: 'https://instagram.com/' + encodeURIComponent(handle), label: 'Instagram @' + handle };
      case 'snapchat': return { href: 'https://snapchat.com/add/' + encodeURIComponent(handle), label: 'Snapchat ' + handle };
      case 'email': return { href: 'mailto:' + c, label: 'Email' };
      default: return { href: '#', label: c };
    }
  }

  // ---------- board ----------
  async function load() {
    if (DEMO) {
      $('#demo-banner').hidden = false;
      all = DEMO_LISTINGS.map(normalize);
    } else {
      $('#result-count').textContent = 'Loading listings…';
      try {
        const res = await fetch(API);
        const data = await res.json();
        all = (data.listings || []).map(normalize);
        stats = data.stats || {};
        stories = Array.isArray(data.stories) ? data.stories : [];
      } catch (err) {
        console.error(err);
        $('#result-count').textContent = "Couldn't load listings. Try refreshing.";
        return;
      }
    }
    loaded = true;
    render();
    focusFromHash();
  }

  function filtered() {
    const q = $('#f-search').value.trim().toLowerCase();
    const type = $('#f-type').value;
    const gender = $('#f-gender').value;
    const arrangement = $('#f-arrangement').value;
    const max = Number($('#f-max').value) || 0;
    const moveIn = toDate($('#f-movein').value);
    const needIncentive = $('#f-incentive').checked;
    const sort = $('#f-sort').value;
    const city = $('#f-city').value;

    const list = all.filter((l) => {
      if (l.taken) return false;
      if (city && l.city !== city) return false;
      if (q && !`${l.complex} ${l.description}`.toLowerCase().includes(q)) return false;
      if (type && l.unitType !== type) return false;
      if (gender && l.unitType === 'bed' && l.gender && l.gender !== 'Any' && l.gender !== gender) return false;
      if (arrangement && l.arrangement !== arrangement) return false;
      if (max && l.rent > max) return false;
      if (moveIn && toDate(l.availableFrom) > moveIn) return false;
      if (needIncentive && !(l.incentive > 0)) return false;
      return true;
    });

    const by = {
      new: (a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)),
      cheap: (a, b) => a.rent - b.rent,
      incentive: (a, b) => b.incentive - a.incentive,
      soon: (a, b) => String(a.availableFrom).localeCompare(String(b.availableFrom)),
    }[sort];
    return list.sort(by);
  }

  const typeLabel = (l) => (l.unitType === 'unit' ? 'Whole place' : 'Private room');

  function tagsHtml(l) {
    return [
      l.transferConfirmed ? '<span class="tag confirmed has-tip" tabindex="0" data-tip-title="Transfer confirmed" data-tip="We checked with the complex that this lease can be transferred to someone new.">✓ Transfer confirmed with complex</span>' : '',
      ARRANGEMENT[l.arrangement] ? `<span class="tag arrangement has-tip" tabindex="0" data-tip-title="${esc(ARRANGEMENT[l.arrangement].label)}" data-tip="${esc(ARRANGEMENT[l.arrangement].hint)}.">${ARRANGEMENT[l.arrangement].label}</span>` : '',
      l.incentive > 0 ? `<span class="tag incentive has-tip" tabindex="0" data-tip-title="Cash incentive" data-tip="The current tenant will pay you this to take over their lease.">${money(l.incentive)} incentive</span>` : '',
      `<span class="tag">${l.unitType === 'unit' ? 'Whole unit' : 'By the bed'}</span>`,
      l.bedrooms !== '' ? `<span class="tag">${esc(l.bedrooms)} bd / ${esc(l.bathrooms)} ba</span>` : '',
      l.unitType === 'bed' && l.gender && l.gender !== 'Any' ? `<span class="tag">${esc(l.gender)} roommates</span>` : '',
      l.furnished === 'Yes' ? '<span class="tag">Furnished</span>' : '',
    ].join('');
  }

  // Swipeable photo strip with arrows + counter. `thumbs` adds a clickable thumbnail row (details page).
  function photosHtml(l, { thumbs = false } = {}) {
    const n = l.photos.length;
    if (!n) return '';
    const strip = `<div class="photo-wrap">
        <div class="photos">${l.photos.map((id, i) => `<img src="${esc(photoUrl(id))}" data-fallback="${esc(photoFallbackUrl(id))}" alt="Photo ${i + 1} of ${esc(l.complex)}" ${i ? 'loading="lazy"' : ''}>`).join('')}</div>
        ${n > 1 ? `
          <button type="button" class="photo-nav prev" data-photo-nav="-1" aria-label="Previous photo">&#8249;</button>
          <button type="button" class="photo-nav next" data-photo-nav="1" aria-label="Next photo">&#8250;</button>
          <span class="photo-counter">1 / ${n}</span>` : ''}
      </div>`;
    const row = thumbs && n > 1
      ? `<div class="thumbs">${l.photos.map((id, i) => `<button type="button" class="thumb-btn${i ? '' : ' active'}" data-thumb="${i}" aria-label="Show photo ${i + 1}"><img src="${esc(photoUrl(id).replace('=w1200', '=w300'))}" data-fallback="${esc(photoFallbackUrl(id))}" alt="" loading="lazy"></button>`).join('')}</div>`
      : '';
    return strip + row;
  }

  // "Nov 20" (or "now" if it's already available)
  function shortDate(iso) {
    const d = toDate(iso);
    if (!d) return '';
    return d <= new Date() ? 'now' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function detailBits(l) {
    return [
      l.unitType === 'unit' ? 'Whole place' : 'Private room',
      l.bedrooms !== '' && l.bedrooms != null ? l.bedrooms + ' bd / ' + l.bathrooms + ' ba' : '',
      l.unitType === 'bed' && l.gender === 'Female' ? 'Girls' : l.unitType === 'bed' && l.gender === 'Male' ? 'Guys' : '',
      l.furnished === 'Yes' ? 'Furnished' : '',
      l.arrangement === 'sublease' ? 'Sublease' : '',
    ].filter(Boolean);
  }
  function card(l) {
    const media = photosHtml(l) || '<div class="lc-placeholder"><span>🏠</span><small>' + esc(l.complex) + '</small></div>';
    const move = shortDate(l.availableFrom);
    return `
      <article class="card clickable lcard${l.incentive > 0 ? ' has-incentive' : ''}" id="l-${esc(l.id)}" data-listing="${esc(l.id)}" tabindex="0" aria-label="View details for ${esc(l.complex)}">
        <div class="lc-media">
          ${media}
          ${l.incentive > 0 ? `<span class="lc-incentive">💵 ${money(l.incentive)} incentive</span>` : ''}
        </div>
        <div class="lc-body">
          <div class="lc-price">${money(l.rent)}<small>/mo</small></div>
          <h3 class="lc-name">${esc(l.complex)}</h3>
          ${openCities().length > 1 ? `<p class="lc-city">📍 ${esc(cityName(l.city))}</p>` : ''}
          <p class="lc-meta">${detailBits(l).map(esc).join(' · ')}</p>
          <p class="lc-dates">Move in <b>${esc(move)}</b>${l.leaseEnds ? ' · until ' + esc(fmtDate(l.leaseEnds)) : ''}</p>
          ${interestLine(l, 'interest-line')}
          <div class="lc-actions">${contactBtn(l, 'sm')}</div>
          <div class="lc-foot">
            <span>${l.listedBy ? esc(l.listedBy) + ' · ' : ''}${esc(postedAgo(l.submittedAt) || '')}</span>
            <button type="button" class="card-report" data-report="${esc(l.id)}" aria-label="Report this listing" title="Report this listing">⚑ Report</button>
          </div>
        </div>
      </article>`;
  }

  // Full details page for one listing.
  function detail(l) {
    const arr = ARRANGEMENT[l.arrangement];
    const facts = [
      ['📝', 'Lease', arr ? `${arr.label}<small>${esc(arr.hint)}</small>` : ''],
      ['🛏️', 'Room', esc(typeLabel(l))],
      ['🛁', 'Bed / bath', l.bedrooms !== '' ? `${esc(l.bedrooms)} bed · ${esc(l.bathrooms)} bath` : ''],
      ['👥', 'Roommates', l.unitType === 'bed' ? esc(l.gender && l.gender !== 'Any' ? `${l.gender} only` : 'Any') : ''],
      ['🛋️', 'Furnished', esc(l.furnished || '')],
      ['📅', 'Available', esc(fmtDate(l.availableFrom))],
      ['🗓️', 'Lease ends', esc(fmtDate(l.leaseEnds))],
      ['💳', 'Transfer fee', esc(l.takeoverFee && !/^n\/?a$/i.test(l.takeoverFee) ? l.takeoverFee : 'Ask the complex')],
    ].filter(([, , v]) => v);

    return `
      <article class="detail">
        <div class="detail-main">
          <div class="detail-gallery">${photosHtml(l, { thumbs: true })}</div>
          <div class="detail-intro">
            <h1>${esc(l.complex)}</h1>
            ${byLine(l, true)}
            <p class="detail-meta">${detailBits(l).map(esc).join(" · ")}</p>
          </div>
          ${l.incentive > 0 ? `<div class="callout">💵 The current tenant is offering <b>${money(l.incentive)}</b> to whoever takes over this lease.</div>` : ''}
          <section class="detail-section">
            <h2>The details</h2>
            <dl class="facts">${facts.map(([ic, k, v]) => `<div class="fact"><span class="fact-ic">${ic}</span><div><dt>${k}</dt><dd>${v}</dd></div></div>`).join('')}</dl>
          </section>
          ${l.description ? `<section class="detail-section"><h2>About this place</h2><p class="detail-desc">${esc(l.description)}</p></section>` : ''}
          <p class="detail-note report-line"><button type="button" class="link-btn" data-report="${esc(l.id)}">Report this listing</button></p>
        </div>
        <aside class="detail-side">
          <div class="action-card">
            <div class="detail-rent">${money(l.rent)}<small>/mo</small></div>
            <p class="action-sub">${esc(typeLabel(l))} · Move in <b>${esc(shortDate(l.availableFrom))}</b></p>
            ${l.incentive > 0 ? `<p class="action-inc">+ ${money(l.incentive)} cash incentive</p>` : ''}
            ${interestLine(l, 'interest-line big')}
            <div class="detail-actions">
              ${contactBtn(l, 'lg')}
              <button type="button" class="btn btn-outline btn-lg" data-share="${esc(l.id)}">Share</button>
            </div>
            <p class="detail-note">Tour before committing, and pay rent and fees to the complex, not a stranger. <a href="/how-it-works">How takeovers work →</a></p>
          </div>
          <div class="owner-note">Is this your listing? <button type="button" class="link-btn owner-link" data-my-listings>Edit it or take it down</button></div>
        </aside>
      </article>
      <div class="detail-bar">
        <div class="bar-price"><b>${money(l.rent)}</b><small>/mo</small></div>
        ${contactBtn(l, 'lg')}
      </div>`;
  }

  function render() {
    const list = filtered();
    const live = all.filter((l) => !l.taken);
    const taken = all.filter((l) => l.taken);
    if (live.length) {
      const cs = openCities();
      $('#live-count').textContent = live.length + (live.length === 1 ? ' place' : ' places') + ' open ' + (cs.length > 1 ? 'in ' + cs.length + ' cities' : 'in ' + cityName(cs[0].city));
      $('#tb-count').textContent = live.length + ' places';
    }
    // City filter: only shown once there's more than one city
    {
      const cs = openCities(), sel = $('#f-city'), cur = sel.value;
      sel.innerHTML = '<option value="">All cities</option>' + cs.map((c) => '<option value="' + esc(c.city) + '">' + esc(cityName(c.city)) + '</option>').join('');
      if (cur && !cs.some((c) => c.city === cur)) sel.add(new Option(cityName(cur), cur));
      sel.value = cur;
      (sel.closest('.dd') || sel).hidden = cs.length < 2 && !cur;
      const shown = cur || (cs.length === 1 ? cs[0].city : '');
      $('#board-title').textContent = shown ? 'Lease takeovers in ' + cityName(shown) : 'Lease takeovers';
    }
    const cta = `<div class="alert-cta"><div><b>Don't see the right place?</b><span>Get a text or email the moment one fits your budget and move-in date. Free.</span></div><button type="button" class="btn btn-primary" data-open="waitlist-dialog" data-cta="board">Get alerts</button></div>`;
    const cards = list.map(card);
    if (cards.length) cards.splice(Math.min(6, cards.length), 0, cta);
    $('#listings').innerHTML = cards.join('');
    [...$('#listings').children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 9)));
    bindPhotoCounters($('#listings'));
    $('#empty').hidden = list.length > 0;
    $('#result-count').textContent = live.length
      ? `${list.length} of ${live.length} takeover${live.length === 1 ? '' : 's'}`
      : '';
    // Ones found through us first, newest first.
    taken.sort((a, b) => (b.viaUs - a.viaUs) || String(b.takenAt || '').localeCompare(String(a.takenAt || '')));
    $('#taken-listings').innerHTML = taken.map(takenCard).join('');
    $('#taken-wrap').hidden = taken.length === 0;
    $('#taken-wrap .taken-head').textContent = taken.some((l) => l.viaUs) ? 'Taken through Takeover SMTX' : 'Recently taken';
    $('#story-list').innerHTML = stories.map((s) => `
      <figure class="story">
        <blockquote>“${esc(s.quote)}”</blockquote>
        <figcaption><b>${esc(s.name)}</b>${s.complex ? ` · ${esc(s.complex)}` : ''}${s.daysToTake ? ` · taken in ${esc(s.daysToTake)} day${s.daysToTake == 1 ? '' : 's'}` : ''}</figcaption>
      </figure>`).join('');
    $('#stories').hidden = stories.length === 0;
    // Real demand: only shown once enough people are looking that it means something.
    const looking = Number(stats.looking) || 0;
    const showLooking = looking >= MIN_LOOKING_TO_SHOW;
    $('#looking-stat').hidden = !showLooking;
    $('#looking-note').hidden = !showLooking;
    if (live.length) $('#live-count').textContent = live.length + (live.length === 1 ? ' place' : ' places') + ' open' + (showLooking ? ' · ' + looking + ' people looking' : (openCities().length > 1 ? ' in ' + openCities().length + ' cities' : ' in ' + cityName((openCities()[0] || {}).city)));
    if (showLooking) {
      $('#looking-stat').innerHTML = `<span class="pulse"></span><b>${looking}</b> students looking for a place right now`;
      $('#looking-note').innerHTML = `👀 <b>${looking} students</b> are looking for a place right now and get notified when listings like yours go up.`;
    }
    const n = Number(stats.successes) || 0;
    $('#success-stat').hidden = n === 0;
    if (n) $('#success-stat').innerHTML = `<b>${n}</b> lease${n === 1 ? '' : 's'} taken over through Takeover SMTX`;
  }

  // A listing someone already took: stamped, faded, not clickable. Shows the site works.
  function takenCard(l) {
    const p = l.photos[0];
    return `
      <article class="card taken-card" aria-label="${esc(l.complex)}, taken">
        ${p ? `<div class="taken-photo"><img src="${esc(photoUrl(p))}" alt="" loading="lazy" data-fallback="${esc(photoFallbackUrl(p))}"></div>` : ''}
        <span class="taken-stamp">Taken ✓</span>
        <div class="card-top">
          <h3>${esc(l.complex)}</h3>
          <div class="rent">${money(l.rent)}<small>/mo</small></div>
        </div>
        <p class="by">${l.daysToTake ? `Taken in <b>${esc(l.daysToTake)} day${l.daysToTake === 1 ? '' : 's'}</b>` : (l.unitType === 'unit' ? 'Whole unit' : 'Room')}${l.listedBy ? ` · ${esc(l.listedBy)}` : ''}</p>
      </article>`;
  }

  // Keep the "2 / 5" counter and active thumbnail in sync when people swipe or use the arrows.
  function bindPhotoCounters(root) {
    $$('.photos', root).forEach((strip) =>
      strip.addEventListener('scroll', () => {
        const total = strip.querySelectorAll('img').length;
        const current = Math.min(total, Math.round(strip.scrollLeft / strip.clientWidth) + 1);
        const counter = strip.parentElement.querySelector('.photo-counter');
        if (counter) counter.textContent = `${current} / ${total}`;
        const thumbs = strip.parentElement.nextElementSibling;
        if (thumbs && thumbs.classList.contains('thumbs')) {
          $$('.thumb-btn', thumbs).forEach((b, i) => b.classList.toggle('active', i === current - 1));
        }
      }, { passive: true })
    );
  }

  // Listing details page: takeoversmtx.com/#l-abc123 (from a card click or a shared link).
  let boardScroll = null; // where the visitor was on the board, so "back" returns them there

  function focusFromHash() {
    const m = location.hash.match(/^#l-(.+)$/);
    if (!m) return exitFocus();
    const l = all.find((x) => x.id === m[1]);
    if (!loaded) return; // listings still loading; load() calls this again when done
    $('#focus-card').innerHTML = l && l.taken
      ? `<div class="empty"><h3>This place at ${esc(l.complex)} has been taken. 🎉</h3><p>Someone found it here. See what else is up for takeover, or get alerts when new places are listed.</p></div>`
      : l
      ? detail(l)
      : `<div class="empty"><h3>This listing isn't available anymore.</h3><p>It may have already been taken. See what else is up for takeover.</p></div>`;
    bindPhotoCounters($('#focus-card'));
    $('#focus').hidden = false;
    document.body.classList.add('focus-mode');
    document.title = l ? `${l.complex} · ${money(l.rent)}/mo | Takeover SMTX` : 'Takeover SMTX';
    if (l) track('view/' + l.id, 'Listing view: ' + l.complex);
    window.scrollTo(0, 0);
  }

  function exitFocus() {
    if ($('#focus').hidden) return;
    $('#focus').hidden = true;
    document.body.classList.remove('focus-mode');
    document.title = 'Takeover SMTX: San Marcos lease takeovers in one place';
    if (boardScroll !== null) {
      const y = boardScroll;
      boardScroll = null;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  }

  function openListing(id) {
    boardScroll = window.scrollY;
    location.hash = 'l-' + id; // hashchange → focusFromHash
  }

  function backToBoard() {
    if (boardScroll !== null) {
      history.back(); // came from the board: go back to the exact spot
    } else {
      location.hash = 'board'; // came from a shared link
    }
  }

  async function share(id) {
    const l = all.find((x) => x.id === id);
    track('share/' + id, 'Share: ' + (l ? l.complex : id));
    const url = location.origin + location.pathname + '#l-' + id;
    const text = l ? `Lease takeover: ${l.complex}, ${money(l.rent)}/mo${l.incentive ? ` + ${money(l.incentive)} incentive` : ''}` : 'Lease takeover';
    if (navigator.share) {
      try { await navigator.share({ title: text, text, url }); return; } catch (_) { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch (_) {
      prompt('Copy this link:', url);
    }
  }

  // ---------- dialogs ----------
  function openDialog(id, opts) {
    if (id === 'listing-dialog' && !(opts && opts.skipGate) && CFG.requireAccountToList !== false && window.supabase && CFG.supabaseUrl) {
      if (!authChecked) { setTimeout(() => openDialog(id, opts), 250); return; }
      if (!session) {
        afterSignIn = () => openDialog('listing-dialog');
        afterKind = 'list';
        openSignIn({ title: 'Sign in to list your place', hint: "So you can see who's interested and manage your listing in one place. No password, we'll email you a code." });
        track('gate/listing', 'Sign in asked before listing');
        return;
      }
    }
    if (id === 'listing-dialog' || id === 'waitlist-dialog' || id === 'interest-dialog') setTimeout(prefillFromAccount);
    track('open/' + id.replace('-dialog', ''), 'Opened form: ' + id.replace('-dialog', ''));
    const d = document.getElementById(id);
    $('form', d).hidden = false;
    $('.form-success', d).hidden = true;
    $('.form-error', d).hidden = true;
    if (id === 'listing-dialog') {
      $('#verify-step').hidden = true;
      nudged = false;
      $('#ig-tag').value = '';
      $('#feature-offer [name=wantsFeature][value=false]').checked = true;
      syncFeature();
      wizShow(1, true);
    }
    if (id === 'waitlist-dialog') {
      const f = $('#waitlist-form');
      alertWiz.show(1, true);
      if ($('#f-max').value && !f.maxRent.value) f.maxRent.value = $('#f-max').value;
      if ($('#f-movein').value && !f.moveIn.value) f.moveIn.value = $('#f-movein').value;
      if ($('#f-type').value) f.unitType.value = $('#f-type').value;
      const g = $('#f-gender').value && f.querySelector('[name=gender][value="' + $('#f-gender').value + '"]');
      if (g) g.checked = true;
      syncWhenFromDate();
      updateFits();
    }
    d.showModal();
  }

  function openReport(id) {
    const l = all.find((x) => x.id === id);
    const f = $('#report-form');
    f.reset();
    f.listingId.value = id;
    f.listingName.value = l ? l.complex : '';
    $('#report-listing-name').textContent = l ? `${l.complex}, ${money(l.rent)}/mo` : '';
    openDialog('report-dialog');
  }

  // ---------- photos ----------
  const MAX_PHOTOS = 8;
  let photos = []; // [{ dataUrl }] new uploads, or [{ existingId, dataUrl }] photos already on the listing
  let editing = null; // { id, token } while editing an existing listing

  // Shrink photos on the device before upload: max 1280px, JPEG. Keeps uploads fast on cell data.
  function compressImage(file, maxDim = 1280, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unsupported image')); };
      img.src = url;
    });
  }

  function renderPhotoPreviews() {
    $('#photo-previews').innerHTML = photos
      .map((p, i) => `<div class="thumb"><img src="${p.dataUrl}" alt="Photo ${i + 1}"><button type="button" data-remove-photo="${i}" aria-label="Remove photo">&times;</button></div>`)
      .join('');
    $('#photo-add').hidden = photos.length >= MAX_PHOTOS;
  }

  // ---------- edit an existing listing (private link: #edit-<id>.<token>) ----------
  async function startEdit(id, token) {
    const d = $('#listing-dialog');
    const f = $('#listing-form');
    openDialog('listing-dialog', { skipGate: true });
    $('#listing-title').textContent = 'Loading your listing…';
    f.hidden = true;
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ type: 'editLoad', id, t: token }) });
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || 'failed');
      editing = { id, token };
      f.reset();
      Object.entries(out.listing).forEach(([k, v]) => {
        const el = f.elements[k];
        if (!el || v === null || v === undefined) return;
        el.value = String(v);
      });
      syncContactInput();
      if (out.listing.contactMethod === 'text') f.contact.value = formatPhone(out.listing.contact);
      photos = (out.photos || []).map((pid) => ({ existingId: pid, dataUrl: photoUrl(pid) }));
      renderPhotoPreviews();
      proof = null;
      renderProof();
      placeVerifyCard(false); // lease screenshots are turned off
      $('#listing-title').textContent = 'Edit your listing';
      $('#edit-takedown').hidden = !out.takeDownUrl;
      $('#edit-takedown-link').href = out.takeDownUrl || '#';
      $('button[type=submit]', f).textContent = 'Save changes';
      f.hidden = false;
    } catch (e) {
      console.error(e);
      editing = null;
      $('#listing-title').textContent = "This edit link isn't working";
      const err = $('.form-error', f);
      f.hidden = false;
      err.textContent = 'The link may be old or the listing was removed. Reply to any of our emails and we will fix it for you.';
      err.hidden = false;
    }
  }

  function endEdit() {
    if (!editing) return;
    editing = null;
    const f = $('#listing-form');
    f.reset();
    clearPhotos();
    syncContactInput();
    placeVerifyCard(false);
    $('#edit-takedown').hidden = true;
    $('#listing-title').textContent = 'List your lease';
    $('#listing-success-title').textContent = "You're listed! 🎉";
    $('#listing-dialog .form-success').classList.remove('is-edit');
    $('button[type=submit]', f).textContent = 'Submit listing';
    if (/^#edit-/.test(location.hash)) history.replaceState(null, '', location.pathname);
  }
  $('#listing-dialog').addEventListener('close', endEdit);

  async function addPhotos(files) {
    const err = $('#listing-form .form-error');
    err.hidden = true;
    const room = MAX_PHOTOS - photos.length;
    const picked = [...files].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    let failed = 0;
    for (const file of picked.slice(0, room)) {
      try {
        photos.push({ dataUrl: await compressImage(file) });
      } catch (_) {
        failed++;
      }
      renderPhotoPreviews();
    }
    if (picked.length > room) {
      err.textContent = `Only ${MAX_PHOTOS} photos allowed. Extra photos were skipped.`;
      err.hidden = false;
    } else if (failed) {
      err.textContent = "Some photos couldn't be read. Try a screenshot of the photo, or a JPG/PNG.";
      err.hidden = false;
    }
  }

  function clearPhotos() {
    nudged = false;
    photos = [];
    renderPhotoPreviews();
    proof = null;
    renderProof();
  }

  // Lease screenshot for the Verified badge (private; never shown on the site).
  let proof = null;
  let nudged = false; // the "One last thing" step was shown for this listing
  // The verify card lives in the step after Submit, or inline in the form while editing an unverified listing.
  function placeVerifyCard(inForm) {
    const card = $('#verify-card'), slot = $('#verify-slot');
    if (inForm) slot.appendChild(card); else $('#verify-step').insertBefore(card, $('.verify-actions'));
    slot.hidden = !inForm;
  }
  function showVerifyStep(show) {
    $('#listing-dialog').dataset.dir = show ? '1' : '-1';
    if (show) {
      const f = $('#listing-form');
      $('#fo-mock-name').textContent = f.complex.value.trim() || 'Your place';
      $('#fo-mock-price').innerHTML = (f.rent.value ? money(f.rent.value) : '$—') + '<small>/mo</small>';
    }
    $('#listing-form').hidden = show;
    $('#verify-step').hidden = !show;
    if (show) $('#listing-dialog').scrollTop = 0;
  }
  function renderProof() {
    const box = $('#proof-preview');
    box.hidden = !proof;
    box.innerHTML = proof ? `<div class="thumb"><img src="${proof}" alt="Lease screenshot"><button type="button" data-remove-proof aria-label="Remove screenshot">&times;</button></div><span class="proof-ok">✓ Screenshot added</span>` : '';
    $('#proof-add').hidden = !!proof;
  }
  $('#proof-input').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { proof = await compressImage(f, 1800, 0.82); } // bigger so the text stays readable
    catch (_) {
      const err = $('#listing-form .form-error');
      err.textContent = "That image type isn't supported. Try a screenshot (PNG or JPG).";
      err.hidden = false;
    }
    renderProof();
  });

  // ---------- forms ----------
  function validate(form, type) {
    if (type === 'waitlist' && Number(form.maxRent.value) > 0 && !form.moveIn.value) return 'Please pick when you want to move in.';
    if (!form.checkValidity()) {
      const bad = form.querySelector('input:invalid, select:invalid, textarea:invalid');
      if (bad.type === 'tel' && bad.value) return 'Please enter a full 10-digit phone number.';
      if (bad.type === 'radio') return `Please pick one for "${bad.closest('fieldset')?.querySelector('legend')?.childNodes[0]?.textContent.trim() || bad.name}".`;
      return `Please fill in "${bad.closest('label')?.childNodes[0]?.textContent.trim() || bad.name}".`;
    }
    if (type === 'listing' && form.availableFrom.value > form.leaseEnds.value) {
      return 'The "available from" date must be before the lease end date.';
    }
    return '';
  }

  async function submit(form, type) {
    const err = $('.form-error', form);
    const msg = validate(form, type);
    if (msg) { err.textContent = msg; err.hidden = false; return; }
    err.hidden = true;

    const data = Object.fromEntries(new FormData(form).entries());
    data.type = type;
    if (type === 'feedback') data.page = location.pathname + location.hash;
    if (type === 'waitlist') {
      const byEmail = data.notifyBy === 'email';
      $('#waitlist-success-text').textContent = byEmail
        ? "We'll email you as soon as something matching what you want is listed. If anything already fits, it's on its way now."
        : "We'll text you when something matching what you want is listed.";
      $('#waitlist-spam-note').hidden = !byEmail;
      const fits = fitsFor(form) || [];
      const box = $('#waitlist-fits');
      box.innerHTML = fits.length
        ? '<p class="fits-head">Places that fit you right now:</p>' +
          fits.slice(0, 4).map((l) => `<a class="fit-row" href="#l-${esc(l.id)}" data-close><span>${esc(l.complex)}</span><b>${money(l.rent)}/mo</b></a>`).join('') +
          (fits.length > 4 ? `<p class="muted">+ ${fits.length - 4} more on the board</p>` : '')
        : '';
      box.hidden = !fits.length;
      data.name = String(data.name || '').trim();
      delete data.moveWhen;
    }
    if (type === 'listing' && editing) {
      const err2 = $('.form-error', form);
      const btn2 = $('button[type=submit]', form);
      btn2.disabled = true;
      btn2.textContent = photos.some((p) => !p.existingId) ? 'Uploading photos…' : 'Saving…';
      try {
        const body = {
          type: 'edit', id: editing.id, t: editing.token, fields: data,
          items: photos.map((p) => (p.existingId ? { id: p.existingId } : { b64: p.dataUrl.split(',')[1] })),
          proof: proof ? proof.split(',')[1] : '',
        };
        const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        const out = await res.json();
        if (!out.ok) throw new Error(out.error || 'failed');
        form.hidden = true;
        $('#listing-success-title').textContent = out.status === 'pending' ? 'Saved. We will give it a quick look.' : 'Your changes are saved.';
        $('.form-success', form.closest('dialog')).classList.add('is-edit');
        $('.form-success', form.closest('dialog')).hidden = false;
        track('edited/listing', 'Edited listing');
        load(); // the form resets itself when the dialog closes (endEdit)
      } catch (e) {
        console.error(e);
        err2.textContent = 'Could not save your changes. Check your connection and try again.';
        err2.hidden = false;
      } finally {
        btn2.disabled = false;
        btn2.textContent = 'Save changes';
      }
      return;
    }
    if (type === 'listing' && !nudged) {
      nudged = true;
      // Listed with Instagram as their contact? Pre-fill the tag box.
      if (!$('#ig-tag').value && form.contactMethod.value === 'instagram') $('#ig-tag').value = form.contact.value.trim().replace(/^@/, '');
      showVerifyStep(true);
      track('nudge/verify', 'Verify step shown');
      return;
    }
    if (type === 'listing') data.photos = photos.map((p) => p.dataUrl.split(',')[1]);
    if (type === 'listing' && proof) data.proof = proof.split(',')[1];
    if (type === 'listing') data.tagInstagram = $('#feature-offer [name=wantsFeature][value=true]:checked') ? $('#ig-tag').value.trim() : '';
    if (type === 'listing') {
      const pick = $('#feature-offer [name=wantsFeature]:checked');
      data.wantsFeature = !!pick && pick.value === 'true';
      $('#feature-pay').hidden = !data.wantsFeature;
      $('#feature-cta').hidden = data.wantsFeature;
      if (data.wantsFeature) track('feature/chose-yes', 'Listing: wants Instagram feature');
    }
    const btn = $('button[type=submit]', form);
    const btnText = btn.textContent;
    btn.disabled = true;
    if (type === 'listing' && photos.length) btn.textContent = 'Uploading photos…';

    try {
      if (DEMO) {
        console.log('[demo] would submit', { ...data, photos: (data.photos || []).length + ' photo(s)' });
      } else {
        // text/plain avoids a CORS preflight; Apps Script still reads the JSON body.
        await fetch(API, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(data),
        });
      }
      track('submitted/' + type, 'Submitted: ' + type);
      // Monthly fee on? Go straight to the free-trial pop-up (no "you're listed" until it's really going live).
      if (type === 'listing' && !editing) {
        btn.textContent = 'Finishing up…';
        const trialOpened = await startTrial('', { fromListing: true, thenFeature: !!data.wantsFeature, complex: data.complex });
        if (trialOpened) { form.reset(); clearPhotos(); return; }
      }
      form.reset();
      if (type === 'waitlist') { syncNotifyBy(); resetWhen(); }
      if (type === 'listing') clearPhotos();
      form.hidden = true;
      const ok = $('.form-success', form.closest('dialog'));
      ok.hidden = false;
      if (type === 'listing' && !editing) {
        const sub = $('#listing-success-sub');
        if (sub) sub.textContent = data.complex ? 'Nice work. Your place at ' + data.complex + ' will be on the board in a few minutes.' : 'Nice work. Your place will be on the board in a few minutes.';
        celebrate(ok);
        if (data.wantsFeature) setTimeout(() => featurePay('', { fromListing: true }), 1600);
      }
      if (type === 'waitlist') offerSave('#waitlist-dialog', data.email);
    } catch (e) {
      console.error(e);
      err.textContent = 'Something went wrong. Check your connection and try again.';
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = btnText;
    }
  }

  // ---------- wire up ----------
  ['#f-search', '#f-city', '#f-type', '#f-gender', '#f-arrangement', '#f-max', '#f-movein', '#f-incentive', '#f-sort'].forEach((s) =>
    $(s).addEventListener('input', render)
  );

  document.addEventListener('click', (e) => {
    const ct = e.target.closest('[data-contact]');
    if (ct) {
      const cl = all.find((x) => x.id === ct.dataset.contact);
      track('contact/' + ct.dataset.contact, 'Contact tap: ' + (cl ? cl.complex : ct.dataset.contact));
    }
    const open = e.target.closest('[data-open]');
    if (open && open.dataset.cta) track('cta/' + open.dataset.cta, 'Alerts button: ' + open.dataset.cta);
    if (open) return openDialog(open.dataset.open);
    const close = e.target.closest('[data-close]');
    if (close) return close.closest('dialog').close();
    const sh = e.target.closest('[data-share]');
    if (sh) return share(sh.dataset.share);
    const rp = e.target.closest('[data-report]');
    if (rp) return openReport(rp.dataset.report);
    const nav = e.target.closest('[data-photo-nav]');
    if (nav) {
      const strip = nav.parentElement.querySelector('.photos');
      const dir = Number(nav.dataset.photoNav);
      const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2;
      const atStart = strip.scrollLeft <= 2;
      // Wrap around at either end.
      if (dir > 0 && atEnd) strip.scrollTo({ left: 0, behavior: 'smooth' });
      else if (dir < 0 && atStart) strip.scrollTo({ left: strip.scrollWidth, behavior: 'smooth' });
      else strip.scrollBy({ left: dir * strip.clientWidth, behavior: 'smooth' });
      return;
    }
    const th = e.target.closest('[data-thumb]');
    if (th) {
      const strip = th.closest('.thumbs').previousElementSibling.querySelector('.photos');
      strip.scrollTo({ left: Number(th.dataset.thumb) * strip.clientWidth, behavior: 'smooth' });
      return;
    }
    if (e.target.closest('[data-see-all]')) return backToBoard();
    if (e.target.closest('[data-remove-proof]')) { proof = null; renderProof(); return; }
    if (e.target.closest('[data-verify-submit]')) { if (proof) track('verify/added', 'Verify screenshot added'); showVerifyStep(false); $('#listing-form').requestSubmit(); return; }
    if (e.target.closest('[data-verify-back]')) { nudged = false; showVerifyStep(false); return; }
    if (e.target.closest('[data-switch-manage]')) { $('#listing-dialog').close(); setTimeout(goMyListings, 300); return; }
    const iv = e.target.closest('[data-interest]');
    if (iv) { e.preventDefault(); openInterest(iv.dataset.interest); return; }
    const rm = e.target.closest('[data-remove-photo]');
    if (rm) { photos.splice(Number(rm.dataset.removePhoto), 1); renderPhotoPreviews(); return; }

    const tipEl = e.target.closest(".has-tip");
    if (tipEl) { e.preventDefault(); return showTip(tipEl); }
    if (!e.target.closest("#tip")) hideTip();

    // Clicking anywhere on a listing card opens its details page.
    // The contact button (text / Instagram / email) still works as normal.
    const cardEl = e.target.closest('.card.clickable');
    if (cardEl) {
      const a = e.target.closest('a');
      if (a && !a.getAttribute('href').startsWith('#l-')) return;
      e.preventDefault();
      openListing(cardEl.dataset.listing);
    }
  });

  // ---------- badge tooltips ----------
  const hoverCapable = window.matchMedia("(hover: hover)").matches;
  const tip = document.createElement("div");
  tip.id = "tip"; tip.setAttribute("role", "tooltip"); tip.hidden = true;
  document.body.appendChild(tip);
  let tipShownFor = null;
  function showTip(el) {
    tipShownFor = el;
    tip.innerHTML = "<strong>" + esc(el.dataset.tipTitle || "") + "</strong><span>" + esc(el.dataset.tip) + "</span>";
    // Inside an open popup (like the listing form), the tip has to live in the popup or it shows behind it.
    const host = el.closest("dialog[open]") || document.body;
    if (tip.parentNode !== host) host.appendChild(tip);
    tip.hidden = false; tip.classList.remove("below");
    const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect(), pad = 12;
    let left = r.left + r.width / 2 - t.width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - t.width - pad));
    let top = r.top - t.height - 10;
    if (top < pad) { top = r.bottom + 10; tip.classList.add("below"); }
    tip.style.left = left + "px"; tip.style.top = top + "px";
    tip.style.setProperty("--arrow-x", (r.left + r.width / 2 - left) + "px");
    requestAnimationFrame(() => tip.classList.add("show"));
  }
  function hideTip() { tipShownFor = null; tip.classList.remove("show"); tip.hidden = true; }
  if (hoverCapable) {
    document.addEventListener("mouseover", (e) => { const el = e.target.closest(".has-tip"); if (el && el !== tipShownFor) showTip(el); });
    document.addEventListener("mouseout", (e) => { const el = e.target.closest(".has-tip"); if (el && !el.contains(e.relatedTarget)) hideTip(); });
  }
  document.addEventListener("focusin", (e) => { if (e.target.classList && e.target.classList.contains("has-tip")) showTip(e.target); });
  document.addEventListener("focusout", (e) => { if (e.target === tipShownFor) hideTip(); });
  window.addEventListener("scroll", hideTip, { passive: true, capture: true });
  window.addEventListener("resize", hideTip);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideTip(); });

  // ---------- number-only fields ----------
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.matches) return;
    if (el.matches('[data-digits]')) el.value = el.value.replace(/\D/g, '');
    else if (el.matches('[data-decimal]')) el.value = el.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    else if (el.matches('[data-phone]') && el.type === 'tel') el.value = formatPhone(el.value);
  }, true);

  // The listing contact box changes with the method: number pad + dashes for Text, normal keyboard otherwise.
  const contactMethodEl = { get value() { return $('#listing-form').contactMethod.value; } };
  const contactEl = $('#listing-form [name=contact]');
  const CONTACT_INPUT = {
    text: { type: 'tel', mode: 'tel', ph: '512-555-0123', ac: 'tel' },
    instagram: { type: 'text', mode: 'text', ph: '@yourhandle', ac: 'off' },
    snapchat: { type: 'text', mode: 'text', ph: 'yourusername', ac: 'off' },
    email: { type: 'email', mode: 'email', ph: 'you@example.com', ac: 'email' },
  };
  function syncContactInput() {
    const cfg = CONTACT_INPUT[contactMethodEl.value] || CONTACT_INPUT.text;
    const wasPhone = contactEl.type === 'tel';
    contactEl.type = cfg.type; contactEl.inputMode = cfg.mode;
    contactEl.placeholder = cfg.ph; contactEl.autocomplete = cfg.ac;
    if (cfg.type === 'tel') { contactEl.pattern = '[0-9]{3}-[0-9]{3}-[0-9]{4}'; contactEl.value = formatPhone(contactEl.value); }
    else { contactEl.removeAttribute('pattern'); if (wasPhone) contactEl.value = ''; }
  }
  $$('#listing-form [name=contactMethod]').forEach((r) => r.addEventListener('change', syncContactInput));
  $('#listing-form').addEventListener('reset', () => setTimeout(syncContactInput));
  syncContactInput();

  // Keyboard: Enter on a focused card opens it.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const cardEl = e.target.closest && e.target.closest('.card.clickable');
    if (cardEl && e.target === cardEl) openListing(cardEl.dataset.listing);
  });

  $('#photo-input').addEventListener('change', (e) => {
    addPhotos(e.target.files);
    e.target.value = ''; // allow picking the same photo again after removing it
  });

  // If a Drive photo fails to load, try the backup URL once, then hide it.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || !img.dataset.fallback) return;
    if (img.src !== img.dataset.fallback) img.src = img.dataset.fallback;
    else img.remove();
  }, true);

  // Click on the dark backdrop closes the dialog.
  $$('dialog').forEach((d) =>
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); })
  );

  $('#listing-form').addEventListener('submit', (e) => { e.preventDefault(); submit(e.target, 'listing'); });
  $('#interest-form').addEventListener('submit', (e) => { e.preventDefault(); submitInterest(e.target); });
  function syncNotifyBy() {
    const f = $('#waitlist-form');
    const byEmail = f.notifyBy.value === 'email';
    f.email.required = byEmail;
    f.phone.required = !byEmail;
    $('#waitlist-email-field').hidden = !byEmail;
    $('#waitlist-phone-field').hidden = byEmail;
  }
  $$('#waitlist-form [name=notifyBy]').forEach((r) => r.addEventListener('change', syncNotifyBy));

  // Alerts form: quick move-in choices (instead of a date picker) + a live "places that fit" count.
  const wf = $('#waitlist-form');
  const isoDay = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const nextOn = (m, day) => { const now = new Date(); const d = new Date(now.getFullYear(), m, day); return d < now ? new Date(now.getFullYear() + 1, m, day) : d; };
  const seasons = [['Spring', 0, 10, 'January'], ['Summer', 5, 1, 'June'], ['Fall', 7, 15, 'August']]
    .map(([name, m, day, sub]) => { const d = nextOn(m, day); return { v: isoDay(d), label: name + " '" + String(d.getFullYear()).slice(2), sub: sub, t: d.getTime() }; })
    .sort((a, b) => a.t - b.t);
  const whenOpts = [{ v: isoDay(new Date()), label: 'ASAP', sub: 'Within 2 weeks' }, ...seasons, { v: 'other', label: 'Pick a date', sub: '' }];
  $('#movein-chips').innerHTML = whenOpts.map((o) =>
    `<label class="choice"><input type="radio" name="moveWhen" value="${o.v}"><span>${o.label}${o.sub ? `<small>${o.sub}</small>` : ''}</span></label>`).join('');
  function showDate(show) { $('#movein-date-field').hidden = !show; }
  wf.querySelectorAll('[name=moveWhen]').forEach((r) => r.addEventListener('change', () => {
    if (r.value === 'other') { wf.moveIn.value = ''; showDate(true); wf.moveIn.focus(); }
    else { wf.moveIn.value = r.value; showDate(false); }
    updateFits();
  }));
  function syncWhenFromDate() {
    if (!wf.moveIn.value || wf.querySelector('[name=moveWhen]:checked')) return;
    wf.querySelector('[name=moveWhen][value=other]').checked = true;
    showDate(true);
  }
  function resetWhen() { showDate(false); $('#fit-count').hidden = true; }
  function fitsFor(f) {
    const max = Number(f.maxRent.value) || 0;
    if (!max) return null;
    const mi = toDate(f.moveIn.value);
    const g = String(f.gender.value || '').toLowerCase();
    const want = f.unitType.value;
    const now = new Date();
    return all.filter((l) => {
      if (l.taken || l.rent > max) return false;
      const from = toDate(l.availableFrom), ends = toDate(l.leaseEnds);
      if (ends && ends < now) return false;
      if (mi && from && from.getTime() > mi.getTime() + 14 * 864e5) return false;
      if (mi && ends && ends.getTime() <= mi.getTime()) return false;
      if (want && want !== 'either' && l.unitType && want !== l.unitType) return false;
      if (l.unitType === 'bed' && l.gender && l.gender !== 'Any' && g && g !== String(l.gender).toLowerCase()) return false;
      return true;
    }).sort((a, b) => a.rent - b.rent);
  }
  function updateFits() {
    const el = $('#fit-count');
    const fits = fitsFor(wf);
    if (!fits) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = fits.length
      ? `🔥 <b>${fits.length} place${fits.length === 1 ? '' : 's'}</b> fit${fits.length === 1 ? 's' : ''} right now. We'll send ${fits.length === 1 ? 'it' : 'them'} to you, plus new ones as they're listed.`
      : "Nothing fits yet, but new places go up every week. We'll let you know the moment one does.";
  }
  wf.addEventListener('input', updateFits);
  wf.addEventListener('change', updateFits);
  syncNotifyBy();
  $('#waitlist-form').addEventListener('submit', (e) => { e.preventDefault(); submit(e.target, 'waitlist'); });
  $('#report-form').addEventListener('submit', (e) => { e.preventDefault(); submit(e.target, 'report'); });
  $('#report-form').addEventListener('change', () => { $('#report-form .form-error').hidden = true; });
  $('#feedback-form').addEventListener('submit', (e) => { e.preventDefault(); submit(e.target, 'feedback'); });

  const EASE = 'cubic-bezier(.22, 1, .36, 1)';

  // ---------- "List your lease": 4 steps that slide ----------
  const lf = $('#listing-form');
  const wizSteps = [...lf.querySelectorAll('.wiz-step')];
  let wiz = 1;
  function wizShow(n, instant) {
    const from = wizSteps[wiz - 1], to = wizSteps[n - 1];
    const dir = n >= wiz ? 1 : -1;
    wiz = n;
    $('#wiz-count').textContent = 'Step ' + n + ' of ' + wizSteps.length;
    $('#wiz-bar').style.width = (n / wizSteps.length) * 100 + '%';
    $('[data-wiz-back]', lf).style.visibility = n > 1 ? 'visible' : 'hidden';
    $('[data-wiz-back]', lf).closest('.wiz-nav').classList.toggle('wiz-first', n === 1);
    $('[data-wiz-next]', lf).hidden = n === wizSteps.length;
    $('[data-wiz-submit]', lf).hidden = n !== wizSteps.length;
    $('.form-error', lf).hidden = true;
    if (instant || from === to) { wizSteps.forEach((s) => (s.hidden = s !== to)); return; }
    const d = $('#listing-dialog');
    if (d.scrollTop > 0) d.scrollTo({ top: 0, behavior: 'smooth' });
    slideSteps($('.wiz-steps', lf), from, to, dir);
  }
  function fieldMsg(bad) {
    if (bad.type === 'radio') {
      const lg = bad.closest('fieldset') && bad.closest('fieldset').querySelector('legend');
      return 'Please pick one for "' + (lg ? lg.childNodes[0].textContent.trim() : bad.name) + '".';
    }
    if (bad.type === 'tel' && bad.value) return 'Please enter a full 10-digit phone number.';
    if (bad.type === 'email' && bad.value) return 'Please enter a valid email address.';
    const lab = bad.closest('label');
    const name = lab ? lab.childNodes[0].textContent.trim() : bad.name;
    return bad.value ? 'Please check "' + name + '".' : 'Please fill in "' + name + '".';
  }
  function stepProblem(n) {
    const bad = [...wizSteps[n - 1].querySelectorAll('input, select, textarea')].find((el) => !el.checkValidity());
    if (bad) return { el: bad, msg: fieldMsg(bad) };
    if (n === 2 && lf.availableFrom.value && lf.leaseEnds.value && lf.availableFrom.value > lf.leaseEnds.value) {
      return { el: lf.leaseEnds, msg: 'The "available from" date must be before the lease end date.' };
    }
    return null;
  }
  function wizCheck(n) {
    const p = stepProblem(n);
    const err = $('.form-error', lf);
    if (!p) { err.hidden = true; return true; }
    err.textContent = p.msg;
    err.hidden = false;
    p.el.focus({ preventScroll: false });
    return false;
  }
  lf.addEventListener('click', (e) => {
    if (e.target.closest('[data-wiz-next]')) { if (wizCheck(wiz)) { wizShow(wiz + 1); track('wizard/' + wiz, 'Listing step ' + wiz); } return; }
    if (e.target.closest('[data-wiz-back]')) wizShow(Math.max(1, wiz - 1));
  });
  // Enter key or Submit before the last step moves forward instead; on the last step, jump back to anything missed.
  $('#listing-dialog').addEventListener('submit', (e) => {
    if (e.target !== lf) return;
    if (wiz < wizSteps.length) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (wizCheck(wiz)) wizShow(wiz + 1);
      return;
    }
    for (let i = 1; i <= wizSteps.length; i++) {
      if (stepProblem(i)) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (i !== wiz) wizShow(i);
        setTimeout(() => wizCheck(i), i !== wiz ? 600 : 0);
        return;
      }
    }
  }, true);

  // "Get featured on Instagram" offer on the last listing screen
  function syncFeature() {
    const yes = !!$('#feature-offer [name=wantsFeature][value=true]:checked');
    $('#feature-offer').classList.toggle('on', yes);
    $('#verify-submit').textContent = yes ? 'Submit + get featured' : 'Submit listing';
  }
  $$('#feature-offer [name=wantsFeature]').forEach((r) => r.addEventListener('change', syncFeature));

  // ---------- small reusable step-by-step form (used by Get alerts) ----------
  function makeWizard(form, check) {
    const steps = [...form.querySelectorAll('.wiz-step')];
    let cur = 1;
    const problem = (n) => {
      const extra = check && check(n);
      if (extra) return extra;
      const bad = [...steps[n - 1].querySelectorAll('input, select, textarea')].find((el) => !el.closest('[hidden]') && !el.checkValidity());
      return bad ? { el: bad, msg: fieldMsg(bad) } : null;
    };
    const showErr = (p) => {
      const err = $('.form-error', form);
      if (!p) { err.hidden = true; return true; }
      err.textContent = p.msg;
      err.hidden = false;
      if (p.el && p.el.focus) p.el.focus();
      return false;
    };
    function show(n, instant) {
      const from = steps[cur - 1], to = steps[n - 1];
      const dir = n >= cur ? 1 : -1;
      cur = n;
      $('.wiz-count', form).textContent = 'Step ' + n + ' of ' + steps.length;
      $('.wiz-progress span', form).style.width = (n / steps.length) * 100 + '%';
      $('[data-wiz-back]', form).style.visibility = n > 1 ? 'visible' : 'hidden';
      $('[data-wiz-back]', form).closest('.wiz-nav').classList.toggle('wiz-first', n === 1);
      $('[data-wiz-next]', form).hidden = n === steps.length;
      $('[data-wiz-submit]', form).hidden = n !== steps.length;
      $('.form-error', form).hidden = true;
      if (instant || from === to) { steps.forEach((s) => (s.hidden = s !== to)); return; }
      const d = form.closest('dialog');
      if (d && d.scrollTop > 0) d.scrollTo({ top: 0, behavior: 'smooth' });
      slideSteps($('.wiz-steps', form), from, to, dir);
    }
    form.addEventListener('click', (e) => {
      if (e.target.closest('[data-wiz-next]')) { if (showErr(problem(cur))) show(cur + 1); return; }
      if (e.target.closest('[data-wiz-back]')) show(Math.max(1, cur - 1));
    });
    form.closest('dialog').addEventListener('submit', (e) => {
      if (e.target !== form) return;
      if (cur < steps.length) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (showErr(problem(cur))) show(cur + 1);
        return;
      }
      for (let i = 1; i <= steps.length; i++) {
        const p = problem(i);
        if (p) {
          e.preventDefault(); e.stopImmediatePropagation();
          if (i !== cur) { show(i); setTimeout(() => showErr(p), 600); } else showErr(p);
          return;
        }
      }
    }, true);
    return { show };
  }
  const alertWiz = makeWizard($('#waitlist-form'), (n) => {
    const f = $('#waitlist-form');
    if (n === 1 && Number(f.maxRent.value) > 0 && !f.moveIn.value) return { el: f.querySelector('[name=moveWhen]'), msg: 'Please pick when you want to move in.' };
    return null;
  });

  // ---------- home screen: "I am looking for a place" finder ----------
  const finder = $('#finder-dialog');
  const ff = $('#finder-form');
  const fOrder = ['where', 'filters', 'nocity'];
  var fCity = '';
  function renderCityList() {
    const cs = openCities();
    const list = cs.length ? cs : [{ city: DEFAULT_CITY, n: 0 }];
    $('#city-list').innerHTML = list.map((c) =>
      '<button type="button" class="city-opt" data-city="' + esc(c.city) + '"><span class="city-pin">📍</span>' +
      '<span class="city-txt"><b>' + esc(c.city) + '</b><small>' + (c.city === DEFAULT_CITY ? 'Near Texas State' : 'Lease takeovers') + '</small></span>' +
      '<span class="city-count">' + (c.n ? c.n + ' open' : '') + '</span></button>').join('');
  }
  function pickCity(city) {
    fCity = normCity(city);
    const has = openCities().some((c) => c.city === fCity);
    track('finder/city', 'Finder city: ' + fCity + (has ? '' : ' (none yet)'));
    if (!has) {
      $('#nocity-name').textContent = cityName(fCity);
      $$('#finder-dialog .nocity-n').forEach((x) => (x.textContent = cityName(fCity)));
      return finderStep('nocity');
    }
    $('#finder-city-back').textContent = '← ' + fCity;
    finderStep('filters');
    finderFit();
  }
  function finderStep(step, instant) {
    const cur = finder.querySelector('.finder-step:not([hidden])');
    const nxt = finder.querySelector('.finder-step[data-step="' + step + '"]');
    if (cur === nxt) return;
    if (instant || !cur) { finder.querySelectorAll('.finder-step').forEach((el) => (el.hidden = el !== nxt)); return; }
    const dir = fOrder.indexOf(step) >= fOrder.indexOf(cur.dataset.step) ? 1 : -1;
    slideSteps(finder.querySelector('.finder-body'), cur, nxt, dir).then(() => {
      const first = nxt.querySelector('input:not(.hp):not([type=radio])');
      if (first && step === 'where' && false) first.focus({ preventScroll: true });
    });
  }
  // Move-in choices: Any / Now / by the next Jan, Jun and Aug (sorted), used as "move in by" dates.
  (function () {
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const now = new Date();
    const next = (m, day) => { const d = new Date(now.getFullYear(), m, day); return d < now ? new Date(now.getFullYear() + 1, m, day) : d; };
    const soon = new Date(now.getTime() + 14 * 864e5);
    const seasons = [[0, 15, 'Spring'], [5, 1, 'Summer'], [7, 20, 'Fall']]
      .map(([m, d, n]) => { const x = next(m, d); return [iso(x), n + " '" + String(x.getFullYear()).slice(2), x]; })
      .sort((a, b) => a[2] - b[2]).map(([v, n]) => [v, n]);
    const opts = [['', 'Any'], [iso(soon), 'Now']].concat(seasons);
    $('#f-movein').innerHTML = opts.map(([v, n], i) => '<option value="' + v + '">' + (i ? 'Move in: ' + n : 'Move in') + '</option>').join('');
    $('#finder-when').innerHTML = opts.map(([v, n], i) => '<label><input type="radio" name="when" value="' + v + '"' + (i ? '' : ' checked') + '><span>' + n + '</span></label>').join('');
  })();
  function applyFinder(useFilters) {
    const v = useFilters ? Object.fromEntries(new FormData(ff).entries()) : {};
    $('#f-city').value = useFilters || fCity ? fCity : '';
    $('#f-max').value = v.max || '';
    $('#f-type').value = v.type || '';
    $('#f-gender').value = v.gender || '';
    $('#f-movein').value = v.when || '';
    $('#f-search').value = '';
    $('#f-arrangement').value = '';
    $('#f-incentive').checked = false;
    render();
  }
  function finderFit() {
    const v = Object.fromEntries(new FormData(ff).entries());
    const max = Number(v.max) || 0, by = toDate(v.when);
    const n = all.filter((l) => !l.taken && (!fCity || l.city === fCity) && (!max || l.rent <= max) && (!v.type || l.unitType === v.type) &&
      (!v.gender || l.unitType !== 'bed' || !l.gender || l.gender === 'Any' || l.gender === v.gender) &&
      (!by || !toDate(l.availableFrom) || toDate(l.availableFrom) <= by)).length;
    $('#finder-fit').innerHTML = n
      ? '🔥 <b>' + n + ' place' + (n === 1 ? '' : 's') + '</b> fit' + (n === 1 ? 's' : '') + ' right now'
      : "Nothing fits yet. We'll set you up with a free alert so you hear the moment one does.";
    return n;
  }
  ff.addEventListener('input', finderFit);
  ff.addEventListener('change', finderFit);
  function finderDone(useFilters) {
    applyFinder(useFilters);
    finder.close();
    const n = filtered().length;
    track('finder/' + (useFilters ? 'filters' : 'skip'), 'Finder: ' + (useFilters ? 'filters' : 'skip') + ' (' + n + ')');
    if (useFilters && !n) return openDialog('waitlist-dialog');
    goBoard();
  }
  ff.addEventListener('submit', (e) => { e.preventDefault(); finderDone(true); });
  finder.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]');
    if (go) return finderStep(go.dataset.goto);
    const cb = e.target.closest('[data-city]');
    if (cb) return pickCity(cb.dataset.city);
    if (e.target.closest('[data-nocity-alert]')) { finder.close(); return setTimeout(() => { openDialog('waitlist-dialog'); setTimeout(() => { $('#waitlist-form').city.value = fCity; }, 60); }, 300); }
    if (e.target.closest('[data-nocity-list]')) { finder.close(); return setTimeout(() => { openDialog('listing-dialog'); setTimeout(() => { $('#listing-form').city.value = fCity; }, 60); }, 300); }
    if (e.target.closest('[data-finder-skip]')) return finderDone(false);
  });
  $('#city-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = e.target.city.value.trim();
    if (!v) return e.target.city.focus();
    pickCity(v);
    e.target.reset();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-finder]')) {
      track('cta/home-find', 'Home: looking for a place');
      fCity = '';
      renderCityList();
      finderStep('where', true);
      finder.showModal();
      return;
    }
    const br = e.target.closest('[data-browse]');
    if (br) {
      e.preventDefault();
      track('cta/home-browse', 'Home: just browsing');
      applyFinder(false);
      goBoard();
    }
    if (e.target.closest('[data-home]')) { e.preventDefault(); goHome(); }
  });
  $('#manage-form').addEventListener('submit', (e) => { e.preventDefault(); submit(e.target, 'sendEditLinks'); });

  // Transitions always play (Braydon wants them even when Windows' "Animation effects" is off). They're gentle slides and fades.
  const reduceMotion = false;
  let view = '';
  function viewFor(h) { return /^#l-/.test(h) ? 'focus' : h === '#board' ? 'board' : h === '#me' ? 'me' : 'home'; }
  const rank = { home: 0, board: 1, me: 1, focus: 2 };
  function swap(fn, dir) {
    const m = $('main');
    if (reduceMotion || !m.animate) return fn();
    m.getAnimations().forEach((a) => a.cancel());
    const out = m.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-36 * dir) + 'px)' }],
      { duration: 190, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' });
    out.onfinish = () => {
      fn();
      out.cancel();
      m.animate([{ opacity: 0, transform: 'translateX(' + (60 * dir) + 'px)' }, { opacity: 1, transform: 'none' }],
        { duration: 560, easing: EASE });
    };
  }
  let routedHash = null;
  function route() {
    // Opening a listing fires both "hashchange" and "popstate"; only handle each address once so the slide plays once.
    if (location.hash === routedHash) return;
    routedHash = location.hash;
    const next = viewFor(location.hash);
    if (next === view) { if (next === 'focus') focusFromHash(); return; }
    const from = view;
    view = next;
    const apply = () => {
      document.body.classList.toggle('view-home', next === 'home');
      document.body.classList.toggle('view-board', next === 'board' || next === 'focus');
      document.body.classList.toggle('view-me', next === 'me');
      $('#me').hidden = next !== 'me';
      if (next === 'me') loadMe();
      if (next === 'focus') focusFromHash();
      else exitFocus();
      // Back from a listing keeps your spot on the board; everything else starts at the top.
      if (!(from === 'focus' && next === 'board')) { window.scrollTo(0, 0); requestAnimationFrame(() => window.scrollTo(0, 0)); }
      if (next === 'board') track('view-board', 'Board screen');
    };
    if (!from) return apply(); // first load: no slide
    swap(apply, rank[next] >= rank[from] ? 1 : -1);
  }
  function goBoard() { if (location.hash === '#board') route(); else location.hash = 'board'; }
  function goHome() {
    if (view === 'home') return;
    history.pushState(null, '', location.pathname + location.search);
    route();
  }
  window.addEventListener('hashchange', route);

  // ---------- motion helpers ----------
  // Slide from one panel to the next inside a box: the old one glides out while the new one glides in,
  // and the box smoothly grows or shrinks to fit.
  function slideSteps(box, from, to, dir) {
    if (reduceMotion || !to.animate) { from.hidden = true; to.hidden = false; return Promise.resolve(); }
    box.getAnimations().forEach((a) => a.finish());
    // Scrolled down (e.g. at the pay button)? Glide back up so the next screen isn't off-view while the pop-up shrinks.
    const dlg = box.closest('dialog');
    if (dlg && dlg.scrollTop > 0) dlg.scrollTo({ top: 0, behavior: 'smooth' });
    const h0 = box.offsetHeight;
    const top = from.offsetTop, left = from.offsetLeft, w = from.offsetWidth;
    const keep = from.getAttribute('style') || '';
    from.style.cssText = keep + ';position:absolute;top:' + top + 'px;left:' + left + 'px;width:' + w + 'px;margin:0;pointer-events:none;';
    to.hidden = false;
    const h1 = box.offsetHeight;
    box.style.overflow = 'hidden';
    const leave = from.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-70 * dir) + 'px)' }],
      { duration: 320, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'forwards' });
    const enter = to.animate([{ opacity: 0, transform: 'translateX(' + (90 * dir) + 'px)' }, { opacity: 1, transform: 'none' }],
      { duration: 560, delay: 40, easing: EASE, fill: 'backwards' });
    const grow = Math.abs(h1 - h0) > 2 ? box.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 560, easing: EASE }) : null;
    return Promise.all([enter.finished, grow ? grow.finished : 0]).catch(() => {}).then(() => {
      leave.cancel();
      from.hidden = true;
      from.setAttribute('style', keep);
      if (!keep) from.removeAttribute('style');
      box.style.overflow = '';
    });
  }
  // Inside pop-ups: when the next screen appears (e.g. "Thanks!"), it slides in and the pop-up resizes smoothly.
  const lastH = new WeakMap();
  const sizeWatch = new ResizeObserver((entries) => entries.forEach((e) => { if (!e.target._sizing) lastH.set(e.target, e.target.offsetHeight); }));
  const panelWatch = new MutationObserver((muts) => {
    const shown = new Set();
    muts.forEach((m) => { const el = m.target; if (!el.hidden && el.parentElement && el.parentElement.tagName === 'DIALOG') shown.add(el); });
    shown.forEach((el) => {
      const d = el.parentElement;
      if (!d.open || reduceMotion || !el.animate) return;
      const dir = Number(d.dataset.dir || 1);
      delete d.dataset.dir;
      d.scrollTop = 0;
      el.animate([{ opacity: 0, transform: 'translateX(' + (70 * dir) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 560, easing: EASE });
      const h0 = lastH.get(d), h1 = d.offsetHeight;
      if (h0 && Math.abs(h0 - h1) > 2) {
        d._sizing = true;
        d.style.overflow = 'hidden';
        d.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 560, easing: EASE }).finished.catch(() => {}).then(() => {
          d._sizing = false;
          d.style.overflow = '';
          lastH.set(d, d.offsetHeight);
        });
      }
    });
  });
  $$('dialog').forEach((d) => { sizeWatch.observe(d); panelWatch.observe(d, { attributes: true, attributeFilter: ['hidden'], subtree: true }); });

  // The home screen's float-in only plays on the first visit, not every time you come back.
  setTimeout(() => document.body.classList.remove('first-load'), 1600);
  window.addEventListener('popstate', route);
  route();

  // Dialogs ease out instead of vanishing.
  const nativeClose = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.close = function (v) {
    if (!this.open || reduceMotion || this.classList.contains('closing')) return nativeClose.call(this, v);
    this.classList.add('closing');
    setTimeout(() => { this.classList.remove('closing'); nativeClose.call(this, v); }, 330);
  };

  // Filter pills light up when they're set; "Clear" resets them.
  const pillIds = ['#f-city', '#f-type', '#f-gender', '#f-max', '#f-movein', '#f-arrangement'];
  function syncPills() {
    let any = !!$('#f-search').value.trim() || $('#f-incentive').checked;
    pillIds.forEach((id) => {
      const el = $(id), on = !!String(el.value).trim();
      (el.closest('.money-pill') || el).classList.toggle('on', on);
      any = any || on;
    });
    $('#f-clear').hidden = !any;
    (dropdowns || []).forEach((d) => d.refresh());
  }
  ['#f-search', '#f-incentive'].concat(pillIds).forEach((id) => { $(id).addEventListener('input', syncPills); $(id).addEventListener('change', syncPills); });
  $('#f-clear').addEventListener('click', () => {
    pillIds.concat('#f-search').forEach((id) => ($(id).value = ''));
    $('#f-incentive').checked = false;
    syncPills();
    render();
  });
  const renderBase = render;
  render = function () { renderBase(); syncPills(); };

  // ---------- board filters: clean custom menus instead of the browser's plain dropdown ----------
  var dropdowns = []; // var on purpose: syncPills (above) reads it
  const chevron = '<svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function enhanceSelect(sel) {
    const isPill = sel.classList.contains('pill');
    const wrap = document.createElement('div');
    wrap.className = 'dd';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.classList.add('dd-native');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dd-btn ' + (isPill ? 'pill-btn' : 'sort-btn');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', sel.getAttribute('aria-label') || '');
    const menu = document.createElement('div');
    menu.className = 'dd-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    wrap.append(btn);
    document.body.appendChild(menu);
    const api = {};
    api.refresh = () => {
      const o = sel.options[sel.selectedIndex];
      btn.innerHTML = '<span>' + esc(o ? o.textContent : '') + '</span>' + chevron;
      btn.classList.toggle('on', isPill && !!sel.value);
    };
    const place = () => {
      const r = btn.getBoundingClientRect();
      const w = Math.max(r.width, 200);
      const left = Math.min(Math.max(8, isPill ? r.left : r.right - w), innerWidth - w - 8);
      menu.style.minWidth = w + 'px';
      menu.style.left = left + 'px';
      menu.style.top = r.bottom + 8 + 'px';
    };
    api.close = (instant) => {
      if (menu.hidden) return;
      btn.setAttribute('aria-expanded', 'false');
      btn.classList.remove('open');
      if (instant) { menu.hidden = true; return; }
      const a = menu.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px) scale(.97)' }], { duration: 160, easing: 'ease-in' });
      a.onfinish = () => { menu.hidden = true; };
    };
    const open = () => {
      dropdowns.forEach((d) => d !== api && d.close(true));
      menu.innerHTML = [...sel.options].map((o, i) =>
        '<button type="button" role="option" class="dd-opt' + (o.selected ? ' sel' : '') + '" data-i="' + i + '" aria-selected="' + o.selected + '"><span>' + esc(isPill && o.value === '' ? 'Any' : o.textContent) + '</span><b>✓</b></button>').join('');
      menu.hidden = false;
      place();
      btn.setAttribute('aria-expanded', 'true');
      btn.classList.add('open');
      menu.animate([{ opacity: 0, transform: 'translateY(-8px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
      const s = menu.querySelector('.sel') || menu.querySelector('.dd-opt');
      if (s) s.focus({ preventScroll: true });
    };
    btn.addEventListener('click', () => (menu.hidden ? open() : api.close()));
    btn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); open(); } });
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('.dd-opt');
      if (!b) return;
      sel.selectedIndex = Number(b.dataset.i);
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      api.refresh();
      api.close();
      btn.focus({ preventScroll: true });
    });
    menu.addEventListener('keydown', (e) => {
      const opts = [...menu.querySelectorAll('.dd-opt')];
      const i = opts.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (opts[i + 1] || opts[0]).focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (opts[i - 1] || opts[opts.length - 1]).focus(); }
      if (e.key === 'Escape' || e.key === 'Tab') { api.close(); btn.focus({ preventScroll: true }); }
    });
    api.wrap = wrap;
    api.menu = menu;
    dropdowns.push(api);
    api.refresh();
    return api;
  }
  $$('.filters select').forEach(enhanceSelect);
  document.addEventListener('click', (e) => dropdowns.forEach((d) => { if (!d.wrap.contains(e.target) && !d.menu.contains(e.target)) d.close(); }));
  window.addEventListener('scroll', () => dropdowns.forEach((d) => d.close(true)), { passive: true });
  window.addEventListener('resize', () => dropdowns.forEach((d) => d.close(true)));
  $('#filter-row').addEventListener('scroll', () => dropdowns.forEach((d) => d.close(true)), { passive: true });

  if (CFG.contactEmail) {
    $('#footer-contact').innerHTML = `Questions? <a href="mailto:${esc(CFG.contactEmail)}">${esc(CFG.contactEmail)}</a>`;
  }

  // Links from the How it works page: index.html#list and index.html#alerts open the forms.
  if (location.hash === '#list') openDialog('listing-dialog');
  if (location.hash === '#alerts') openDialog('waitlist-dialog');
  if (location.hash === '#feedback') openDialog('feedback-dialog');
  const editMatch = location.hash.match(/^#edit-([\w]+)\.([\w]+)$/);
  if (editMatch) startEdit(editMatch[1], editMatch[2]);

  // ---------- accounts (Supabase): sign in with an emailed code, profile page ----------
  var sb = window.supabase && CFG.supabaseUrl
    ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })
    : null;
  var session = null, meData = null, afterSignIn = null, afterKind = 'me', authChecked = false, pendingMe = false;
  const siDlg = $('#signin-dialog'), siEmail = $('#signin-email'), siCode = $('#signin-code');
  const userIcon = $('.me-btn').innerHTML;
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
  };
  const initials = (email) => String(email || '?').trim().charAt(0).toUpperCase();
  const siErr = (form, msg) => { const e = $('.form-error', form); e.textContent = msg || ''; e.hidden = !msg; };

  function siStep(step, instant) {
    const cur = siDlg.querySelector('.finder-step:not([hidden])');
    const nxt = siDlg.querySelector('.finder-step[data-step="' + step + '"]');
    if (cur === nxt) return;
    if (instant || !cur) { siDlg.querySelectorAll('.finder-step').forEach((el) => (el.hidden = el !== nxt)); return; }
    slideSteps($('.finder-body', siDlg), cur, nxt, step === 'code' ? 1 : -1);
  }
  function openSignIn(opts) {
    opts = opts || {};
    if (!afterSignIn) afterKind = 'me';
    $('#signin-title').textContent = opts.title || 'Sign in to Takeover';
    $('#signin-hint').textContent = opts.hint || "See your listings, who's interested, and your alerts in one place. No password, we'll email you a code.";
    siStep('email', true);
    siErr(siEmail, '');
    siErr(siCode, '');
    siCode.code.value = '';
    siDlg.showModal();
    track('open/signin', 'Opened sign in');
  }

  let resendAt = 0;
  async function sendCode(email) {
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
    resendAt = Date.now() + 30000;
  }
  siEmail.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = siEmail.email.value.trim();
    if (!siEmail.checkValidity() || !email) return siErr(siEmail, 'Please enter a valid email.');
    if (!sb) return siErr(siEmail, "Sign in isn't available right now.");
    const btn = $('button[type=submit]', siEmail);
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      await sendCode(email);
      siErr(siEmail, '');
      $('#signin-sent-to').textContent = email;
      siStep('code');
      track('signin/code-sent', 'Sign in: code sent');
      setTimeout(() => siCode.code.focus({ preventScroll: true }), 650);
    } catch (err) {
      console.error(err);
      siErr(siEmail, /rate|second|limit/i.test(err.message || '') ? 'Too many tries. Wait a minute and try again.' : "Couldn't send the code. Check the email and try again.");
    } finally {
      btn.disabled = false;
      btn.textContent = 'Email me a code';
    }
  });
  siCode.code.addEventListener('input', () => { siCode.code.value = siCode.code.value.replace(/\D/g, '').slice(0, 8); });
  siCode.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = siCode.code.value.trim();
    if (code.length < 6) return siErr(siCode, 'Enter the code from the email.');
    const btn = $('button[type=submit]', siCode);
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const { data, error } = await sb.auth.verifyOtp({ email: siEmail.email.value.trim(), token: code, type: 'email' });
      if (error) throw error;
      session = data.session;
      siErr(siCode, '');
      track('signin/done', 'Signed in');
      paintAccountBtn();
      prefillFromAccount();
      siDlg.close();
      const next = afterSignIn;
      afterSignIn = null;
      setTimeout(() => (next ? next() : (location.hash = 'me')), 350);
    } catch (err) {
      console.error(err);
      siErr(siCode, "That code didn't work. Check it, or tap Resend code.");
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });
  // Show "Continue with Google" only once it's switched on in Supabase
  if (sb) fetch(CFG.supabaseUrl + '/auth/v1/settings', { headers: { apikey: CFG.supabaseKey } })
    .then((r) => r.json()).then((s) => { if (s && s.external && s.external.google) $('#google-wrap').hidden = false; }).catch(() => {});
  siDlg.addEventListener('click', async (e) => {
    if (e.target.closest('[data-google]')) {
      ls.set('tsmtx_after', afterKind || 'me');
      track('signin/google', 'Sign in: Google');
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname + '?signin=google' } });
      if (error) siErr(siEmail, "Couldn't open Google sign in. Try your email instead.");
      return;
    }
    if (e.target.closest('[data-si-back]')) return siStep('email');
    const rs = e.target.closest('[data-si-resend]');
    if (!rs) return;
    const left = Math.ceil((resendAt - Date.now()) / 1000);
    if (left > 0) return siErr(siCode, 'You can resend in ' + left + ' seconds.');
    try {
      await sendCode(siEmail.email.value.trim());
      siErr(siCode, '');
      rs.textContent = 'Sent ✓';
      setTimeout(() => (rs.textContent = 'Resend code'), 3000);
    } catch (_) {
      siErr(siCode, "Couldn't resend. Try again in a minute.");
    }
  });

  // Header button: initial + a dot when someone new is interested in your place.
  function totalInterested() { return meData ? meData.listings.reduce((n, l) => n + l.interested.length, 0) : 0; }
  function paintAccountBtn() {
    const b = $('.me-btn');
    if (session) {
      const fresh = totalInterested() > Number(ls.get('tsmtx_seen_int') || 0);
      b.classList.add('signed-in');
      b.innerHTML = '<span>' + esc(initials(session.user.email)) + '</span>' + (fresh ? '<i class="me-dot"></i>' : '');
    } else {
      b.classList.remove('signed-in');
      b.innerHTML = userIcon;
    }
  }
  // Signed in? Fill your email into forms so you don't retype it.
  function prefillFromAccount() {
    lockListingEmail();
    if (!session) return;
    const em = session.user.email;
    [['#listing-form', 'email'], ['#waitlist-form', 'email'], ['#interest-form', 'email']].forEach(([f, n]) => {
      const el = $(f) && $(f).elements[n];
      if (el && !el.value) el.value = em;
    });
  }

  // "Save this to an account" card on the alerts / interested success screens
  function offerSave(dialogSel, email) {
    const box = $(dialogSel + ' .save-acct');
    if (!box) return;
    box.hidden = !sb || !!session;
    box.dataset.email = String(email || '').trim();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-save-acct]');
    if (!b) return;
    const email = b.closest('.save-acct').dataset.email;
    b.closest('dialog').close();
    afterSignIn = () => { location.hash = 'me'; }; afterKind = 'me';
    track('signin/save-offer', 'Tapped save to account');
    setTimeout(() => {
      openSignIn({ title: 'Save to your account', hint: "We'll email you a code. Then everything you do here shows up in your account." });
      if (email) { siEmail.email.value = email; siEmail.requestSubmit(); }
    }, 360);
  });

  // Listing email comes from your account, so your listing always shows up there
  function lockListingEmail() {
    const el = $('#listing-form').elements.email;
    if (!el) return;
    el.readOnly = !!session && !editing;
    el.classList.toggle('from-account', el.readOnly);
  }

  var justPaid = '';
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => (t.hidden = true), 400); }, ms || 4500);
  }
  // Stripe card form inside our own pop-up (styled to match the site)
  var stripeJs = null, payState = null, payFromListing = false;
  function loadStripe() {
    if (window.Stripe) return Promise.resolve(window.Stripe);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload = () => res(window.Stripe);
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const PAY_LOOK = {
    theme: 'stripe',
    variables: {
      colorPrimary: '#2f5bea', colorText: '#0f172a', colorTextSecondary: '#64748b', colorDanger: '#b42318',
      colorBackground: '#ffffff', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', fontSizeBase: '15px',
      borderRadius: '12px', spacingUnit: '4px', fontWeightMedium: '600',
    },
    rules: {
      '.Input': { padding: '13px 14px', border: '1px solid #e7e9ee', backgroundColor: '#f8fafc', boxShadow: 'none' },
      '.Input:focus': { border: '1px solid #2f5bea', boxShadow: '0 0 0 3px #eef2ff', backgroundColor: '#ffffff' },
      '.Label': { fontWeight: '600', color: '#0f172a', marginBottom: '6px' },
      '.Tab': { border: '1px solid #e7e9ee', boxShadow: 'none' },
      '.Tab--selected': { border: '1px solid #2f5bea', boxShadow: '0 0 0 3px #eef2ff' },
    },
  };
  const payErr = (msg) => { const e = $('#pay-dialog .form-error'); e.textContent = msg || ''; e.hidden = !msg; };
  async function featurePay(listingId, opts) {
    opts = opts || {};
    $('#pay-posted').hidden = !opts.fromListing;
    $('#pay-done-posted').hidden = !opts.fromListing;
    payFromListing = !!opts.fromListing;
    if (!session) { afterSignIn = () => { location.hash = 'me'; }; afterKind = 'me'; return openSignIn({ title: 'Sign in to get featured' }); }
    const d = $('#pay-dialog');
    d.querySelectorAll('.finder-step').forEach((el) => (el.hidden = el.dataset.step !== 'pay'));
    $('#pay-element').innerHTML = '<div class="me-loading"><span class="spinner"></span> Loading secure checkout…</div>';
    $('#pay-listing').textContent = 'Your listing';
    const payBtn = $('#pay-btn');
    payBtn.disabled = true;
    payBtn.textContent = 'Pay $10';
    payErr('');
    payState = null;
    const others = [...document.querySelectorAll('dialog[open]')].filter((x) => x !== d);
    others.forEach((x) => x.close());
    setTimeout(() => d.showModal(), others.length ? 360 : 0);
    track('feature/checkout', 'Feature checkout opened');
    try {
      const ask = () => fetch(CFG.supabaseUrl + '/functions/v1/feature-pay', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token, apikey: CFG.supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(listingId ? { listingId } : {}),
      }).then((r) => r.json()).catch(() => ({}));
      const [StripeCtor, first] = await Promise.all([loadStripe(), ask()]);
      let j = first;
      // A just-posted listing can take a few seconds to show up; keep the pop-up loading and try again.
      for (let i = 0; i < 4 && !j.ok && j.error === 'no listing' && opts.fromListing; i++) {
        await new Promise((res) => setTimeout(res, 2500));
        if (!$('#pay-dialog').open) return;
        j = await ask();
      }
      if (!j.ok) {
        payFromListing = false;
        d.close();
        toast(j.error === 'already featured' ? "That listing is already featured. You're all set!" :
          j.error === 'no listing' ? "We couldn't find your listing yet. Give it a minute, then try from your account." :
          "Couldn't open checkout. Try again in a minute.", 6000);
        return;
      }
      $('#pay-listing').textContent = j.listing.complex;
      $('#pay-done-listing').textContent = j.listing.complex;
      stripeJs = stripeJs || StripeCtor(CFG.stripeKey);
      const elements = stripeJs.elements({ clientSecret: j.clientSecret, appearance: PAY_LOOK, fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' }] });
      const pe = elements.create('payment', { layout: 'tabs', wallets: { applePay: 'auto', googlePay: 'auto' } });
      $('#pay-element').innerHTML = '';
      pe.mount('#pay-element');
      pe.on('ready', () => { payBtn.disabled = false; });
      payState = { elements, listingId: String(j.listing.id) };
    } catch (e) {
      console.error(e);
      payFromListing = false;
      d.close();
      toast("Couldn't open checkout. Check your connection and try again.");
    }
  }
  $('#pay-dialog').addEventListener('close', () => {
    const done = !$('#pay-dialog [data-step="done"]').hidden;
    if (payFromListing && !done) toast('Your listing is posted. You can get it featured anytime from your account.', 6000);
    payFromListing = false;
  });
  $('#pay-btn').addEventListener('click', async () => {
    if (!payState || !stripeJs) return;
    const btn = $('#pay-btn');
    btn.disabled = true;
    btn.textContent = 'Paying…';
    payErr('');
    const { error, paymentIntent } = await stripeJs.confirmPayment({
      elements: payState.elements,
      redirect: 'if_required',
      confirmParams: { return_url: location.origin + '/?featured=' + encodeURIComponent(payState.listingId) + '#me' },
    });
    if (error) {
      payErr(error.message || 'Payment didn\'t go through. Check your card and try again.');
      btn.disabled = false;
      btn.textContent = 'Pay $10';
      return;
    }
    if (paymentIntent && paymentIntent.status === 'succeeded') {
      justPaid = payState.listingId;
      if (meData) { meData.featured = (meData.featured || []).concat(justPaid); if (view === 'me') renderMe(meData); }
      track('feature/paid', 'Feature paid in pop-up');
      const d = $('#pay-dialog');
      slideSteps($('.finder-body', d), d.querySelector('[data-step="pay"]'), d.querySelector('[data-step="done"]'), 1);
    } else {
      payErr("Your payment is processing. We'll email you as soon as it's done.");
    }
  });
  // ---------- $7.99/month listing: 7-day free trial, card up front ----------
  var subState = null, subOpts = {};
  const subErr = (msg) => { const e = $('#sub-dialog .form-error'); e.textContent = msg || ''; e.hidden = !msg; };
  async function startTrial(listingId, opts) {
    opts = opts || {};
    subOpts = opts;
    if (!session) {
      if (opts.fromListing) return false;
      afterSignIn = () => { location.hash = 'me'; }; afterKind = 'me'; openSignIn({ title: 'Sign in to finish your listing' }); return false;
    }
    const d = $('#sub-dialog');
    // Preview site: the listing isn't really saved, so ask for a test-mode demo trial instead.
    // thenFeature: they picked the $10 Instagram feature, so it goes in the same checkout.
    const feat = opts.thenFeature ? { feature: true } : {};
    const reqBody = listingId ? { listingId, ...feat } : (window.TAKEOVER_PREVIEW && opts.fromListing ? { preview: true, complex: opts.complex || '', ...feat } : feat);
    const ask = () => fetch(CFG.supabaseUrl + '/functions/v1/listing-subscribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.access_token, apikey: CFG.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    }).then((r) => r.json()).catch(() => ({}));
    // Free / grandfathered listings skip straight on (to the feature, if they picked it).
    let j = await ask();
    for (let i = 0; i < 4 && !j.ok && j.error === 'no listing' && opts.fromListing; i++) {
      await new Promise((res) => setTimeout(res, 2500));
      j = await ask();
    }
    if (!j.ok) {
      // From the listing form, the caller shows "You're listed" (and the feature pop-up if they picked it).
      if (j.error === 'not needed' || j.error === 'no listing') return false;
      toast("Couldn't start the trial. Try again from your account in a minute.", 6000);
      return false;
    }
    d.querySelectorAll('.finder-step').forEach((el) => (el.hidden = el.dataset.step !== 'pay'));
    $('#sub-posted').hidden = !opts.fromListing;
    $('#sub-listing').textContent = j.listing.complex;
    $('#sub-done-listing').textContent = j.listing.complex;
    const ends = j.trialEnd ? new Date(j.trialEnd * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    // The cart: listing (trial: $7.99/mo crossed out, $0 today) + optional $10 feature + tax = due today
    const money = (c) => '$' + (c / 100).toFixed(2);
    const cart = j.cart || { monthly: 799, dueToday: 0, tax: 0 };
    const monthly = money(cart.monthly || 799).replace('.00', '');
    const hasFeature = !!j.feature;
    $('#sub-title').textContent = j.trial ? (hasFeature ? 'Your free trial + feature' : 'Start your 7-day free trial') : 'Put your listing back up';
    $('#sub-note').textContent = j.trial ? '7-day free trial, then ' + monthly + '/mo' : 'Back on the board · ' + monthly + '/mo';
    $('#sub-was').textContent = monthly + '/mo';
    $('#sub-was').hidden = !j.trial;
    $('#sub-now').textContent = j.trial ? '$0' : monthly + '/mo';
    $('#sub-cart-feature').hidden = !hasFeature;
    $('#sub-feature-add').hidden = hasFeature || !!j.featured;
    $('#sub-feature-remove').disabled = $('#sub-feature-add').disabled = false;
    subListingId = listingId;
    $('#sub-cart-tax').hidden = !cart.tax;
    $('#sub-tax').textContent = money(cart.tax || 0);
    const due = j.trial ? (cart.dueToday || 0) : (cart.dueToday || cart.monthly || 799);
    $('#sub-due').textContent = money(due);
    $('#sub-btn').textContent = j.trial ? (due ? 'Start trial · Pay ' + money(due) : 'Start free trial') : 'Restart · ' + money(due);
    const after = j.trial ? 'Free until ' + ends + ', then ' + monthly + '/month plus tax until you cancel.' : monthly + '/month plus tax until you cancel.';
    $('#sub-fine').textContent = (hasFeature ? 'The $10 feature is one time. ' : '') + after + ' Cancel anytime in your account, and marking your listing taken cancels it automatically.';
    $('#sub-done-trial').textContent = (j.trial ? 'Your free trial runs until ' + ends + '.' : '') + (hasFeature ? " It'll also be in this week's Featured post on @takeoverleases." : '');
    // Only offer the feature afterwards if they wanted it but it couldn't go in this cart
    const offerLater = !!opts.thenFeature && !hasFeature && !j.featured;
    $('#sub-next-feature').hidden = !offerLater;
    $('#sub-done-btn').textContent = offerLater ? 'Skip for now' : 'Done';
    $('#sub-element').innerHTML = '<div class="me-loading"><span class="spinner"></span> Loading secure checkout…</div>';
    $('#sub-btn').disabled = true;
    subErr('');
    if (!d.open) {
      const others = [...document.querySelectorAll('dialog[open]')].filter((x) => x !== d);
      others.forEach((x) => x.close());
      setTimeout(() => d.showModal(), others.length ? 360 : 0);
      track('trial/open', 'Trial pop-up opened');
    }
    try {
      const StripeCtor = await loadStripe();
      stripeJs = stripeJs || StripeCtor(CFG.stripeKey);
      const elements = stripeJs.elements({ clientSecret: j.clientSecret, appearance: PAY_LOOK, fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' }] });
      const pe = elements.create('payment', { layout: 'tabs', wallets: { applePay: 'auto', googlePay: 'auto' } });
      $('#sub-element').innerHTML = '';
      pe.mount('#sub-element');
      pe.on('ready', () => { $('#sub-btn').disabled = false; });
      subState = { elements, mode: j.mode, listingId: String(j.listing.id) };
    } catch (e) {
      console.error(e);
      subErr("Couldn't load the card form. Check your connection and try again.");
    }
    return true;
  }
  // Confetti burst + check-mark pop for the "you're listed" moments
  function celebrate(root) {
    const box = root && root.querySelector('.confetti');
    if (!box) return;
    box.innerHTML = '';
    const colors = ['#2f5bea', '#7c9cff', '#f5b301', '#22c55e', '#ec4899', '#38bdf8'];
    for (let i = 0; i < 100; i++) {
      const p = document.createElement('i');
      const dx = (Math.random() - 0.5) * 520, up = 120 + Math.random() * 160, down = 260 + Math.random() * 260;
      p.style.cssText = `background:${colors[i % colors.length]};--dx:${dx}px;--up:${-up}px;--down:${down}px;--r:${(Math.random() - 0.5) * 1080}deg;` +
        `animation-delay:${Math.random() * 0.18}s;animation-duration:${1.5 + Math.random() * 0.9}s;` +
        (i % 3 === 0 ? 'border-radius:50%;width:7px;height:7px;' : '');
      box.appendChild(p);
    }
    const badge = root.querySelector('.cele-badge');
    if (badge) { badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop'); }
    setTimeout(() => { box.innerHTML = ''; }, 3000);
  }
  // Remove / add the $10 feature right in the cart: rebuilds the checkout with or without it
  var subListingId = '';
  async function toggleFeature(on) {
    $('#sub-feature-remove').disabled = $('#sub-feature-add').disabled = true;
    $('#sub-btn').disabled = true;
    $('#sub-due').textContent = '…';
    track(on ? 'trial/feature-add' : 'trial/feature-remove', on ? 'Added feature in cart' : 'Removed feature in cart');
    const ok = await startTrial(subListingId, { ...subOpts, thenFeature: on });
    if (!ok) $('#sub-feature-remove').disabled = $('#sub-feature-add').disabled = false;
  }
  $('#sub-feature-remove').addEventListener('click', () => toggleFeature(false));
  $('#sub-feature-add').addEventListener('click', () => toggleFeature(true));
  $('#sub-btn').addEventListener('click', async () => {
    if (!subState || !stripeJs) return;
    const btn = $('#sub-btn'), label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'One sec…';
    subErr('');
    const args = { elements: subState.elements, redirect: 'if_required', confirmParams: { return_url: location.origin + '/?subscribed=1#me' } };
    const res = subState.mode === 'setup' ? await stripeJs.confirmSetup(args) : await stripeJs.confirmPayment(args);
    if (res.error) {
      subErr(res.error.message || "That card didn't go through. Try another one.");
      btn.disabled = false;
      btn.textContent = label;
      return;
    }
    track('trial/started', 'Trial started');
    meData = null; // refresh the account page next time
    const d = $('#sub-dialog');
    slideSteps($('.finder-body', d), d.querySelector('[data-step="pay"]'), d.querySelector('[data-step="done"]'), 1);
    setTimeout(() => celebrate(d.querySelector('[data-step="done"]')), 250);
  });
  $('#sub-next-feature').addEventListener('click', () => featurePay(subState ? subState.listingId : '', { fromListing: false }));
  $('#sub-dialog').addEventListener('close', () => {
    const done = !$('#sub-dialog [data-step="done"]').hidden;
    if (subOpts.fromListing && !done) toast("Your listing is saved but won't go live until you start your free trial. You can finish from your account.", 7000);
    if (done && view === 'me') loadMe();
    subOpts = {};
  });
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-start-trial]');
    if (t) return startTrial(t.dataset.startTrial);
    if (e.target.closest('[data-billing]')) {
      const r = await fetch(CFG.supabaseUrl + '/functions/v1/billing-portal', {
        method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token, apikey: CFG.supabaseKey, 'Content-Type': 'application/json' }, body: '{}',
      }).then((x) => x.json()).catch(() => ({}));
      if (r.ok && r.url) location.href = r.url; else toast("Couldn't open billing right now. Try again in a minute.");
    }
  });
  if (/[?&]subscribed=1/.test(location.search)) {
    history.replaceState(null, '', location.pathname + location.hash);
    setTimeout(() => toast("You're live! ✅ Your free trial has started."), 700);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-feature-pay]');
    if (b) featurePay(b.dataset.featurePay || '');
  });
  (function backFromStripe() {
    const q = new URLSearchParams(location.search);
    if (!q.has('featured') && !q.has('feature_canceled')) return;
    const ok = q.has('featured');
    if (ok) justPaid = q.get('featured');
    history.replaceState(null, '', location.pathname + location.hash);
    setTimeout(() => toast(ok ? "You're featured! ✅ We'll add your place to this week's post." : 'Checkout canceled. No charge was made.', 6500), 700);
    if (ok) track('feature/paid-return', 'Back from Stripe: paid');
  })();

  async function fetchMe() {
    if (!sb || !session) return null;
    const r = await fetch(CFG.supabaseUrl + '/functions/v1/me', { headers: { Authorization: 'Bearer ' + session.access_token, apikey: CFG.supabaseKey } });
    if (r.status === 401) { await sb.auth.signOut(); session = null; paintAccountBtn(); return null; }
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'failed');
    try {
      const { data: paid } = await sb.from('feature_orders').select('listing_id').eq('status', 'paid');
      j.featured = (paid || []).map((o) => String(o.listing_id));
      if (justPaid && !j.featured.includes(justPaid)) j.featured.push(justPaid);
    } catch (_) { j.featured = []; }
    meData = j;
    return j;
  }

  const STATUS = { approved: ['Live', 'live'], pending: ['In review', 'review'], taken: ['Taken', 'taken'], unpaid: ['Not live yet', 'review'], paused: ['Paused', 'taken'] };
  function subLine(l) {
    const s = l.subStatus;
    if (l.status === 'unpaid') return '<p class="mc-sub-line warn">Start your free trial to put it on the board.</p>';
    if (l.status === 'paused') return '<p class="mc-sub-line warn">Paused: your $7.99/mo plan ended. Restart to put it back up.</p>';
    if (s === 'trialing') return '<p class="mc-sub-line">Free trial · ends ' + esc(shortDate(l.trialEnds) || 'soon') + ', then $7.99/mo</p>';
    if (s === 'active') return '<p class="mc-sub-line">$7.99/mo · active</p>';
    if (s === 'past_due') return '<p class="mc-sub-line warn">Payment didn\'t go through. Update your card in Plan &amp; billing below.</p>';
    return '';
  }
  const WHO = { Female: 'girls', Male: 'guys' };
  function renderMe(d) {
    const featured = d.featured || [];
    const nInt = d.listings.reduce((n, l) => n + l.interested.length, 0);
    const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
    $('#me-email').textContent = d.email;
    $('#me-avatar').textContent = initials(d.email);
    $('#me-stats').textContent = [plural(d.listings.length, 'listing'), nInt + ' interested', plural(d.alerts.length, 'alert')].join(' · ');

    $('#me-listings').innerHTML = d.listings.length ? d.listings.map((l) => {
      const s = STATUS[l.status] || [l.status, ''];
      const isFeatured = featured.includes(String(l.id));
      const live = l.status === 'approved';
      const open = live ? ' href="#l-' + esc(l.id) + '"' : '';
      const people = l.interested.length
        ? '<div class="mc-people"><p class="mc-people-head">' + (l.interested.length >= 3 ? '🔥 ' : '👀 ') + plural(l.interested.length, 'person') .replace('persons', 'people') + ' interested</p>' +
          l.interested.map((p) => '<div class="mc-person"><span class="mc-avatar">' + esc(initials(p.name || p.email || '?')) + '</span><b>' + esc(p.name || 'Someone') + '</b>' +
            '<span class="mc-reach">' + (p.phone ? '<a class="pill-link" href="sms:' + esc(p.phone) + '">💬 Text</a>' : '') + (p.email ? '<a class="pill-link" href="mailto:' + esc(p.email) + '">✉️ Email</a>' : '') + '</span></div>').join('') + '</div>'
        : '<p class="mc-none">No one has tapped "I\'m interested" yet. Sharing your listing helps.</p>';
      return '<article class="mc">' +
        '<div class="mc-top">' +
          (live ? '<a class="mc-thumb"' + open + '>' : '<div class="mc-thumb">') +
            (l.photo ? '<img src="' + esc(photoUrl(l.photo)) + '" alt="" loading="lazy">' : '<span>🏠</span>') +
          (live ? '</a>' : '</div>') +
          '<div class="mc-info">' +
            (live ? '<a class="mc-name"' + open + '>' + esc(l.complex) + '</a>' : '<b class="mc-name">' + esc(l.complex) + '</b>') +
            '<p class="mc-sub">' + money(l.rent) + '/mo · Move in ' + esc(shortDate(l.availableFrom)) + '</p>' +
            '<span class="me-status ' + s[1] + '">' + esc(s[0]) + '</span>' +
          '</div>' +
        '</div>' +
        subLine(l) +
        (l.status === 'unpaid' ? '<button type="button" class="btn btn-primary btn-block mc-feature" data-start-trial="' + esc(l.id) + '">Start 7-day free trial</button>' :
          l.status === 'paused' ? '<button type="button" class="btn btn-primary btn-block mc-feature" data-start-trial="' + esc(l.id) + '">Restart · $7.99/mo</button>' : '') +
        people +
        '<div class="mc-actions">' +
          (l.editUrl ? '<button type="button" class="mc-btn" data-me-edit="' + esc(l.editUrl) + '">✏️ Edit</button>' : '') +
          (live ? '<button type="button" class="mc-btn" data-share="' + esc(l.id) + '">↗ Share</button>' : '') +
          (TAKEABLE.includes(l.status) ? '<button type="button" class="mc-btn" data-me-taken="' + esc(l.id) + '">✓ Mark taken</button>' : '') +
        '</div>' +
        (isFeatured ? '<p class="mc-featured">⭐ Featured on Instagram</p>'
          : l.status !== 'taken' && l.status !== 'unpaid' && l.status !== 'paused' ? '<button type="button" class="btn btn-feature btn-block mc-feature" data-feature-pay="' + esc(l.id) + '">⭐ Get featured on Instagram · $10</button>' : '') +
      '</article>';
    }).join('') : '<div class="me-empty"><p>No listings under <b>' + esc(d.email) + '</b> yet.</p><small>Listed with a different email? Sign in with that one to see it here.</small></div>';

    $('#me-alerts').innerHTML = d.alerts.length ? d.alerts.map((a) => {
      const chips = [a.maxRent ? 'Under ' + money(a.maxRent) : 'Any price', a.moveIn ? 'By ' + shortDate(a.moveIn) : '', WHO[a.gender] ? WHO[a.gender].replace(/^./, (c) => c.toUpperCase()) : '',
        a.unitType === 'unit' ? 'Whole place' : a.unitType === 'bed' ? 'Private room' : '', a.notifyBy === 'text' ? 'By text' : 'By email'].filter(Boolean);
      return '<div class="me-row"><span class="me-row-ic">🔔</span><span class="chip-row">' + chips.map((c) => '<span class="mini-chip">' + esc(c) + '</span>').join('') + '</span></div>';
    }).join('') : '<div class="me-empty"><p>No alerts yet.</p><small>Get a text or email the moment a place fits your budget.</small></div>';

    $('#me-interests').innerHTML = d.interests.length ? d.interests.map((i) =>
      '<a class="me-row link" href="#l-' + esc(i.listingId) + '"><span class="me-row-ic">🏠</span><span><b>' + esc(i.complex || 'A listing') + '</b>' +
      (i.rent ? ' <span class="muted">· ' + money(i.rent) + '/mo</span>' : '') + (i.status === 'taken' ? ' <em class="me-status taken">Taken</em>' : '') + '</span><span class="arrow">›</span></a>').join('')
      : '<div class="me-empty"><p>Nothing yet.</p><small>Tap "I\'m interested" on a listing and it shows up here.</small></div>';

    renderPlans();
    $('#me-body').hidden = false;
    $('#me-loading').hidden = true;
    ls.set('tsmtx_seen_int', String(totalInterested())); // you've seen everyone who's interested
    paintAccountBtn();
  }

  // ---------- Plan & billing (trial / monthly plan: see it, change card, cancel) ----------
  var planData = null, planCard = null;
  const planFetch = (body) => fetch(CFG.supabaseUrl + '/functions/v1/my-plan', {
    method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token, apikey: CFG.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then((r) => r.json()).catch(() => ({}));
  async function loadPlans() {
    if (!session || !CFG.supabaseUrl) return;
    const j = await planFetch({ action: 'list' });
    if (j.ok) { planData = j.plans || []; renderPlans(); }
  }
  const pDate = (t) => (t ? new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
  const pMoney = (c) => '$' + (c / 100).toFixed(2).replace(/\.00$/, '');
  const BRANDS = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover' };
  const planName = (p) => { const l = ((meData && meData.listings) || []).find((x) => String(x.id) === String(p.listingId)); return (l && l.complex) || p.complex || 'Your listing'; };
  function renderPlans() {
    const sec = $('#me-plan-section');
    if (!sec) return;
    const plans = planData || [];
    sec.hidden = !plans.length;
    if (!plans.length) return;
    $('#me-plan').innerHTML = plans.map((p) => {
      const trial = p.status === 'trialing', failed = p.status === 'past_due' || p.status === 'unpaid';
      const pill = p.cancelAtEnd ? ['Ends ' + pDate(p.periodEnd), 'ending'] : failed ? ['Payment failed', 'failed'] : trial ? ['Free trial', 'trial'] : ['Active', 'active'];
      const rows = p.cancelAtEnd ? [['Next charge', 'None']]
        : trial ? [['Free trial ends', pDate(p.trialEnd)], ['Then', pMoney(p.amount) + '/mo + tax']]
        : failed ? [['Last payment', "Didn't go through"]]
        : [['Next charge', pDate(p.periodEnd) + ' · ' + pMoney(p.amount) + ' + tax']];
      const c = p.card;
      const card = c ? (c.wallet === 'apple_pay' ? 'Apple Pay · ' : c.wallet === 'google_pay' ? 'Google Pay · ' : '') + (BRANDS[c.brand] || c.brand) + ' •••• ' + c.last4 : 'No card on file';
      return '<article class="plan-card' + (failed ? ' is-failed' : '') + '">' +
        '<div class="plan-top"><span class="cart-ic">🏠</span><div><b>' + esc(planName(p)) + '</b><small>Listing plan · ' + pMoney(p.amount) + '/mo</small></div>' +
          '<span class="plan-pill ' + pill[1] + '">' + esc(pill[0]) + '</span></div>' +
        (failed ? '<p class="mc-sub-line warn">Update your card and we\'ll try it again right away.</p>' : '') +
        (p.cancelAtEnd ? '<p class="plan-canceled"><b>✓ ' + (p.status === 'trialing' ? 'Free trial canceled' : 'Plan canceled') + '</b>You won\'t be charged. ' + esc(planName(p)) + ' stays on the board until ' + pDate(p.periodEnd) + ', then comes down.</p>' : '') +
        '<dl class="plan-rows">' + rows.map((r) => '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>').join('') +
          '<div><dt>Card</dt><dd>' + esc(card) + ' <button type="button" class="plan-link" data-plan-card>Change</button></dd></div></dl>' +
        '<div class="plan-actions">' + (p.cancelAtEnd
          ? '<button type="button" class="mc-btn plan-undo" data-plan-resume="' + esc(p.id) + '">↺ Undo cancel <small>Keep it up after ' + pDate(p.periodEnd) + '</small></button>'
          : '<button type="button" class="mc-btn plan-cancel" data-plan-cancel="' + esc(p.id) + '">Cancel plan</button>') + '</div>' +
      '</article>';
    }).join('') + '<button type="button" class="plan-receipts" data-receipts><span>🧾 Receipts</span><span class="arrow">›</span></button>';
  }
  document.addEventListener('click', async (e) => {
    const cx = e.target.closest('[data-plan-cancel]');
    if (cx) {
      const p = (planData || []).find((x) => x.id === cx.dataset.planCancel);
      if (!p) return;
      const name = planName(p), failed = p.status === 'past_due' || p.status === 'unpaid';
      $('#cancel-title').textContent = p.status === 'trialing' ? 'Cancel your free trial?' : 'Cancel your plan?';
      $('#cancel-text').textContent = failed ? name + ' comes down from the board now, and we won\'t try your card again.'
        : p.status === 'trialing' ? "You won't be charged anything. " + name + ' stays on the board until ' + pDate(p.trialEnd) + ', then comes down. You can undo this until then.'
        : 'No more charges. ' + name + ' stays on the board until ' + pDate(p.periodEnd) + ' (the end of the month you paid for), then comes down. You can undo this until then.';
      const d = $('#cancel-dialog');
      d.dataset.id = p.id;
      d.querySelector('[data-step="confirm"]').hidden = false;
      d.querySelector('[data-step="why"]').hidden = true;
      $$('#why-list input').forEach((x) => { x.checked = false; });
      $('#why-list').dataset.picked = '';
      $('#why-note').value = '';
      $('#cancel-next').textContent = p.status === 'trialing' ? 'Cancel free trial' : 'Cancel plan';
      syncWhy();
      d.showModal();
      return;
    }
    if (e.target.closest('[data-receipts]')) openReceipts();
    const rs = e.target.closest('[data-plan-resume]');
    if (rs) {
      rs.disabled = true;
      const j = await planFetch({ action: 'resume', id: rs.dataset.planResume });
      toast(j.ok ? "Cancel undone ✅ Your listing stays up and your plan continues." : "Couldn't undo that right now. Try again in a minute.");
      loadPlans();
      return;
    }
    if (e.target.closest('[data-plan-card]')) openCardDialog();
  });
  // Step 2 of canceling: a quick, optional "why?"
  function syncWhy() {
    const pick = $('#why-list input:checked');
    const taken = !!pick && pick.value === 'taken';
    $('#why-taken').hidden = !taken;
    $('#why-note').hidden = taken;
    const p = (planData || []).find((x) => x.id === $('#cancel-dialog').dataset.id);
    const b = $('#cancel-confirm');
    b.disabled = false;
    b.textContent = taken ? 'Mark taken & end my plan' : p && p.status === 'trialing' ? 'Cancel free trial' : 'Cancel plan';
    b.classList.toggle('btn-primary', taken);
    b.classList.toggle('btn-danger-soft', !taken);
  }
  // Tap the picked answer again to clear it (it's optional, so "none" has to be reachable)
  $$('#why-list input').forEach((x) => x.addEventListener('click', () => {
    const list = $('#why-list');
    if (list.dataset.picked === x.value) { x.checked = false; list.dataset.picked = ''; }
    else list.dataset.picked = x.value;
    syncWhy();
  }));
  $('#cancel-next').addEventListener('click', () => {
    const d = $('#cancel-dialog');
    slideSteps($('.finder-body', d), d.querySelector('[data-step="confirm"]'), d.querySelector('[data-step="why"]'), 1);
  });
  $('#cancel-confirm').addEventListener('click', async () => {
    const d = $('#cancel-dialog'), b = $('#cancel-confirm');
    const pick = $('#why-list input:checked');
    const reason = pick ? pick.value : '';
    b.disabled = true; b.textContent = reason === 'taken' ? 'Marking it taken…' : 'Canceling…';
    const p = (planData || []).find((x) => x.id === d.dataset.id);
    const j = await planFetch({ action: 'cancel', id: d.dataset.id, reason, note: reason === 'taken' ? '' : $('#why-note').value.trim() });
    d.close();
    if (!j.ok) return toast("Couldn't cancel right now. Try again in a minute, or email team@takeoversmtx.com.", 6000);
    track('plan/cancel' + (reason ? '/' + reason : ''), 'Canceled plan' + (reason ? ': ' + reason : ''));
    if (j.taken) {
      toast('Congrats on getting your lease taken! 🎉 Your listing is off the board and your plan has ended.', 7000);
      planData = null; meData = null; loadMe();
      return;
    }
    const failed = p && (p.status === 'past_due' || p.status === 'unpaid');
    toast(failed ? 'Plan canceled. Your listing is coming down.' : "Canceled. You won't be charged again, and your listing stays up until " + pDate(p && (p.status === 'trialing' ? p.trialEnd : p.periodEnd)) + '.', 6500);
    loadPlans();
    if (failed) { meData = null; loadMe(); }
  });
  async function openReceipts() {
    const d = $('#receipts-dialog');
    $('#receipts-list').innerHTML = '<div class="me-loading"><span class="spinner"></span> Loading…</div>';
    d.showModal();
    const j = await planFetch({ action: 'receipts' });
    if (!j.ok) { $('#receipts-list').innerHTML = '<p class="finder-hint">Couldn\'t load your receipts right now. Try again in a minute.</p>'; return; }
    const rows = j.receipts || [];
    $('#receipts-list').innerHTML = rows.length ? rows.map((r) =>
      '<a class="receipt" href="' + esc(r.url || r.pdf || '#') + '" target="_blank" rel="noopener">' +
        '<span class="receipt-date">' + esc(new Date(r.date * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) + '</span>' +
        '<span class="receipt-what">' + esc([...new Set(r.items)].join(' + ')) + (r.tax ? '<small>incl. ' + pMoney(r.tax) + ' tax</small>' : '') + '</span>' +
        '<b class="receipt-amt">' + esc('$' + (r.amount / 100).toFixed(2)) + '</b><span class="arrow">›</span>' +
      '</a>').join('') + '<p class="si-fine">Tap one to view or download it.</p>'
      : '<div class="me-empty"><p>No charges yet.</p><small>Your free trial doesn\'t cost anything. Receipts show up here after a payment.</small></div>';
  }
  const cardErr = (m) => { const e = $('#card-dialog .form-error'); e.textContent = m || ''; e.hidden = !m; };
  async function openCardDialog() {
    const d = $('#card-dialog');
    cardErr('');
    $('#card-btn').disabled = true;
    $('#card-btn').textContent = 'Save card';
    const failed = (planData || []).some((p) => p.status === 'past_due' || p.status === 'unpaid');
    $('#card-hint').textContent = failed ? "We'll use this card from now on and retry your last payment right away." : 'Your plan will use this card from now on.';
    $('#card-element').innerHTML = '<div class="me-loading"><span class="spinner"></span> Loading secure form…</div>';
    d.showModal();
    const j = await planFetch({ action: 'card' });
    if (!j.ok) return cardErr("Couldn't load the card form. Try again in a minute.");
    try {
      const StripeCtor = await loadStripe();
      stripeJs = stripeJs || StripeCtor(CFG.stripeKey);
      const elements = stripeJs.elements({ clientSecret: j.clientSecret, appearance: PAY_LOOK, fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' }] });
      const pe = elements.create('payment', { layout: 'tabs', wallets: { applePay: 'auto', googlePay: 'auto' } });
      $('#card-element').innerHTML = '';
      pe.mount('#card-element');
      pe.on('ready', () => { $('#card-btn').disabled = false; });
      planCard = elements;
    } catch (e) {
      console.error(e);
      cardErr("Couldn't load the card form. Check your connection and try again.");
    }
  }
  $('#card-btn').addEventListener('click', async () => {
    if (!planCard) return;
    const b = $('#card-btn');
    b.disabled = true; b.textContent = 'Saving…'; cardErr('');
    const res = await stripeJs.confirmSetup({ elements: planCard, redirect: 'if_required', confirmParams: { return_url: location.origin + '/#me' } });
    if (res.error) { cardErr(res.error.message || "That card didn't work. Try another one."); b.disabled = false; b.textContent = 'Save card'; return; }
    const j = await planFetch({ action: 'setcard', setupIntent: res.setupIntent.id });
    $('#card-dialog').close();
    if (!j.ok) return toast("Your card was saved but we couldn't switch your plan to it. Email team@takeoversmtx.com and we'll fix it.", 7000);
    track('plan/card', 'Updated card');
    toast(j.retried ? 'Card updated ✅ We retried your payment with it.' : 'Card updated ✅', 5000);
    loadPlans();
    if (j.retried) { meData = null; loadMe(); }
  });

  // ---------- "My lease got taken": signed in -> pick your listing -> confirm -> done ----------
  const TAKEABLE = ['approved', 'pending', 'unpaid', 'paused'];
  var takenPick = null, takenMany = false, takenList = [];
  function takenStep(name, animate) {
    const d = $('#taken-dialog'), box = $('.finder-body', d);
    const from = [...d.querySelectorAll('.finder-step')].find((s) => !s.hidden);
    const to = d.querySelector('[data-step="' + name + '"]');
    if (!animate || !from || from === to || !d.open) { d.querySelectorAll('.finder-step').forEach((s) => (s.hidden = s !== to)); return; }
    slideSteps(box, from, to, name === 'pick' && from.dataset.step === 'confirm' ? -1 : 1);
  }
  function needSignIn(then, kind, title) {
    if (!window.supabase || !CFG.supabaseUrl) return false;
    if (!authChecked) { setTimeout(then, 250); return true; }
    if (session) return false;
    afterSignIn = then; afterKind = kind;
    openSignIn({ title, hint: "Use the email you listed with. No password, we'll email you a code." });
    return true;
  }
  async function openTaken() {
    if (!window.supabase || !CFG.supabaseUrl) return openDialog('manage-dialog');
    if (needSignIn(openTaken, 'taken', 'Sign in to mark your lease taken')) return;
    track('taken/open', 'My lease got taken: opened');
    const d = $('#taken-dialog');
    takenStep('loading');
    if (!d.open) d.showModal();
    // Both lookups at once; if we already have them (fetched when the page loaded), don't wait at all.
    const needPlans = !!window.TAKEOVER_PREVIEW;
    const fresh = Promise.all([
      fetchMe().catch(() => null),
      needPlans ? planFetch({ action: 'list' }).then((pj) => { if (pj.ok) planData = pj.plans || []; }) : null,
    ]);
    if (!meData || (needPlans && !planData)) await fresh;
    const list = ((meData && meData.listings) || []).filter((l) => TAKEABLE.includes(l.status));
    // Preview site: listings aren't really saved, so let its demo trial plans stand in for them
    if (needPlans) {
      (planData || []).filter((p) => p.preview).forEach((p) => list.push({ id: 'preview:' + p.id, complex: p.complex || 'Your listing', rent: 0, status: 'approved', subStatus: p.status, availableFrom: '', photo: '', preview: true }));
    }
    takenList = list;
    takenMany = list.length > 1;
    if (!list.length) {
      $('#taken-email').textContent = session.user.email;
      track('taken/none', 'My lease got taken: no listing on account');
      return takenStep('none', true);
    }
    if (list.length === 1) return pickTaken(list[0]);
    $('#taken-list').innerHTML = list.map((l) =>
      '<button type="button" class="taken-opt" data-taken-pick="' + esc(l.id) + '">' +
        '<span class="taken-thumb">' + (l.photo ? '<img src="' + esc(photoUrl(l.photo)) + '" alt="" loading="lazy">' : '🏠') + '</span>' +
        '<span><b>' + esc(l.complex) + '</b><small>' + (l.preview ? 'Preview listing (test mode)' : money(l.rent) + '/mo · Move in ' + esc(shortDate(l.availableFrom))) + '</small></span><span class="arrow">›</span>' +
      '</button>').join('');
    takenStep('pick', true);
  }
  function pickTaken(l) {
    takenPick = l;
    const onPlan = ['trialing', 'active', 'past_due'].includes(l.subStatus);
    $('#taken-confirm-title').textContent = 'Mark ' + l.complex + ' taken?';
    $('#taken-confirm-text').textContent = 'It comes off the board right away and people stop reaching out.' +
      (onPlan ? (l.subStatus === 'trialing' ? ' Your free trial ends too, so you won\'t be charged.' : ' Your $7.99/mo plan ends too, so you won\'t be charged again.') : '');
    $('#taken-back').hidden = !takenMany;
    $('#taken-yes').disabled = false;
    $('#taken-yes').textContent = 'Yes, mark it taken';
    $('#taken-dialog .form-error').hidden = true;
    takenStep('confirm', true);
  }
  $('#taken-yes').addEventListener('click', async () => {
    if (!takenPick) return;
    const b = $('#taken-yes'), err = $('#taken-dialog .form-error');
    b.disabled = true; b.textContent = 'Marking it taken…'; err.hidden = true;
    const j = await planFetch({ action: 'taken', listingId: takenPick.id });
    if (!j.ok) { err.textContent = "Couldn't mark it taken right now. Try again in a minute, or email team@takeoversmtx.com."; err.hidden = false; b.disabled = false; b.textContent = 'Yes, mark it taken'; return; }
    track('taken/done', 'My lease got taken: marked taken');
    $('#taken-done-text').textContent = takenPick.complex + ' is off the board' + (['trialing', 'active', 'past_due'].includes(takenPick.subStatus) ? ' and your plan has ended' : '') + '. Thanks for using Takeover SMTX, and good luck with the move! 🍀';
    takenStep('done', true);
    setTimeout(() => celebrate($('#taken-dialog [data-step="done"]')), 250);
    if (meData) meData.listings.forEach((l) => { if (String(l.id) === String(takenPick.id)) l.status = 'taken'; });
    if (planData) planData = planData.filter((p) => 'preview:' + p.id !== takenPick.id && String(p.listingId) !== String(takenPick.id));
    fetchMe().catch(() => {});
    if (view === 'me') loadMe();
    load();
  });
  $('#taken-back').addEventListener('click', () => takenStep('pick', true));
  // Edit / take down links: everything lives in your account now
  function goMyListings() {
    if (needSignIn(goMyListings, 'me', 'Sign in to manage your listing')) return;
    location.hash = 'me';
  }
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-taken-flow]')) return openTaken();
    const mt = e.target.closest('[data-me-taken]');
    if (mt) { const l = ((meData && meData.listings) || []).find((x) => String(x.id) === mt.dataset.meTaken); if (l) { takenMany = false; pickTaken(l); $('#taken-dialog').showModal(); } return; }
    if (e.target.closest('[data-my-listings]')) { const dl = e.target.closest('dialog'); if (dl) dl.close(); return goMyListings(); }
    const pk = e.target.closest('[data-taken-pick]');
    if (pk) { const l = takenList.find((x) => String(x.id) === pk.dataset.takenPick); if (l) pickTaken(l); return; }
    if (e.target.closest('[data-taken-switch]')) {
      $('#taken-dialog').close();
      if (sb) await sb.auth.signOut();
      session = null; meData = null; planData = null; paintAccountBtn();
      track('taken/switch', 'My lease got taken: switching email');
      return setTimeout(openTaken, 350);
    }
    if (e.target.closest('[data-taken-link]')) { $('#taken-dialog').close(); return setTimeout(() => openDialog('manage-dialog'), 350); }
    if (e.target.closest('[data-taken-browse]')) { $('#taken-dialog').close(); const f = $('[data-finder]'); return setTimeout(() => (f ? f.click() : goHome()), 350); }
  });

  async function loadMe() {
    if (!sb) { $('#me-loading').hidden = true; $('#me-error').hidden = false; return; }
    if (!authChecked) { pendingMe = true; return; }
    if (!session) {
      setTimeout(() => { goHome(); afterSignIn = () => { location.hash = 'me'; }; afterKind = 'me'; openSignIn({ title: 'Sign in to see your account' }); }, 0);
      return;
    }
    $('#me-email').textContent = session.user.email;
    $('#me-avatar').textContent = initials(session.user.email);
    $('#me-error').hidden = true;
    if (meData) renderMe(meData);
    else { $('#me-loading').hidden = false; $('#me-body').hidden = true; }
    loadPlans();
    try {
      const d = await fetchMe();
      if (d) renderMe(d);
    } catch (e) {
      console.error(e);
      if (!meData) $('#me-error').hidden = false;
    } finally {
      $('#me-loading').hidden = true;
    }
  }

  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-account]')) {
      if (session) location.hash = 'me';
      else openSignIn();
      return;
    }
    if (e.target.closest('[data-signout]')) {
      if (sb) await sb.auth.signOut();
      session = null;
      meData = null;
      paintAccountBtn();
      track('signin/out', 'Signed out');
      goHome();
      return;
    }
    if (e.target.closest('[data-me-retry]')) return loadMe();
    const ed = e.target.closest('[data-me-edit]');
    if (ed) {
      const m = ed.dataset.meEdit.match(/#edit-([\w]+)\.([\w]+)/);
      if (m) startEdit(m[1], m[2]);
    }
  });

  if (sb) {
    sb.auth.getSession().then(({ data }) => {
      session = data.session;
      authChecked = true;
      paintAccountBtn();
      prefillFromAccount();
      if (/[?&](signin=google|code=)/.test(location.search)) {
        const kind = ls.get('tsmtx_after') || 'me';
        ls.set('tsmtx_after', '');
        history.replaceState(null, '', location.pathname + location.hash);
        if (session) {
          track('signin/done', 'Signed in (Google)');
          setTimeout(() => (kind === 'list' ? openDialog('listing-dialog') : kind === 'taken' ? openTaken() : (location.hash = 'me')), 300);
        }
      }
      if (pendingMe || location.hash === '#me') { pendingMe = false; loadMe(); }
      else if (session) { fetchMe().then(paintAccountBtn).catch(() => {}); if (window.TAKEOVER_PREVIEW) loadPlans(); }
    });
    sb.auth.onAuthStateChange((_event, s) => { session = s; if (!s) meData = null; paintAccountBtn(); });
  } else {
    authChecked = true;
  }

  load();
})();
