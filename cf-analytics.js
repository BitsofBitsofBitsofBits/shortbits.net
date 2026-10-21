(() => {
  const token = window.SITE_CONFIG?.cloudflareAnalyticsToken;
  const privacySignal = navigator.globalPrivacyControl === true
    || navigator.doNotTrack === "1"
    || window.doNotTrack === "1";
  if (!token || privacySignal || /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
    return;
  }
  const beacon = document.createElement("script");
  beacon.defer = true;
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.dataset.cfBeacon = JSON.stringify({ token, spa: false });
  document.head.append(beacon);
})();
