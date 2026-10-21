(() => {
  const log = document.querySelector("#endless-boot-log");
  const cycleOutput = document.querySelector("#endless-boot-cycle");
  const countOutput = document.querySelector("#endless-boot-count");
  const elapsedOutput = document.querySelector("#endless-boot-elapsed");
  const progressBar = document.querySelector("#endless-boot-progress-bar");
  const stageOutput = document.querySelector("#endless-boot-stage");
  const percentOutput = document.querySelector("#endless-boot-percent");
  const messageOutput = document.querySelector("#endless-boot-message");
  const themeSelect = document.querySelector("#endless-boot-theme");
  const schemeSelect = document.querySelector("#endless-boot-scheme");
  const randomThemeButton = document.querySelector("#endless-boot-theme-random");
  const settingsPanel = document.querySelector("#endless-boot-settings-panel");
  const settingsToggle = document.querySelector("#endless-boot-settings-toggle");
  const speedSelect = document.querySelector("#endless-boot-speed");
  const densitySelect = document.querySelector("#endless-boot-density");
  const autoscrollInput = document.querySelector("#endless-boot-autoscroll");
  const pauseButton = document.querySelector("#endless-boot-pause");
  const bitsOutput = document.querySelector("#endless-boot-bits");
  const errorsOutput = document.querySelector("#endless-boot-errors");
  const commandPanel = document.querySelector("#endless-boot-command");
  const commandForm = document.querySelector("#endless-boot-command-form");
  const commandInput = document.querySelector("#endless-boot-command-input");
  const commandOutput = document.querySelector("#endless-boot-command-output");
  const commandOpen = document.querySelector("#endless-boot-command-open");
  const commandClose = document.querySelector("#endless-boot-command-close");
  const eventPanel = document.querySelector("#endless-boot-event");
  const eventCode = document.querySelector("#endless-boot-event-code");
  const eventTitle = document.querySelector("#endless-boot-event-title");
  const eventDetail = document.querySelector("#endless-boot-event-detail");
  const particles = document.querySelector("#endless-boot-bits-particles");
  const fallingBits = document.querySelector("#endless-boot-falling-bits");
  const fallingBitsMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let nextFallingBitAt = Date.now() + 4000;
  let powerTransitionTimer = 0;
  const powerRestore = document.querySelector("#endless-boot-power-restore");
  const postButton = document.querySelector("#endless-boot-post");
  const postCodeOutput = document.querySelector("#endless-boot-post-code");
  const hostnameOutput = document.querySelector("#endless-boot-hostname");
  const cpuOutput = document.querySelector("#endless-boot-cpu");
  const memoryOutput = document.querySelector("#endless-boot-memory");
  const temperatureOutput = document.querySelector("#endless-boot-temperature");
  const diskOutput = document.querySelector("#endless-boot-disk");
  const networkOutput = document.querySelector("#endless-boot-network");
  const etaOutput = document.querySelector("#endless-boot-eta");
  const hardwarePanel = document.querySelector("#endless-boot-hardware");
  const hardwareList = document.querySelector("#endless-boot-hardware-list");
  const hardwareClose = document.querySelector("#endless-boot-hardware-close");
  const presentationButton = document.querySelector("#endless-boot-presentation");
  const incidentsOpen = document.querySelector("#endless-boot-incidents-open");
  const inspectorPanel = document.querySelector("#endless-boot-inspector");
  const inspectorKicker = document.querySelector("#endless-boot-inspector-kicker");
  const inspectorTitle = document.querySelector("#endless-boot-inspector-title");
  const inspectorContent = document.querySelector("#endless-boot-inspector-content");
  const inspectorClose = document.querySelector("#endless-boot-inspector-close");
  const achievementToast = document.querySelector("#endless-boot-achievement");
  const achievementMessage = document.querySelector("#endless-boot-achievement-message");
  const crashScreen = document.querySelector("#endless-boot-crash");
  const crashLabel = document.querySelector("#endless-boot-crash-label");
  const crashFace = document.querySelector("#endless-boot-crash-face");
  const crashTitle = document.querySelector("#endless-boot-crash-title");
  const crashCopy = document.querySelector("#endless-boot-crash-copy");
  const crashProgress = document.querySelector("#endless-boot-crash-progress");
  const crashMeterFill = document.querySelector("#endless-boot-crash-meter-fill");
  const crashCode = document.querySelector("#endless-boot-crash-code");
  const crashFault = document.querySelector("#endless-boot-crash-fault");
  const crashBuild = document.querySelector("#endless-boot-crash-build");
  const crashRecover = document.querySelector("#endless-boot-crash-recover");
  const sparkOutputs = Object.fromEntries(
    ["cpu", "memory", "temperature", "disk", "network"].map((meter) => (
      [meter, document.querySelector(`#endless-boot-${meter}-spark`)]
    )),
  );

  const subjects = [
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
  ];
  const actions = [
    "ALLOCATE", "AUTHENTICATE", "CALIBRATE", "CHECK", "COMPILE", "CONNECT",
    "CREATE", "DEFRAGMENT", "ENUMERATE", "FIND", "INDEX", "INITIALIZE",
    "INSTALL", "LOAD", "MOUNT", "NEGOTIATE", "PING", "PRETEND TO UNDERSTAND",
    "RECONCILE", "RENDER", "RESOLVE", "SCAN", "SEND", "SHORT", "SOLVE",
    "SUBMIT", "SYNC", "VALIDATE", "WAKE",
  ];
  const results = [
    "OK", "READY", "NOMINAL", "PROBABLY FINE", "OPINIONATED", "TOO MANY BITS",
    "SUSPICIOUSLY FAST", "NO NOTES", "STILL THINKING", "CONNECTED",
    "MOSTLY HARMLESS", "WITH FEELING", "UNREASONABLY CONFIDENT", "CACHE HIT",
    "CACHE MISS (IT DUCKED)", "ENABLED", "ABSOLUTELY", "ASK AGAIN LATER",
    "TECHNICALLY WORKING", "VIBES PASS", "0 ERRORS, 3 CONCERNS",
    "PENDING APPROVAL", "ESCALATED TO THE BITS", "WORKS ON MY MACHINE",
    "REQUIRES MORE COFFEE", "NOT REPRODUCIBLE", "SENT TO TIER 2",
    "CLOSED AS DESIGNED", "WAITING FOR REBOOT", "DOCUMENTATION UNCLEAR",
  ];
  const baseFixedMessages = [
    "MEMORY CHECK ........................ TOO MANY BITS",
    "MOUNT /dev/internet ................. OK",
    "COUNT AVAILABLE CORES ............... SOME",
    "VERIFY USERNAME LENGTH .............. EXCESSIVE",
    "LOCATE PRODUCTIVITY ................. NOT FOUND",
    "CHECK WARRANTY ...................... BOLD OF YOU",
    "MEASURE INTERNET PRESENCE ........... PALPABLE",
    "ASK GPU TO DRAW A RECTANGLE ......... COMPLIED",
    "CONTACT RESPONSIBLE ADULT ........... TIMEOUT",
    "CONTAIN LOOSE BITS .................. IN PROGRESS",
    "PARSE TODO LIST ..................... GREW BY FOUR",
    "INSPECT DOWNLOADS FOLDER ............ DECLINED",
    "LOAD LAST_KNOWN_GOOD_VIBES .......... PARTIAL",
    "RUN CABLE MANAGEMENT ................ SKIPPED",
    "CHECK CAPS LOCK ..................... EMOTIONALLY ON",
    "DETECT SECOND MONITOR ............... JEALOUS",
    "VERIFY CLOUD ........................ STILL UP THERE",
    "COUNT BROWSER TABS .................. INTEGER OVERFLOW",
    "BENCHMARK COFFEE .................... 98.6%",
    "TRAIN TINY BIT ...................... REFUSES COMMANDS",
    "REHEARSE ERROR MESSAGE .............. CONVINCING",
    "CHECK IF PLUGGED IN ................. PHILOSOPHICALLY",
    "DOWNLOAD MORE RAM ................... ETHICALLY DUBIOUS",
    "OPTIMIZE NOTHING .................... 43% FASTER",
    "VALIDATE VIBES ...................... PASS",
    "WAKE SLEEPING THREADS ............... FIVE MORE MINUTES",
    "READ THE ROOM ....................... ACCESS DENIED",
    "TEST EMERGENCY CONFETTI ............. ARMED",
    "SEARCH FOR SEMICOLON ................ HIDING",
    "COMPILE PERSONALITY ................. WARNINGS IGNORED",
    "NEGOTIATE WITH FIREWALL ............. IT WANTS A SNACK",
    "CHECK STACK ......................... PANCAKES DETECTED",
    "INSPECT HEAP ........................ A LITTLE MESSY",
    "START ACTUAL_WORK.EXE ............... SUSPENDED",
    "SYNCHRONIZE CLOCK ................... CLOSE ENOUGH",
    "PING LOCALHOST ...................... IT KNOWS WE LIVE HERE",
    "CALCULATE ETA ....................... EVENTUALLY",
    "VERIFY FINAL_FINAL_V2 ............... NOT FINAL",
    "TEST UNDO BUTTON .................... NO REGRETS",
    "MOUNT SIDE PROJECT ................. ANOTHER ONE",
    "BOOTING LINUX ...................... KERNEL PANICKED AND RAN OFF",
    "TRYING TO LOAD WINDOWS ............. BSOD ENCOUNTERED",
    "INSTALLING CPU ..................... BENT PIN",
    "INSTALLING SIDE PANEL .............. DROPPED. GLASS EVERYWHERE",
    "FLASHING BIOS ...................... POWER BLINKED",
    "ENABLING XMP ....................... RAM DEVELOPED CONFIDENCE",
    "APPLYING THERMAL PASTE ............. USED THE WHOLE TUBE",
    "CHECKING CPU TEMPERATURE ........... WARM THOUGHTS DETECTED",
    "SPINNING UP FANS ................... PREPARING FOR TAKEOFF",
    "TRAINING AI ........................ IT LEARNED SARCASM",
    "QUERYING DNS ....................... ASKED ANOTHER DNS",
    "RENEWING DHCP LEASE ................ ADDRESS PENDING",
    "NEGOTIATING TLS .................... CERTIFICATE SAYS MAYBE",
    "VERIFYING CHECKSUM ................. CHECKSUM CHECKING ITSELF",
    "REBUILDING RAID .................... STILL REDUNDANT",
    "EJECTING USB ....................... TOO LATE",
    "DETECTING PRINTER .................. IT DENIES EXISTING",
    "CONNECTING BLUETOOTH ............... PAIRING EMOTIONALLY",
    "OPENING PORT 443 ................... CLOSE THE DOOR BEHIND YOU",
    "CLOSING PORT 80 .................... DRAFT RESOLVED",
    "PULLING LATEST MAIN ................ CONFLICT ACQUIRED",
    "MERGING BRANCH ..................... TREE IS NOW ABSTRACT ART",
    "RESOLVING CONFLICTS ................ CHOSE BOTH",
    "COMMITTING CHANGES ................. IDENTITY UNKNOWN",
    "PUSHING TO PRODUCTION .............. ON A FRIDAY? ABSOLUTELY NOT",
    "INSTALLING NODE_MODULES ............ DISK SPACE LEFT THE CHAT",
    "AUDITING DEPENDENCIES .............. 0 VULNERABILITIES*",
    "STARTING DOCKER .................... ONE WHALE LATER",
    "SCALING KUBERNETES ................. YAML INTENSIFIES",
    "CENTERING A DIV .................... CONSULTING THE ELDERS",
    "PARSING JSON ....................... UNEXPECTED COMMA EXPECTED",
    "DEREFERENCING POINTER .............. NULL ENTERED THE CHAT",
    "CATCHING EXCEPTION ................. IT GOT AWAY",
    "COLLECTING GARBAGE ................. FOUND THREE SIDE PROJECTS",
    "OPENING SOURCE ..................... BUGS NOW COMMUNITY-OWNED",
    "UPDATING DRIVER .................... VEHICLE UNCHANGED",
    "ENABLING DARK MODE ................. BUGS HARDER TO SEE",
    "DISABLING COOKIES .................. WEBSITE IS HUNGRY",
    "CHECKING LATENCY ................... REPLY PENDING",
    "PINGING 8.8.8.8 .................... VIBES RETURNED",
    "TRACING ROUTE ...................... TAKING THE SCENIC PATH",
    "SYNCHRONIZING CLOCK ................ TIME DISAGREES",
    "FORMATTING DRIVE ................... ASKED NICELY FIRST",
    "PARTITIONING DISK .................. AMICABLY SEPARATED",
    "MOUNTING FILESYSTEM ................ SADDLE UNAVAILABLE",
    "UNZIPPING ARCHIVE .................. PANTS REMAINED ZIPPED",
    "HASHING PASSWORD ................... BREAKFAST SECURED",
    "SALTING PASSWORD ................... SEASONED TO TASTE",
    "ROTATING KEYS ...................... KEYBOARD DIZZY",
    "BALANCING LOAD ..................... SPIRITUALLY CENTERED",
    "INVALIDATING CACHE ................. OTHER HARD PROBLEM PENDING",
    "FIXING OFF-BY-ONE ERROR ............ FIXED 2 OF 3",
    "READING MAN PAGE ................... PROTAGONIST UNCLEAR",
    "EXITING VIM ........................ STILL NEGOTIATING",
    "UPDATING FIRMWARE .................. NOW HAS OPINIONS",
    "TESTING BACKUP ..................... RESTORE NOT INCLUDED",
    "RESTORING BACKUP ................... BACKUP IS FROM THE FUTURE",
    "SCANNING QR CODE ................... SQUARES WITHIN SQUARES",
    "CALIBRATING RGB .................... +12 FPS CONFIRMED",
    "SEATING RAM ........................ ASKED IT TO SIT",
    "PLUGGING IN USB .................... WRONG SIDE TWICE",
    "FLIPPING USB ....................... SOMEHOW WRONG AGAIN",
    "FINDING NEMO ....................... CHECKING /dev/ocean",
    "SENDING HELP ....................... DELIVERY CONFIRMATION LOST",
    "SUBMITTING A TICKET ................ QUEUE POSITION: EVENTUALLY",
    "SOLVING A TICKET ................... CREATED TWO MORE",
    "INSTALLING APPS .................... TERMS UNREAD",
    "BOOTING SHORTBITS .................. LONG BITS NOT DETECTED",
    "SHORTING MY BITS ................... WARRANTY VOIDED",
    "CREATING BITSOFBITS ................ RECURSION LIMIT APPROACHING",
    "BUYING RAM ......................... HOPEFULLY ENOUGH",
    "BUYING RAM ......................... TOO EXPENSIVE DUE TO AI",
    "BUYING RAM ......................... SUCCESSFULLY INSTALLED",
    "BUYING RAM ......................... REGRETTING PURCHASE",
    "CHECKING CPU TYPE ..................... HOPEFULLY COMPATIBLE",
    "CHECKING CPU TYPE ..................... INCOMPATIBLE?",
    "INSTALLING DDR4 in SLOTS ................... SUCCESSFULLY INSTALLED",
    "INSTALLING DDR4 in SLOTS ................... FAILED DUE TO INCOMPATIBILITY",
    "INSTALLING NEXUS 3 ................... FISH OBTAINED",
    "INSTALLING SIGNALRGB ................... COLORFUL!",
    "INSTALLING MICROSOFT 365 ................... SUBSCRIPTION ACTIVE",
    "INSTALLING LINUX ................... KERNEL PANIC IMMINENT",
    "INSTALLING WINDOWS ................... REBOOT REQUIRED",
    "INSTALLING MACOS ................... APPLE LOGO DISPLAYED",
    "LISTENING TO MUSIC ................... HEADPHONES PLUGGED IN",
    "LISTENING TO MUSIC ................... SPEAKERS ACTIVE",
    "LISTENING TO MUSIC ................... NO AUDIO DEVICE DETECTED",
    "LISTENING TO MUSIC ................... AUDIO DEVICE MALFUNCTION",
    "BEING BIGGEST VERSION OF SELF ................... ACHIEVED",
    "TRYING TO HARD RESET ................... SUCCESSFUL",
    "TRYING TO HARD RESET ................... FAILED",
    "TRYING TOO HARD ................... EXHAUSTED",
    "TRYING TOO HARD ................... SUCCESSFULLY OVERCOME",
    "OBTAINING DR. PEPPER ................... REFRESHED",
    "OBTAINING DR. PEPPER ................... SPILLED",
    "OBTAINING DR. PEPPER ................... ENJOYED",
    "OBTAINING DR. PEPPER ................... BLACKBERRY FLAVORED",
    "OBTAINING DR. PEPPER ................... CHERRY FLAVORED",
    "OBTAINING DR. PEPPER ................... VANILLA FLAVORED",
    "OBTAINING DR. PEPPER ................... DIET",
    "OBTAINING DR. PEPPER ................... CAFFEINATED",
    "OBTAINING DR. PEPPER ................... SUGAR-FREE",
    "OBTAINING DR. PEPPER ................... LIMITED EDITION",
    "OBTAINING DR. PEPPER ................... SEASONAL FLAVORED",
    "OBTAINING DR. PEPPER ................... MYSTERY FLAVORED",
    "OBTAINING DR. PEPPER ................... OUT OF STOCK",
    "OBTAINING DR. PEPPER ................... FOUND IN SECRET STASH",
    "OBTAINING DR. PEPPER ................... SHARED WITH FRIENDS",
    "OBTAINING DR. PEPPER ................... ENJOYED IN SILENCE",
    "OBTAINING DR. PEPPER ................... COCONUT FLAVORED",
    "OBTAINING COFFEE ................... BREWED",
    "OBTAINING COFFEE ................... SPILLED",
    "OBTAINING COFFEE ................... ENJOYED",
    "OBTAINING COFFEE ................... ICED",
    "OBTAINING COFFEE ................... DECAF",
    "OBTAINING COFFEE ................... SUGAR-FREE",
    "OBTAINING COFFEE ................... LIMITED EDITION",
    "OBTAINING COFFEE ................... SEASONAL FLAVORED",
    "OBTAINING COFFEE ................... MYSTERY FLAVORED",
    "OBTAINING COFFEE ................... OUT OF STOCK",
    "OBTAINING COFFEE ................... FOUND IN SECRET STASH",
    "OBTAINING COFFEE ................... SHARED WITH FRIENDS",
    "OBTAINING COFFEE ................... ENJOYED IN SILENCE",
    "OBTAINING COFFEE ................... PUMPKIN SPICE",
    "OBTAINING COFFEE ................... HAZELNUT",
    "OBTAINING COFFEE ................... VANILLA",
    "OBTAINING COFFEE ................... CARAMEL",
    "OBTAINING COFFEE ................... MOCHA",
    "OBTAINING COFFEE ................... IRISH CREAM",
    "OBTAINING COFFEE ................... HONEY",
    "OBTAINING COFFEE ................... CINNAMON",
    "OBTAINING COFFEE ................... PEPPERMINT",
    "OBTAINING COFFEE ................... MATCHA",
    "OBTAINING COFFEE ................... TURMERIC",
    "OBTAINING COFFEE ................... CARDAMOM",
    "BEING QUESTIONED ................... INTENSELY",
    "COMMITING ARSON ................... SECRETLY",
    "COMMITING ARSON ................... PUBLICLY",
    "COMMITING ARSON ................... INDISCRIMINATELY",
    "COMMITING ARSON ................... WITH CAUTION",
    "COMMITING ARSON ................... REGRETFULLY",
    "COMMITING ARSON ................... HESITANTLY",
    "COMMITING ARSON ................... DELIBERATELY",
    "COMMITING ARSON ................... SPONTANEOUSLY",
    "COMMITING ARSON ................... AS A FELONY",
    "COMMITING ARSON ................... WITH INTENT",
    "COMMITING ARSON ................... ACCIDENTALLY",
    "COMMITING ARSON ................... AS A MISDEMEANOR",
  ];
  const seasonalProfile = window.BITS_SEASONAL_PROFILE;
  const seasonalBootMessages = seasonalProfile?.bootMessages ?? [];
  const fixedMessages = seasonalProfile?.mode === "exclusive"
    ? seasonalBootMessages
    : baseFixedMessages;
  const bootPhases = [
    {
      name: "FIRMWARE POWER-ON SELF TEST",
      code: "A2",
      messages: [
        "CHECKING FIRMWARE INTEGRITY .......... MOSTLY INTACT",
        "READING CMOS SETTINGS ................ OPINIONS RESTORED",
      ],
    },
    {
      name: "DISCOVERING QUESTIONABLE HARDWARE",
      code: "B4",
      messages: [
        "ENUMERATING PCI DEVICES .............. ONE EXTRA",
        "PROBING LEGACY PORTS ................. DUST DETECTED",
      ],
    },
    {
      name: "TESTING EXCESSIVE MEMORY",
      code: "C1",
      messages: [
        "TESTING LOWER MEMORY ................. REMEMBERS ENOUGH",
        "TESTING UPPER MEMORY ................. FEELINGS FOUND",
      ],
    },
    {
      name: "MOUNTING STORAGE SUBSYSTEMS",
      code: "D7",
      messages: [
        "MOUNTING BOOT VOLUME ................. SLIGHTLY CROOKED",
        "READING PARTITION TABLE .............. TABLE HAS CRUMBS",
      ],
    },
    {
      name: "INITIALIZING PERSONALITY KERNEL",
      code: "E2",
      messages: [
        "LOADING PERSONALITY KERNEL ........... SARCASM ENABLED",
        "STARTING SCHEDULER ................... EVENTUALLY",
      ],
    },
    {
      name: "NEGOTIATING WITH THE INTERNET",
      code: "F4",
      messages: [
        "ACQUIRING NETWORK ADDRESS ............ SOMEWHERE ONLINE",
        "VERIFYING INTERNET ROUTE ............. SCENIC",
      ],
    },
    {
      name: "STARTING PRESENCE SERVICES",
      code: "71",
      messages: [
        "STARTING SOCIAL NODES ................ AWKWARDLY",
        "STARTING LINK SERVICES ............... CLICKABLE",
      ],
    },
    {
      name: "VERIFYING BOOT COMPLETION",
      code: "FF",
      messages: [
        "CHECKING BOOT COMPLETION ............. INCONCLUSIVE",
        "PREPARING FINAL HANDOFF .............. HANDED BACK",
      ],
    },
  ];
  const multiStepOperations = [
    [
      "SCANNING STORAGE BUS ................. STARTED",
      "SCANNING STORAGE BUS ................. 4 DEVICES FOUND",
      "SCANNING STORAGE BUS ................. 1 DEVICE SUSPICIOUS",
      "SCANNING STORAGE BUS ................. ACCEPTED ANYWAY",
    ],
    [
      "VERIFYING MEMORY MAP ................. PASS 1 OF 3",
      "VERIFYING MEMORY MAP ................. PASS 2 OF 3",
      "VERIFYING MEMORY MAP ................. MAP FOLDED WRONG",
      "VERIFYING MEMORY MAP ................. CLOSE ENOUGH",
    ],
    [
      "CONTACTING BOOT SERVER ............... SYN",
      "CONTACTING BOOT SERVER ............... SYN, AGAIN",
      "CONTACTING BOOT SERVER ............... RECEIVED SHRUG",
      "CONTACTING BOOT SERVER ............... CONNECTIONISH",
    ],
    [
      "CALIBRATING PROGRESS BAR ............. 12%",
      "CALIBRATING PROGRESS BAR ............. 61%",
      "CALIBRATING PROGRESS BAR ............. 114%",
      "CALIBRATING PROGRESS BAR ............. RESET TO 12%",
    ],
    [
      "INDEXING INTERNET PRESENCE ........... FILES LOCATED",
      "INDEXING INTERNET PRESENCE ........... VIBES CATALOGUED",
      "INDEXING INTERNET PRESENCE ........... BITS CROSS-REFERENCED",
      "INDEXING INTERNET PRESENCE ........... INDEX NEEDS INDEX",
    ],
  ];
  const themeBootMessages = {
    catppuccin: [
      "BREWING PASTEL PALETTE ................ MOCHA, EXTRA FOAM",
      "PETTING THE CAT ....................... PURRING",
      "SOFTENING ALL CORNERS ................. VERY ROUND",
      "CHECKING FLAVOUR ...................... LATTE OR MOCHA",
    ],
    coffee: [
      "GRINDING BOOT BEANS ................... MEDIUM ROAST",
      "PREHEATING CPU ........................ ESPRESSO TEMPERATURE",
      "STEAMING MILK BUFFER .................. MICROFOAM",
      "SPELLING NAME ON CUP .................. CALEB? KAYLUB?",
      "REFILLING USER ........................ CAFFEINE 98%",
    ],
    "game-bit": [
      "BLOWING ON CARTRIDGE .................. WORKS NOW",
      "LOADING 4 SHADES OF GREEN ............. ALL OF THEM",
      "INSERTING AA BATTERIES ................ 4 OF 4",
      "CHECKING LINK CABLE ................... NO FRIENDS NEARBY",
      "SAVING TO SRAM ........................ DO NOT TURN OFF",
    ],
    gruvbox: [
      "WARMING RETRO PALETTE ................. COZY",
      "SEPIA-TONING STARTUP LOG .............. VINTAGE",
      "LOADING DOTFILES ...................... 3,412 LINES",
      "QUITTING VIM .......................... STILL TRYING",
      "ADJUSTING CONTRAST .................... SOFT HARD MEDIUM",
    ],
    "high-contrast": [
      "MAXIMIZING CONTRAST RATIO ............. 21:1",
      "REMOVING SUBTLE GRADIENTS ............. NOT SUBTLE NOW",
      "OUTLINING EVERYTHING .................. VERY VISIBLE",
      "CHECKING READABILITY .................. FROM ACROSS ROOM",
      "DISABLING DECORATIVE NOISE ............ SILENCED",
    ],
    matrix: [
      "FOLLOWING WHITE RABBIT ................ RABBIT 404",
      "DECODING DIGITAL RAIN ................. BLONDE, BRUNETTE",
      "CHOOSING PILL ......................... RED (DEFAULT)",
      "BENDING SPOON ......................... THERE IS NO SPOON",
      "DODGING BULLET TIME ................... SLOWLY",
    ],
    monokai: [
      "HIGHLIGHTING SYNTAX ................... VERY PINK",
      "OPENING SUBLIME BUFFER ................ UNREGISTERED",
      "COLOURING STRINGS YELLOW .............. AS TRADITION",
      "CLOSING 47 UNSAVED TABS ............... CANCELLED",
      "LINTING STARTUP CODE .................. 0 ERRORS, 99 WARNINGS",
    ],
    ocean: [
      "PRESSURIZING HULL ..................... 1 ATM, ALLEGEDLY",
      "PINGING SONAR ......................... PING... PING...",
      "COUNTING FISH ......................... GAVE UP AT 12",
      "DESCENDING TO MIDNIGHT ZONE ........... BIOLUMINESCENT",
      "CHECKING UNDERSEA CABLE ............... SHARK NEARBY",
    ],
    sunset: [
      "LOWERING SUN .......................... 4 DEGREES LEFT",
      "SATURATING SKY ........................ GOLDEN HOUR",
      "TAKING SCENIC SCREENSHOT .............. NO FILTER",
      "FADING TO DUSK ........................ GRADUALLY",
      "WAITING FOR GREEN FLASH ............... MISSED IT",
    ],
    "tokyo-night": [
      "LIGHTING NEON SIGNAGE ................. FLICKERING",
      "CATCHING LAST TRAIN ................... 23:58",
      "RENDERING CITY LIGHTS ................. 4K RAINY",
      "QUEUEING LOFI PLAYLIST ................ BEATS TO BOOT TO",
      "SYNCING NIGHT SHIFT ................... STILL AWAKE",
    ],
    "aero-glass": [
      "COMPOSITING GLASS FRAME .............. SHINY ENOUGH",
      "BUFFERING WINDOW REFLECTIONS ......... CLOUDY",
      "POLISHING TRANSPARENT CHROME .......... FINGERPRINTED",
      "CALCULATING GLASS INDEX ............... 7.9",
      "STARTING SIDEBAR GADGETS .............. WEATHER UNKNOWN",
    ],
    "amber-crt": [
      "WARMING AMBER PHOSPHOR ............... GLOWING",
      "ALIGNING ELECTRON BEAM ................ MOSTLY STRAIGHT",
      "BURNING IN STATUS TEXT ................ TEMPORARILY FOREVER",
      "ADJUSTING CRT HUM ..................... VISIBLY SILENT",
      "DEGAUSSING PERSONALITY ................ MAGNETICALLY CALM",
    ],
    aurora: [
      "ALIGNING AURORA BANDS ................ MAGNETICALLY PRETTY",
      "CHARGING SOLAR PARTICLES .............. ATMOSPHERIC",
      "CALIBRATING NORTHERN LIGHTS ........... NORTHISH",
      "MEASURING GEOMAGNETIC VIBES ........... SHIMMERING",
      "ROUTING PACKETS THROUGH SKY ........... SCENIC",
    ],
    "candy-pop": [
      "SORTING CANDY-COLORED BITS ........... DELICIOUSLY INVALID",
      "INFLATING BUBBLEGUM BUFFER ............ POPPED",
      "SPRINKLING UI CONTROLS ................ EXTRA SPRINKLES",
      "CALIBRATING CUTE OVERLOAD ............. ADORABLE",
      "COUNTING JELLYBEAN CORES .............. ONE EATEN",
    ],
    christmas: [
      "ALLOCATING PRESENTS .................. NICE LIST CACHED",
      "SYNCHRONIZING SLEIGH TELEMETRY ........ REINDEER ONLINE",
      "CHECKING CHIMNEY COMPATIBILITY ........ NARROW",
      "COMPILING FESTIVE LIGHTS .............. ONE BULB OUT",
      "MOUNTING NORTH POLE SHARE ............. SNOWY",
    ],
    "cozy-blossom": [
      "ARRANGING DESKTOP BLOSSOMS ........... COZY",
      "WARMING PASTEL CACHE .................. COMFORTABLE",
      "STEEPING BACKGROUND PROCESS ........... FLORAL",
      "SOFTENING WINDOW CORNERS .............. PILLOWY",
      "WATERING DECORATIVE THREADS ........... BLOOMING",
    ],
    cyberpunk: [
      "NEGOTIATING WITH MEGACORP ............ TERMS REJECTED",
      "JACKING INTO LOCALHOST ................ NEON HANDSHAKE",
      "SCANNING STREET-LEVEL PACKETS ......... WANTED",
      "BYPASSING CORPORATE FIREWALL .......... DRAMATICALLY",
      "INSTALLING SYNTHETIC ATTITUDE ......... EDGY",
    ],
    default: [
      "LOADING STANDARD ISSUE BITS .......... NONSTANDARD",
      "APPLYING FACTORY DEFAULTS ............. CUSTOMIZED",
      "CHECKING GENERIC SUBSYSTEM ............ SPECIFICALLY FINE",
      "INITIALIZING BASELINE VIBES ........... ACCEPTABLE",
      "SELECTING DEFAULT OPTION .............. BOLD CHOICE",
    ],
    "dos-blue": [
      "CHECKING CONVENTIONAL MEMORY ......... NEVER ENOUGH",
      "LOADING HIMEM.SYS ..................... HIGH ENOUGH",
      "SEARCHING AUTOEXEC.BAT ................ FOUND AUTOEXEC.CAT",
      "MOUNTING DRIVE C: ..................... COLON VERIFIED",
      "COUNTING FREE KILOBYTES ............... ASK AGAIN IN 1994",
    ],
    dracula: [
      "COUNTING BACKGROUND PROCESSES ......... BLEH BLEH BLEH",
      "LOADING NIGHT MODE .................... PERMANENTLY",
      "CHECKING MIRROR DEVICE ................ NOT DETECTED",
      "MOUNTING /dev/coffin .................. COMFORTABLE",
      "STARTING BLOOD TYPE SERVICE ........... O NEGATIVE",
    ],
    fluent: [
      "APPLYING FLUENT MATERIAL .............. FLOWING",
      "REVEALING HIDDEN HIGHLIGHTS ........... REVEALED",
      "BLURRING ACRYLIC BUFFER ............... TASTEFULLY",
      "CALCULATING DESIGN DEPTH .............. 2.5D",
      "ALIGNING MOTION CURVES ................ ELEGANTISH",
    ],
    macos: [
      "POLISHING MENU BAR .................... COURAGEOUS",
      "VERIFYING DONGLE INVENTORY ............ ONE MORE REQUIRED",
      "INDEXING SPOTLIGHT INDEX .............. INDEXED TWICE",
      "ASKING GATEKEEPER NICELY .............. APP NOTARIZEDISH",
      "CALCULATING PREMIUM PIXELS ............ EXPENSIVE",
    ],
    mica: [
      "SAMPLING DESKTOP WALLPAPER ........... MATERIALIZED",
      "MIXING MICA PARTICLES ................. TRANSLUCENT",
      "READING BACKDROP COLOR ................ TASTEFUL",
      "COMPOSITING SUBTLE DEPTH .............. SUBTLE ENOUGH",
      "APPLYING MATERIAL LAYERS .............. LAYERED",
    ],
    "midnight-oled": [
      "TURNING OFF UNUSED PIXELS ............. MOST OF THEM",
      "MEASURING ABSOLUTE BLACK .............. ABSOLUTELY",
      "DIMMING BACKLIGHT ..................... BACKLIGHT NOT FOUND",
      "COUNTING LIT PIXELS ................... SEVEN",
      "SAVING PHOTONS ........................ DARK MODE COMPLETE",
    ],
    minebits: [
      "GENERATING BOOT CHUNKS ................ CREEPER NEARBY",
      "PUNCHING STARTUP TREE .................. WOOD ACQUIRED",
      "CRAFTING NETWORK STACK ................ RECIPE UNKNOWN",
      "LIGHTING REDSTONE BUS ................. POWERED",
      "CHECKING SPAWN POINT .................. BED MISSING",
    ],
    "new-year": [
      "SYNCHRONIZING MIDNIGHT CLOCK .......... ALMOST THIS YEAR",
      "COUNTING DOWN BOOT TIMER ............... COUNTING UP",
      "QUEUEING FIREWORK PACKETS ............. COLORFUL",
      "ARCHIVING OLD YEAR .................... STILL IN USE",
      "RESOLVING NEW YEAR VERSION ............ BETA",
    ],
    nord: [
      "COOLING NORDIC PALETTE ................ FROSTY",
      "ALIGNING POLAR NIGHT MODE .............. NORTHBOUND",
      "FREEZING BACKGROUND THREADS ............ SUSPENDED",
      "MOUNTING FJORD STORAGE ................. DEEP",
      "CALIBRATING SNOW CONTRAST .............. CRISP",
    ],
    rgb: [
      "SYNCHRONIZING RGB CONTROLLERS ......... STILL RAINBOW",
      "ALLOCATING RED CHANNEL ................ 255",
      "ALLOCATING GREEN CHANNEL .............. ALSO 255",
      "ALLOCATING BLUE CHANNEL ............... DEFINITELY 255",
      "DOWNLOADING MORE LIGHTING SOFTWARE .... CPU +12%",
    ],
    solarized: [
      "CALCULATING SOLAR ANGLE ............... BLUE HOUR",
      "BALANCING CYAN AND YELLOW .............. SCIENTIFICALLY",
      "MEASURING TERMINAL LUMINANCE ........... PRECISEISH",
      "ALIGNING BASE03 WITH BASE3 ............. CONTRASTED",
      "CHARGING SOLARIZED BATTERY ............. LOW BLUE",
    ],
    spooky: [
      "ENUMERATING GHOST DEVICES ............. ONE TOO MANY",
      "MOUNTING HAUNTED VOLUME ................ READ-ONLY WAILS",
      "CHECKING CLOSET PORT ................... SOMETHING MOVED",
      "STARTING SKELETON SERVICE .............. NO BODY",
      "RESOLVING PHANTOM INTERRUPT ............ BOO",
    ],
    terminal: [
      "SPAWNING /dev/vibes ................... PID 1337",
      "CHMOD +X PERSONALITY ................... EXECUTABLE",
      "PIPING OUTPUT TO /dev/DRAMATIC ......... VERBOSE",
      "GREPPING FOR PRODUCTIVITY .............. 0 MATCHES",
      "SUDOING THE NEEDFUL .................... PERMISSION MAYBE",
    ],
    vaporwave: [
      "LOADING AESTHETIC DRIVERS ............. AESTHETIC 420",
      "MOUNTING VIRTUAL PLAZA ................. ABANDONED",
      "BUFFERING ELEVATOR MUSIC ............... SLOWED",
      "RENDERING MARBLE BUST .................. LOW POLY",
      "CONNECTING TO 199X INTERNET ............ 56K DREAMS",
    ],
    winter: [
      "DEFROSTING NETWORK STACK .............. SLUSHY",
      "SHOVELING BOOT SECTOR .................. PATH CLEARED",
      "CHECKING MITTEN DRIVERS ................ LEFT ONLY",
      "FREEZING UNUSED PROCESSES .............. PRESERVED",
      "MOUNTING SNOW VOLUME ................... POWDERED",
    ],
    "windows-95": [
      "RESOLVING IRQ CONFLICT ................ NEW CONFLICT CREATED",
      "INSTALLING PLUG AND PRAY DEVICE ........ PRAYING",
      "SEARCHING FOR FLOPPY DRIVE ............. PLEASE WAIT",
      "RUNNING SCANDISK ....................... CLUSTERS NERVOUS",
      "LOADING DESKTOP CHANNELS ............... ACTIVE DESKTOPISH",
    ],
    "y2k-silver": [
      "CHECKING DATE FIELD WIDTH .............. TWO DIGITS ENOUGH",
      "POLISHING CHROME BUTTONS ............... VERY WEB",
      "CONNECTING THROUGH WAP GATEWAY ......... TINY INTERNET",
      "LOADING FUTURE FROM CD-ROM ............. 4X SPEED",
      "VERIFYING MILLENNIUM BUG ............... FEATURE CONFIRMED",
    ],
  };
  const etaGoofs = [
    "EVENTUALLY",
    "YESTERDAY",
    "UNKNOWN",
    "RECALCULATING",
    "SOON-ISH",
    "WHEN READY",
    "AFTER COFFEE",
    "ASK BIOS",
    "PENDING",
    "MAYBE",
    "TUESDAY",
    "LAST WEEK",
    "NEXT REBOOT",
    "ALMOST",
    "SEE MANUAL",
    "404 ETA",
    "CALENDAR TBD",
    "ONE MOMENT",
    "MOMENT EXTENDED",
    "TIMEOUT",
    "ON SCHEDULE*",
    "3-5 BUSINESS BOOTS",
    "BEFORE HEAT DEATH",
    "NOW + 1",
    "YES",
    "NO",
    "00:??",
    "INFINITE",
  ];
  const dailyPersonalities = [
    {
      id: "cooperative",
      name: "COOPERATIVE",
      messages: ["SYSTEM IS FEELING HELPFUL ............ THIS IS SUSPICIOUS", "FOLLOWING INSTRUCTIONS ................ FOR NOW"],
      fortune: "Today is an excellent day to finish booting. We will not.",
    },
    {
      id: "suspicious",
      name: "SUSPICIOUS",
      messages: ["VERIFYING USER INTENT ................. UNCONVINCING", "WATCHING INPUT DEVICES ................ RESPECTFULLY"],
      fortune: "Trust no peripheral reporting fewer than three concerns.",
    },
    {
      id: "sleepy",
      name: "SLEEPY",
      messages: ["WAKING BACKGROUND THREADS ............. SNOOZED", "REDUCING CLOCK SPEED .................. FIVE MORE MINUTES"],
      fortune: "A process at rest remains at rest until coffee.",
    },
    {
      id: "dramatic",
      name: "DRAMATIC",
      messages: ["ANNOUNCING ROUTINE CHECK .............. CATASTROPHICALLY", "DIMMING LIGHTS FOR BOOT ............... CINEMATIC"],
      fortune: "Every warning deserves a full-screen entrance.",
    },
    {
      id: "overconfident",
      name: "OVERCONFIDENT",
      messages: ["SKIPPING VERIFICATION ................. DEFINITELY FINE", "ASSUMING SUCCESS ...................... OPTIMIZED"],
      fortune: "Confidence is just cached certainty.",
    },
    {
      id: "haunted",
      name: "HAUNTED",
      messages: ["PROCESS 0000 WHISPERED ................ IGNORED", "CHECKING EMPTY PORT ................... SOMETHING ANSWERED"],
      fortune: "The ghost in the machine has administrator privileges.",
    },
    {
      id: "corporate",
      name: "CORPORATE",
      messages: ["ALIGNING BOOT DELIVERABLES ............ SYNERGIZED", "ESCALATING STARTUP BLOCKER ............ MEETING SCHEDULED"],
      fortune: "This boot is a cross-functional opportunity.",
    },
    {
      id: "literal",
      name: "EXTREMELY LITERAL",
      messages: ["BOOTING BOOT PROCESS .................. BOOTED", "COUNTING BITS ......................... IN BINARY"],
      fortune: "The estimated time is an estimate of time.",
    },
  ];
  const sessionAnomalies = [
    "memory-creep",
    "post-language",
    "hostname-drift",
    "network-ghost",
    "temperature-opinion",
    "eta-reversal",
    "boot-zero",
    "lazy-core",
  ];
  const narrativeStories = [
    [
      "ONE LOOSE BIT ESCAPED ................ LAST SEEN NEAR MEMORY",
      "DISPATCHING SEARCH THREAD ............. THREAD GOT DISTRACTED",
      "LOOSE BIT ENTERED NETWORK STACK ....... PACKET DISGUISE POOR",
      "CORNERING LOOSE BIT ................... BIT CLAIMS INNOCENCE",
      "RETURNING BIT TO CONTAINMENT .......... COUNT NOW OFF BY ONE",
    ],
    [
      "DETECTING PRINTER ..................... PRINTER DENIES EXISTING",
      "REQUESTING PRINTER IDENTIFICATION ..... TONER LOW",
      "PRINTER FILED FORMAL COMPLAINT ......... PAPER JAM ATTACHED",
      "ESCALATING TO PRINT SPOOLER ............ SPOOLER HIDING",
      "PRINTER INCIDENT CLOSED ............... DEVICE STILL PRINTING",
    ],
    [
      "SYSTEM CLOCK A REPORTS 19:37 ........... CONFIDENT",
      "SYSTEM CLOCK B REPORTS TUESDAY ......... ALSO CONFIDENT",
      "ARBITRATING TEMPORAL DISPUTE ........... HEATED",
      "CLOCKS AGREED TO DISAGREE .............. TIME RESUMED",
    ],
    [
      "BACKGROUND PROCESS REQUESTED PROMOTION . REVIEW OPENED",
      "INTERVIEWING BACKGROUND PROCESS ........ VERY AMBITIOUS",
      "PROMOTING PROCESS TO FOREGROUND ......... NOTHING CHANGED",
      "PROCESS REQUESTED BACKGROUND AGAIN ...... APPROVED",
    ],
  ];
  const bootAchievements = [
    ["still-waiting", "STILL WAITING"],
    ["committed-bit", "COMMITTED TO THE BIT"],
    ["speedrunner", "BOOT SPEEDRUNNER"],
    ["technician", "CERTIFIED-ISH TECHNICIAN"],
    ["incident-response", "IT WAS LIKE THAT"],
    ["do-not-turn-off", "DO NOT TURN OFF"],
    ["eta-expired", "EVENTUALLY MEANS EVENTUALLY"],
    ["night-shift", "NIGHT SHIFT"],
    ["full-spectrum", "FULL BOOT FAILURE SPECTRUM"],
    ["command-center", "COMMAND CENTER"],
  ];
  const crashProfiles = {
    blue: {
      label: "BITS STOP RESPONSE // BLUE CHANNEL",
      face: ":(",
      title: "Your endless boot ran into a finite problem.",
      copies: ["Collecting boot fragments.", "Asking the ETA what happened.", "Restarting the restart process."],
      codes: ["ENDLESS_BOOT_COMPLETION_LOOP", "ETA_COUNTER_REACHED_TOMORROW", "POST_PHASE_REFUSED_HANDOFF", "BOOT_CYCLE_INTEGER_TIRED"],
      fault: "boot_completion_verifier.sys",
      steps: [8, 23, 47, 71, 92, 100],
    },
    black: {
      label: "BIT BUCKET RECOVERY // NO COLOR CHANNEL",
      face: "[    ]",
      title: "The boot display encountered absolutely nothing.",
      copies: ["Searching the Bit Bucket.", "Increasing darkness for visibility.", "Fabricating the missing final percent."],
      codes: ["BOOT_BIT_BUCKET_EMPTY", "DISPLAY_OUTPUT_ABSENT_WITH_CONFIDENCE", "NULL_PROGRESS_REFERENCE", "POST_CODE_NOT_VISIBLE"],
      fault: "nothing_at_all.dll",
      steps: [18, 41, 67, 86, 99, 100],
    },
    green: {
      label: "BITS INSIDER PREVIEW // CANARY BOOT RING",
      face: ":(",
      title: "Your experimental boot installed tomorrow's problem today.",
      copies: ["Collecting speculative error info.", "Promoting unstable code to production.", "Thank you for testing this without volunteering."],
      codes: ["INSIDER_BOOT_AHEAD_OF_ITSELF", "CANARY_ESCAPED_BOOT_RING", "EXPERIMENTAL_ETA_LEAK", "PREVIEW_BUILD_PREVIEWED_TOO_HARD"],
      fault: "definitely-ready-for-boot.sys",
      build: "Evaluation copy. Build B17.26052.bits_canary_endless.1016-1906",
      steps: [12, 29, 47, 68, 86, 100, 103],
    },
    red: {
      label: "FATAL BOOT EXCEPTION // RED CHANNEL",
      face: "[x_x]",
      title: "The boot process became too bootable.",
      copies: ["Containing recursive startup calls.", "Cooling the POST code.", "Reassembling the progress bar."],
      codes: ["POST_CODE_CAUGHT_FIRE", "BOOT_RECURSION_LIMIT_EXCEEDED", "PROGRESS_BAR_OVERPRESSURE", "FIRMWARE_VIBES_CRITICAL"],
      fault: "recursive_bootstrap.exe",
      steps: [9, 31, 58, 79, 96, 100],
    },
    purple: {
      label: "BITPROTECTOR // BOOTKIT NARRATIVE ACTIVE",
      face: "[!_!]",
      title: "A virus has claimed ownership of the boot sequence.",
      copies: ["Encrypting the fake hardware inventory.", "Installing three complimentary boot toolbars.", "Virus requesting administrator vibes.", "Quarantining everything except the virus."],
      codes: ["BOOTKIT_REQUESTED_ADMIN_VIBES", "VIRUS_OWNS_THE_ETA_NOW", "MALWARE_ADDED_MORE_BITS", "QUARANTINE_QUARANTINED_ITSELF"],
      fault: "totally_legitimate_bootkit.b17",
      steps: [10, 20, 30, 45, 63, 82, 97, 100],
    },
  };
  const degradationMessages = [
    "RECOUNTING INSTALLED MEMORY .......... TOTAL CHANGED",
    "SYSTEM CLOCK DRIFT DETECTED .......... TIME IS SUBJECTIVE",
    "DUPLICATE BOOT DEVICE FOUND .......... BOTH CLAIM ORIGINAL",
    "PROGRESS COUNTER EXCEEDED CONFIDENCE . HIDING EVIDENCE",
    "UPTIME HAS BECOME CONCERNING ......... USER STILL PRESENT",
  ];
  const incidents = [
    ["INCIDENT 0xB17", "PACKET ESCAPED CONTAINMENT", "Dispatching a smaller packet to bring it back."],
    ["THERMAL NOTICE", "CPU EXPERIENCING WARM THOUGHTS", "Opening a window and hoping for the best."],
    ["MEMORY EVENT", "BIT FLIPPED WITHOUT PERMISSION", "Flipping it back before anyone notices."],
    ["USER NOTICE", "UNEXPECTED USER DETECTED", "Attempting to look productive."],
    ["DRIVER NOTICE", "KEYBOARD REQUESTING A RAISE", "Request forwarded to Human Resources.exe."],
    ["NETWORK EVENT", "LATENCY ARRIVED LATE", "Acknowledgement expected eventually."],
    ["STORAGE NOTICE", "CACHE MISPLACED ITS KEYS", "Checking underneath the couch."],
  ];
  const incidentChains = [
    {
      event: ["STORAGE INCIDENT", "BOOT DRIVE DISAPPEARED", "Asking the storage bus where it put it."],
      telemetry: { disk: 100, cpu: 74 },
      messages: [
        ["SEARCHING STORAGE BUS ............... NO DRIVE", "error"],
        ["SEARCHING UNDER DESK ................. CABLE LOCATED", "warning"],
        ["REMOUNTING BOOT DRIVE ................ IDENTIFIES AS TOASTER", "warning"],
        ["STORAGE INCIDENT RESOLVED ............ TOAST DISABLED", ""],
      ],
    },
    {
      event: ["NETWORK INCIDENT", "ADAPTER LOST CONFIDENCE", "Reassuring the network interface with affirmations."],
      telemetry: { network: 0, cpu: 48 },
      messages: [
        ["PINGING DEFAULT GATEWAY .............. EMOTIONALLY UNAVAILABLE", "error"],
        ["RETRAINING NETWORK ADAPTER ........... GOOD JOB, BUDDY", "warning"],
        ["RENEWING ADDRESS ..................... 192.168.SOMETHING", "warning"],
        ["NETWORK INCIDENT RESOLVED ............ SIGNAL FEELS SEEN", ""],
      ],
    },
    {
      event: ["MEMORY INCIDENT", "AVAILABLE MEMORY BECAME NEGATIVE", "Borrowing several megabytes from the future."],
      telemetry: { memory: 99, cpu: 88 },
      messages: [
        ["COUNTING MEMORY ...................... -640 MB", "error"],
        ["FLIPPING SUSPICIOUS BIT .............. IT FLIPPED BACK", "warning"],
        ["BORROWING FUTURE MEMORY .............. INTEREST VARIABLE", "warning"],
        ["MEMORY INCIDENT RESOLVED ............. NUMBERS POSITIVEISH", ""],
      ],
    },
  ];
  const uptimeMilestones = [
    [300, "EXTENDED BOOT DETECTED .............. USER COMMITMENT VERIFIED"],
    [900, "BOOT TECHNICIAN DISPATCHED ........... ETA EVENTUALLY"],
    [1800, "THIRTY MINUTE POST COMPLETE ........... STILL POSTING"],
    [3600, "ONE HOUR UPTIME ACHIEVED .............. BOOT LEGEND CONFIRMED"],
  ];
  const transformations = {
    panic: ["KERNEL PANIC", "KERNEL PANICKED AND RAN OFF", "Please remain calm while the kernel does not."],
    bsod: ["STOP 0x00000B17", "BITS SCREEN OF DEATH", "A bit encountered a bit it did not particularly like."],
    bios: ["FIRMWARE SETUP", "BIOS HAS OPINIONS", "Press every key to continue pretending this is configurable."],
    recovery: ["RECOVERY ENVIRONMENT", "AUTOMATIC REPAIR IS THINKING", "Diagnosing your PC. Your PC has declined to comment."],
  };
  const diagnosticDetails = [
    "TRACE: Operation completed with an unreasonable amount of confidence.",
    "OWNER: side_project_daemon // PRIORITY: eventually",
    "NOTE: This result has not been peer reviewed by the bits.",
    "EXIT CODE: 0xB17 // INTERPRETATION: probably fine",
    "RECOMMENDATION: Turn it off, admire it, then turn it on again.",
    "SOURCE: A tiny log file nobody remembers creating.",
  ];
  const longRunningMessages = [
    "PROBING LEGACY HARDWARE ............. STILL PROBING",
    "REBUILDING FONT CACHE ............... TAKING ITS TIME",
    "WAITING FOR STORAGE CONTROLLER ...... IT IS THINKING",
    "VERIFYING EVERY SINGLE BIT .......... THIS MAY TAKE A WHILE",
    "NEGOTIATING WITH OLD FIRMWARE ....... TERMS PENDING",
    "TRAINING BOOT SPLASH ................ ALMOST SENTIENT",
    "CALIBRATING PROGRESS ESTIMATE ....... RECALCULATING",
    "SEARCHING FOR BOOT DEVICE ........... CHECKING UNDER DESK",
    "DECOMPRESSING SYSTEM VIBES .......... 73% OF EVENTUALLY",
    "ENUMERATING USB DEVICES ............. ONE OF THEM IS SHY",
  ];
  const speedTimingProfiles = {
    slow: {
      minimum: 650,
      maximum: 950,
      longMinimum: 2400,
      longMaximum: 5200,
    },
    normal: {
      minimum: 90,
      maximum: 450,
      longMinimum: 1100,
      longMaximum: 2800,
    },
    fast: {
      minimum: 45,
      maximum: 150,
      longMinimum: 550,
      longMaximum: 1400,
    },
    absurd: {
      minimum: 16,
      maximum: 46,
      longMinimum: 240,
      longMaximum: 700,
    },
  };
  const preferenceKey = "bits-endless-boot-preferences";
  const statsKey = "bits-endless-boot-stats";
  const hardwareKey = "bits-endless-boot-hardware";
  const incidentHistoryKey = "bits-endless-boot-incidents";
  const achievementKey = "bits-endless-boot-achievements";
  const crashHistoryKey = "bits-endless-boot-crashes";
  const speedOrder = ["slow", "normal", "fast", "absurd"];
  const densityOrder = ["relaxed", "normal", "compact"];

  const startedAt = Date.now();
  let cycle = 1;
  let count = 0;
  let progress = 0;
  let processedBits = 0;
  let ignoredErrors = 0;
  let lastTransmission = "";
  let lastEta = "";
  let etaCountdownSeconds = null;
  const recentMessages = [];
  const recentMessageSet = new Set();
  let timer = 0;
  let viewportFrame = 0;
  let paused = false;
  let speed = "normal";
  let density = "normal";
  let autoScroll = true;
  let incidentActive = false;
  let lastIncidentAt = 0;
  let currentPhaseIndex = 0;
  let activeOperation = null;
  let operationGap = 0;
  let activeNarrative = null;
  let narrativeGap = 0;
  let presentationRevealTimer = 0;
  let achievementTimer = 0;
  let crashTimer = 0;
  let crashRecoveryTimer = 0;
  let crashActive = false;
  let crashPreviousFocus = null;
  let lastCrashAt = 0;
  let lastUserActivityAt = Date.now();
  let userIdleStage = 0;
  let networkOnline = navigator.onLine;
  let commandHistory = [];
  let commandHistoryIndex = 0;
  let incidentHistory = [];
  let unlockedBootAchievements = [];
  let survivedBootCrashes = new Set();
  let telemetryHistory = {
    cpu: [],
    memory: [],
    temperature: [],
    disk: [],
    network: [],
  };
  let hardware = null;
  const dailyPersonality = getDailyPersonality();
  const sessionAnomaly = getSessionAnomaly();
  const reachedMilestones = new Set();
  const telemetry = {
    cpu: 18,
    memory: 42,
    temperature: 39,
    fan: 780,
    disk: 12,
    network: 48,
    targets: {},
    overrideUntil: 0,
  };
  let stats = {
    totalBoots: 0,
    messagesSeen: 0,
    longestUptime: 0,
    incidentsIgnored: 0,
  };

  function readStorage(key, fallback) {
    try {
      const stored = JSON.parse(localStorage.getItem(key));
      return stored && typeof stored === "object" ? stored : fallback;
    } catch (error) {
      console.warn(`Unable to read ${key} from local storage.`, error);
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Unable to save ${key} to local storage.`, error);
    }
  }

  function hashString(value) {
    return [...value].reduce(
      (hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0,
      2166136261,
    );
  }

  function getDailyPersonality(date = new Date()) {
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    return dailyPersonalities[hashString(key) % dailyPersonalities.length];
  }

  function getSessionAnomaly() {
    const key = "bits-endless-boot-session-anomaly";
    try {
      const stored = sessionStorage.getItem(key);
      if (sessionAnomalies.includes(stored)) {
        return stored;
      }
      const anomaly = randomItem(sessionAnomalies);
      sessionStorage.setItem(key, anomaly);
      return anomaly;
    } catch (error) {
      console.warn("Unable to retain the boot session anomaly.", error);
      return randomItem(sessionAnomalies);
    }
  }

  function loadStoredArray(key, validator) {
    const stored = readStorage(key, []);
    if (!Array.isArray(stored)) {
      console.error(`Stored ${key} data is not an array.`);
      return [];
    }
    return stored.filter(validator);
  }

  function initializeBootRecords() {
    incidentHistory = loadStoredArray(incidentHistoryKey, (entry) => (
      entry
      && typeof entry.id === "string"
      && typeof entry.code === "string"
      && typeof entry.title === "string"
      && typeof entry.createdAt === "string"
    )).slice(-50);
    unlockedBootAchievements = loadStoredArray(achievementKey, (entry) => (
      entry
      && bootAchievements.some(([id]) => id === entry.id)
      && typeof entry.unlockedAt === "string"
    ));
    survivedBootCrashes = new Set(
      loadStoredArray(crashHistoryKey, (kind) => Object.hasOwn(crashProfiles, kind)),
    );
  }

  function unlockBootAchievement(id) {
    const achievement = bootAchievements.find(([candidate]) => candidate === id);
    if (!achievement || unlockedBootAchievements.some((entry) => entry.id === id)) {
      return false;
    }
    unlockedBootAchievements.push({ id, unlockedAt: new Date().toISOString() });
    writeStorage(achievementKey, unlockedBootAchievements);
    window.clearTimeout(achievementTimer);
    achievementMessage.textContent = achievement[1];
    achievementToast.hidden = false;
    achievementTimer = window.setTimeout(() => {
      achievementToast.hidden = true;
    }, 4200);
    return true;
  }

  function recordIncident({ code, title, detail, kind = "incident" }) {
    incidentHistory.push({
      id: `${Date.now()}-${randomHex(4)}`,
      code,
      title,
      detail,
      kind,
      createdAt: new Date().toISOString(),
      telemetry: {
        cpu: Math.round(telemetry.cpu),
        temperature: Math.round(telemetry.temperature),
        disk: Math.round(telemetry.disk),
        network: Math.round(telemetry.network),
      },
    });
    incidentHistory = incidentHistory.slice(-50);
    writeStorage(incidentHistoryKey, incidentHistory);
  }

  function createRecordList(entries, emptyMessage) {
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "endless-boot-records-empty";
      empty.textContent = emptyMessage;
      return empty;
    }
    const list = document.createElement("ol");
    list.className = "endless-boot-records";
    entries.forEach((entry) => {
      const item = document.createElement("li");
      const header = document.createElement("div");
      const title = document.createElement("strong");
      const time = document.createElement("time");
      const detail = document.createElement("p");
      title.textContent = `${entry.code} // ${entry.title}`;
      time.dateTime = entry.createdAt;
      time.textContent = new Date(entry.createdAt).toLocaleString();
      detail.textContent = entry.detail;
      header.append(title, time);
      item.append(header, detail);
      if (entry.telemetry) {
        const telemetryLine = document.createElement("small");
        telemetryLine.textContent = `CPU ${entry.telemetry.cpu}% // TEMP ${entry.telemetry.temperature}C // DISK ${entry.telemetry.disk}% // NET ${entry.telemetry.network}K`;
        item.append(telemetryLine);
      }
      list.append(item);
    });
    return list;
  }

  function openInspector(mode = "incidents") {
    inspectorContent.replaceChildren();
    if (mode === "achievements") {
      inspectorKicker.textContent = "LOCAL_BOOT_ACHIEVEMENTS";
      inspectorTitle.textContent = `${unlockedBootAchievements.length} / ${bootAchievements.length} DISCOVERED`;
      const entries = bootAchievements.map(([id, label]) => {
        const unlocked = unlockedBootAchievements.find((entry) => entry.id === id);
        return {
          code: unlocked ? "UNLOCKED" : "LOCKED",
          title: unlocked ? label : "????????",
          detail: unlocked ? `Achievement ID: ${id}` : "Continue interacting with the endless boot display.",
          createdAt: unlocked?.unlockedAt ?? new Date(0).toISOString(),
        };
      });
      inspectorContent.append(createRecordList(entries, "No achievements discovered."));
    } else {
      inspectorKicker.textContent = "PERSISTENT_INCIDENT_HISTORY";
      inspectorTitle.textContent = `${incidentHistory.length} IGNORED INCIDENTS`;
      inspectorContent.append(createRecordList(
        [...incidentHistory].reverse(),
        "No incidents recorded. The machine finds this suspicious.",
      ));
    }
    inspectorPanel.hidden = false;
    inspectorClose.focus();
  }

  function closeInspector({ restoreFocus = true } = {}) {
    inspectorPanel.hidden = true;
    if (restoreFocus) {
      incidentsOpen.focus();
    }
  }

  function randomHex(length) {
    return Array.from(
      { length },
      () => Math.floor(Math.random() * 16).toString(16).toUpperCase(),
    ).join("");
  }

  function createHardwareIdentity() {
    const memory = randomItem([8192, 16384, 24576, 32768, 65536]);
    return {
      hostname: `BITS-${randomHex(4)}`,
      cpu: randomItem([
        "BITFORGE B17-6400",
        "SHORTCORE i7-EVENTUALLY",
        "RYZEN 7 7800B17",
        "COBITS NEURAL POTATO",
      ]),
      memory,
      bios: `B17.${randomDelay(10, 99)}.${randomDelay(100, 999)}`,
      serial: `B0B-${randomHex(4)}-${randomHex(4)}`,
      storage: randomItem([
        "1 TB QUESTIONABLE NVMe",
        "2 TB DEFINITELY AN SSD",
        "512 GB BOOTISH DEVICE",
        "4 TB SIDE PROJECT ARCHIVE",
      ]),
      gpu: randomItem([
        "RECTANGLE ACCELERATOR 4090",
        "INTEGRATED VIBES GRAPHICS",
        "RGB PIXEL DISPENSER",
        "GENERIC DISPLAY OPINION",
      ]),
      mac: Array.from({ length: 6 }, () => randomHex(2)).join(":"),
    };
  }

  function initializeHardwareIdentity() {
    const stored = readStorage(hardwareKey, null);
    const validStoredIdentity = (
      stored
      && typeof stored.hostname === "string"
      && typeof stored.cpu === "string"
      && Number.isFinite(stored.memory)
      && typeof stored.bios === "string"
      && typeof stored.serial === "string"
      && typeof stored.storage === "string"
      && typeof stored.gpu === "string"
      && typeof stored.mac === "string"
    );
    hardware = validStoredIdentity ? stored : createHardwareIdentity();
    if (!validStoredIdentity) {
      writeStorage(hardwareKey, hardware);
    }
    hostnameOutput.textContent = hardware.hostname;
    const fields = [
      ["HOSTNAME", hardware.hostname],
      ["PROCESSOR", hardware.cpu],
      ["MEMORY", `${hardware.memory} MB`],
      ["BOOT STORAGE", hardware.storage],
      ["DISPLAY", hardware.gpu],
      ["BIOS", hardware.bios],
      ["SERIAL", hardware.serial],
      ["MAC ADDRESS", hardware.mac],
      ["TOTAL BOOTS", String(stats.totalBoots)],
    ];
    hardwareList.replaceChildren(...fields.flatMap(([term, value]) => {
      const label = document.createElement("dt");
      const detail = document.createElement("dd");
      label.textContent = term;
      detail.textContent = value;
      return [label, detail];
    }));
  }

  function savePreferences() {
    writeStorage(preferenceKey, { speed, density, autoScroll });
  }

  function saveStats() {
    stats.longestUptime = Math.max(stats.longestUptime, Math.floor((Date.now() - startedAt) / 1000));
    writeStorage(statsKey, stats);
  }

  function initializePersistentState() {
    const preferences = readStorage(preferenceKey, {});
    speed = speedTimingProfiles[preferences.speed] ? preferences.speed : "normal";
    density = ["relaxed", "normal", "compact"].includes(preferences.density)
      ? preferences.density
      : "normal";
    autoScroll = preferences.autoScroll !== false;
    stats = { ...stats, ...readStorage(statsKey, {}) };
    stats.totalBoots += 1;
    document.documentElement.dataset.bootDensity = density;
    document.documentElement.classList.toggle("is-boot-autoscroll-disabled", !autoScroll);
    speedSelect.value = speed;
    densitySelect.value = density;
    autoscrollInput.checked = autoScroll;
    saveStats();
  }

  function trimLog() {
    const firstItem = log.firstElementChild;
    const measuredLineHeight = firstItem
      ? Number.parseFloat(window.getComputedStyle(firstItem).lineHeight)
      : 16;
    const lineHeight = Number.isFinite(measuredLineHeight) && measuredLineHeight > 0
      ? measuredLineHeight
      : 16;
    const visibleLines = Math.ceil(log.clientHeight / lineHeight);
    const retainedLines = Math.min(240, Math.max(80, visibleLines + 8));

    while (log.children.length > retainedLines) {
      log.firstElementChild.remove();
    }
  }

  function reconcileViewport() {
    window.cancelAnimationFrame(viewportFrame);
    viewportFrame = window.requestAnimationFrame(() => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty(
        "--boot-viewport-height",
        `${Math.round(viewportHeight)}px`,
      );
      trimLog();
      if (autoScroll) {
        log.scrollTop = log.scrollHeight;
      }
    });
  }

  function applyTheme(themeId, persist = true) {
    const themes = window.BITS_INTERFACE_THEMES ?? [];
    const theme = themes.find((entry) => entry.id === themeId) ?? themes[0];
    if (!theme) {
      return;
    }
    if (window.BITS_THEME_PREFERENCE?.apply) {
      window.BITS_THEME_PREFERENCE.apply(theme.id);
    } else {
      document.documentElement.dataset.interfaceTheme = theme.id;
      document.documentElement.classList.toggle("is-rgb-mode", theme.id === "rgb");
    }
    themeSelect.value = theme.id;
    if (persist) {
      if (window.BITS_THEME_PREFERENCE) {
        window.BITS_THEME_PREFERENCE.select(theme.id);
      } else {
        localStorage.setItem("bits-interface-theme", theme.id);
      }
    }
  }

  function initializeThemePicker() {
    const themes = window.BITS_INTERFACE_THEMES ?? [];
    themeSelect.replaceChildren(...themes.map((theme) => {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = theme.name;
      return option;
    }));
    applyTheme(document.documentElement.dataset.interfaceTheme, false);
    themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
    window.BITS_THEME_PREFERENCE?.bindColorSchemeSelect(schemeSelect);
    randomThemeButton?.addEventListener("click", () => {
      const themeId = window.BITS_THEME_PREFERENCE?.pickRandom();
      if (themeId) {
        applyTheme(themeId);
      }
    });
    speedSelect.addEventListener("change", () => {
      speed = speedTimingProfiles[speedSelect.value] ? speedSelect.value : "normal";
      savePreferences();
      scheduleNextMessage();
    });
    densitySelect.addEventListener("change", () => {
      density = ["relaxed", "normal", "compact"].includes(densitySelect.value)
        ? densitySelect.value
        : "normal";
      document.documentElement.dataset.bootDensity = density;
      savePreferences();
      reconcileViewport();
    });
    autoscrollInput.addEventListener("change", () => {
      autoScroll = autoscrollInput.checked;
      document.documentElement.classList.toggle("is-boot-autoscroll-disabled", !autoScroll);
      savePreferences();
      if (autoScroll) {
        log.scrollTop = log.scrollHeight;
      }
    });
    pauseButton.addEventListener("click", () => setPaused(!paused));
    commandOpen.addEventListener("click", openCommandLine);
    window.addEventListener("storage", (event) => {
      const themePreferenceKeys = [
        "bits-interface-theme",
        window.BITS_THEME_PREFERENCE?.choiceKey,
        window.BITS_THEME_PREFERENCE?.dismissalKey,
      ];
      if (themePreferenceKeys.includes(event.key)) {
        const themeId = window.BITS_THEME_PREFERENCE?.resolve() ?? event.newValue;
        applyTheme(themeId, false);
      }
    });
    settingsToggle.addEventListener("click", () => {
      const opening = settingsPanel.hidden;
      settingsPanel.hidden = !opening;
      settingsToggle.setAttribute("aria-expanded", String(opening));
      settingsToggle.setAttribute(
        "aria-label",
        opening ? "Close display settings" : "Open display settings",
      );
      if (opening) {
        themeSelect.focus();
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".endless-boot-settings")) {
        settingsPanel.hidden = true;
        settingsToggle.setAttribute("aria-expanded", "false");
        settingsToggle.setAttribute("aria-label", "Open display settings");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !settingsPanel.hidden) {
        settingsPanel.hidden = true;
        settingsToggle.setAttribute("aria-expanded", "false");
        settingsToggle.setAttribute("aria-label", "Open display settings");
        settingsToggle.focus();
      }
    });
  }

  function setPaused(nextPaused) {
    paused = nextPaused;
    pauseButton.textContent = paused ? "RESUME OUTPUT" : "PAUSE OUTPUT";
    pauseButton.setAttribute("aria-pressed", String(paused));
    document.documentElement.classList.toggle("is-boot-paused", paused);
    window.clearTimeout(timer);
    if (!paused && !document.hidden) {
      scheduleNextMessage();
    }
  }

  function randomDelay(minimum, maximum) {
    return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
  }

  function nextMessageDelay(longRunning = false) {
    const profile = speedTimingProfiles[speed] ?? speedTimingProfiles.normal;
    if (longRunning) {
      return randomDelay(profile.longMinimum, profile.longMaximum);
    }

    const baseline = randomDelay(profile.minimum, profile.maximum);
    const variation = Math.random();
    if (variation < 0.18) {
      return Math.max(8, Math.round(baseline * randomDelay(45, 72) / 100));
    }
    if (variation > 0.9) {
      return Math.round(baseline * randomDelay(150, 260) / 100);
    }
    return baseline;
  }

  function scheduleNextMessage(longRunning = false) {
    window.clearTimeout(timer);
    if (paused || document.hidden) {
      return;
    }
    timer = window.setTimeout(appendMessage, nextMessageDelay(longRunning));
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function approach(current, target, smoothing = 0.28) {
    return current + ((target - current) * smoothing);
  }

  function updateTelemetryTargets() {
    if (Date.now() < telemetry.overrideUntil) {
      return;
    }
    const phaseLoads = [
      { cpu: 22, disk: 8, network: 2 },
      { cpu: 35, disk: 18, network: 4 },
      { cpu: 76, disk: 5, network: 1 },
      { cpu: 42, disk: 82, network: 3 },
      { cpu: 68, disk: 48, network: 8 },
      { cpu: 38, disk: 12, network: 78 },
      { cpu: 58, disk: 34, network: 46 },
      { cpu: 29, disk: 16, network: 18 },
    ];
    const load = phaseLoads[currentPhaseIndex] ?? phaseLoads[0];
    const degradation = getDegradationLevel();
    const memoryDrift = sessionAnomaly === "memory-creep"
      ? Math.min(24, Math.floor((Date.now() - startedAt) / 45000))
      : 0;
    telemetry.targets = {
      cpu: clamp(load.cpu + randomDelay(-14, 18) + (degradation * 4), 2, 100),
      memory: clamp(38 + (currentPhaseIndex * 5) + randomDelay(-5, 7) + memoryDrift, 8, 97),
      disk: clamp(load.disk + randomDelay(-12, 16), 0, 100),
      network: networkOnline
        ? clamp(load.network + randomDelay(-15, 22), 0, 999)
        : 0,
    };
    if (sessionAnomaly === "lazy-core" && Math.random() < 0.35) {
      telemetry.targets.cpu = 1;
    }
  }

  function renderSparkline(name, value, maximum = 100) {
    const output = sparkOutputs[name];
    if (!output) {
      return;
    }
    const blocks = "▁▂▃▄▅▆▇█";
    const history = telemetryHistory[name];
    history.push(clamp(value, 0, maximum));
    while (history.length > 14) {
      history.shift();
    }
    output.textContent = history.map((sample) => (
      blocks[Math.round((sample / maximum) * (blocks.length - 1))]
    )).join("");
  }

  function renderTelemetry() {
    telemetry.cpu = approach(telemetry.cpu, telemetry.targets.cpu ?? telemetry.cpu);
    telemetry.memory = approach(telemetry.memory, telemetry.targets.memory ?? telemetry.memory, 0.18);
    telemetry.disk = approach(telemetry.disk, telemetry.targets.disk ?? telemetry.disk, 0.35);
    telemetry.network = approach(telemetry.network, telemetry.targets.network ?? telemetry.network, 0.3);
    const targetTemperature = 31 + (telemetry.cpu * 0.48);
    telemetry.temperature = approach(telemetry.temperature, targetTemperature, 0.16);
    telemetry.fan = approach(telemetry.fan, 520 + (telemetry.temperature * 31), 0.2);

    const usedMemory = Math.round(hardware.memory * telemetry.memory / 100);
    cpuOutput.textContent = `${Math.round(telemetry.cpu).toString().padStart(2, "0")}%`;
    memoryOutput.textContent = `${usedMemory}M`;
    temperatureOutput.textContent = `${Math.round(telemetry.temperature)}C`;
    diskOutput.textContent = `${Math.round(telemetry.disk).toString().padStart(2, "0")}%`;
    networkOutput.textContent = networkOnline
      ? `${Math.round(telemetry.network).toString().padStart(3, "0")}K`
      : "OFF";
    renderSparkline("cpu", telemetry.cpu);
    renderSparkline("memory", telemetry.memory);
    renderSparkline("temperature", telemetry.temperature, 90);
    renderSparkline("disk", telemetry.disk);
    renderSparkline("network", telemetry.network, 160);

    const levels = {
      cpu: telemetry.cpu,
      memory: telemetry.memory,
      temperature: Math.max(0, telemetry.temperature - 25) * 1.6,
      disk: telemetry.disk,
      network: Math.min(100, telemetry.network),
    };
    Object.entries(levels).forEach(([meter, level]) => {
      const element = document.querySelector(`[data-meter="${meter}"]`);
      element.classList.toggle("is-active", level > 28);
      element.classList.toggle("is-hot", level > 78);
    });
  }

  function tickTelemetry() {
    if (Math.random() < 0.32) {
      updateTelemetryTargets();
    }
    renderTelemetry();
  }

  function overrideTelemetry(values, duration = 9000) {
    telemetry.targets = { ...telemetry.targets, ...values };
    telemetry.overrideUntil = Date.now() + duration;
  }

  function formatEta(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function setEtaMessage(message) {
    etaCountdownSeconds = null;
    etaOutput.textContent = message;
    lastEta = message;
  }

  function setEtaCountdown(totalSeconds, initialText = "") {
    etaCountdownSeconds = Math.max(0, Math.floor(totalSeconds));
    etaOutput.textContent = initialText || formatEta(etaCountdownSeconds);
    lastEta = etaOutput.textContent;
  }

  function tickEtaCountdown() {
    if (etaCountdownSeconds === null) {
      return;
    }
    if (etaCountdownSeconds <= 0) {
      setEtaMessage(randomItem(["OVERTIME", "MISSED IT", "STILL GOING"]));
      unlockBootAchievement("eta-expired");
      return;
    }
    etaCountdownSeconds -= 1;
    etaOutput.textContent = formatEta(etaCountdownSeconds);
    lastEta = etaOutput.textContent;
  }

  function updateEta() {
    const remaining = Math.max(1, 100 - progress);
    const averageDelays = { slow: 800, normal: 270, fast: 98, absurd: 31 };
    const estimatedSeconds = Math.max(
      1,
      Math.round((remaining / 4.5) * (averageDelays[speed] ?? 270) / 1000),
    );
    const unreliable = Math.random();
    let eta;
    if (unreliable < 0.28) {
      do {
        eta = randomItem(etaGoofs);
      } while (eta === lastEta && etaGoofs.length > 1);
      setEtaMessage(eta);
    } else if (unreliable < 0.42) {
      const exaggeratedSeconds = estimatedSeconds + randomDelay(45, 720);
      setEtaCountdown(exaggeratedSeconds);
    } else if (unreliable < 0.5) {
      const impossibleEta = randomItem([
        ["99:99", 6039],
        ["-00:04", 4],
        ["00:00", 0],
        ["12:60", 780],
        ["??:??", null],
      ]);
      if (impossibleEta[1] === null) {
        setEtaMessage(impossibleEta[0]);
      } else {
        setEtaCountdown(impossibleEta[1], impossibleEta[0]);
      }
    } else {
      const jitteredSeconds = Math.max(0, estimatedSeconds + randomDelay(-4, 8));
      setEtaCountdown(jitteredSeconds);
    }
  }

  function updateBootPhase(force = false) {
    const nextPhaseIndex = Math.min(
      bootPhases.length - 1,
      Math.floor(progress / (100 / bootPhases.length)),
    );
    if (!force && nextPhaseIndex === currentPhaseIndex) {
      return;
    }
    currentPhaseIndex = nextPhaseIndex;
    const phase = bootPhases[currentPhaseIndex];
    stageOutput.textContent = phase.name;
    postCodeOutput.textContent = Math.random() < 0.008
      ? randomItem(["??", "B1T", "00"])
      : phase.code;
    updateTelemetryTargets();
  }

  function appendSystemLine(message, state = "warning") {
    const item = createLogItem(message);
    item.dataset.state = state;
    log.append(item);
    trimLog();
    if (autoScroll) {
      log.scrollTop = log.scrollHeight;
    }
  }

  function createLogItem(message) {
    const item = document.createElement("li");
    const toggle = document.createElement("button");
    const summary = document.createElement("span");
    const detail = document.createElement("small");
    toggle.type = "button";
    toggle.className = "endless-boot-log-entry";
    toggle.setAttribute("aria-expanded", "false");
    summary.textContent = message;
    detail.textContent = randomItem(diagnosticDetails);
    toggle.append(summary, detail);
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(expanded));
      item.classList.toggle("is-expanded", expanded);
      if (autoScroll && expanded) {
        item.scrollIntoView({ block: "nearest" });
      }
    });
    item.append(toggle);
    return item;
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function generatedMessage() {
    const subject = randomItem(subjects);
    const action = randomItem(actions);
    const result = randomItem(results);
    const dots = ".".repeat(Math.max(3, 39 - action.length - subject.length));
    return `${action} ${subject} ${dots} ${result}`;
  }

  function nextMessage() {
    let message;
    let attempts = 0;
    do {
      if (seasonalProfile?.mode === "exclusive") {
        message = randomItem(fixedMessages);
      } else if (seasonalBootMessages.length && Math.random() < 0.22) {
        message = randomItem(seasonalBootMessages);
      } else {
        message = Math.random() < 0.38 ? randomItem(fixedMessages) : generatedMessage();
      }
      attempts += 1;
    } while (recentMessageSet.has(message) && attempts < 100);

    recentMessages.push(message);
    recentMessageSet.add(message);
    if (recentMessages.length > 240) {
      recentMessageSet.delete(recentMessages.shift());
    }
    return message;
  }

  function nextBootMessage() {
    if (activeNarrative && narrativeGap <= 0) {
      const text = activeNarrative.messages[activeNarrative.index];
      const finalStep = activeNarrative.index === activeNarrative.messages.length - 1;
      activeNarrative.index += 1;
      narrativeGap = randomDelay(1, 3);
      if (finalStep) {
        activeNarrative = null;
      }
      return { text, state: finalStep ? "rainbow" : "warning", longRunning: !finalStep };
    }
    if (activeNarrative) {
      narrativeGap -= 1;
    } else if (Date.now() - startedAt > 45000 && Math.random() < 0.0018) {
      activeNarrative = { messages: [...randomItem(narrativeStories)], index: 1 };
      narrativeGap = 2;
      return { text: activeNarrative.messages[0], state: "warning", longRunning: true };
    }

    if (activeOperation && operationGap <= 0) {
      const text = activeOperation.messages[activeOperation.index];
      const finalStep = activeOperation.index === activeOperation.messages.length - 1;
      activeOperation.index += 1;
      operationGap = randomDelay(2, 4);
      if (activeOperation.index >= activeOperation.messages.length) {
        activeOperation = null;
      }
      return {
        text,
        longRunning: !finalStep,
        state: finalStep ? "rainbow" : "warning",
      };
    }

    if (activeOperation) {
      operationGap -= 1;
    } else if (Math.random() < 0.018) {
      activeOperation = {
        messages: [...randomItem(multiStepOperations)],
        index: 1,
      };
      operationGap = randomDelay(2, 4);
      return {
        text: activeOperation.messages[0],
        longRunning: true,
        state: "warning",
      };
    }

    const themeMessages = themeBootMessages[document.documentElement.dataset.interfaceTheme] ?? [];
    const degradation = getDegradationLevel();
    if (Math.random() < 0.035) {
      return { text: randomItem(dailyPersonality.messages) };
    }
    if (Math.random() < 0.012) {
      const anomalyMessages = {
        "memory-creep": "MEMORY USAGE CREEPING .................. BEING VERY QUIET",
        "post-language": "POST CODE TRANSLATED .................. SAYS HELLO",
        "hostname-drift": `HOSTNAME DRIFT DETECTED ............... ${hardware.hostname}-${randomHex(1)}`,
        "network-ghost": "OFFLINE PACKET RECEIVED ............... FROM SOMEWHERE",
        "temperature-opinion": `THERMAL SENSOR REPORTS ................ ${randomItem(["COZY", "A BIT MUCH", "WEATHER"])} `,
        "eta-reversal": "ETA DIRECTION CHECK ................... TEMPORARILY BACKWARD",
        "boot-zero": "BOOT DEVICE ZERO ...................... CLAIMS TO BE DEVICE ONE",
        "lazy-core": "CPU CORE 03 ........................... TAKING PERSONAL DAY",
      };
      return { text: anomalyMessages[sessionAnomaly], state: "warning" };
    }
    if (degradation > 0 && Math.random() < degradation * 0.025) {
      return { text: randomItem(degradationMessages), state: "error" };
    }
    if (themeMessages.length && Math.random() < 0.14) {
      return { text: randomItem(themeMessages) };
    }
    if (Math.random() < 0.16) {
      return { text: randomItem(bootPhases[currentPhaseIndex].messages) };
    }
    if (Math.random() < 0.035) {
      return { text: randomItem(longRunningMessages), longRunning: true };
    }
    return { text: nextMessage() };
  }

  function weightedTransmission() {
    const messages = (window.BITS_MESSAGES ?? []).filter((message) => (
      message && typeof message.text === "string" && Number(message.weight) > 0
    ));
    if (!messages.length) {
      return { text: "the main process is being mysteriously quiet...", weight: 1 };
    }
    const totalWeight = messages.reduce((total, message) => total + Number(message.weight), 0);
    let choice = Math.random() * totalWeight;
    return messages.find((message) => {
      choice -= Number(message.weight);
      return choice <= 0;
    }) ?? messages.at(-1);
  }

  function renderTransmission() {
    let message;
    do {
      message = weightedTransmission();
    } while (message.text === lastTransmission && (window.BITS_MESSAGES?.length ?? 0) > 1);
    lastTransmission = message.text;
    messageOutput.replaceChildren();
    messageOutput.removeAttribute("style");
    if (message.format) {
      Object.entries(message.format).forEach(([property, value]) => {
        if (property in messageOutput.style) {
          messageOutput.style[property] = value;
        }
      });
    }
    if (message.colorful) {
      [...message.text].forEach((character, index) => {
        const span = document.createElement("span");
        span.textContent = character;
        if (character.trim()) {
          span.style.color = `hsl(${(index * 37) % 360} 88% 70%)`;
        }
        messageOutput.append(span);
      });
    } else {
      messageOutput.textContent = message.text;
    }
  }

  function showEvent([code, title, detail], kind = "incident", duration = 3200) {
    if (incidentActive) {
      return false;
    }
    incidentActive = true;
    lastIncidentAt = Date.now();
    eventCode.textContent = code;
    eventTitle.textContent = title;
    eventDetail.textContent = detail;
    eventPanel.dataset.kind = kind;
    eventPanel.hidden = false;
    document.documentElement.classList.add("has-boot-event");
    recordIncident({ code, title, detail, kind });
    window.setTimeout(() => {
      eventPanel.hidden = true;
      delete eventPanel.dataset.kind;
      document.documentElement.classList.remove("has-boot-event");
      incidentActive = false;
      stats.incidentsIgnored += 1;
      ignoredErrors += 1;
      errorsOutput.textContent = String(ignoredErrors).padStart(4, "0");
      saveStats();
    }, duration);
    return true;
  }

  function maybeTriggerEvent() {
    if (
      incidentActive
      || Date.now() - startedAt < 15000
      || Date.now() - lastIncidentAt < 60000
    ) {
      return;
    }
    const eventRoll = Math.random();
    if (eventRoll < 0.002) {
      startIncidentChain(randomItem(incidentChains));
    } else if (eventRoll < 0.004) {
      showEvent(randomItem(incidents));
    } else if (eventRoll < 0.0045) {
      const [kind, event] = randomItem(Object.entries(transformations));
      showEvent(event, kind, 4200);
    }
  }

  function startIncidentChain(chain) {
    if (!showEvent(chain.event, "incident", 3600)) {
      return false;
    }
    overrideTelemetry(chain.telemetry, 13000);
    unlockBootAchievement("incident-response");
    chain.messages.forEach(([message, state], index) => {
      window.setTimeout(() => {
        appendSystemLine(message, state || "normal");
        if (index === chain.messages.length - 1) {
          updateTelemetryTargets();
        }
      }, 2100 + (index * 2500));
    });
    return true;
  }

  function scheduleCrashRecovery(profile, stepIndex = 0) {
    window.clearTimeout(crashRecoveryTimer);
    if (!crashActive) {
      return;
    }
    const value = profile.steps[Math.min(stepIndex, profile.steps.length - 1)];
    crashProgress.textContent = `${value}%`;
    crashMeterFill.style.width = `${Math.min(100, value)}%`;
    crashCopy.textContent = profile.copies[stepIndex % profile.copies.length];
    if (stepIndex >= profile.steps.length - 1) {
      crashCopy.textContent = "Recovery complete. Automatically resuming endless boot.";
      crashRecoveryTimer = window.setTimeout(recoverFromCrash, 900);
      return;
    }
    crashRecoveryTimer = window.setTimeout(
      () => scheduleCrashRecovery(profile, stepIndex + 1),
      randomDelay(350, 850),
    );
  }

  function triggerCrash(kind, { manual = false } = {}) {
    const profile = crashProfiles[kind];
    if (!profile || crashActive || document.hidden) {
      return false;
    }
    crashActive = true;
    lastCrashAt = Date.now();
    crashPreviousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    window.clearTimeout(timer);
    window.clearTimeout(crashTimer);
    const code = randomItem(profile.codes);
    crashScreen.dataset.kind = kind;
    crashLabel.textContent = profile.label;
    crashFace.textContent = profile.face;
    crashTitle.textContent = profile.title;
    crashCopy.textContent = profile.copies[0];
    crashProgress.textContent = "0%";
    crashMeterFill.style.width = "0%";
    crashCode.textContent = code;
    crashFault.textContent = `FAULT: ${profile.fault}`;
    crashBuild.textContent = profile.build ?? `BITS Endless Boot recovery channel // ${hardware.hostname}`;
    crashRecover.hidden = true;
    crashScreen.hidden = false;
    document.documentElement.classList.add("has-boot-crash");
    recordIncident({
      code,
      title: `${kind.toUpperCase()} BOOT CRASH`,
      detail: manual ? "Crash invoked through local diagnostics." : "Rare automatic boot failure recovered locally.",
      kind: `crash-${kind}`,
    });
    scheduleCrashRecovery(profile);
    return true;
  }

  function recoverFromCrash() {
    if (!crashActive) {
      return;
    }
    const kind = crashScreen.dataset.kind;
    window.clearTimeout(crashRecoveryTimer);
    crashActive = false;
    crashScreen.hidden = true;
    crashRecover.hidden = true;
    delete crashScreen.dataset.kind;
    document.documentElement.classList.remove("has-boot-crash");
    survivedBootCrashes.add(kind);
    writeStorage(crashHistoryKey, [...survivedBootCrashes]);
    appendSystemLine(`${kind.toUpperCase()} CHANNEL RECOVERY ............... BOOT RESUMED`, "rainbow");
    if (survivedBootCrashes.size >= Object.keys(crashProfiles).length) {
      unlockBootAchievement("full-spectrum");
    } else {
      unlockBootAchievement("do-not-turn-off");
    }
    if (!paused && !document.hidden) {
      scheduleNextMessage();
    }
    crashPreviousFocus?.focus();
    crashPreviousFocus = null;
  }

  function maybeTriggerCrash() {
    if (
      crashActive
      || incidentActive
      || document.hidden
      || Date.now() - startedAt < 90000
      || Date.now() - lastCrashAt < 420000
      || Math.random() >= 0.00025
    ) {
      return;
    }
    triggerCrash(randomItem(Object.keys(crashProfiles)));
  }

  function tickFallingBits() {
    if (
      document.hidden
      || paused
      || crashActive
      || !powerRestore.hidden
      || fallingBitsMotion.matches
      || document.documentElement.dataset.motion === "reduced"
      || document.documentElement.dataset.effects === "off"
    ) {
      fallingBits.replaceChildren();
      nextFallingBitAt = Date.now() + randomDelay(4000, 9000);
      return;
    }
    if (Date.now() < nextFallingBitAt || fallingBits.childElementCount >= 3) {
      return;
    }

    const bit = document.createElement("span");
    bit.textContent = Math.random() < 0.5 ? "0" : "1";
    bit.style.setProperty("--falling-bit-x", `${randomDelay(2, 96)}%`);
    bit.style.setProperty("--falling-bit-duration", `${randomDelay(7000, 11000)}ms`);
    bit.style.setProperty("--falling-bit-distance", `${fallingBits.clientHeight + 48}px`);
    bit.style.setProperty("--falling-bit-spin", `${randomDelay(-35, 35)}deg`);
    bit.addEventListener("animationend", () => bit.remove(), { once: true });
    fallingBits.append(bit);
    nextFallingBitAt = Date.now() + randomDelay(4000, 9000);
  }

  function releaseBits(amount = 18) {
    particles.replaceChildren();
    const countToRelease = Math.min(64, Math.max(1, Number(amount) || 18));
    for (let index = 0; index < countToRelease; index += 1) {
      const bit = document.createElement("i");
      bit.textContent = Math.random() < 0.5 ? "0" : "1";
      bit.style.setProperty("--bit-x", `${8 + Math.random() * 84}vw`);
      bit.style.setProperty("--bit-y", `${8 + Math.random() * 78}vh`);
      bit.style.setProperty("--bit-delay", `${Math.random() * 320}ms`);
      bit.style.setProperty("--bit-spin", `${-180 + Math.random() * 360}deg`);
      particles.append(bit);
    }
    appendSystemLine(`RELEASING ${countToRelease} LOOSE BITS .............. RECAPTURE PENDING`);
    window.setTimeout(() => particles.replaceChildren(), 2600);
  }

  function powerMotionReduced() {
    return fallingBitsMotion.matches || document.documentElement.dataset.motion === "reduced";
  }

  function cyclePower() {
    window.clearTimeout(powerTransitionTimer);
    document.documentElement.classList.add("is-boot-powered-off");
    powerRestore.dataset.state = powerMotionReduced() ? "on" : "opening";
    powerRestore.hidden = false;
    window.clearTimeout(timer);
    powerRestore.focus();
    if (powerRestore.dataset.state === "opening") {
      powerTransitionTimer = window.setTimeout(() => {
        powerRestore.dataset.state = "on";
      }, 650);
    }
  }

  function restorePower() {
    if (powerRestore.hidden || powerRestore.dataset.state === "closing") {
      return;
    }
    window.clearTimeout(powerTransitionTimer);
    const finishRestore = () => {
      powerRestore.hidden = true;
      delete powerRestore.dataset.state;
      document.documentElement.classList.remove("is-boot-powered-off");
      appendSystemLine("RESTORING DISPLAY POWER .............. USER FOUND BUTTON");
      if (!paused) {
        scheduleNextMessage();
      }
    };
    if (powerMotionReduced()) {
      finishRestore();
      return;
    }
    powerRestore.dataset.state = "closing";
    powerTransitionTimer = window.setTimeout(finishRestore, 650);
  }

  function scanSignal() {
    const originalStage = stageOutput.textContent;
    stageOutput.textContent = "SCANNING LOCAL NETWORK";
    appendSystemLine("SCANNING SIGNAL ...................... NEIGHBOR'S PRINTER FOUND");
    window.setTimeout(() => {
      stageOutput.textContent = originalStage;
    }, 2200);
  }

  function openHardwarePanel() {
    hardwarePanel.hidden = false;
    postButton.setAttribute("aria-expanded", "true");
    unlockBootAchievement("technician");
    hardwareClose.focus();
  }

  function closeHardwarePanel({ restoreFocus = true } = {}) {
    hardwarePanel.hidden = true;
    postButton.setAttribute("aria-expanded", "false");
    if (restoreFocus) {
      postButton.focus();
    }
  }

  function revealPresentationControls() {
    const settings = document.querySelector(".endless-boot-settings");
    settings.classList.add("is-revealed");
    window.clearTimeout(presentationRevealTimer);
    presentationRevealTimer = window.setTimeout(() => {
      settings.classList.remove("is-revealed");
    }, 2400);
  }

  async function togglePresentationMode() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error("Unable to change presentation mode.", error);
      appendSystemLine("PRESENTATION MODE .................... FULLSCREEN REQUEST DENIED", "error");
    }
  }

  function setPresentationState() {
    const presenting = Boolean(document.fullscreenElement);
    document.documentElement.classList.toggle("is-boot-presentation", presenting);
    presentationButton.textContent = presenting
      ? "EXIT PRESENTATION MODE"
      : "ENTER PRESENTATION MODE";
    if (presenting) {
      settingsPanel.hidden = true;
      settingsToggle.setAttribute("aria-expanded", "false");
      revealPresentationControls();
    }
  }

  function cycleSelect(select, options, direction = 1) {
    const currentIndex = options.indexOf(select.value);
    const nextIndex = (currentIndex + direction + options.length) % options.length;
    select.value = options[nextIndex];
    select.dispatchEvent(new Event("change"));
  }

  function showShortcutHelp() {
    commandPanel.hidden = false;
    commandOutput.textContent = [
      "KEYBOARD CONTROLS",
      "SPACE  PAUSE OR RESUME",
      "+ / -  CHANGE BOOT SPEED",
      "A      TOGGLE AUTO-SCROLL",
      "D      CYCLE MESSAGE DENSITY",
      "T      CYCLE INTERFACE THEME",
      "F      TOGGLE PRESENTATION MODE",
      "?      SHOW THIS HELP",
      "CTRL+` OPEN COMMAND LINE",
    ].join("\n");
    commandInput.focus();
  }

  function isTypingTarget(target) {
    return target instanceof HTMLElement && (
      target.isContentEditable
      || ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A"].includes(target.tagName)
    );
  }

  function openCommandLine() {
    settingsPanel.hidden = true;
    settingsToggle.setAttribute("aria-expanded", "false");
    settingsToggle.setAttribute("aria-label", "Open display settings");
    commandPanel.hidden = false;
    commandInput.focus();
  }

  function closeCommandLine() {
    commandPanel.hidden = true;
    commandInput.value = "";
  }

  function formatDuration(totalSeconds) {
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  function getDegradationLevel(elapsed = Math.floor((Date.now() - startedAt) / 1000)) {
    if (elapsed >= 3600) {
      return 3;
    }
    if (elapsed >= 1800) {
      return 2;
    }
    if (elapsed >= 600) {
      return 1;
    }
    return 0;
  }

  function checkUptimeMilestones(elapsed) {
    uptimeMilestones.forEach(([threshold, message]) => {
      if (elapsed < threshold || reachedMilestones.has(threshold)) {
        return;
      }
      reachedMilestones.add(threshold);
      appendSystemLine(message, threshold >= 3600 ? "rainbow" : "warning");
      if (threshold >= 3600 && !incidentActive) {
        showEvent(
          ["UPTIME MILESTONE", "BOOT LEGEND CONFIRMED", "One hour of continuous booting. The machine respects this."],
          "incident",
          4200,
        );
      }
    });
  }

  function logText() {
    return [...log.querySelectorAll(".endless-boot-log-entry > span")]
      .map((entry) => entry.textContent)
      .join("\n");
  }

  function diagnosticText() {
    return [
      "BITS ENDLESS BOOT DIAGNOSTICS",
      `Generated: ${new Date().toISOString()}`,
      `Host: ${hardware.hostname} (${hardware.serial})`,
      `Personality: ${dailyPersonality.name}`,
      `Session anomaly: ${sessionAnomaly}`,
      `Online: ${networkOnline ? "yes" : "no"}`,
      `Uptime: ${formatDuration(Math.floor((Date.now() - startedAt) / 1000))}`,
      `Cycle: ${cycle} // Phase: ${currentPhaseIndex + 1}/${bootPhases.length}`,
      `CPU: ${Math.round(telemetry.cpu)}% // Memory: ${Math.round(telemetry.memory)}%`,
      `Temperature: ${Math.round(telemetry.temperature)}C // Fan: ${Math.round(telemetry.fan)} RPM`,
      `Disk: ${Math.round(telemetry.disk)}% // Network: ${Math.round(telemetry.network)}K`,
      `Incidents: ${incidentHistory.length} // Crash channels survived: ${survivedBootCrashes.size}/5`,
      "",
      logText(),
    ].join("\n");
  }

  async function copyText(text, label) {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API is unavailable in this browser.");
      }
      await navigator.clipboard.writeText(text);
      return `${label} COPIED TO CLIPBOARD.`;
    } catch (error) {
      console.error(`Unable to copy ${label.toLowerCase()}.`, error);
      return `${label} COPY FAILED: ${error.message}`;
    }
  }

  function downloadText(text, filename) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      return `DOWNLOAD STARTED: ${filename}`;
    } catch (error) {
      console.error("Unable to download boot diagnostics.", error);
      return `DOWNLOAD FAILED: ${error.message}`;
    }
  }

  async function runCommand(rawCommand) {
    const [command = "", ...argumentsList] = rawCommand.trim().toLowerCase().split(/\s+/);
    const argument = argumentsList.join(" ");
    const responses = {
      help: "COMMANDS: STATUS, STATS, SENSORS, LSHW, LSPCI, DMESG, UPTIME, WHOAMI, PS, NETSTAT, SMART, FORTUNE, HISTORY, MAN <COMMAND>, COPY <LOG|HARDWARE|DIAGNOSTICS>, DOWNLOAD LOG, INCIDENTS, ACHIEVEMENTS, CRASH <COLOR>, HARDWARE, FULLSCREEN, CLEAR, REBOOT, THEME <NAME|RANDOM|DARK|LIGHT|AUTO>, INCIDENT, PANIC, BSOD, BIOS, RECOVERY, MORE BITS [COUNT], PAUSE, RESUME, SPEED <MODE>, DENSITY <MODE>",
      status: `CYCLE ${cycle} // PHASE ${currentPhaseIndex + 1}/${bootPhases.length} // ${count} MESSAGES // ${processedBits} BITS // ${ignoredErrors} ERRORS IGNORED // ${paused ? "PAUSED" : "RUNNING"}`,
      stats: `TOTAL BOOTS ${stats.totalBoots} // MESSAGES SEEN ${stats.messagesSeen} // LONGEST UPTIME ${formatDuration(stats.longestUptime)} // INCIDENTS IGNORED ${stats.incidentsIgnored}`,
      diagnose: `DIAGNOSTIC COMPLETE: CPU ${Math.round(telemetry.cpu)}% // TEMP ${Math.round(telemetry.temperature)}C // FAN ${Math.round(telemetry.fan)} RPM // 0 ERRORS, 3 CONCERNS.`,
      sensors: `CPU ${Math.round(telemetry.cpu)}% // MEMORY ${Math.round(telemetry.memory)}% // TEMP ${Math.round(telemetry.temperature)}C // FAN ${Math.round(telemetry.fan)} RPM // DISK ${Math.round(telemetry.disk)}% // NET ${networkOnline ? `${Math.round(telemetry.network)}K` : "OFFLINE"}`,
      lspci: `00:00.0 Host bridge: ${hardware.cpu}\n01:00.0 Display controller: ${hardware.gpu}\n02:00.0 Network controller: QUESTIONABLE ETHERNET\n03:00.0 Unclassified device: LOOSE BIT CAGE`,
      uptime: `${formatDuration(Math.floor((Date.now() - startedAt) / 1000))} UP // ${cycle} BOOT CYCLES // LOAD ${Math.round(telemetry.cpu / 10) / 10}, ${Math.round(telemetry.disk / 10) / 10}, 17.00`,
      whoami: `visitor@${hardware.hostname.toLowerCase()} // GROUPS: bits, boot, sudo-ish`,
      ps: "PID  COMMAND\n001  endless-boot\n017  eta-daemon --unreliable\n042  bit-counter --off-by-one\n404  final-stage [missing]",
      netstat: networkOnline
        ? `tcp  0  0  ${hardware.hostname}:17  internet:443  ESTABLISHED-ISH`
        : "NO ACTIVE CONNECTIONS // BROWSER REPORTS OFFLINE",
      smart: `SMART OVERALL-HEALTH: OPTIMISTIC\nDEVICE: ${hardware.storage}\nPOWER-ON BOOTS: ${stats.totalBoots}\nQUESTIONABLE SECTORS: 17`,
      fortune: dailyPersonality.fortune,
      dmesg: [...log.querySelectorAll(".endless-boot-log-entry > span")].slice(-12).map((entry) => entry.textContent).join("\n"),
    };

    if (responses[command]) {
      return responses[command];
    }
    if (command === "lshw") {
      return `HOST ${hardware.hostname}\nCPU ${hardware.cpu}\nMEMORY ${hardware.memory} MB\nSTORAGE ${hardware.storage}\nDISPLAY ${hardware.gpu}\nBIOS ${hardware.bios}\nSERIAL ${hardware.serial}`;
    }
    if (command === "history") {
      return commandHistory.length ? commandHistory.join("\n") : "NO COMMAND HISTORY YET.";
    }
    if (command === "man") {
      return argumentsList[0]
        ? `${argumentsList[0].toUpperCase()}(17) // See HELP. Accuracy not guaranteed.`
        : "WHAT MANUAL PAGE DO YOU WANT?";
    }
    if (command === "incidents") {
      openInspector("incidents");
      return `${incidentHistory.length} INCIDENT RECORDS OPENED.`;
    }
    if (command === "achievements") {
      openInspector("achievements");
      return `${unlockedBootAchievements.length}/${bootAchievements.length} ACHIEVEMENTS OPENED.`;
    }
    if (command === "crash") {
      const kind = argumentsList[0];
      if (!Object.hasOwn(crashProfiles, kind)) {
        return "CRASH COLORS: BLUE, BLACK, GREEN, RED, PURPLE.";
      }
      return triggerCrash(kind, { manual: true })
        ? `${kind.toUpperCase()} CRASH CHANNEL REQUESTED.`
        : "CRASH REQUEST REFUSED: ANOTHER OVERLAY IS ACTIVE.";
    }
    if (command === "copy") {
      const targets = {
        log: logText(),
        hardware: `HOST ${hardware.hostname}\nCPU ${hardware.cpu}\nMEMORY ${hardware.memory} MB\nSTORAGE ${hardware.storage}\nDISPLAY ${hardware.gpu}\nBIOS ${hardware.bios}\nSERIAL ${hardware.serial}\nMAC ${hardware.mac}`,
        diagnostics: diagnosticText(),
      };
      const target = argumentsList[0];
      return Object.hasOwn(targets, target)
        ? copyText(targets[target], target.toUpperCase())
        : "COPY TARGETS: LOG, HARDWARE, DIAGNOSTICS.";
    }
    if (command === "download") {
      return argumentsList[0] === "log"
        ? downloadText(diagnosticText(), `bits-boot-${Date.now()}.txt`)
        : "DOWNLOAD TARGET: LOG.";
    }
    if (command === "clear") {
      log.replaceChildren();
      return "BOOT LOG CLEARED. THE BITS REMEMBER.";
    }
    if (command === "reboot") {
      window.location.reload();
      return "REBOOTING...";
    }
    if (command === "pause" || command === "resume") {
      setPaused(command === "pause");
      return `OUTPUT ${paused ? "PAUSED" : "RESUMED"}.`;
    }
    if (command === "hardware") {
      openHardwarePanel();
      return `HOST ${hardware.hostname} // ${hardware.cpu} // ${hardware.memory} MB // BIOS ${hardware.bios}`;
    }
    if (command === "fullscreen") {
      togglePresentationMode();
      return "PRESENTATION MODE REQUESTED.";
    }
    if (command === "incident") {
      startIncidentChain(randomItem(incidentChains));
      return "CHAINED INCIDENT INJECTED.";
    }
    if (Object.hasOwn(transformations, command)) {
      showEvent(transformations[command], command, 4200);
      return `${command.toUpperCase()} SIMULATION STARTED.`;
    }
    if (command === "more" && argumentsList[0] === "bits") {
      releaseBits(argumentsList[1] ?? 32);
      return "ADDITIONAL BITS DISPENSED.";
    }
    if (command === "theme") {
      const themes = window.BITS_INTERFACE_THEMES ?? [];
      if (argument === "random" && window.BITS_THEME_PREFERENCE?.pickRandom) {
        const randomThemeId = window.BITS_THEME_PREFERENCE.pickRandom();
        const randomTheme = themes.find((theme) => theme.id === randomThemeId);
        applyTheme(randomTheme.id);
        return `THEME RANDOMIZED TO ${randomTheme.name.toUpperCase()}.`;
      }
      if (["dark", "light", "auto"].includes(argument) && window.BITS_THEME_PREFERENCE) {
        window.BITS_THEME_PREFERENCE.setColorScheme(argument);
        return `COLOR MODE SET TO ${argument.toUpperCase()}.`;
      }
      const requestedTheme = themes.find((theme) => (
        theme.id === argument || theme.name.toLowerCase() === argument
      ));
      if (!requestedTheme) {
        return `THEME NOT FOUND. AVAILABLE: ${themes.map((theme) => theme.id).join(", ")}`;
      }
      applyTheme(requestedTheme.id);
      return `THEME SWITCHED TO ${requestedTheme.name.toUpperCase()}.`;
    }
    if (command === "speed") {
      if (!speedTimingProfiles[argument]) {
        return "SPEEDS: SLOW, NORMAL, FAST, ABSURD.";
      }
      speed = argument;
      speedSelect.value = speed;
      savePreferences();
      scheduleNextMessage();
      return `BOOT SPEED SET TO ${speed.toUpperCase()}.`;
    }
    if (command === "density") {
      if (!["relaxed", "normal", "compact"].includes(argument)) {
        return "DENSITIES: RELAXED, NORMAL, COMPACT.";
      }
      density = argument;
      densitySelect.value = density;
      document.documentElement.dataset.bootDensity = density;
      savePreferences();
      reconcileViewport();
      return `MESSAGE DENSITY SET TO ${density.toUpperCase()}.`;
    }
    if (!command) {
      return "AWAITING COMMAND.";
    }
    return `COMMAND NOT FOUND: ${command.toUpperCase()}. TRY HELP.`;
  }

  function updatePresenceState() {
    const idleFor = Date.now() - lastUserActivityAt;
    const nextStage = idleFor >= 300000 ? 2 : idleFor >= 75000 ? 1 : 0;
    if (nextStage === userIdleStage) {
      return;
    }
    userIdleStage = nextStage;
    document.documentElement.classList.toggle("is-boot-user-idle", nextStage > 0);
    document.documentElement.classList.toggle("is-boot-user-away", nextStage > 1);
    if (nextStage === 1) {
      appendSystemLine("USER PRESENCE TIMED OUT ............... CONTINUING WITHOUT SUPERVISION");
    } else if (nextStage === 2) {
      appendSystemLine("USER STILL ABSENT ..................... MACHINE ASSUMING NIGHT SHIFT");
    }
  }

  function noteUserActivity() {
    const previousStage = userIdleStage;
    lastUserActivityAt = Date.now();
    if (previousStage > 0) {
      userIdleStage = 0;
      document.documentElement.classList.remove("is-boot-user-idle", "is-boot-user-away");
      appendSystemLine("USER SIGNAL RESTORED .................. PRETENDING NOTHING HAPPENED", "rainbow");
    }
  }

  function shiftBurnInProtection() {
    const offsetX = randomDelay(-2, 2);
    const offsetY = randomDelay(-2, 2);
    document.documentElement.style.setProperty("--boot-shift-x", `${offsetX}px`);
    document.documentElement.style.setProperty("--boot-shift-y", `${offsetY}px`);
  }

  function setNetworkState(isOnline) {
    if (networkOnline === isOnline && document.documentElement.hasAttribute("data-boot-network")) {
      return;
    }
    networkOnline = isOnline;
    document.documentElement.dataset.bootNetwork = isOnline ? "online" : "offline";
    appendSystemLine(
      isOnline
        ? "NETWORK LINK RESTORED .................. PACKETS ACTING CASUAL"
        : "NETWORK LINK LOST ...................... BOOTING FROM MEMORY",
      isOnline ? "rainbow" : "error",
    );
    recordIncident({
      code: isOnline ? "NETWORK_LINK_RESTORED" : "BROWSER_REPORTED_OFFLINE",
      title: isOnline ? "NETWORK RETURNED" : "NETWORK UNAVAILABLE",
      detail: isOnline
        ? "The browser online signal returned."
        : "The browser online signal was lost; network telemetry was suspended.",
      kind: "network",
    });
    updateTelemetryTargets();
    renderTelemetry();
  }

  function updateElapsed() {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const degradation = getDegradationLevel(elapsed);
    const displayedElapsed = elapsed + (degradation ? Math.floor(elapsed / (900 / degradation)) : 0);
    elapsedOutput.textContent = formatDuration(displayedElapsed);
    document.documentElement.dataset.bootDegradation = String(degradation);
    stats.longestUptime = Math.max(stats.longestUptime, elapsed);
    checkUptimeMilestones(elapsed);
    updatePresenceState();
    maybeTriggerEvent();
    maybeTriggerCrash();
    if (elapsed > 300) {
      unlockBootAchievement("still-waiting");
    }
    if (cycle >= 17) {
      unlockBootAchievement("committed-bit");
    }
    if (speed === "absurd" && cycle >= 3) {
      unlockBootAchievement("speedrunner");
    }
    if (new Date().getHours() < 5) {
      unlockBootAchievement("night-shift");
    }
  }

  function appendMessage() {
    const selectedMessage = nextBootMessage();
    const item = createLogItem(selectedMessage.text);
    if (selectedMessage.state) {
      item.dataset.state = selectedMessage.state;
      if (selectedMessage.state === "error") {
        ignoredErrors += 1;
      }
    } else {
      const messageState = Math.random();
      if (messageState < 0.01) {
        item.dataset.state = "rainbow";
      } else if (messageState < 0.03) {
        item.dataset.state = "error";
        ignoredErrors += 1;
      } else if (messageState < 0.1) {
        item.dataset.state = "warning";
        ignoredErrors += 1;
      }
    }
    log.append(item);
    trimLog();
    if (autoScroll) {
      log.scrollTop = log.scrollHeight;
    }

    count += 1;
    processedBits += 64 + Math.floor(Math.random() * 960);
    stats.messagesSeen += 1;
    progress += 2 + Math.floor(Math.random() * 7);
    if (progress >= 100) {
      progress %= 100;
      cycle += 1;
      currentPhaseIndex = bootPhases.length - 1;
      postCodeOutput.textContent = "FF";
      stageOutput.textContent = "BOOT COMPLETE; VERIFYING BOOT COMPLETION";
    } else {
      updateBootPhase();
    }
    countOutput.textContent = String(count).padStart(6, "0");
    cycleOutput.textContent = String(cycle).padStart(4, "0");
    bitsOutput.textContent = String(processedBits).padStart(8, "0");
    errorsOutput.textContent = String(ignoredErrors).padStart(4, "0");
    percentOutput.textContent = `${progress}%`;
    progressBar.style.width = `${progress}%`;
    updateElapsed();
    if (count % 25 === 0) {
      saveStats();
    }
    scheduleNextMessage(selectedMessage.longRunning);
  }

  document.addEventListener("visibilitychange", () => {
    tickFallingBits();
    if (document.hidden) {
      window.clearTimeout(timer);
      saveStats();
    } else if (!paused) {
      scheduleNextMessage();
    }
  });
  document.querySelectorAll("[data-indicator]").forEach((indicator) => {
    indicator.addEventListener("click", () => {
      const actionsByIndicator = {
        power: cyclePower,
        signal: scanSignal,
        bits: () => releaseBits(),
      };
      actionsByIndicator[indicator.dataset.indicator]?.();
    });
  });
  powerRestore.addEventListener("click", restorePower);
  postButton.addEventListener("click", openHardwarePanel);
  incidentsOpen.addEventListener("click", () => openInspector("incidents"));
  inspectorClose.addEventListener("click", () => closeInspector());
  inspectorPanel.addEventListener("click", (event) => {
    if (event.target === inspectorPanel) {
      closeInspector();
    }
  });
  crashRecover.addEventListener("click", recoverFromCrash);
  hardwareClose.addEventListener("click", () => closeHardwarePanel());
  hardwarePanel.addEventListener("click", (event) => {
    if (event.target === hardwarePanel) {
      closeHardwarePanel();
    }
  });
  presentationButton.addEventListener("click", togglePresentationMode);
  document.addEventListener("fullscreenchange", setPresentationState);
  document.addEventListener("pointermove", () => {
    if (document.fullscreenElement) {
      revealPresentationControls();
    }
  });
  commandClose.addEventListener("click", closeCommandLine);
  commandForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const command = commandInput.value.trim();
    if (command) {
      commandHistory.push(command);
      commandHistory = commandHistory.slice(-50);
      commandHistoryIndex = commandHistory.length;
      if (new Set(commandHistory.map((entry) => entry.split(/\s+/)[0].toLowerCase())).size >= 10) {
        unlockBootAchievement("command-center");
      }
    }
    commandOutput.textContent = `boot> ${command}\n${await runCommand(command)}`;
    commandInput.value = "";
  });
  commandInput.addEventListener("keydown", (event) => {
    if (!["ArrowUp", "ArrowDown"].includes(event.key) || !commandHistory.length) {
      return;
    }
    event.preventDefault();
    commandHistoryIndex = event.key === "ArrowUp"
      ? Math.max(0, commandHistoryIndex - 1)
      : Math.min(commandHistory.length, commandHistoryIndex + 1);
    commandInput.value = commandHistory[commandHistoryIndex] ?? "";
  });
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && (event.key === "`" || event.key === "~")) {
      event.preventDefault();
      if (commandPanel.hidden) {
        openCommandLine();
      } else {
        closeCommandLine();
      }
      return;
    }
    if (event.key === "Escape") {
      if (crashActive) {
        recoverFromCrash();
      } else if (!inspectorPanel.hidden) {
        closeInspector();
      } else if (!hardwarePanel.hidden) {
        closeHardwarePanel();
      } else if (!commandPanel.hidden) {
        closeCommandLine();
      }
      return;
    }
    if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const key = event.key.toLowerCase();
    if (event.repeat && [" ", "a", "d", "t", "f"].includes(key)) {
      return;
    }
    if (key === " ") {
      event.preventDefault();
      setPaused(!paused);
    } else if (key === "+" || key === "=") {
      event.preventDefault();
      cycleSelect(speedSelect, speedOrder, 1);
    } else if (key === "-" || key === "_") {
      event.preventDefault();
      cycleSelect(speedSelect, speedOrder, -1);
    } else if (key === "a") {
      autoScroll = !autoScroll;
      autoscrollInput.checked = autoScroll;
      autoscrollInput.dispatchEvent(new Event("change"));
    } else if (key === "d") {
      cycleSelect(densitySelect, densityOrder);
    } else if (key === "t") {
      const themeIds = (window.BITS_INTERFACE_THEMES ?? []).map((theme) => theme.id);
      cycleSelect(themeSelect, themeIds);
    } else if (key === "f") {
      togglePresentationMode();
    } else if (key === "?") {
      event.preventDefault();
      showShortcutHelp();
    }
  });
  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, noteUserActivity, { passive: true });
  });
  window.addEventListener("online", () => setNetworkState(true));
  window.addEventListener("offline", () => setNetworkState(false));
  window.addEventListener("pagehide", saveStats);
  window.addEventListener("resize", reconcileViewport);
  window.addEventListener("orientationchange", reconcileViewport);
  window.visualViewport?.addEventListener("resize", reconcileViewport);
  window.visualViewport?.addEventListener("scroll", reconcileViewport);

  for (let index = 0; index < 12; index += 1) {
    const item = createLogItem(nextMessage());
    log.append(item);
    count += 1;
  }
  countOutput.textContent = String(count).padStart(6, "0");
  initializePersistentState();
  initializeBootRecords();
  initializeHardwareIdentity();
  document.documentElement.dataset.bootPersonality = dailyPersonality.id;
  document.documentElement.dataset.bootAnomaly = sessionAnomaly;
  document.documentElement.dataset.bootNetwork = networkOnline ? "online" : "offline";
  reconcileViewport();
  initializeThemePicker();
  updateBootPhase(true);
  updateTelemetryTargets();
  renderTelemetry();
  updateEta();
  renderTransmission();
  updateElapsed();
  appendSystemLine(`DAILY BOOT PERSONALITY ................. ${dailyPersonality.name}`);
  appendSystemLine(`SESSION ANOMALY SEEDED ................. ${sessionAnomaly.toUpperCase()}`);
  window.setInterval(updateElapsed, 1000);
  window.setInterval(renderTransmission, 7000);
  window.setInterval(tickTelemetry, 700);
  window.setInterval(tickEtaCountdown, 1000);
  window.setInterval(updateEta, 2800);
  window.setInterval(shiftBurnInProtection, 30000);
  window.setInterval(tickFallingBits, 1000);
  scheduleNextMessage();
})();
