"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { stopOwnedChild } = require("./backend-native-smoke.cjs");

test("Native backend smoke waits for its own Java exit after requesting stop", async () => {
  const child = new EventEmitter();
  child.killed = false;
  let kills = 0;
  child.kill = () => { child.killed = true; kills++; };
  let stopped = false;
  const pending = stopOwnedChild(child, 1000).then(() => { stopped = true; });
  await Promise.resolve();
  assert.equal(stopped, false);
  assert.equal(kills, 1);
  child.emit("exit", 0);
  await pending;
  assert.equal(stopped, true);
});

test("A successful kill request without exit cannot certify stopped Java", async () => {
  const child = new EventEmitter();
  child.kill = () => true;
  await assert.rejects(stopOwnedChild(child, 20), error =>
    error.code === "JAVA_STOP_UNCONFIRMED" && error.javaStoppedConfirmed === false);
});

test("An already exited Java child is not killed again", async () => {
  const child = new EventEmitter();
  child.exitCode = 0;
  child.kill = () => assert.fail("Exited process must not be killed");
  await stopOwnedChild(child);
});
