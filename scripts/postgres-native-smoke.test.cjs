"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { cleanEnvironment, ownedTempPath, cleanupTemp } = require("./postgres-native-smoke.cjs");

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(path.resolve(os.tmpdir()), "jarvis-pg-native-smoke-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const token = crypto.randomUUID();
  fs.writeFileSync(path.join(directory, ".jarvis-native-smoke.json"), JSON.stringify({
    schema: "jarvis.pg.native-smoke.v1", token, pid: process.pid,
  }));
  fs.writeFileSync(path.join(directory, "sentinel"), "test-only");
  return { directory, token };
}

test("Native smoke removes inherited PostgreSQL and application DB settings case-insensitively", () => {
  const env = cleanEnvironment({ SystemRoot: "C:\\Windows", PATH: "safe-path", PGHOST: "old-host",
    pgpassword: "test-only", JARVIS_DB_PASSWORD: "test-only", PGOPTIONS: "old-options",
    SPRING_DATASOURCE_PASSWORD: "test-only", DATABASE_URL: "old-database",
    SPRING_CONFIG_LOCATION: "old-config", JAVA_TOOL_OPTIONS: "old-options", JDK_JAVA_OPTIONS: "old-options",
    _JAVA_OPTIONS: "old-options", SERVER_PORT: "8080", LOGGING_LEVEL_ROOT: "DEBUG" });
  assert.deepEqual(env, { SystemRoot: "C:\\Windows", PATH: "safe-path" });
});

test("Native smoke cannot clean its own temporary data without confirmed stop", (t) => {
  const f = fixture(t);
  assert.throws(() => cleanupTemp(f.directory, f.token, false), { code: "STOP_NOT_CONFIRMED" });
  assert.equal(fs.existsSync(path.join(f.directory, "sentinel")), true);
});

test("Native smoke rejects a foreign ownership marker before cleanup", (t) => {
  const f = fixture(t);
  assert.throws(() => cleanupTemp(f.directory, "different-owner", true), { code: "TEMP_MARKER_REFUSED" });
  assert.equal(fs.existsSync(path.join(f.directory, "sentinel")), true);
});

test("Native smoke refuses cleanup outside a direct temporary child", (t) => {
  const f = fixture(t);
  const child = path.join(f.directory, "jarvis-pg-native-smoke-nested");
  fs.mkdirSync(child);
  assert.throws(() => ownedTempPath(child, f.token, true), { code: "TEMP_SCOPE_REFUSED" });
  assert.equal(fs.existsSync(path.join(f.directory, "sentinel")), true);
});

test("Native smoke removes only its marked temporary directory after stop", (t) => {
  const f = fixture(t);
  cleanupTemp(f.directory, f.token, true);
  assert.equal(fs.existsSync(f.directory), false);
});
