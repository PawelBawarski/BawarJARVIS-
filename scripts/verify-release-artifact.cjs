"use strict";

// Static post-build checks only. Never starts the application, database or installer.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");
const { requiredFiles: licenses } = require("./stage-llm-licenses.cjs");

const requiredResources = [
  "ui/index.html", "java/bin/java.exe", "java/release",
  "backend/jarvis-backend.jar", "backend/stage17-2-manifest.json",
  "postgres/bin/postgres.exe", "postgres/bin/pg_ctl.exe", "postgres/bin/initdb.exe",
  "postgres/bin/pg_restore.exe", "postgres/share/postgres.bki", "postgres/stage17-3-manifest.json",
  "llm/bin/llama-server.exe", "llm/stage17-4-manifest.json",
];

function ensure(ok, message) {
  if (!ok) throw new Error(message);
}

function checkedPath(root, relative, allowMissing = false) {
  ensure(!path.isAbsolute(relative) && !relative.split(/[\\/]/).includes(".."), "Ścieżka poza katalogiem artefaktu.");
  const target = path.join(root, relative);
  let current = target;
  while (true) {
    try {
      ensure(!fs.lstatSync(current).isSymbolicLink(), "Niedozwolone dowiązanie w artefakcie.");
    } catch (error) {
      if (!allowMissing || error.code !== "ENOENT") throw error;
    }
    if (current === root) return target;
    const parent = path.dirname(current);
    ensure(parent !== current, "Ścieżka poza katalogiem artefaktu.");
    current = parent;
  }
}

function requiredFile(root, relative) {
  const target = checkedPath(root, relative);
  const stat = fs.statSync(target);
  ensure(stat.isFile() && stat.size > 0, `Brak niepustego pliku: ${relative}`);
  return target;
}

function digest(file) {
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(file, "r");
  const buffer = Buffer.alloc(4 * 1024 * 1024);
  try {
    let bytes;
    while ((bytes = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, bytes));
    return hash.digest("hex");
  } finally {
    fs.closeSync(fd);
  }
}

function forbidden(relative) {
  const value = relative.replaceAll("\\", "/").toLowerCase();
  return /(^|\/)(backend\.env|\.env(?:\.[^/]*)?|credentials\.json|state\.json|pg_version|pg_wal|jarvisdata|backups?)(\/|$)/.test(value)
    || /(^|\/)\.jarvis-[^/]*backups[^/]*(\/|$)/.test(value)
    || /\.(gguf(?:\.part[^/]*)?|dump|bak|backup)$/.test(value)
    || /\.test\.cjs$/.test(value);
}

function scanTree(root, relative = "") {
  const target = checkedPath(root, relative);
  ensure(!forbidden(relative), `Prywatne dane, model lub plik deweloperski w artefakcie: ${relative}`);
  if (fs.statSync(target).isDirectory()) {
    for (const name of fs.readdirSync(target)) scanTree(root, path.join(relative, name));
  }
}

function productionModules(root, relative = "desktop/electron") {
  const target = checkedPath(root, relative);
  return fs.readdirSync(target).flatMap((name) => {
    const rel = path.join(relative, name);
    const stat = fs.lstatSync(checkedPath(root, rel));
    if (stat.isDirectory()) return productionModules(root, rel);
    return name.endsWith(".cjs") && !name.endsWith(".test.cjs") ? [rel] : [];
  });
}

