(() => {
  if (!window.BITS_LAYOUTS) return;
  const theme = 'legacy-bios';
  let controller;
  let activeVariant;
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    element.dataset.layoutChrome = theme;
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const pages = {
    chooser: ['Boot Device Selection', 'Choose a profile to start. Online opens the desktop; Professional opens experience, skills, and contact.'],
    professional: ['System Information', 'Inspect professional experience, education, supported platforms, and current projects.'],
    resume: ['System Configuration Summary', 'Review the printable résumé and career configuration.'],
    blog: ['Event Log', 'Read notes, project updates, and entries from the shortbits archive.'],
    post: ['Event Log / Entry', 'Read the selected archive entry. All article links remain available.'],
    boot: ['Power-On Self Test', 'Watch the live boot diagnostics below. Use the original console controls to change output.'],
    error: ['Boot Failure Recovery', 'The requested boot device was not found. Select a valid destination to recover.'],
  };
  function clear() {
    controller?.abort();
    document.querySelectorAll('[data-layout-chrome="legacy-bios"]').forEach((element) => element.remove());
  }
  function render(ctx) {
    clear();
    controller = new AbortController();
    const options = { signal: controller.signal };
    activeVariant = ctx.root.dataset.themeVariant || 'award';
    const variant = activeVariant;
    const page = ctx.page || 'chooser';
    const [section, description] = pages[page] || ['System Information', 'Browse the selected shortbits system page.'];
    const frame = make('section', 'bios-setup');
    frame.setAttribute('aria-label', 'BIOS setup navigation');
    const header = make('header', 'bios-header');
    const title = variant === 'phoenix' ? 'PhoenixBIOS Setup Utility' : variant === 'ami' ? 'AMIBIOS SETUP UTILITY' : 'CMOS Setup Utility - Copyright (C) 1984-2001 Award Software';
    header.append(make('div', 'bios-title', title), make('div', 'bios-subtitle', 'SHORTBITS.NET  /  PERSONAL SYSTEM CONFIGURATION'));
    frame.append(header);

    const tabs = make('nav', 'bios-tabs');
    tabs.setAttribute('aria-label', 'Setup categories');
    const tabItems = [['Main', '/?choose', 'chooser'], ['Advanced', '/professional/', 'professional'], ['Security', '/professional/#contact', 'contact'], ['Power', '/boot/', 'boot'], ['Boot', '/blog/', 'blog'], ['Exit', '/online/', 'online']];
    tabItems.forEach(([label, href, id]) => {
      const link = make('a', '', label);
      link.href = href;
      if (id === page || (id === 'blog' && page === 'post')) link.setAttribute('aria-current', 'page');
      tabs.append(link);
    });
    frame.append(tabs);
    const workspace = make('div', 'bios-workspace');
    const menu = make('nav', 'bios-menu');
    menu.setAttribute('aria-label', 'Setup items');
    const entries = [
      ['Standard CMOS Features', '/?choose', 'chooser', 'Select a boot profile: Online desktop or Professional profile.'],
      ['Advanced BIOS Features', '/professional/', 'professional', 'Inspect Caleb’s professional profile, experience, and system administration skills.'],
      ['Integrated Peripherals', '/professional/#projects', 'projects', 'Browse practical projects, home-lab services, and automation.'],
      ['Power Management Setup', '/boot/', 'boot', 'Run the endless power-on self test and inspect live boot diagnostics.'],
      ['PnP/PCI Configurations', '/professional/#skills', 'skills', 'Inspect supported platforms, technical skills, and tools.'],
      ['PC Health Status', '/blog/', 'blog', 'Read the event log: project updates, notes, and blog entries.'],
      ['Set Supervisor Password', '/professional/#contact', 'contact', 'Open contact options. This site does not set a BIOS password.'],
      ['Save & Exit Setup', '/online/', 'online', 'Leave setup and launch the Online desktop. Its last compatible theme will be used.'],
    ];
    const plainLabels = ['Boot Device Priority', 'System Information', 'Peripheral Configuration', 'Power-On Diagnostics', 'Supported Platforms', 'System Event Log', 'Contact Administrator', 'Exit to Desktop'];
    const help = make('aside', 'bios-item-help');
    help.setAttribute('aria-label', 'Item-specific help');
    const helpHeading = make('h2', '', variant === 'award' ? 'Item Help' : 'Item Specific Help');
    const helpText = make('p', '', description);
    help.append(helpHeading, helpText, make('p', 'bios-help-hint', 'Select an item with the arrow keys. Press Enter to open it. Tab reaches all page controls.'));
    const status = make('p', 'bios-description', description);
    entries.forEach(([label, href, id, hint], index) => {
      const link = make('a', 'bios-menu-item');
      link.href = href;
      link.append(make('span', 'bios-marker', '►'), make('span', '', variant === 'award' ? label : plainLabels[index]));
      link.dataset.help = hint;
      if (id === page || (id === 'blog' && page === 'post')) link.setAttribute('aria-current', 'page');
      const showHelp = () => { helpText.textContent = hint; status.textContent = hint; };
      link.addEventListener('focus', showHelp, options);
      link.addEventListener('pointerenter', showHelp, options);
      menu.append(link);
    });
    workspace.append(menu, help);
    frame.append(workspace, status);
    const contentLabel = make('div', 'bios-content-label', `▶ ${section}  /  CURRENT CONFIGURATION`);
    ctx.body.prepend(frame, contentLabel);

    const footer = make('footer', 'bios-footer');
    footer.append(make('p', 'bios-key-help', 'Esc : Quit  ↑↓→← : Select Item  F10 : Save & Exit Setup'));
    footer.append(make('p', 'bios-copyright', variant === 'ami' ? 'v02.61 (C)Copyright 1985-2006, American Megatrends, Inc.' : variant === 'phoenix' ? 'F1 : Help   Enter : Select   Phoenix Technologies Ltd.' : 'Enter : Open Item  •  SHORTBITS SETUP  •  Display simulation only'));
    ctx.body.append(footer);
    frame.addEventListener('keydown', (event) => {
      if (!(event.target instanceof HTMLAnchorElement)) return;
      const group = event.target.closest('nav');
      if (!group) return;
      const links = [...group.querySelectorAll('a')];
      const current = links.indexOf(event.target);
      let next;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (current + 1) % links.length;
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (current - 1 + links.length) % links.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = links.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        links[next].focus();
      }
      if (event.key === 'Escape' || event.key === 'F10') {
        event.preventDefault();
        event.stopPropagation();
        location.assign(event.key === 'Escape' ? '/?choose' : '/online/');
      }
    }, options);
  }
  window.BITS_LAYOUTS.register(theme, {
    mount: render,
    update(ctx) {
      if ((ctx.root.dataset.themeVariant || 'award') !== activeVariant) render(ctx);
    },
    unmount() { clear(); activeVariant = undefined; },
  });
})();
