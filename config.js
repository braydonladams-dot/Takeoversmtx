// ===== Edit these settings =====
window.TAKEOVER_CONFIG = {
  siteName: 'Takeover SMTX',

  // Paste your Google Apps Script web app URL here (see README, step 2).
  // While this is empty, the site runs in DEMO MODE with sample listings.
  apiUrl: 'https://script.google.com/macros/s/AKfycbz9pc7DFlzPNZEKvV6O1uK1_wKZA2klkvGK0cG4rne0inj8hpdNENzrfoHY2ZHPxnalvQ/exec',

  // Where people can reach you with questions (shown in the footer).
  contactEmail: 'team@takeoversmtx.com',

  // Accounts + payments (Supabase). The publishable key is meant to be public; real access is locked by Row Level Security.
  supabaseUrl: 'https://fkflptyzstspweekfihc.supabase.co',
  supabaseKey: 'sb_publishable_RXLgFj5YCEy8yP9Al_UPxw_vNYTX2uU',
  // Stripe publishable key (meant to be public). Test mode until Stripe is fully set up.
  stripeKey: 'pk_test_51UcYVKA7RQFcJ2PuBAZeWYdXIFOxqqZ9IBdi2D88TJk2vEHYHLHfGNzgXGyiT0abLbm6F0KeWwkU5eFyVcTQ1UST00Dud4s35H',
};
