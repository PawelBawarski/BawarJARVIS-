const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const config = require("../electron-builder.config.cjs");

const projectRoot = path.resolve(__dirname, "..");

test("should configure Windows NSIS installer", () => {
  assert.equal(config.productName, "J.A.R.V.I.S.");
  assert.equal(config.win.target[0].target, "nsis");
  assert.equal(config.nsis.oneClick, false);
  assert.equal(config.nsis.allowToChangeInstallationDirectory, true);
});

test("should include Angular in application resources", () => {
  const ui = config.extraResources.find((resource) => resource.to === "ui");

  assert.ok(ui);
  assert.equal(ui.from, "../frontend/dist/jarvis/browser");
});

test("should contain both installer licenses", () => {
  for (const language of ["pl", "en"]) {
    const licensePath = path.join(
      projectRoot,
      "build",
      `license_${language}.txt`,
    );

    assert.equal(fs.existsSync(licensePath), true);
  }
});

test("should contain the Jarvis icon", () => {
  const iconPath = path.join(projectRoot, config.win.icon);

  assert.equal(fs.existsSync(iconPath), true);
});
