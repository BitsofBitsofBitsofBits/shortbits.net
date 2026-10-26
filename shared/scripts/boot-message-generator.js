(() => {
  const subjects = Object.freeze([
    "avatar.service", "binary_rain.sys", "bitclip.dll", "caffeine.driver",
    "changelog.cache", "cookie_eater.sys", "cobits.language.model",
    "confidence.module", "cursor_enthusiasm", "desktop.ini", "discord.presence",
    "dramatic_lighting.fx", "filesystem.vibes", "firmware.personality",
    "guestbook.daemon", "help_request", "installed.apps", "internet.presence",
    "keyboard_clacks.wav", "linktree.compat", "missing_bit.trace", "my.bits",
    "Nemo", "notification.anxiety", "packet_router", "playlist.telemetry",
    "questionable_css.dll", "rgb_process", "ShortBits", "side_project_daemon",
    "social_nodes", "spotify.signal", "support.ticket", "terminal.sarcasm",
    "theme_atmosphere", "unallocated.bit", "BitsofBits",
  ]);
  const actions = Object.freeze([
    "ALLOCATE", "AUTHENTICATE", "CALIBRATE", "CHECK", "COMPILE", "CONNECT",
    "CREATE", "DEFRAGMENT", "ENUMERATE", "FIND", "INDEX", "INITIALIZE",
    "INSTALL", "LOAD", "MOUNT", "NEGOTIATE", "PING", "PRETEND TO UNDERSTAND",
    "RECONCILE", "RENDER", "RESOLVE", "SCAN", "SEND", "SHORT", "SOLVE",
    "SUBMIT", "SYNC", "VALIDATE", "WAKE",
  ]);
  const results = Object.freeze([
    "OK", "READY", "NOMINAL", "PROBABLY FINE", "OPINIONATED", "TOO MANY BITS",
    "SUSPICIOUSLY FAST", "NO NOTES", "STILL THINKING", "CONNECTED",
    "MOSTLY HARMLESS", "WITH FEELING", "UNREASONABLY CONFIDENT", "CACHE HIT",
    "CACHE MISS (IT DUCKED)", "ENABLED", "ABSOLUTELY", "ASK AGAIN LATER",
    "TECHNICALLY WORKING", "VIBES PASS", "0 ERRORS, 3 CONCERNS",
    "PENDING APPROVAL", "ESCALATED TO THE BITS", "WORKS ON MY MACHINE",
    "REQUIRES MORE COFFEE", "NOT REPRODUCIBLE", "SENT TO TIER 2",
    "CLOSED AS DESIGNED", "WAITING FOR REBOOT", "DOCUMENTATION UNCLEAR",
  ]);

  function generate(random = Math.random) {
    const subject = subjects[Math.floor(random() * subjects.length)];
    const action = actions[Math.floor(random() * actions.length)];
    const result = results[Math.floor(random() * results.length)];
    const dots = ".".repeat(Math.max(3, 39 - action.length - subject.length));
    return `${action} ${subject} ${dots} ${result}`;
  }

  window.BITS_BOOT_MESSAGE_GENERATOR = Object.freeze({
    subjects, actions, results,
    combinations: subjects.length * actions.length * results.length,
    generate,
  });
})();
