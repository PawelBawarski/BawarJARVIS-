"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// This test requires the prepared stage17-4 resources used by stage17-5.
test("17.6.11 actual stage17-5 desktop build enables interactive NSIS installer", () => {
  const cfg = require(path.resolve(__dirname, "../../electron-builder.stage17-5.desktop.config.cjs"));
  assert.equal(cfg.nsis.oneClick, false);
  assert.equal(cfg.nsis.allowToChangeInstallationDirectory, true);
  assert.equal(cfg.nsis.runAfterFinish, true);
  assert.equal(cfg.nsis.perMachine, false);
  assert.equal(cfg.productName, "J.A.R.V.I.S.");
  assert.equal(cfg.nsis.deleteAppDataOnUninstall, false);
  assert.ok(cfg.extraResources.some(e => e.to === "llm"));
  assert.ok(cfg.extraResources.some(e => e.to === "postgres"));
});
