"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");
const asar = createRequire(path.resolve(__dirname, "../desktop/package.json"))("@electron/asar");
const { verifyArtifact, writeBuildManifest } = require("./verify-release-artifact.cjs");

function write(root, relative, value = "fixture") {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}

async function fixture(t, mutateApp = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-artifact-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const output = path.join(root, "dist/jarvis-17-5");
  const unpacked = path.join(output, "win-unpacked");
  const app = path.join(root, "app");
  const pkg = JSON.stringify({ name: "jarvis-desktop", version: "1.0.3", main: "electron/main.cjs" });
  write(root, "desktop/package.json", pkg);
  write(app, "package.json", pkg);
  for (const module of ["main", "backend-runtime", "postgres-first-run", "postgres-runtime", "qwen-first-run", "qwen-runtime", "bundled-java"]) {
    write(root, `desktop/electron/${module}.cjs`, `// ${module} source`);
    write(app, `electron/${module}.cjs`, `// ${module} source`);
  }
  const resources = [
    "java/bin/java.exe", "java/release", "backend/jarvis-backend.jar", "backend/stage17-2-manifest.json",
    "postgres/bin/postgres.exe", "postgres/bin/pg_ctl.exe", "postgres/bin/initdb.exe", "postgres/bin/pg_restore.exe",
    "postgres/share/postgres.bki", "postgres/stage17-3-manifest.json",
  ];
  for (const rel of resources) {
    write(root, "desktop/resources/" + rel);
    write(unpacked, "resources/" + rel);
  }
  fs.mkdirSync(path.join(unpacked, "resources/java/legal/java.base"), { recursive: true });
  for (const rel of ["bin/llama-server.exe", "stage17-4-manifest.json"]) {
    write(root, "desktop/ai-runtime/" + rel);
    write(unpacked, "resources/llm/" + rel);
  }
  for (const [name, text] of [
    ["QWEN3-8B-GGUF-LICENSE.txt", "Qwen: Apache License Version 2.0"],
    ["LLAMA-CPP-LICENSE.txt", "llama.cpp: MIT License"],
    ["THIRD-PARTY-NOTICES.txt", "Qwen and llama.cpp notices"],
  ]) {
    write(root, "desktop/resources/llm/" + name, text);
    write(unpacked, "resources/llm/licenses/" + name, text);
  }
  write(root, "frontend/dist/jarvis/browser/index.html", "<html>UI</html>");
  write(unpacked, "resources/ui/index.html", "<html>UI</html>");
  write(unpacked, "J.A.R.V.I.S.exe", "MZ app fixture");
  write(output, "J.A.R.V.I.S.-Setup-1.0.3-x64.exe", "MZ NSIS fixture");
  write(output, "J.A.R.V.I.S.-Setup-1.0.3-x64.exe.blockmap");
  write(output, "latest.yml", "version: 1.0.3\n");
  mutateApp(app);
  await asar.createPackage(app, path.join(unpacked, "resources/app.asar"));
  return { root, output, unpacked, asarImpl: asar };
}

test("Post-build verifier writes the original gate's SHA/size manifest without approving publication", async (t) => {
  const f = await fixture(t);
  const result = writeBuildManifest(f);
  const installer = fs.readFileSync(path.join(f.output, result.installer));
  assert.equal(result.schema, "jarvis.17.5.build.v1");
  assert.equal(result.size, installer.length);
  assert.equal(result.sha256, crypto.createHash("sha256").update(installer).digest("hex"));
  assert.equal(result.model_bundled, false);
  assert.equal(result.github_release_upload_ready, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.output, "stage17-5-build.json"), "utf8")), result);
});

test("Read-only artifact verification does not create a manifest", async (t) => {
  const f = await fixture(t);
  verifyArtifact(f);
  assert.equal(fs.existsSync(path.join(f.output, "stage17-5-build.json")), false);
});

test("Missing artefacts block verification and never create a successful manifest", async (t) => {
  const f = await fixture(t);
  fs.unlinkSync(path.join(f.unpacked, "resources/postgres/bin/initdb.exe"));
  assert.throws(() => writeBuildManifest(f), /ENOENT/);
  assert.equal(fs.existsSync(path.join(f.output, "stage17-5-build.json")), false);
});

test("Root-only license files cannot replace the licenses/ tree required by the original gate", async (t) => {
  const f = await fixture(t);
  fs.renameSync(path.join(f.unpacked, "resources/llm/licenses/QWEN3-8B-GGUF-LICENSE.txt"), path.join(f.unpacked, "resources/llm/QWEN3-8B-GGUF-LICENSE.txt"));
  assert.throws(() => writeBuildManifest(f), /ENOENT/);
  assert.equal(fs.existsSync(path.join(f.output, "stage17-5-build.json")), false);
});

test("An installer with old ASAR code cannot be certified against newer source", async (t) => {
  const f = await fixture(t);
  write(f.root, "desktop/electron/backend-runtime.cjs", "// new source");
  assert.throws(() => writeBuildManifest(f), /Nieaktualny kod w app.asar/);
});

test("Stale packaged licenses are rejected", async (t) => {
  const f = await fixture(t);
  write(f.unpacked, "resources/llm/licenses/LLAMA-CPP-LICENSE.txt", "old licence");
  assert.throws(() => verifyArtifact(f), /Niezgodne źródło i artefakt/);
});

test("Secrets and model bytes in loose resources block the build manifest", async (t) => {
  for (const relative of ["resources/backend.env", "resources/llm/model.gguf", "resources/backups/chat.dump"]) {
    const f = await fixture(t);
    write(f.unpacked, relative, "test-only data");
    assert.throws(() => writeBuildManifest(f), /Prywatne dane, model lub plik deweloperski/);
    assert.equal(fs.existsSync(path.join(f.output, "stage17-5-build.json")), false);
  }
});

test("Secrets and development backups inside ASAR block the build manifest", async (t) => {
  for (const relative of ["backend.env", "electron/postgres-runtime.cjs.bak", "electron/unit.test.cjs"]) {
    const f = await fixture(t, app => write(app, relative, "test-only data"));
    assert.throws(() => writeBuildManifest(f), /Zabroniona zawartość app.asar/);
  }
});

test("A junction under unpacked resources is rejected", async (t) => {
  const f = await fixture(t);
  const outside = path.join(f.root, "outside");
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(f.unpacked, "resources/redirect"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => writeBuildManifest(f), /dowiązanie/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("An old installer version cannot produce a manifest for the current package", async (t) => {
  const f = await fixture(t);
  fs.renameSync(path.join(f.output, "J.A.R.V.I.S.-Setup-1.0.3-x64.exe"), path.join(f.output, "J.A.R.V.I.S.-Setup-1.0.2-x64.exe"));
  assert.throws(() => writeBuildManifest(f), /Wymagany jeden instalator/);
});

test("Updater artifacts are required after the build", async (t) => {
  const f = await fixture(t);
  fs.unlinkSync(path.join(f.output, "latest.yml"));
  assert.throws(() => writeBuildManifest(f), /ENOENT/);
});

test("Nested ASAR dependency paths are inspected with native Windows separators", async (t) => {
  const f = await fixture(t, app => {
    write(app, "node_modules/dependency/LICENSE", "test dependency license");
    write(app, "electron/nested/helper.cjs", "// nested production module");
  });
  write(f.root, "desktop/electron/nested/helper.cjs", "// nested production module");
  assert.doesNotThrow(() => verifyArtifact(f));
});
