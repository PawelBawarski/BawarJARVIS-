"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { pathsFor } = require("./postgres-first-run.cjs");

const { locations } = require("./postgres-runtime.cjs");
const { configPath } = require("./backend-runtime.cjs");

test("17.6.9 uses Windows-compatible data paths", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-path-test-"));

  t.after(() => {
    fs.rmSync(root, {
      recursive: true,
      force: true,
    });
  });

  const resourcesPath = path.join(root, "resources");
  const env = { APPDATA: root };

  const p = pathsFor(resourcesPath, env, fs, "win32");

  assert.equal(path.basename(p.appDir), "JarvisData");

  assert.equal(p.stateDir, path.join(root, "JarvisData", "postgres17"));
  assert.equal(p.envFile, configPath(env));

  assert.ok(!path.basename(p.appDir).endsWith("."));

  assert.throws(
    () => locations(resourcesPath, env, fs, "win32"),
    /JARVIS_DB_NOT_INITIALIZED/,
  );
});
