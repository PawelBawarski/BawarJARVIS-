"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

if (process.platform !== "win32") {
  throw new Error("Wymagany Windows.");
}

const system32 = path.join(process.env.SystemRoot || "C:\\Windows", "System32");

function execute(name, args) {
  const result = spawnSync(path.join(system32, name), args, {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
  });

  return result;
}

const identity = execute("whoami.exe", ["/user", "/fo", "csv", "/nh"]);

const sid = identity.stdout?.match(/S-1-(?:\d+-){2,}\d+/)?.[0];

if (!sid) {
  throw new Error("Nie mozna odczytac SID uzytkownika.");
}

function testAcl(name, commands) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-acl-test-"));

  console.log(`\n=== ${name} ===`);

  try {
    for (const args of commands(dir)) {
      const result = execute("icacls.exe", args);

      console.log("EXIT:", result.status);
      console.log("STDOUT:", result.stdout.trim());
      console.log("STDERR:", result.stderr.trim());

      if (result.error) {
        console.log("ERROR:", result.error.code);
      }

      if (result.status !== 0) {
        break;
      }
    }
  } finally {
    try {
      fs.rmSync(dir, {
        recursive: true,
        force: true,
      });
    } catch {
      console.log("WARN: Nie udalo sie usunac katalogu testowego.");
    }
  }
}

testAcl("OBECNA IMPLEMENTACJA", (dir) => [
  [dir, "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)F`],
]);

testAcl("ALTERNATYWNA KOLEJNOSC", (dir) => [
  [dir, "/grant:r", `*${sid}:(OI)(CI)F`],
  [dir, "/inheritance:r"],
]);
