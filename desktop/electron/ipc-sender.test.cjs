const test = require("node:test");
const assert = require("node:assert/strict");
const { isTrustedSender } = require("./ipc-sender.cjs");

function eventFor(origin) {
  const frame = { origin };
  return { senderFrame: frame, sender: { mainFrame: frame } };
}

test("accepts the packaged app main frame", () => {
  assert.equal(isTrustedSender(eventFor("jarvis://app"), true), true);
});

test("rejects web origins in packaged mode", () => {
  assert.equal(isTrustedSender(eventFor("https://example.com"), true), false);
});

test("rejects non-main frames", () => {
  const event = eventFor("jarvis://app");
  event.sender.mainFrame = { origin: "jarvis://app" };
  assert.equal(isTrustedSender(event, true), false);
});

test("accepts only Angular dev origin in dev mode", () => {
  assert.equal(isTrustedSender(eventFor("http://127.0.0.1:4200"), false), true);
  assert.equal(isTrustedSender(eventFor("http://localhost:4200"), false), false);
});
