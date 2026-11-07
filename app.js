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

  let all = [];

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
    };
  }

  // Photos are stored in Google Drive; these are two public ways to show a shared Drive image.
  const photoUrl = (id) => `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1200`;
  const photoFallbackUrl = (id) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`;

  function contactLink(l) {
    const c = String(l.contact || '').trim();
    const handle = c.replace(/^@/, '');
    switch (l.contactMethod) {
      case 'text': return { href: 'sms:' + c.replace(/[^\d+]/g, ''), label: 'Text ' + c };
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
      } catch (err) {
        console.error(err);
        $('#result-count').textContent = "Couldn't load listings. Try refreshing.";
        return;
      }
    }
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

  function card(l) {
    const c = contactLink(l);
    const typeLabel = l.unitType === 'unit' ? 'Whole unit' : 'By the bed';
    const tags = [
      l.transferConfirmed ? '<span class="tag confirmed" title="We confirmed with the complex that this lease can be transferred">✓ Transfer confirmed with complex</span>' : '',
      l.verified ? '<span class="tag verified" title="We saw proof of this lease">✓ Verified lease</span>' : '',
      ARRANGEMENT[l.arrangement] ? `<span class="tag arrangement" title="${esc(ARRANGEMENT[l.arrangement].hint)}">${ARRANGEMENT[l.arrangement].label}</span>` : '',
      l.incentive > 0 ? `<span class="tag incentive">${money(l.incentive)} incentive</span>` : '',
      `<span class="tag">${typeLabel}</span>`,
      l.bedrooms !== '' ? `<span class="tag">${esc(l.bedrooms)} bd / ${esc(l.bathrooms)} ba</span>` : '',
      l.unitType === 'bed' && l.gender && l.gender !== 'Any' ? `<span class="tag">${esc(l.gender)} roommates</span>` : '',
      l.furnished === 'Yes' ? '<span class="tag">Furnished</span>' : '',
    ].join('');

    const n = l.photos.length;
    const photos = n
      ? `<div class="photo-wrap">
          <div class="photos">${l.photos.map((id, i) => `<img src="${esc(photoUrl(id))}" data-fallback="${esc(photoFallbackUrl(id))}" alt="Photo ${i + 1} of ${esc(l.complex)}" loading="lazy">`).join('')}</div>
          ${n > 1 ? `
            <button type="button" class="photo-nav prev" data-photo-nav="-1" aria-label="Previous photo">&#8249;</button>
            <button type="button" class="photo-nav next" data-photo-nav="1" aria-label="Next photo">&#8250;</button>
            <span class="photo-counter">1 / ${n}</span>` : ''}
        </div>`
      : '';

    return `
      <article class="card" id="l-${esc(l.id)}">
        ${photos}
        <div class="card-top">
          <h3>${esc(l.complex)}</h3>
          <div class="rent">${money(l.rent)}<small>/mo</small></div>
        </div>
        <div class="tags">${tags}</div>
        <div class="meta">
          <span>Available <b>${esc(fmtDate(l.availableFrom))}</b> · Lease ends <b>${esc(fmtDate(l.leaseEnds))}</b></span>
          ${l.takeoverFee ? `<span>Transfer fee: <b>${esc(l.takeoverFee)}</b></span>` : ''}
        </div>
        ${l.description ? `<p class="desc">${esc(l.description)}</p>` : ''}
        <div class="card-actions">
          <a class="btn btn-primary btn-sm" href="${esc(c.href)}" target="_blank" rel="noopener">${esc(c.label)}</a>
          <button class="btn btn-outline btn-sm" data-share="${esc(l.id)}">Share</button>
          <button class="link-btn" data-report="${esc(l.id)}">Report</button>
        </div>
      </article>`;
  }

  function render() {
    const list = filtered();
    $('#listings').innerHTML = list.map(card).join('');
    // Keep the "2 / 5" photo counter in sync when people swipe or use the arrows.
    $$('#listings .photos').forEach((strip) =>
      strip.addEventListener('scroll', () => {
        const counter = strip.parentElement.querySelector('.photo-counter');
        if (!counter) return;
        const total = strip.querySelectorAll('img').length;
        const current = Math.min(total, Math.round(strip.scrollLeft / strip.clientWidth) + 1);
        counter.textContent = `${current} / ${total}`;
      }, { passive: true })
    );
    $('#empty').hidden = list.length > 0;
    $('#result-count').textContent = all.length
      ? `${list.length} of ${all.length} takeover${all.length === 1 ? '' : 's'}`
      : '';
  }

  function focusFromHash() {
    const m = location.hash.match(/^#l-(.+)$/);
    if (!m) return;
    const el = document.getElementById('l-' + m[1]);
    if (!el) return;
    el.classList.add('highlight');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function share(id) {
    const l = all.find((x) => x.id === id);
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
  }

  // ---------- forms ----------
  function validate(form, type) {
    if (!form.checkValidity()) {
      const bad = form.querySelector(':invalid');
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
    if (type === 'listing') data.photos = photos.map((p) => p.dataUrl.split(',')[1]);
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
      if (type === 'listing') clearPhotos();
      form.hidden = true;
      $('.form-success', form.closest('dialog')).hidden = false;
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
    const rm = e.target.closest('[data-remove-photo]');
    if (rm) { photos.splice(Number(rm.dataset.removePhoto), 1); renderPhotoPreviews(); }
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
  $('#waitlist-form').addEventListener('submit', (e) => { e.preventDefault(); submit(e.target, 'waitlist'); });
  $('#report-form').addEventListener('submit', (e) => { e.preventDefault(); submit(e.target, 'report'); });

  window.addEventListener('hashchange', focusFromHash);

  if (CFG.contactEmail) {
    $('#footer-contact').innerHTML = `Questions? <a href="mailto:${esc(CFG.contactEmail)}">${esc(CFG.contactEmail)}</a>`;
  }

  // Links from the How it works page: index.html#list and index.html#alerts open the forms.
  if (location.hash === '#list') openDialog('listing-dialog');
  if (location.hash === '#alerts') openDialog('waitlist-dialog');

  load();
})();
