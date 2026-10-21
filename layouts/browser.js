(() => {
  if (!window.BITS_LAYOUTS) return;

  let frame;
  let titleObserver;
  let windowObserver;
  let menuHome = null;
  let applyVariant = () => {};
  const windowOffsets = new Map();
  let cleanups = [];
  const sections = [
    ['Online', '/online/'],
    ['Professional', '/professional/'],
    ['Blog', '/blog/'],
    ['Boot', '/boot/'],
  ];
  const variantChrome = {
    chrome: { caption: 'CHROME', bar: 'Bookmarks bar', menu: '⋮', reload: '⟳', title: '' },
    firefox: { caption: 'FIREFOX', bar: 'Bookmarks Toolbar', menu: '≡', reload: '↻', title: '' },
    edge: { caption: 'EDGE', bar: 'Favorites bar', menu: '⋯', reload: '↻', title: '' },
    'edge-legacy': { caption: 'EDGE', bar: 'Favorites bar', menu: '⋯', reload: '↻', title: '' },
    'internet-explorer': { caption: '', bar: 'Links', menu: '⚙', reload: '↻', address: 'Address', go: 'Go', title: ' - Microsoft Internet Explorer' },
    safari: { caption: '', bar: 'Favorites', menu: '⋯', reload: '↻', title: '' },
    opera: { caption: 'OPERA GX', bar: 'Bookmarks bar', menu: '≡', reload: '↻', title: '' },
    netscape: { caption: 'N', bar: 'Personal Toolbar', menu: '≡', reload: '↻', address: 'Location:', title: ' - Netscape' },
  };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.setAttribute('data-layout-chrome', 'browser');
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function listen(node, event, handler) {
    node.addEventListener(event, handler);
    cleanups.push(() => node.removeEventListener(event, handler));
  }

  function button(label, glyph, action) {
    const node = element('button', 'browser-icon', glyph);
    node.type = 'button';
    node.title = label;
    node.setAttribute('aria-label', label);
    listen(node, 'click', action);
    return node;
  }

  function link(label, href, className) {
    const node = element('a', className, label);
    node.href = href;
    return node;
  }

  function mount(ctx) {
    frame = element('header', 'browser-frame');
    frame.setAttribute('aria-label', 'Browser frame');
    const strip = element('nav', 'browser-tabs');
    strip.setAttribute('aria-label', 'Site tabs');
    const active = element('div', 'browser-tab browser-tab-active');
    active.setAttribute('aria-current', 'page');
    const favicon = element('img', 'browser-favicon');
    favicon.src = '/images/favicon.png';
    favicon.alt = '';
    const title = element('span', 'browser-tab-title', document.title);
    active.append(favicon, title);
    if (ctx.page === 'boot') active.append(element('span', 'browser-tab-spinner'));
    strip.append(active);
    sections.forEach(([label, href]) => {
      if (location.pathname.startsWith(href) || (ctx.page === 'post' && href === '/blog/')) return;
      strip.append(link(label, href, 'browser-tab'));
    });
    const newTab = link('+', '/', 'browser-new-tab');
    newTab.title = 'New tab — choose a profile';
    newTab.setAttribute('aria-label', 'New tab — choose a profile');
    strip.append(newTab, element('span', 'browser-caption', 'BROWSER'));
    const caption = strip.lastChild;

    const toolbar = element('div', 'browser-toolbar');
    const reload = button('Reload page', '⟳', () => location.reload());
    toolbar.append(
      button('Back', '←', () => history.back()),
      button('Forward', '→', () => history.forward()),
      reload
    );
    const addressLabel = element('span', 'browser-address-label');
    addressLabel.setAttribute('aria-hidden', 'true');
    toolbar.append(addressLabel);
    const form = element('form', 'browser-omnibox');
    form.setAttribute('role', 'search');
    const lock = element('span', 'browser-lock', '▣');
    lock.title = 'Same-origin navigation only';
    lock.setAttribute('aria-hidden', 'true');
    const address = element('input', 'browser-address');
    address.type = 'text';
    address.setAttribute('aria-label', 'Address: enter a same-origin path');
    address.setAttribute('autocomplete', 'off');
    address.setAttribute('spellcheck', 'false');
    address.setAttribute('autocapitalize', 'off');
    address.setAttribute('enterkeyhint', 'go');
    const display = element('span', 'browser-address-display');
    display.setAttribute('aria-hidden', 'true');
    const host = element('strong', '', 'shortbits.net');
    const path = element('span', '', location.pathname + location.search + location.hash);
    display.append(host, path);
    function syncAddress() {
      address.value = 'shortbits.net' + location.pathname + location.search + location.hash;
      path.textContent = location.pathname + location.search + location.hash;
      address.setCustomValidity('');
    }
    syncAddress();
    listen(window, 'hashchange', syncAddress);
    listen(window, 'popstate', syncAddress);
    listen(address, 'focus', () => address.select());
    listen(address, 'input', () => address.setCustomValidity(''));
    listen(address, 'keydown', (event) => {
      if (event.key === 'Escape') { syncAddress(); address.blur(); }
    });
    listen(form, 'submit', (event) => {
      event.preventDefault();
      let value = address.value.trim();
      if (/^(?:https?:\/\/)?shortbits\.net(?=[/?#]|$)/i.test(value)) {
        value = value.replace(/^(?:https?:\/\/)?shortbits\.net/i, '') || '/';
      }
      try {
        const target = new URL(value, location.origin + '/');
        if (!value || target.origin !== location.origin || !/^https?:$/.test(target.protocol)) throw new Error('origin');
        location.assign(target.pathname + target.search + target.hash);
      } catch {
        address.setCustomValidity('Enter a path on this site, for example /blog/. External addresses are not allowed.');
        address.reportValidity();
      }
    });
    form.append(lock, address, display);
    const go = element('button', 'browser-go');
    go.type = 'submit';
    go.setAttribute('aria-label', 'Go to address');
    form.append(go);
    toolbar.append(form);
    const extras = element('div', 'browser-extras');
    extras.append(
      link('♧', '/online/#app-menu-bar', 'browser-icon'),
      link('CK', '/professional/', 'browser-profile')
    );
    extras.firstChild.title = 'Site tools';
    extras.firstChild.setAttribute('aria-label', 'Site tools');
    extras.lastChild.setAttribute('aria-label', 'Caleb’s professional profile');
    const menu = element('details', 'browser-menu');
    const summary = element('summary', 'browser-icon', '⋮');
    summary.setAttribute('aria-label', 'Browser menu');
    const menuBody = element('nav', 'browser-menu-body');
    menuBody.setAttribute('aria-label', 'Browser shortcuts');
    sections.forEach(([label, href]) => menuBody.append(link(label, href)));
    menuBody.append(link('Choose a profile', '/'));
    menu.append(summary, menuBody);
    toolbar.append(extras, menu);
    const bookmarks = element('nav', 'browser-bookmarks');
    bookmarks.setAttribute('aria-label', 'Bookmarks');
    const barLabel = element('span', 'browser-bar-label');
    barLabel.setAttribute('aria-hidden', 'true');
    bookmarks.append(barLabel);
    // The site's own menu bar (FILE / EDIT / VIEW…) lives in the favorites bar while this layout is active.
    const appMenuBar = document.querySelector('#app-menu-bar');
    if (appMenuBar) {
      menuHome = { node: appMenuBar, parent: appMenuBar.parentNode, next: appMenuBar.nextSibling };
      bookmarks.append(appMenuBar, element('span', 'browser-bar-separator'));
      frame.classList.add('browser-frame-has-menu');
    }
    sections.forEach(([label, href]) => bookmarks.append(link('◇  ' + label, href, 'browser-bookmark')));
    [['Site menu', '/online/#app-menu-bar'], ['Experience', '/professional/#experience'], ['Projects', '/professional/#projects']].forEach(([label, href]) => {
      if (appMenuBar && label === 'Site menu') return;
      bookmarks.append(link(label, href, 'browser-bookmark'));
    });
    applyVariant = () => {
      const chrome = variantChrome[document.documentElement.dataset.themeVariant] ?? variantChrome.chrome;
      caption.textContent = chrome.caption;
      summary.textContent = chrome.menu;
      reload.textContent = chrome.reload;
      barLabel.textContent = chrome.bar;
      bookmarks.setAttribute('aria-label', chrome.bar);
      addressLabel.textContent = chrome.address ?? '';
      go.textContent = chrome.go ?? '';
      title.textContent = document.title + chrome.title;
    };
    applyVariant();
    frame.append(strip, toolbar, bookmarks);
    if (ctx.page === 'boot') frame.append(element('div', 'browser-loading'));
    ctx.body.prepend(frame);
    // Keep the existing window drag coordinates, but clip their usable area below the browser toolbar.
    function syncWindowOffset(node) {
      const value = `${parseFloat(node.style.top) || 0}px`;
      if (node.style.getPropertyValue('--browser-window-top') !== value) {
        node.style.setProperty('--browser-window-top', value);
      }
    }
    windowObserver = new MutationObserver((records) => {
      records.forEach(({ target }) => syncWindowOffset(target));
    });
    document.querySelectorAll('.desktop-window').forEach((node) => {
      windowOffsets.set(node, node.style.getPropertyValue('--browser-window-top'));
      syncWindowOffset(node);
      windowObserver.observe(node, { attributes: true, attributeFilter: ['style'] });
    });
    titleObserver = new MutationObserver(() => applyVariant());
    titleObserver.observe(document.querySelector('title') || document.head, { childList: true, subtree: true, characterData: true });

    if (ctx.page === 'chooser') {
      const shortcuts = element('nav', 'browser-shortcuts');
      shortcuts.setAttribute('aria-label', 'More shortcuts');
      sections.slice(2).forEach(([label, href]) => {
        const tile = link('', href, 'browser-shortcut');
        tile.append(element('span', '', label === 'Blog' ? '▤' : '⟳'), element('strong', '', label));
        shortcuts.append(tile);
      });
      document.querySelector('.chooser-options')?.after(shortcuts);
    }
    if (ctx.page === 'error') {
      const content = document.querySelector('#error-content');
      if (content) {
        const intro = element('div', 'browser-error-intro');
        intro.append(element('span', 'browser-error-ascii', ':('), element('h2', '', "This page isn't available"), element('p', '', 'The address may have changed, or a bit went missing.'), element('p', 'browser-error-code', 'ERR_BIT_NOT_FOUND'));
        content.prepend(intro);
      }
    }
  }

  window.BITS_LAYOUTS.register('browser', {
    mount,
    update() {
      applyVariant();
    },
    unmount() {
      if (menuHome) {
        const { node, parent, next } = menuHome;
        if (next && next.parentNode === parent) parent.insertBefore(node, next);
        else parent.append(node);
        menuHome = null;
      }
      applyVariant = () => {};
      windowObserver?.disconnect();
      windowObserver = null;
      windowOffsets.forEach((value, node) => {
        if (value) node.style.setProperty('--browser-window-top', value);
        else node.style.removeProperty('--browser-window-top');
      });
      windowOffsets.clear();
      titleObserver?.disconnect();
      titleObserver = null;
      cleanups.forEach((cleanup) => cleanup());
      cleanups = [];
      frame = null;
    },
  });
})();

