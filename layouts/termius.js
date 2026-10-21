(() => {
  if (!window.BITS_LAYOUTS) return;
  let clockTimer;

  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.setAttribute('data-layout-chrome', 'termius');
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function link(label, href, active) {
    const element = node('a', '', label);
    element.href = href;
    if (active) element.setAttribute('aria-current', 'page');
    return element;
  }

  window.BITS_LAYOUTS.register('termius', {
    mount(ctx) {
      const page = ctx.page || 'online';
      const session = page === 'post' ? 'blog/post.md' : page === 'error' ? '404' : page;
      const sidebar = node('aside', 'termius-sidebar');
      sidebar.setAttribute('aria-label', 'SSH workspace');
      sidebar.append(node('div', 'termius-brand', '>_ TERMIUS'), node('p', 'termius-workspace', 'SHORTBITS / PERSONAL VAULT'));
      const hosts = node('nav', 'termius-hosts');
      hosts.setAttribute('aria-label', 'Hosts');
      hosts.append(node('h2', '', '⌄ Hosts'), node('p', 'termius-group', 'MY CONNECTIONS'));
      [ ['online', '01  online', '/online/'], ['professional', '02  professional', '/professional/'], ['blog', '03  blog archive', '/blog/'], ['boot', '04  boot console', '/boot/'] ].forEach(([id, label, href]) => {
        hosts.append(link(label, href, page === id || (id === 'blog' && page === 'post')));
      });
      sidebar.append(hosts);
      const snippets = node('nav', 'termius-snippets');
      snippets.setAttribute('aria-label', 'Snippets');
      snippets.append(node('h2', '', '⌘ Snippets'));
      const sections = page === 'professional'
        ? [['experience', 'cat experience.md'], ['skills', 'ls skills/'], ['projects', 'ls projects/'], ['contact', 'write caleb']]
        : [['identity-name', 'cat about.txt'], ['featured-heading', 'ls featured/'], ['link-heading', 'cat links.conf'], ['contact-heading', 'write caleb']];
      sections.forEach(([id, label]) => {
        if (document.getElementById(id)) snippets.append(link(label, `#${id}`));
      });
      snippets.append(link('less journal/', '/blog/'));
      sidebar.append(snippets);
      const forwarding = node('nav', 'termius-forwarding');
      forwarding.setAttribute('aria-label', 'Port forwarding');
      forwarding.append(node('h2', '', '⇄ Port forwarding'), link('localhost → host picker', '/?choose'), link('localhost → career', '/professional/'));
      sidebar.append(forwarding, node('div', 'termius-sidebar-foot', '● vault unlocked\nSSH / local workspace'));

      const tabs = node('nav', 'termius-tabs');
      tabs.setAttribute('aria-label', 'Terminal sessions');
      tabs.append(link(`● caleb@shortbits:~/${session}`, page === 'chooser' ? '/?choose' : location.pathname + location.search, true), link('+ Connect', '/?choose'));
      const topbar = node('header', 'termius-topbar');
      topbar.append(tabs, node('span', 'termius-connection', 'SSH  •  UTF-8'));

      const status = node('footer', 'termius-status');
      const statusNav = node('nav', 'termius-status-sessions');
      statusNav.setAttribute('aria-label', 'Session shortcuts');
      [['online', '/online/'], ['professional', '/professional/'], ['blog', '/blog/']].forEach(([id, href], index) => {
        statusNav.append(link(`${index === 0 ? '[0]' : index} ${id}${page === id ? '*' : ''}`, href, page === id));
      });
      const clock = node('time', 'termius-clock');
      const tick = () => {
        const now = new Date();
        clock.dateTime = now.toISOString();
        clock.textContent = now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false});
      };
      tick();
      clockTimer = window.setInterval(tick, 1000);
      status.append(statusNav, node('span', 'termius-status-meta', 'shortbits  •  bash'), clock);
      ctx.body.prepend(sidebar, topbar);
      ctx.body.append(status);

      const target = document.querySelector(page === 'professional' ? '#main' : page === 'chooser' ? '.chooser-body' : 'main');
      if (target) {
        const greeting = node('div', 'termius-greeting');
        greeting.append(node('p', 'termius-session-info', 'Connected to shortbits.net · interactive session'));
        const banner = node('pre', 'termius-ascii', '┌───────────────────────────┐\n│  BBBB   III  TTTTT  SSSS  │\n│  B   B   I     T    S     │\n│  BBBB    I     T    SSSS  │\n│  B   B   I     T       S  │\n│  BBBB   III    T    SSSS  │\n└───────────────────────────┘');
        banner.setAttribute('aria-hidden', 'true');
        greeting.append(banner);
        const commands = {online: 'cat about.txt', professional: 'man caleb', blog: 'ls -lah journal/', post: 'less post.md', chooser: 'ssh --select-host', boot: 'tail -f /var/log/boot.log', error: 'stat ' + location.pathname};
        const prompt = node('p', 'termius-prompt');
        prompt.append(node('span', 'termius-user', 'caleb@shortbits'), node('span', '', ':~$ ' + (commands[page] || 'pwd')));
        const cursor = node('span', 'termius-cursor', '█');
        cursor.setAttribute('aria-hidden', 'true');
        prompt.append(cursor);
        greeting.append(prompt);
        if (page === 'professional') greeting.append(node('p', 'termius-man-header', 'CALEB(1)         USER COMMANDS         CALEB(1)'));
        if (page === 'post') greeting.append(node('p', 'termius-file-info', 'post.md  •  read-only  •  scroll to read'));
        if (page === 'chooser') greeting.append(node('p', 'termius-hint', 'Select host  [1] online  [2] professional'));
        if (page === 'error') greeting.append(node('p', 'termius-error', `bash: ${location.pathname}: No such file or directory`));
        target.prepend(greeting);
      }
    },
    unmount() {
      window.clearInterval(clockTimer);
      clockTimer = undefined;
    },
  });
})();


