const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const { createUpdateManager } = require("../electron/updates.cjs");

function createFakeUpdater() {
  const updater = new EventEmitter();

  updater.checkForUpdates = async () => ({
    updateInfo: { version: "1.0.1" },
  });

  updater.downloadUpdate = async () => {
    updater.downloadCalled = true;
  };

  updater.quitAndInstall = () => {
    updater.installCalled = true;
  };

  return updater;
}

test("should check GitHub for updates", async () => {
  const updater = createFakeUpdater();

  let checks = 0;

  updater.checkForUpdates = async () => {
    checks++;
  };

  const manager = createUpdateManager({
    updater,
    dialog: {},
    window: {},
    locale: "pl",
  });

  await manager.check();

  assert.equal(checks, 1);
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
});

test("should download accepted update", async () => {
  const updater = createFakeUpdater();

  createUpdateManager({
    updater,
    dialog: {
      showMessageBox: async () => ({
        response: 0,
      }),
    },
    window: {},
    locale: "pl",
  });

  updater.emit("update-available", {
    version: "1.0.1",
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(updater.downloadCalled, true);
});

test("should not download declined update", async () => {
  const updater = createFakeUpdater();

  createUpdateManager({
    updater,
    dialog: {
      showMessageBox: async () => ({
        response: 1,
      }),
    },
    window: {},
    locale: "en",
  });

  updater.emit("update-available", {
    version: "1.0.1",
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(updater.downloadCalled, undefined);
});

test("should install downloaded update after consent", async () => {
  const updater = createFakeUpdater();

  createUpdateManager({
    updater,
    dialog: {
      showMessageBox: async () => ({
        response: 0,
      }),
    },
    window: {},
    locale: "pl",
  });

  updater.emit("update-downloaded", {
    version: "1.0.1",
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(updater.installCalled, true);
});