function verifyArtifact({ root = path.resolve(__dirname, ".."), asarImpl } = {}) {
  root = path.resolve(root);
  const pkg = JSON.parse(fs.readFileSync(requiredFile(root, "desktop/package.json"), "utf8"));
  ensure(pkg.name === "jarvis-desktop" && /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(pkg.version), "Nieprawidłowa wersja aplikacji.");
  const output = checkedPath(root, "dist/jarvis-17-5");
  const installerName = `J.A.R.V.I.S.-Setup-${pkg.version}-x64.exe`;
  const installers = fs.readdirSync(output).filter(name => /^J\.A\.R\.V\.I\.S\.-Setup-.*-x64\.exe$/i.test(name));
  ensure(installers.length === 1 && installers[0] === installerName, "Wymagany jeden instalator odpowiadający wersji desktop/package.json.");
  const installer = requiredFile(output, installerName);
  ensure(fs.statSync(installer).size < 2 * 1024 ** 3, "Instalator przekracza limit 2 GiB.");
  requiredFile(output, installerName + ".blockmap");
  requiredFile(output, "latest.yml");
  const unpacked = checkedPath(output, "win-unpacked");
  requiredFile(unpacked, "J.A.R.V.I.S.exe");
  for (const rel of requiredResources) requiredFile(unpacked, "resources/" + rel);
  ensure(fs.statSync(checkedPath(unpacked, "resources/java/legal/java.base")).isDirectory(), "Brak licencji Java.");
  scanTree(unpacked);

  // Compare to this checkout: a previous build must not pass with newer source files.
  const sourceMappings = [
    ["frontend/dist/jarvis/browser/index.html", "ui/index.html"],
    ...requiredResources.filter(rel => rel !== "ui/index.html" && !rel.startsWith("llm/")).map(rel => ["desktop/resources/" + rel, rel]),
    ["desktop/ai-runtime/bin/llama-server.exe", "llm/bin/llama-server.exe"],
    ["desktop/ai-runtime/stage17-4-manifest.json", "llm/stage17-4-manifest.json"],
    ...licenses.map(name => ["desktop/resources/llm/" + name, "llm/licenses/" + name]),
  ];
  for (const [source, packaged] of sourceMappings) {
    ensure(digest(requiredFile(root, source)) === digest(requiredFile(unpacked, "resources/" + packaged)), `Niezgodne źródło i artefakt: ${packaged}`);
  }
  const licenseText = licenses.map(name => fs.readFileSync(requiredFile(unpacked, "resources/llm/licenses/" + name), "utf8")).join("\n").toLowerCase();
  ensure(["apache license", "mit license", "qwen", "llama"].every(term => licenseText.includes(term)), "Niekompletne licencje zgodne z oryginalnym Release Gate.");

  const asar = asarImpl || createRequire(path.join(root, "desktop/package.json"))("@electron/asar");
  const archive = requiredFile(unpacked, "resources/app.asar");
  for (const entry of asar.listPackage(archive)) {
    const name = entry.replaceAll("\\", "/").replace(/^\//, "");
    ensure(!name.split("/").includes("..") && !forbidden(name), "Zabroniona zawartość app.asar.");
    ensure(!asar.statFile(archive, path.normalize(name), false).link, "Dowiązanie w app.asar.");
  }
  const bundledPackage = JSON.parse(asar.extractFile(archive, "package.json").toString("utf8"));
  ensure(bundledPackage.name === pkg.name && bundledPackage.version === pkg.version, "Nieaktualna wersja w app.asar.");
  const modules = productionModules(root);
  for (const required of ["main.cjs", "backend-runtime.cjs", "postgres-first-run.cjs", "postgres-runtime.cjs", "qwen-first-run.cjs", "qwen-runtime.cjs", "bundled-java.cjs"]) {
    ensure(modules.includes(path.join("desktop/electron", required)), `Brak modułu źródłowego: ${required}`);
  }
  for (const module of modules) {
    const rel = module.replaceAll("\\", "/").slice("desktop/".length);
    ensure(asar.extractFile(archive, path.normalize(rel)).equals(fs.readFileSync(requiredFile(root, module))), `Nieaktualny kod w app.asar: ${rel}`);
  }
  return {
    schema: "jarvis.17.5.build.v1", installer: installerName,
    size: fs.statSync(installer).size, sha256: digest(installer),
    model_bundled: false, github_release_upload_ready: false,
  };
}

function writeBuildManifest(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, ".."));
  const manifest = verifyArtifact({ ...options, root });
  const target = checkedPath(root, "dist/jarvis-17-5/stage17-5-build.json", true);
  fs.writeFileSync(target, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return manifest;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    let root = path.resolve(__dirname, "..");
    let write = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--write-manifest") write = true;
      else if (args[i] === "--root" && args[i + 1]) root = path.resolve(args[++i]);
      else throw new Error("Nieznany argument weryfikatora artefaktu.");
    }
    const result = write ? writeBuildManifest({ root }) : verifyArtifact({ root });
    console.log(`ARTIFACT_VERIFIED: ${result.installer}; SHA-256: ${result.sha256}`);
    console.log("Kontrola statyczna. Ręczne testy Windows, podpis i pełny Release Gate nadal wymagane.");
  } catch (error) {
    console.error("ARTIFACT_BLOCKED:", error.message);
    process.exitCode = 1;
  }
}

module.exports = { verifyArtifact, writeBuildManifest };
