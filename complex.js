// Complex pages (takeoversmtx.com/lease-takeover/<complex>).
// Used two ways: the build script (Node) renders the cards into the HTML so Google sees them,
// and in the browser it reloads the live listings so visitors never see a stale page.
(function (root) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '$' + Number(n || 0).toLocaleString('en-US');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function toDate(s) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function fmt(s) { const d = toDate(s); return d ? MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() : ''; }
  // "The Villages on Telluride", "Cabana Beach San Marcos" -> one key per complex.
  const key = (name) => String(name || '').toLowerCase()
    .replace(/\b(the|san marcos|apartments?|apts?|smtx|tx)\b/g, '').replace(/[^a-z0-9]/g, '');
  const photoUrl = (id) => 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(id) + '=w800';
  const isLive = (l) => !l.taken && String(l.status || '') !== 'taken';

  function card(l) {
    const p = (l.photos || [])[0];
    const tags = [
      l.verified ? '<span class="tag verified">✓ Verified lease</span>' : '',
      Number(l.incentive) > 0 ? '<span class="tag incentive">' + money(l.incentive) + ' incentive</span>' : '',
      '<span class="tag">' + (l.unitType === 'unit' ? 'Whole unit' : 'Private room') + '</span>',
      l.bedrooms !== '' && l.bedrooms != null ? '<span class="tag">' + esc(l.bedrooms) + ' bd / ' + esc(l.bathrooms) + ' ba</span>' : '',
      l.unitType === 'bed' && l.gender && l.gender !== 'Any' ? '<span class="tag">' + esc(l.gender) + ' roommates</span>' : '',
      l.furnished === 'Yes' ? '<span class="tag">Furnished</span>' : '',
    ].join('');
    return '<a class="card cp-card" href="/#l-' + esc(l.id) + '">' +
      (p ? '<img class="cp-photo" src="' + esc(photoUrl(p)) + '" alt="Photo of a lease takeover at ' + esc(l.complex) + '" loading="lazy">' : '') +
      '<div class="card-top"><h3>' + esc(l.complex) + '</h3><div class="rent">' + money(l.rent) + '<small>/mo</small></div></div>' +
      '<div class="tags">' + tags + '</div>' +
      '<div class="meta"><span>Available <b>' + esc(fmt(l.availableFrom)) + '</b> · Lease ends <b>' + esc(fmt(l.leaseEnds)) + '</b></span></div>' +
      '<span class="cp-more">See details and contact →</span></a>';
  }

  function summary(list, name) {
    if (!list.length) return 'No ' + esc(name) + ' takeovers listed right now.';
    const min = Math.min.apply(null, list.map((l) => Number(l.rent)));
    return '<b>' + list.length + '</b> ' + (list.length === 1 ? 'takeover' : 'takeovers') + ' available now, from <b>' + money(min) + '/mo</b>.';
  }

  const api = { esc, money, fmt, key, card, summary, isLive };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // Browser: refresh the listings from the live board.
  const box = document.getElementById('cp-listings');
  const url = (root.TAKEOVER_CONFIG || {}).apiUrl;
  if (!box || !url) return;
  const k = box.dataset.key, name = box.dataset.name;
  fetch(url).then((r) => r.json()).then((data) => {
    const list = (data.listings || []).filter((l) => isLive(l) && key(l.complex) === k).sort((a, b) => a.rent - b.rent);
    document.getElementById('cp-summary').innerHTML = summary(list, name);
    box.innerHTML = list.map(card).join('');
    document.getElementById('cp-empty').hidden = list.length > 0;
  }).catch(() => { /* keep the built version */ });
})(this);
