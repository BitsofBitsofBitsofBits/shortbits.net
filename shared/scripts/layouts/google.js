(() => {
  if (!window.BITS_LAYOUTS) return;
  const colors = ['#4285f4', '#ea4335', '#fbbc05', '#34a853'];
  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.setAttribute('data-layout-chrome', 'google');
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }
  function link(text, href, className) {
    const element = node('a', className, text);
    element.href = href;
    return element;
  }
  function wordmark() {
    const mark = link('', '/', 'google-wordmark');
    mark.setAttribute('aria-label', 'Bits home');
    [...'Bits'].forEach((letter, index) => {
      const span = node('span', '', letter);
      span.style.color = colors[index];
      mark.append(span);
    });
    return mark;
  }
  function search(value) {
    const form = node('form', 'google-search');
    form.setAttribute('role', 'search');
    form.setAttribute('aria-label', 'Search this profile');
    const icon = node('span', 'google-search-icon');
    icon.setAttribute('aria-hidden', 'true');
    const input = node('input');
    input.type = 'search';
    input.value = value;
    input.placeholder = 'Search Bits or discover a profile';
    input.setAttribute('aria-label', 'Search Bits');
    const submit = node('button', 'google-search-submit', 'Search');
    submit.type = 'submit';
    form.append(icon, input, submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const query = input.value.trim().toLowerCase();
      if (query.includes('profession') || query.includes('career') || query.includes('resume')) location.href = '/professional/';
      else if (query.includes('blog') || query.includes('news')) location.href = '/blog/';
      else if (query.includes('boot')) location.href = '/boot/';
      else location.href = '/online/';
    });
    return form;
  }
  function tools() {
    const container = node('div', 'google-tools');
    const menu = node('details', 'google-apps');
    const summary = node('summary', 'google-waffle');
    summary.setAttribute('aria-label', 'Bits apps');
    for (let i = 0; i < 9; i += 1) {
      const dot = node('span');
      dot.setAttribute('aria-hidden', 'true');
      summary.append(dot);
    }
    const grid = node('nav', 'google-app-grid');
    grid.setAttribute('aria-label', 'Bits apps');
    [['Online', '/online/'], ['Professional', '/professional/'], ['News', '/blog/'], ['Device setup', '/boot/'], ['Home', '/']].forEach(([name, path]) => grid.append(link(name, path)));
    menu.append(summary, grid);
    const avatar = link('C', '/professional/', 'google-avatar');
    avatar.setAttribute('aria-label', 'Caleb K Masters professional profile');
    container.append(menu, avatar);
    return container;
  }
  window.BITS_LAYOUTS.register('google', {
    mount(ctx) {
      const header = node('header', 'google-header');
      header.append(wordmark());
      if (ctx.page !== 'chooser') header.append(search(ctx.page === 'online' ? 'caleb k masters' : ''));
      else header.append(link('About Caleb', '/professional/', 'google-header-link'), link('News', '/blog/', 'google-header-link'));
      header.append(tools());
      ctx.body.prepend(header);
      if (ctx.page === 'chooser') {
        const home = node('section', 'google-home');
        home.setAttribute('aria-label', 'Discover Bits');
        home.append(wordmark(), search(''));
        const actions = node('nav', 'google-home-actions');
        actions.setAttribute('aria-label', 'Choose your profile');
        actions.append(link('Online Search', '/online/'), link("I'm Feeling Professional", '/professional/'));
        home.append(actions, node('p', 'google-home-hint', 'A little curiosity. A lot of Bits.'));
        document.querySelector('.chooser').prepend(home);
      }
      if (ctx.page === 'online') {
        const tabs = node('nav', 'google-tabs');
        tabs.setAttribute('aria-label', 'Search categories');
        [['All', '#interface-shell'], ['Images', '#avatar-wrap'], ['News', '#content-files-heading'], ['Videos', '#media-player'], ['Professional', '/professional/']].forEach(([name, href], index) => {
          const tab = link(name, href);
          if (!index) tab.setAttribute('aria-current', 'page');
          tabs.append(tab);
        });
        header.after(tabs);
        document.querySelector('#interface-shell').prepend(node('p', 'google-results-count', 'About one very specific person · A web full of little Bits'));
        const results = [
          ['.featured-section', 'shortbits.net › online › projects', 'BitsofBits — projects, experiments & little ideas', '#featured-heading'],
          ['.link-section', 'shortbits.net › online › connections', 'Find Caleb around the internet', '#link-heading'],
          ['.content-files-section', 'shortbits.net › online › public-files', 'More about Caleb K Masters', '#content-files-heading'],
          ['.contact-section', 'shortbits.net › online › contact', 'Contact Caleb — send a message', '#contact-heading']
        ];
        results.forEach(([selector, path, title, href]) => {
          const section = document.querySelector(selector);
          if (!section) return;
          const resultHeader = node('div', 'google-result-header');
          resultHeader.append(node('p', 'google-breadcrumb', path), link(title, href, 'google-result-title'));
          section.prepend(resultHeader);
        });
        const profile = document.querySelector('.profile');
        profile.prepend(node('p', 'google-panel-label', 'Knowledge panel'), node('h2', 'google-person-name', 'Caleb K Masters'));
        const fab = link('✎', '#contact-heading', 'google-fab');
        fab.setAttribute('aria-label', 'Compose a message to Caleb');
        ctx.body.append(fab);
        profile.append(node('p', 'google-panel-footnote', 'About this person · A small corner of the internet'));
      }
      if (ctx.page === 'blog') {
        const title = node('div', 'google-news-title');
        title.append(wordmark(), node('span', '', 'News'));
        document.querySelector('.blog-shell').prepend(title);
      }
      if (ctx.page === 'boot') {
        const setup = node('div', 'google-setup');
        setup.append(wordmark(), node('h2', '', 'Setting up your device'), node('p', '', 'Getting your Bits ready. This may take a little while.'));
        document.querySelector('.endless-boot-console').prepend(setup);
      }
      if (ctx.page === 'error') {
        const error = document.querySelector('#error-content');
        error.prepend(node('p', 'google-error-heading', "404. That's an error."));
        const robot = node('pre', 'google-error-robot', '  ┌─────────┐\n  │  •   •  │\n  │    ▰    │\n  └──┬───┬──┘\n    /     \\');
        robot.setAttribute('aria-label', 'A slightly lost Bits robot');
        error.append(robot);
      }
    }
  });
})();
