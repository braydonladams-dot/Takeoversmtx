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
      rv[data.listingId] = { contact: out.contact, contactMethod: out.contactMethod };
      store.set('tsmtx_revealed', rv);
      const c = contactLink({ contactMethod: out.contactMethod, contact: out.contact });
      $('#interest-contact').innerHTML = `<a class="btn btn-primary btn-lg btn-block" href="${esc(c.href)}" target="_blank" rel="noopener" data-contact="${esc(data.listingId)}">${esc(c.label)}</a>`;
      form.hidden = true;
      $('.form-success', form.closest('dialog')).hidden = false;
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

  function normalize(l) {
    return {
      ...l,
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
    const arrangement = $('#f-arrangement').value;
    const max = Number($('#f-max').value) || 0;
    const moveIn = toDate($('#f-movein').value);
    const needIncentive = $('#f-incentive').checked;
    const sort = $('#f-sort').value;

    const list = all.filter((l) => {
      if (l.taken) return false;
      if (q && !`${l.complex} ${l.description}`.toLowerCase().includes(q)) return false;
      if (type && l.unitType !== type) return false;
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

  const typeLabel = (l) => (l.unitType === 'unit' ? 'Whole unit' : 'Shared unit (by the bed)');

  function tagsHtml(l) {
    return [
      l.transferConfirmed ? '<span class="tag confirmed has-tip" tabindex="0" data-tip-title="Transfer confirmed" data-tip="We checked with the complex that this lease can be transferred to someone new.">✓ Transfer confirmed with complex</span>' : '',
      l.verified ? '<span class="tag verified has-tip" tabindex="0" data-tip-title="Verified lease" data-tip="We saw proof that this person is really on this lease.">✓ Verified lease</span>' : '',
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

  function card(l) {
    const c = contactLink(l);
    return `
      <article class="card clickable" id="l-${esc(l.id)}" data-listing="${esc(l.id)}" tabindex="0" aria-label="View details for ${esc(l.complex)}">
        ${photosHtml(l)}
        <div class="card-top">
          <h3>${esc(l.complex)}</h3>
          <div class="rent">${money(l.rent)}<small>/mo</small></div>
        </div>
        ${byLine(l, false)}
        <div class="tags">${tagsHtml(l)}</div>
        <div class="meta">
          <span>Available <b>${esc(fmtDate(l.availableFrom))}</b> · Lease ends <b>${esc(fmtDate(l.leaseEnds))}</b></span>
        </div>
        ${l.description ? `<p class="desc">${esc(l.description)}</p>` : ''}
        <div class="card-actions">
          ${contactBtn(l, 'sm')}
          <a class="btn btn-outline btn-sm" href="#l-${esc(l.id)}">View details</a>
        </div>
      </article>`;
  }

  // Full details page for one listing.
  function detail(l) {
    const c = contactLink(l);
    const arr = ARRANGEMENT[l.arrangement];
    const facts = [
      ['Lease', arr ? `${arr.label}<small>${esc(arr.hint)}</small>` : ''],
      ['Room', esc(typeLabel(l))],
      ['Bed / bath', l.bedrooms !== '' ? `${esc(l.bedrooms)} bed · ${esc(l.bathrooms)} bath` : ''],
      ['Roommates', l.unitType === 'bed' ? esc(l.gender && l.gender !== 'Any' ? `${l.gender} only` : 'Any') : ''],
      ['Furnished', esc(l.furnished || '')],
      ['Available', esc(fmtDate(l.availableFrom))],
      ['Lease ends', esc(fmtDate(l.leaseEnds))],
      ['Transfer fee', esc(l.takeoverFee && !/^n\/?a$/i.test(l.takeoverFee) ? l.takeoverFee : 'Ask the complex')],
    ].filter(([, v]) => v);

    return `
      <article class="detail">
        ${photosHtml(l, { thumbs: true })}
        <div class="detail-body">
          <div class="detail-head">
            <h1>${esc(l.complex)}</h1>
            <div class="detail-rent">${money(l.rent)}<small>/mo</small></div>
          </div>
          ${byLine(l, true)}
          <div class="tags">${tagsHtml(l)}</div>

          ${l.incentive > 0 ? `<div class="callout">💵 The current tenant is offering <b>${money(l.incentive)}</b> to whoever takes over this lease.</div>` : ''}

          <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>

          ${l.description ? `<section class="detail-section"><h2>About this place</h2><p class="detail-desc">${esc(l.description)}</p></section>` : ''}

          <div class="detail-actions">
            ${contactBtn(l, 'lg')}
            <button type="button" class="btn btn-outline btn-lg" data-share="${esc(l.id)}">Share</button>
          </div>

          <p class="detail-note">Tour before committing, and pay rent and fees to the complex, not a stranger. <a href="/how-it-works">How takeovers work →</a></p>
          <p class="detail-note"><button type="button" class="link-btn" data-report="${esc(l.id)}">Report this listing</button></p>
        </div>
      </article>`;
  }

  function render() {
    const list = filtered();
    const live = all.filter((l) => !l.taken);
    const taken = all.filter((l) => l.taken);
    $('#listings').innerHTML = list.map(card).join('');
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
      history.pushState('', '', location.pathname + location.search); // came from a shared link
      exitFocus();
      $('#board').scrollIntoView({ behavior: 'smooth' });
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
  function openDialog(id) {
    track('open/' + id.replace('-dialog', ''), 'Opened form: ' + id.replace('-dialog', ''));
    const d = document.getElementById(id);
    $('form', d).hidden = false;
    $('.form-success', d).hidden = true;
    $('.form-error', d).hidden = true;
    if (id === 'waitlist-dialog') {
      const f = $('#waitlist-form');
      if ($('#f-max').value && !f.maxRent.value) f.maxRent.value = $('#f-max').value;
      if ($('#f-movein').value && !f.moveIn.value) f.moveIn.value = $('#f-movein').value;
      if ($('#f-type').value) f.unitType.value = $('#f-type').value;
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
  let photos = []; // [{ dataUrl }]

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
    photos = [];
    renderPhotoPreviews();
    proof = null;
    renderProof();
  }

  // Lease screenshot for the Verified badge (private; never shown on the site).
  let proof = null;
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
    if (!form.checkValidity()) {
      const bad = form.querySelector(':invalid');
      if (bad.type === 'tel' && bad.value) return 'Please enter a full 10-digit phone number.';
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
    }
    if (type === 'listing') data.photos = photos.map((p) => p.dataUrl.split(',')[1]);
    if (type === 'listing' && proof) data.proof = proof.split(',')[1];
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
      form.reset();
      if (type === 'waitlist') syncNotifyBy();
      if (type === 'listing') clearPhotos();
      form.hidden = true;
      $('.form-success', form.closest('dialog')).hidden = false;
      track('submitted/' + type, 'Submitted: ' + type);
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
  ['#f-search', '#f-type', '#f-arrangement', '#f-max', '#f-movein', '#f-incentive', '#f-sort'].forEach((s) =>
    $(s).addEventListener('input', render)
  );

  document.addEventListener('click', (e) => {
    const ct = e.target.closest('[data-contact]');
    if (ct) {
      const cl = all.find((x) => x.id === ct.dataset.contact);
      track('contact/' + ct.dataset.contact, 'Contact tap: ' + (cl ? cl.complex : ct.dataset.contact));
    }
    const open = e.target.closest('[data-open]');
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
  const contactMethodEl = $('#listing-form [name=contactMethod]');
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
  contactMethodEl.addEventListener('change', syncContactInput);
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
    $('#waitlist-email-hint').textContent = byEmail ? '(required for email alerts)' : '(optional)';
  }
  $$('#waitlist-form [name=notifyBy]').forEach((r) => r.addEventListener('change', syncNotifyBy));
  syncNotifyBy();
  $('#waitlist-form').addEventListener('submit', (e) => { e.preventDefault(); submit(e.target, 'waitlist'); });
  $('#report-form').addEventListener('submit', (e) => { e.preventDefault(); submit(e.target, 'report'); });
  $('#feedback-form').addEventListener('submit', (e) => { e.preventDefault(); submit(e.target, 'feedback'); });

  window.addEventListener('hashchange', focusFromHash);

  window.addEventListener('popstate', focusFromHash);

  if (CFG.contactEmail) {
    $('#footer-contact').innerHTML = `Questions? <a href="mailto:${esc(CFG.contactEmail)}">${esc(CFG.contactEmail)}</a>`;
  }

  // Links from the How it works page: index.html#list and index.html#alerts open the forms.
  if (location.hash === '#list') openDialog('listing-dialog');
  if (location.hash === '#alerts') openDialog('waitlist-dialog');
  if (location.hash === '#feedback') openDialog('feedback-dialog');

  load();
})();
