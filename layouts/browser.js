(() => {
  if (!window.BITS_LAYOUTS) return;

  let frame;
  let titleObserver;
  let windowObserver;
  const windowOffsets = new Map();
  let cleanups = [];
  const sections = [
    ['Online', '/online/'],
    ['Professional', '/professional/'],
    ['Blog', '/blog/'],
    ['Boot', '/boot/'],
  ];

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

    const toolbar = element('div', 'browser-toolbar');
    toolbar.append(
      button('Back', '←', () => history.back()),
      button('Forward', '→', () => history.forward()),
      button('Reload page', '⟳', () => location.reload())
    );
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
    sections.forEach(([label, href]) => bookmarks.append(link('◇  ' + label, href)));
    [['Site menu', '/online/#app-menu-bar'], ['Experience', '/professional/#experience'], ['Projects', '/professional/#projects']].forEach(([label, href]) => {
      bookmarks.append(link(label, href));
    });
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
    titleObserver = new MutationObserver(() => { title.textContent = document.title; });
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
    unmount() {
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

