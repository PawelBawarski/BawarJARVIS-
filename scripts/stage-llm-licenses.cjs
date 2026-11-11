"use strict";

const fs = require("node:fs");
const path = require("node:path");

const requiredFiles = [
  "QWEN3-8B-GGUF-LICENSE.txt",
  "LLAMA-CPP-LICENSE.txt",
  "THIRD-PARTY-NOTICES.txt",
];

function noLinks(root, target) {
  let current = target;
  while (true) {
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new Error("Niedozwolone dowiązanie w ścieżce licencji.");
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (current === root) return;
    const parent = path.dirname(current);
    if (parent === current) throw new Error("Ścieżka licencji poza repozytorium.");
    current = parent;
  }
}

function stageLicenses(root = path.resolve(__dirname, "..")) {
  root = path.resolve(root);
  const source = path.join(root, "desktop", "resources", "llm");
  const runtime = path.join(root, "desktop", "ai-runtime");
  const target = path.join(runtime, "licenses");
  noLinks(root, target);
  if (!fs.existsSync(runtime) || !fs.statSync(runtime).isDirectory()) {
    throw new Error("Brak desktop/ai-runtime. Najpierw przygotuj zasoby etapu 17.4.");
  }

  // Validate the complete set before changing the generated staging directory.
  const contents = requiredFiles.map((file) => {
    const from = path.join(source, file);
    noLinks(root, from);
    noLinks(root, path.join(target, file));
    if (!fs.existsSync(from) || !fs.statSync(from).isFile()) {
      throw new Error(`Brak licencji: ${file}`);
    }
    const content = fs.readFileSync(from);
    if (content.length === 0) throw new Error(`Pusty plik: ${file}`);
    return { file, content };
  });
  fs.mkdirSync(target, { recursive: true });
  for (const { file, content } of contents) {
    const to = path.join(target, file);
    fs.writeFileSync(to, content);
    if (!fs.readFileSync(to).equals(content)) {
      throw new Error(`Błąd kopiowania: ${file}`);
    }
  }
  return target;
}

if (require.main === module) {
  stageLicenses();
  console.log("LLM_LICENSES_READY: licenses/");
}

module.exports = { stageLicenses, requiredFiles };
