import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const context = { window: {} };
vm.runInNewContext(readFileSync(new URL("../shared/scripts/boot-message-generator.js", import.meta.url), "utf8"), context);
const generator = context.window.BITS_BOOT_MESSAGE_GENERATOR;

test("Boot combinations reflect the actual immutable action, subject, and result pools", () => {
  assert.equal(generator.actions.length, 29);
  assert.equal(generator.subjects.length, 37);
  assert.equal(generator.results.length, 30);
  assert.equal(generator.combinations, 32190);
  for (const part of [generator, generator.actions, generator.subjects, generator.results]) {
    assert.ok(Object.isFrozen(part));
  }
});

test("All reported boot combinations are reachable and preserve the original line formatting", () => {
  const messages = new Set();
  for (let subject = 0; subject < generator.subjects.length; subject++) {
    for (let action = 0; action < generator.actions.length; action++) {
      for (let result = 0; result < generator.results.length; result++) {
        const values = [(subject + 0.5) / generator.subjects.length,
          (action + 0.5) / generator.actions.length, (result + 0.5) / generator.results.length];
        let draws = 0;
        const message = generator.generate(() => values[draws++]);
        assert.equal(draws, 3);
        const dots = ".".repeat(Math.max(3, 39 - generator.actions[action].length - generator.subjects[subject].length));
        assert.equal(message, `${generator.actions[action]} ${generator.subjects[subject]} ${dots} ${generator.results[result]}`);
        messages.add(message);
      }
    }
  }
  assert.equal(messages.size, generator.combinations);
});

test("Generator accepts both ends of the random range without undefined pieces", () => {
  assert.equal(generator.generate(() => 0), "ALLOCATE avatar.service ................. OK");
  assert.match(generator.generate(() => 0.999999), /^WAKE BitsofBits \.+ DOCUMENTATION UNCLEAR$/);
});
