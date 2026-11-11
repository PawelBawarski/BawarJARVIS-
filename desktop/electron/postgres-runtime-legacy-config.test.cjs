"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { locations } = require("./postgres-runtime.cjs");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-pg-regression-"));

  t.after(() => {
    fs.rmSync(root, {
      recursive: true,
      force: true,
    });
  });

  const resourcesPath = path.join(root, "resources");
  const appData = path.join(root, "AppData");

  const appDir = path.join(appData, "JarvisData");

  const stateDir = path.join(appDir, "postgres17");

  const envFile = path.join(appDir, "backend.env");

  fs.mkdirSync(resourcesPath, { recursive: true });
  fs.mkdirSync(appDir, { recursive: true });

  return {
    resourcesPath,
    appData,
    appDir,
    stateDir,
    envFile,
  };
}

function resolveDatabase(f) {
  return locations(f.resourcesPath, { APPDATA: f.appData }, fs, "win32");
}

test("17.6.6 rejects legacy backend.env without cluster", (t) => {
  const f = fixture(t);

  fs.writeFileSync(f.envFile, "LEGACY_CONFIGURATION=1\n");

  assert.throws(() => resolveDatabase(f), /JARVIS_LEGACY_DB_CONFIG/);

  assert.ok(fs.existsSync(f.envFile));
  assert.ok(!fs.existsSync(f.stateDir));
});

test("17.6.6 detects missing first-run database", (t) => {
  const f = fixture(t);

  assert.throws(() => resolveDatabase(f), /JARVIS_DB_NOT_INITIALIZED/);

  assert.ok(!fs.existsSync(f.stateDir));
});

test("17.6.6 preserves incomplete PostgreSQL state", (t) => {
  const f = fixture(t);

  fs.mkdirSync(f.stateDir);

  fs.writeFileSync(f.envFile, "JARVIS_DB_HOST=127.0.0.1\n");

  assert.throws(
    () => resolveDatabase(f),
    /Brak dołączonego PostgreSQL 17 lub klastra danych/,
  );

  assert.ok(fs.existsSync(f.stateDir));
  assert.ok(fs.existsSync(f.envFile));
});
