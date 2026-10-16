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
    "aero-glass": ["COMPOSITING GLASS FRAME .............. SHINY ENOUGH"],
    "amber-crt": ["WARMING AMBER PHOSPHOR ............... GLOWING"],
    aurora: ["ALIGNING AURORA BANDS ................ MAGNETICALLY PRETTY"],
    "candy-pop": ["SORTING CANDY-COLORED BITS ........... DELICIOUSLY INVALID"],
    christmas: ["ALLOCATING PRESENTS .................. NICE LIST CACHED"],
    "cozy-blossom": ["ARRANGING DESKTOP BLOSSOMS ........... COZY"],
    cyberpunk: ["NEGOTIATING WITH MEGACORP ............ TERMS REJECTED"],
    default: ["LOADING STANDARD ISSUE BITS .......... NONSTANDARD"],
    "dos-blue": ["CHECKING CONVENTIONAL MEMORY ......... NEVER ENOUGH"],
    dracula: ["COUNTING BACKGROUND PROCESSES ......... BLEH BLEH BLEH"],
    fluent: ["APPLYING FLUENT MATERIAL .............. FLOWING"],
    macos: ["POLISHING MENU BAR .................... COURAGEOUS"],
    mica: ["SAMPLING DESKTOP WALLPAPER ........... MATERIALIZED"],
    "midnight-oled": ["TURNING OFF UNUSED PIXELS ............. MOST OF THEM"],
    minebits: ["GENERATING BOOT CHUNKS ................ CREEPER NEARBY"],
    "new-year": ["SYNCHRONIZING MIDNIGHT CLOCK .......... ALMOST THIS YEAR"],
    nord: ["COOLING NORDIC PALETTE ................ FROSTY"],
    rgb: ["SYNCHRONIZING RGB CONTROLLERS ......... STILL RAINBOW"],
    solarized: ["CALCULATING SOLAR ANGLE ............... BLUE HOUR"],
    spooky: ["ENUMERATING GHOST DEVICES ............. ONE TOO MANY"],
    terminal: ["SPAWNING /dev/vibes ................... PID 1337"],
    vaporwave: ["LOADING AESTHETIC DRIVERS ............. AESTHETIC 420"],
    winter: ["DEFROSTING NETWORK STACK .............. SLUSHY"],
    "windows-95": ["RESOLVING IRQ CONFLICT ................ NEW CONFLICT CREATED"],
    "y2k-silver": ["CHECKING DATE FIELD WIDTH .............. TWO DIGITS ENOUGH"],
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
  const speedOrder = ["slow", "normal", "fast", "absurd"];
  const densityOrder = ["relaxed", "normal", "compact"];

  const startedAt = Date.now();
  let cycle = 1;
  let count = 0;
  let progress = 0;
  let processedBits = 0;
  let ignoredErrors = 0;
  let lastTransmission = "";
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
  let presentationRevealTimer = 0;
  let hardware = null;
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
    document.documentElement.dataset.interfaceTheme = theme.id;
    document.documentElement.classList.toggle("is-rgb-mode", theme.id === "rgb");
    document.querySelector('meta[name="theme-color"]').content = theme.darkColor;
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
    telemetry.targets = {
      cpu: clamp(load.cpu + randomDelay(-14, 18) + (degradation * 4), 2, 100),
      memory: clamp(38 + (currentPhaseIndex * 5) + randomDelay(-5, 7), 8, 97),
      disk: clamp(load.disk + randomDelay(-12, 16), 0, 100),
      network: clamp(load.network + randomDelay(-15, 22), 0, 999),
    };
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
    networkOutput.textContent = `${Math.round(telemetry.network).toString().padStart(3, "0")}K`;

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

  function updateEta() {
    const remaining = Math.max(1, 100 - progress);
    const averageDelays = { slow: 800, normal: 270, fast: 98, absurd: 31 };
    const estimatedSeconds = Math.max(
      1,
      Math.round((remaining / 4.5) * (averageDelays[speed] ?? 270) / 1000),
    );
    const unreliable = Math.random();
    if (unreliable < 0.08) {
      etaOutput.textContent = randomItem(["YESTERDAY", "EVENTUALLY", "UNKNOWN", "RECALCULATING"]);
    } else if (unreliable < 0.18) {
      etaOutput.textContent = `00:${String(estimatedSeconds + randomDelay(30, 480)).padStart(2, "0")}`;
    } else {
      const minutes = Math.floor(estimatedSeconds / 60);
      const seconds = estimatedSeconds % 60;
      etaOutput.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
    if (degradation > 0 && Math.random() < degradation * 0.025) {
      return { text: randomItem(degradationMessages), state: "error" };
    }
    if (themeMessages.length && Math.random() < 0.09) {
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

  function cyclePower() {
    document.documentElement.classList.add("is-boot-powered-off");
    powerRestore.hidden = false;
    window.clearTimeout(timer);
    powerRestore.focus();
  }

  function restorePower() {
    powerRestore.hidden = true;
    document.documentElement.classList.remove("is-boot-powered-off");
    appendSystemLine("RESTORING DISPLAY POWER .............. USER FOUND BUTTON");
    if (!paused) {
      scheduleNextMessage();
    }
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

  function runCommand(rawCommand) {
    const [command = "", ...argumentsList] = rawCommand.trim().toLowerCase().split(/\s+/);
    const argument = argumentsList.join(" ");
    const responses = {
      help: "COMMANDS: HELP, STATUS, STATS, HARDWARE, FULLSCREEN, CLEAR, REBOOT, THEME <NAME>, INCIDENT, PANIC, BSOD, BIOS, RECOVERY, MORE BITS [COUNT], PAUSE, RESUME, SPEED <MODE>, DENSITY <MODE>",
      status: `CYCLE ${cycle} // PHASE ${currentPhaseIndex + 1}/${bootPhases.length} // ${count} MESSAGES // ${processedBits} BITS // ${ignoredErrors} ERRORS IGNORED // ${paused ? "PAUSED" : "RUNNING"}`,
      stats: `TOTAL BOOTS ${stats.totalBoots} // MESSAGES SEEN ${stats.messagesSeen} // LONGEST UPTIME ${formatDuration(stats.longestUptime)} // INCIDENTS IGNORED ${stats.incidentsIgnored}`,
      diagnose: `DIAGNOSTIC COMPLETE: CPU ${Math.round(telemetry.cpu)}% // TEMP ${Math.round(telemetry.temperature)}C // FAN ${Math.round(telemetry.fan)} RPM // 0 ERRORS, 3 CONCERNS.`,
    };

    if (responses[command]) {
      return responses[command];
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

  function updateElapsed() {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const degradation = getDegradationLevel(elapsed);
    const displayedElapsed = elapsed + (degradation ? Math.floor(elapsed / (900 / degradation)) : 0);
    elapsedOutput.textContent = formatDuration(displayedElapsed);
    document.documentElement.dataset.bootDegradation = String(degradation);
    stats.longestUptime = Math.max(stats.longestUptime, elapsed);
    checkUptimeMilestones(elapsed);
    maybeTriggerEvent();
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
  commandForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = commandInput.value;
    commandOutput.textContent = `boot> ${command}\n${runCommand(command)}`;
    commandInput.value = "";
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
      if (!hardwarePanel.hidden) {
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
  initializeHardwareIdentity();
  reconcileViewport();
  initializeThemePicker();
  updateBootPhase(true);
  updateTelemetryTargets();
  renderTelemetry();
  updateEta();
  renderTransmission();
  updateElapsed();
  window.setInterval(updateElapsed, 1000);
  window.setInterval(renderTransmission, 7000);
  window.setInterval(tickTelemetry, 700);
  window.setInterval(updateEta, 5000);
  scheduleNextMessage();
})();
