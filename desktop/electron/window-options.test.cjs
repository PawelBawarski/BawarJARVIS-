const test = require("node:test");
const assert = require("node:assert/strict");

const { createWindowOptions } = require("../electron/window-options.cjs");

test("should create a Jarvis desktop window", () => {
  const options = createWindowOptions();

  assert.equal(options.title, "J.A.R.V.I.S.");
  assert.equal(options.width, 1360);
  assert.equal(options.height, 860);
});

test("should support narrow windows", () => {
  const options = createWindowOptions();

  assert.equal(options.minWidth, 480);
});

test("should enable renderer security", () => {
  const options = createWindowOptions();

  assert.equal(options.webPreferences.nodeIntegration, false);

  assert.equal(options.webPreferences.contextIsolation, true);

  assert.equal(options.webPreferences.sandbox, true);
});
