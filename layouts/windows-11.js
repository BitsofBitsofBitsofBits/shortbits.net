(() => {
  if (!window.BITS_LAYOUTS) return;
  let controller;
  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.setAttribute('data-layout-chrome', 'windows-11');
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }
  function navigation(host, items) {
    const nav = node('nav', 'w11-navigation');
    nav.setAttribute('aria-label', 'Settings navigation');
    nav.append(node('strong', 'w11-nav-heading', 'Settings'));
    items.forEach(([label, destination, icon], index) => {
      const link = node('a', index === 0 ? 'w11-nav-item is-selected' : 'w11-nav-item');
      link.href = destination;
      const glyph = node('span', 'w11-nav-icon', icon);
      glyph.setAttribute('aria-hidden', 'true');
      link.append(glyph, document.createTextNode(label));
      link.addEventListener('click', () => {
        nav.querySelectorAll('a').forEach(item => item.classList.toggle('is-selected', item === link));
      }, { signal: controller.signal });
      nav.append(link);
    });
    const menu = host.querySelector("#app-menu-bar");
    if (menu) menu.after(nav); else host.append(nav);
  }
  function titlebar(host, title) {
    const bar = node('div', 'w11-titlebar');
    const glyph = node('span', 'w11-app-glyph');
    glyph.setAttribute('aria-hidden', 'true');
    bar.append(glyph, node('span', '', title));
    const captions = node('span', 'w11-caption-decoration', '—     □     ×');
    captions.setAttribute('aria-hidden', 'true');
    bar.append(captions);
    host.prepend(bar);
  }
  window.BITS_LAYOUTS.register('windows-11', {
    mount(ctx) {
      controller = new AbortController();
      if (ctx.page === 'online') {
        const shell = document.getElementById('interface-shell');
        if (shell) navigation(shell, [
          ['Home', '#identity-name', '⌂'], ['Featured', '#featured-heading', '◇'],
          ['Professional', '/professional/', '▤'], ['Blog', '/blog/', '▱'], ['Boot diagnostics', '/boot/', '↻']
        ]);
        const taskbar = document.querySelector('.fake-taskbar');
        if (taskbar) {
          const search = node('button', 'w11-search', '⌕  Search your Bits');
          search.type = 'button';
          search.addEventListener('click', () => {
            document.querySelector('#fake-desktop [data-window-target="filesystem-window"]')?.click();
          }, { signal: controller.signal });
          taskbar.append(search);
        }
        const quick = document.getElementById('fake-action-center');
        if (quick) quick.prepend(node('h2', 'w11-quick-heading', 'Quick settings'));
      } else if (ctx.page === 'professional') {
        const host = document.querySelector('.profile-layout');
        if (host) {
          titlebar(host, 'Settings · Professional profile');
          navigation(host, [['Overview', '#main', '⌂'], ['Experience', '#experience', '▣'],
            ['Education', '#education', '▤'], ['Skills', '#skills', '◇'],
            ['Projects', '#projects', '▱'], ['Contact', '#contact', '✉'], ['Internet presence', '/online/', '↗']]);
        }
      } else if (ctx.page === 'boot') {
        const host = document.querySelector('.endless-boot-console');
        if (host) {
          const welcome = node('div', 'w11-boot-welcome');
          const spinner = node('span', 'w11-spinner');
          spinner.setAttribute('aria-hidden', 'true');
          welcome.append(spinner, node('p', '', 'Just a moment...'));
          host.prepend(welcome);
        }
      } else {
        const host = document.querySelector('.chooser-terminal, .blog-shell, .error-window');
        if (host) titlebar(host, ctx.page === 'chooser' ? 'BITS OS · Choose an option' : ctx.page === 'error' ? 'BITS OS · Recovery' : 'Bits · Journal');
      }
    },
    unmount() {
      controller?.abort();
      controller = null;
    }
  });
})();

