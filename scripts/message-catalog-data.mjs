import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
export function messageCatalogDefaults() {
  const rows = [];
  const add = (profile, category, pool) => pool.forEach((entry) => {
    const option = typeof entry === "string" ? { text: entry, weight: 1 } : entry;
    rows.push({
      position: rows.length + 1, profile, category, text: option.text, weight: option.weight,
      colorful: option.colorful ?? false, format: option.format ?? {}, enabled: true,
    });
  });
  const context = vm.createContext({ window: {}, Date });
  vm.runInContext(read("shared/scripts/seasonal-calendar.js"), context);
  vm.runInContext(read("shared/scripts/messages.js"), context);
  vm.runInContext(read("shared/scripts/message-text.js"), context);
  vm.runInContext(read("shared/scripts/message-catalog.js"), context);
  for (const [category, global] of [["messages", "BITS_MESSAGES"], ["activities", "BITS_ACTIVITIES"], ["shutdownMessages", "BITS_SHUTDOWN_MESSAGES"]]) {
    add("standard", category, context.window[global]);
  }
  const registerProfiles = context.window.BITS_MESSAGE_CATALOG.registerProfiles;
  context.window.BITS_MESSAGE_CATALOG.start = () => {};
  context.window.BITS_MESSAGE_CATALOG.registerProfiles = (profiles) => {
      registerProfiles(profiles);
      profiles.forEach((profile) => {
        for (const key of ["messages", "activities", "bootMessages", "initialBootSteps", "shutdownMessages", "playingDeadMessages", "glitchMessages"]) {
          if (profile[key]) add(profile.id, key, profile[key]);
        }
        Object.entries(profile.monitorJokes ?? {}).forEach(([metric, pool]) => add(profile.id, `monitor.${metric}`, pool));
      });
  };
  vm.runInContext(read("shared/scripts/seasonal-messages.js"), context);
  const literal = (file, name, indent, kind = "array") => {
    const brackets = kind === "array" ? ["\\[", "\\]"] : ["\\{", "\\}"];
    const match = read(file).match(new RegExp(`const ${name} = (${brackets[0]}[\\s\\S]*?\\n${" ".repeat(indent)}${brackets[1]});`));
    if (!match) throw new Error(`Cannot locate ${name} in ${file}.`);
    return vm.runInNewContext(`(${match[1]})`);
  };
  add("standard", "initialBootSteps", literal("online/scripts/boot.js", "baseBootSteps", 2));
  add("standard", "bootMessages", literal("boot/scripts/endless-boot.js", "baseFixedMessages", 2));
  add("standard", "playingDeadMessages", literal("online/scripts/script.js", "basePlayingDeadMessages", 0));
  add("standard", "glitchMessages", literal("online/scripts/script.js", "baseGlitchMessages", 0));
  Object.entries(literal("online/scripts/content.js", "baseHardwareJokes", 0, "object"))
    .forEach(([metric, pool]) => add("standard", `monitor.${metric}`, pool));
  return JSON.parse(JSON.stringify(rows));
}
