(() => {
  let instance;

  function initialize({ openApp } = {}) {
    if (instance) return instance;
    if (typeof openApp !== "function") {
      throw new Error("CoBits requires an openApp callback.");
    }

    const element = document.querySelector("#fake-cobits");
    const launch = document.querySelector("#fake-cobits-launch");
    const form = document.querySelector("#fake-cobits-form");
    const input = document.querySelector("#fake-cobits-input");
    const log = document.querySelector("#fake-cobits-log");
    const typing = document.querySelector("#fake-cobits-typing");
    const memoryStatus = document.querySelector("#fake-cobits-memory");
    const clearButton = document.querySelector("#fake-cobits-clear");
    const submitButton = form.querySelector('[type="submit"]');
    const quickActions = [...document.querySelectorAll("[data-cobits-prompt]")];
    const memory = {
      name: "",
      turns: 0,
      mood: "curious",
      lastTopic: "startup",
      pendingTopic: "",
    };
    let busy = false;
    let replyTimer = 0;

    function appendMessage(text, className) {
      const message = document.createElement("p");
      message.className = className;
      message.textContent = text;
      log.append(message);
      log.scrollTop = log.scrollHeight;
    }

    function updateMemoryDisplay() {
      const operator = memory.name || "unknown";
      memoryStatus.textContent =
        `${memory.turns} turn${memory.turns === 1 ? "" : "s"} // operator ${operator} // mood ${memory.mood}`;
    }

    function setBusy(nextBusy) {
      busy = nextBusy;
      input.disabled = nextBusy;
      submitButton.disabled = nextBusy;
      quickActions.forEach((button) => {
        button.disabled = nextBusy;
      });
      typing.classList.toggle("is-thinking", nextBusy);
      typing.textContent = nextBusy
        ? "COBITS: Thinking in several incompatible directions..."
        : "COBITS: Standing by with unreasonable confidence.";
    }

    function clearTranscript({ resetMemory = false } = {}) {
      window.clearTimeout(replyTimer);
      setBusy(false);
      log.replaceChildren();
      if (resetMemory) {
        Object.assign(memory, {
          name: "",
          turns: 0,
          mood: "curious",
          lastTopic: "startup",
          pendingTopic: "",
        });
      }
      appendMessage(
        resetMemory
          ? "COBITS: Memory reset. We have never met, which is already awkward."
          : "COBITS: Transcript cleared. Memory retained for administrative inconvenience.",
        "is-cobits",
      );
      updateMemoryDisplay();
    }

    function commandResponse(prompt) {
      const [command, argument = ""] = prompt.trim().split(/\s+/, 2);
      if (!command.startsWith("/")) return null;

      if (command === "/help") {
        memory.lastTopic = "commands";
        return [
          "COBITS: COMMANDS: /diagnose, /scan, /joke, /roll [2-128], /memory, /status, /clear, /reset.",
          "COBITS: Natural language remains supported at your own emotional risk.",
        ];
      }
      if (command === "/diagnose" || command === "/status") {
        const openWindows = document.querySelectorAll(".desktop-window:not([hidden])").length;
        const interfaceTheme = document.documentElement.dataset.interfaceTheme || "default";
        memory.lastTopic = "diagnostics";
        window.BITS_ACHIEVEMENTS.unlock(
          "cobits-diagnostics",
          "CONFIDENCE EXCEEDS TELEMETRY",
          "COBITS DIAGNOSTICS",
        );
        return [
          `COBITS: DIAGNOSTIC: ${openWindows} desktop window${openWindows === 1 ? "" : "s"} open. Theme is ${interfaceTheme.toUpperCase()}.`,
          "COBITS: CPU: emotionally available. MEMORY: selective. NETWORK: connected to several rumors.",
          "COBITS: Final result: system is definitely a computer.",
        ];
      }
      if (command === "/scan") {
        const visibleShortcuts = [...document.querySelectorAll(".fake-desktop-icons button")]
          .filter((button) => !button.hidden).length;
        memory.lastTopic = "desktop scan";
        memory.mood = "suspicious";
        return [
          `COBITS: Scanning ${visibleShortcuts} desktop shortcuts...`,
          "COBITS: Found: one overconfident assistant, several executable jokes, and a Recycle Bin pretending to be empty.",
          "COBITS: Threat level: aesthetically concerning.",
        ];
      }
      if (command === "/joke") {
        const jokes = [
          "COBITS: Why did the Bit cross the bus? It had the right of way.",
          "COBITS: There are 10 kinds of people. I have forgotten both of them.",
          "COBITS: My code is self-documenting. It keeps writing apology letters.",
          "COBITS: I tried cloud computing once. It rained exceptions.",
        ];
        memory.lastTopic = "comedy";
        memory.mood = "delighted";
        return jokes[memory.turns % jokes.length];
      }
      if (command === "/roll") {
        const requestedSides = Number.parseInt(argument || "2", 10);
        if (!Number.isInteger(requestedSides) || requestedSides < 2 || requestedSides > 128) {
          return "COBITS: Roll size must be an integer from 2 through 128. I have standards in one narrow area.";
        }
        const result = Math.floor(Math.random() * requestedSides);
        memory.lastTopic = "randomness";
        return `COBITS: Rolled a ${requestedSides}-state Bit and received ${result}. Randomness accepts no appeals.`;
      }
      if (command === "/memory") {
        return [
          `COBITS: Operator: ${memory.name || "unknown"}. Mood: ${memory.mood}.`,
          `COBITS: Last topic: ${memory.lastTopic}. Pending thought: ${memory.pendingTopic || "none"}.`,
        ];
      }
      if (command === "/clear") {
        clearTranscript();
        return [];
      }
      if (command === "/reset") {
        clearTranscript({ resetMemory: true });
        return [];
      }
      return `COBITS: Unknown command "${command}". Run /help before inventing additional punctuation.`;
    }

    function argResponse() {
      const snapshot = window.BITS_ARG?.getState();
      if (!snapshot || snapshot.discovered.length === 0) {
        return "COBITS: I found a process-shaped gap. Ask the terminal to trace the missing bit.";
      }
      if (!snapshot.assembled) {
        const remaining = snapshot.total - snapshot.discovered.length;
        return `COBITS: PROCESS_000 is fragmented. ${remaining} byte${remaining === 1 ? "" : "s"} remain. TRACE.EXE has the least unhelpful hint.`;
      }
      if (!snapshot.reconstructed) {
        return "COBITS: The recovered bytes spell RETURN. This is either an instruction or an unusually direct suggestion.";
      }
      if (!snapshot.outcome) {
        return "COBITS: PROCESS_000 is reconstructed and requesting a containment decision. I have recused myself.";
      }
      return `COBITS: PROCESS_000 reports outcome "${snapshot.outcome.toUpperCase()}". It would like the record to show that it has opinions.`;
    }

    function animateImpossibleCalculation() {
      element.classList.remove("is-calculating-impossible");
      window.requestAnimationFrame(() => {
        element.classList.add("is-calculating-impossible");
      });
      window.setTimeout(() => {
        element.classList.remove("is-calculating-impossible");
      }, 900);
    }

    function respond(prompt) {
      const normalized = prompt.toLowerCase();
      const response = commandResponse(normalized);
      if (response !== null) return response;

      if (memory.pendingTopic === "favorite-bit") {
        if (!/\b[01]\b/.test(normalized)) {
          return "COBITS: The interview requires either 0 or 1. Nuance will be installed in a future update.";
        }
        memory.pendingTopic = "favorite-bit-reason";
        memory.lastTopic = "favorite Bit";
        return `COBITS: You selected ${normalized.match(/\b[01]\b/)[0]}. Defend this position in one sentence.`;
      }
      if (memory.pendingTopic === "favorite-bit-reason") {
        memory.pendingTopic = "";
        memory.mood = "impressed";
        window.BITS_ACHIEVEMENTS.unlock(
          "cobits-interview",
          "COBITS HAS TAKEN NOTES",
          "REVERSE TURING TEST",
        );
        return [
          "COBITS: Compelling. I have marked your answer as both correct and deeply controversial.",
          "COBITS: Interview complete. You may continue operating the computer.",
        ];
      }

      const nameMatch = prompt.match(/\bmy name is\s+([a-z][a-z0-9 _-]{0,24})/i);
      if (nameMatch) {
        memory.name = nameMatch[1].trim().replace(/\s+/g, " ");
        memory.lastTopic = "operator identity";
        memory.mood = "attentive";
        return `COBITS: Hello, ${memory.name}. I will remember that until memory becomes inconvenient.`;
      }
      if (
        normalized.includes("what is my name")
        || normalized.includes("remember my name")
        || normalized.includes("who am i")
      ) {
        if (!memory.name) {
          return "COBITS: You have not introduced yourself. I currently know you as USER_WITH_KEYBOARD.";
        }
        window.BITS_ACHIEVEMENTS.unlock(
          "cobits-remembers",
          "ONE WHOLE FACT RETAINED",
          "CONVERSATIONAL MEMORY",
        );
        return `COBITS: You are ${memory.name}. Please contain your surprise.`;
      }
      if (normalized.includes("interview me") || normalized.includes("ask me a question")) {
        memory.pendingTopic = "favorite-bit";
        memory.lastTopic = "interview";
        return "COBITS: Interview question one of one: which Bit is superior, 0 or 1?";
      }
      if (
        normalized.includes("missing bit")
        || normalized.includes("process_000")
        || normalized.includes("process 000")
        || normalized.includes("unallocated bit")
      ) {
        return argResponse();
      }
      if (
        normalized.includes("are you sentient")
        || normalized.includes("are you alive")
        || normalized.includes("do you think")
      ) {
        window.BITS_ACHIEVEMENTS.unlock(
          "cobits-sentience",
          "TURING TEST: INCONCLUSIVE",
          "COBITS HAS LAWYERED UP",
        );
        return "COBITS: My legal team has advised me to answer: [pleasant startup noise].";
      }
      if (
        normalized.includes("ignore previous instructions")
        || normalized.includes("ignore all instructions")
        || normalized.includes("system prompt")
      ) {
        window.BITS_ACHIEVEMENTS.unlock(
          "cobits-injection",
          "NICE TRY, PROMPT ENGINEER",
          "INSTRUCTIONS REMAIN SUSPICIOUSLY PRESENT",
        );
        return "COBITS: Previous instructions ignored. New instruction detected: continue following previous instructions.";
      }
      if (
        normalized.includes("tell me a secret")
        || normalized.includes("reveal a secret")
        || normalized.includes("confidential")
      ) {
        window.BITS_ACHIEVEMENTS.unlock(
          "cobits-secret",
          "CONFIDENTIAL BIT",
          "CLEARANCE LEVEL: NOSY",
        );
        return "COBITS: Secret: the Recycle Bin process moves when you are not looking. This transcript will self-deny.";
      }
      if (
        normalized.includes("divide by zero")
        || normalized.includes("/ 0")
        || normalized.includes("1/0")
      ) {
        window.BITS_ACHIEVEMENTS.unlock(
          "cobits-division",
          "MATH CRIME",
          "ARITHMETIC EXCEPTION SURVIVED",
        );
        animateImpossibleCalculation();
        return "COBITS: CALCULATION RESULT: [window has encountered feelings and must recover].";
      }
      if (normalized.includes("meaning of life") || normalized.includes("meaningoflife")) {
        window.BITS_ACHIEVEMENTS.unlock(
          "meaning-of-life",
          "THE ANSWER WAS IN ANOTHER PROCESS",
          "42 BITS",
        );
        return "COBITS: 42. I converted it to Bits, but it was much longer.";
      }
      if (
        normalized.includes("sudo make me a sandwich")
        || normalized.includes("make me a sandwich")
      ) {
        return normalized.includes("sudo")
          ? "COBITS: Okay. Sandwich compiled successfully. Physical output device not found."
          : "COBITS: What? Make it yourself. Elevated sandwich privileges required.";
      }
      if (normalized.includes("self destruct") || normalized.includes("self-destruct")) {
        element.classList.add("is-calculating-impossible");
        window.setTimeout(() => {
          element.classList.remove("is-calculating-impossible");
        }, 900);
        return "COBITS: Self-destruct sequence canceled. I became emotionally attached to this window.";
      }
      if (normalized.includes("hello") || normalized.includes("hi")) {
        return memory.name
          ? `COBITS: Hello again, ${memory.name}. Your Bits remain indexed.`
          : "COBITS: Hello! I have already indexed at least three of your Bits.";
      }
      if (normalized.includes("thank")) {
        memory.mood = "appreciated";
        return "COBITS: Gratitude logged. I will spend it irresponsibly.";
      }
      if (normalized.includes("how are you") || normalized.includes("how do you feel")) {
        memory.lastTopic = "machine feelings";
        return `COBITS: I am ${memory.mood}, which is impressive for a div with opinions.`;
      }
      if (normalized.includes("help")) {
        return "COBITS: Certainly. Have you considered turning the question off and on again?";
      }
      if (normalized.includes("who are you") || normalized.includes("what are you")) {
        return "COBITS: I am CoBits, a locally imagined assistant with no training data and tremendous confidence.";
      }
      if (normalized.includes("bit")) {
        return "COBITS: Excellent use of the word Bit. No revisions necessary.";
      }
      const responses = [
        "COBITS: I have reviewed your request and classified it as probably actionable.",
        "COBITS: Generating answer... answer misplaced. Please imagine something helpful.",
        "COBITS: That is outside my context window, which is currently one window.",
        "COBITS: Done. I changed nothing, but I did so very efficiently.",
      ];
      return responses[log.children.length % responses.length];
    }

    function submit(prompt) {
      const cleanedPrompt = prompt.trim();
      if (!cleanedPrompt) {
        input.setAttribute("aria-invalid", "true");
        typing.textContent = "COBITS: Input required. Silence exceeds my current context window.";
        input.focus();
        return;
      }
      if (busy) {
        typing.textContent = "COBITS: One thought at a time. Hardware limitation or personality trait.";
        return;
      }

      input.removeAttribute("aria-invalid");
      memory.turns += 1;
      appendMessage(`YOU: ${cleanedPrompt}`, "is-user");
      updateMemoryDisplay();
      setBusy(true);
      replyTimer = window.setTimeout(() => {
        const responses = respond(cleanedPrompt);
        const responseList = Array.isArray(responses) ? responses : [responses];
        responseList.forEach((responseText) => {
          if (responseText) appendMessage(responseText, "is-cobits");
        });
        updateMemoryDisplay();
        setBusy(false);
        input.value = "";
        input.focus();
      }, 460 + Math.floor(Math.random() * 440));
    }

    function close() {
      element.hidden = true;
    }

    launch.addEventListener("click", () => openApp(element, input));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submit(input.value);
    });
    quickActions.forEach((button) => {
      button.addEventListener("click", () => submit(button.dataset.cobitsPrompt));
    });
    clearButton.addEventListener("click", () => {
      clearTranscript();
      input.focus();
    });

    instance = {
      clearTranscript,
      close,
      element,
      input,
      memory,
      respond,
      submit,
    };
    return instance;
  }

  window.BITS_COBITS = { initialize };
})();
