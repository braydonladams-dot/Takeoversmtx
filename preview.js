// Preview safety switch. On any host that isn't takeoversmtx.com (the Vercel preview, localhost),
// nothing is real: forms don't create listings or send emails, and visits don't count in GoatCounter.
// On the live domain this file does nothing, so it's safe to ship.
(function () {
  if (/(^|\.)takeoversmtx\.com$/.test(location.hostname)) return;
  window.TAKEOVER_PREVIEW = true;
  // GoatCounter: skip the page view and send any events nowhere.
  window.goatcounter = { no_onload: true, endpoint: 'https://preview.invalid/count' };

  // Fake every POST to the backend (reads still use the real listings).
  const realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    const cfg = window.TAKEOVER_CONFIG || {};
    if (opts && String(opts.method || 'GET').toUpperCase() === 'POST' && cfg.apiUrl && String(url).indexOf(cfg.apiUrl) === 0) {
      let body = {};
      try { body = JSON.parse(opts.body); } catch (_) { /* ignore */ }
      console.log('[preview] blocked', body.type || 'POST', body);
      const out = { ok: true, preview: true, id: 'preview', status: 'approved', contactMethod: 'text', contact: '512-555-0100' };
      return Promise.resolve(new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch(url, opts);
  };

  document.addEventListener('DOMContentLoaded', function () {
    const bar = document.createElement('div');
    bar.textContent = 'PREVIEW · nothing you submit here is real';
    bar.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:9999;background:#111;color:#fff;font:600 12px/1 system-ui,sans-serif;padding:8px 14px;border-radius:999px;opacity:.85;pointer-events:none';
    document.body.appendChild(bar);
  });
})();
