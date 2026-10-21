// Public, non-secret site settings. Leave a value empty to switch that feature off.
window.SITE_CONFIG = Object.freeze({
  // Cloudflare dashboard > Analytics & Logs > Web Analytics > Add a site > copy the "token" from the JS snippet.
  cloudflareAnalyticsToken: "abc278e0b47f4f89b18d6ba78df032d0",
  // Cloudflare dashboard > Turnstile > Add widget > "Site Key". The matching Secret Key belongs in GitHub secrets.
  turnstileSiteKey: "0x4AAAAAAFekKmeFCUNfAXEN",
});
