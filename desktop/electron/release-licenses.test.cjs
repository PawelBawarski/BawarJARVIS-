const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { stageLicenses } = require("../../scripts/stage-llm-licenses.cjs");

const root = path.resolve(__dirname, "../..");

const source = path.join(root, "desktop", "resources", "llm");

const files = [
  "QWEN3-8B-GGUF-LICENSE.txt",
  "LLAMA-CPP-LICENSE.txt",
  "THIRD-PARTY-NOTICES.txt",
];

test("Licencje są dostępne w projekcie", () => {
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(source, file)), `Brak pliku: ${file}`);
  }
});

test("Licencja Qwen zawiera Apache 2.0", () => {
  const content = fs.readFileSync(path.join(source, files[0]), "utf8");

  assert.match(content, /Apache License/i);
  assert.match(content, /Version 2\.0/i);
});

test("Licencja llama.cpp zawiera MIT", () => {
  const content = fs.readFileSync(path.join(source, files[1]), "utf8");

  assert.match(content, /MIT License/i);
  assert.match(content, /Copyright/i);
});

test("Atrybucje wymieniają oba projekty", () => {
  const content = fs.readFileSync(path.join(source, files[2]), "utf8");

  assert.match(content, /Qwen3-8B-GGUF/i);
  assert.match(content, /llama\.cpp/i);
});

function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-release-licenses-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const resources = path.join(temp, "desktop", "resources", "llm");
  fs.mkdirSync(resources, { recursive: true });
  fs.mkdirSync(path.join(temp, "desktop", "ai-runtime"), { recursive: true });
  for (const file of files) {
    fs.copyFileSync(path.join(source, file), path.join(resources, file));
  }
  return temp;
}

test("Staging zapisuje komplet licencji w licenses/ obsługiwanym przez oryginalny Release Gate", (t) => {
  const temp = fixture(t);
  const target = stageLicenses(temp);
  assert.equal(target, path.join(temp, "desktop", "ai-runtime", "licenses"));
  for (const file of files) {
    assert.deepEqual(fs.readFileSync(path.join(target, file)), fs.readFileSync(path.join(source, file)));
  }
  const combined = files.map(file => fs.readFileSync(path.join(target, file), "utf8")).join("\n");
  assert.match(combined, /Apache License/);
  assert.match(combined, /MIT License/);
  assert.match(combined, /Qwen/);
  assert.match(combined, /llama/);
});

test("Brak licencji blokuje staging przed zapisem niepełnego zestawu", (t) => {
  const temp = fixture(t);
  fs.unlinkSync(path.join(temp, "desktop", "resources", "llm", files[1]));
  assert.throws(() => stageLicenses(temp), /Brak licencji/);
  assert.equal(fs.existsSync(path.join(temp, "desktop", "ai-runtime", "licenses")), false);
});

test("Staging odmawia zapisu przez junction katalogu licenses", (t) => {
  const temp = fixture(t);
  const other = path.join(temp, "other");
  fs.mkdirSync(other);
  fs.symlinkSync(other, path.join(temp, "desktop", "ai-runtime", "licenses"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => stageLicenses(temp), /dowiązanie/);
  assert.deepEqual(fs.readdirSync(other), []);
});
