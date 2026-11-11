"use strict";
/** J.A.R.V.I.S. 17.5: small, updateable Windows installer.
 * Qwen's multi-GB GGUF is stored separately in the user's LOCALAPPDATA.
 * NEVER bundle the PostgreSQL data cluster, passwords or chat backups.
 */
const base = require("./electron-builder.stage17-4.config.cjs");

function isRecord(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}
function normal(v) {
  return String(v ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/$/, "");
}
function badPath(v) {
  const s = normal(v).toLowerCase();
  return /(^|\/)(backend\.env|credentials\.json|state\.json|pg_wal|postgres17\/data)(\/|$)/.test(
    s,
  );
}
if (!isRecord(base) || !isRecord(base.win) || !isRecord(base.nsis)) {
  throw new Error("17.5: nieobsługiwana bazowa konfiguracja electron-builder.");
}
if (
  base.appId == null ||
  typeof base.appId !== "string" ||
  !base.appId.trim()
) {
  throw new Error(
    "17.5: wymagany stabilny appId — nie zmieniam tożsamości aplikacji przy aktualizacji.",
  );
}
if (base.productName !== "J.A.R.V.I.S.") {
  throw new Error(
    "17.5: productName nie jest J.A.R.V.I.S. — zmiana nazwy grozi utratą spójności aktualizacji.",
  );
}
if (base.nsis.deleteAppDataOnUninstall === true) {
  throw new Error(
    "17.5: obecna konfiguracja usuwa userData przy odinstalowaniu.",
  );
}
if (base.nsis.script || base.nsis.include) {
  // A custom installer script can override data retention and update rules.
  throw new Error(
    "17.5: niestandardowy skrypt NSIS wymaga osobnego przeglądu.",
  );
}
if (
  base.extraFiles &&
  JSON.stringify(base.extraFiles).match(
    /backend\.env|credentials\.json|postgres17[\\/]data/i,
  )
) {
  throw new Error("17.5: extraFiles mogą zawierać sekrety lub bazę danych.");
}
const extras = Array.isArray(base.extraResources) ? base.extraResources : [];
const llm = extras.filter(
  (item) => isRecord(item) && normal(item.to) === "llm",
);
if (llm.length !== 1 || normal(llm[0].from) !== "desktop/ai-runtime") {
  throw new Error("17.5: niejednoznaczne źródło Qwen z etapu 17.4.");
}
if (extras.some((e) => isRecord(e) && badPath(e.from))) {
  throw new Error("17.5: zasoby instalatora wskazują na prywatne dane.");
}
if (
  extras.some(
    (e) =>
      isRecord(e) &&
      e !== llm[0] &&
      (/\.gguf($|\/)/i.test(normal(e.from)) ||
        normal(e.from).startsWith("desktop/ai-runtime")),
  )
) {
  throw new Error(
    "17.5: drugie mapowanie modelu AI — instalator przekroczyłby limit rozmiaru.",
  );
}
if (
  extras.some(
    (e) =>
      isRecord(e) && normal(e.to).startsWith("llm/") && normal(e.to) !== "llm",
  )
) {
  throw new Error("17.5: dodatkowe mapowanie zasobów AI wymaga przeglądu.");
}
if (base.publish != null) {
  const pubs = Array.isArray(base.publish) ? base.publish : [base.publish];
  if (
    pubs.some(
      (p) =>
        !isRecord(p) ||
        p.provider !== "github" ||
        p.owner !== "PawelBawarski" ||
        p.repo !== "BawarJARVIS-",
    )
  ) {
    throw new Error(
      "17.5: bazowa konfiguracja wskazuje inny kanał aktualizacji.",
    );
  }
}
const additions = [
  "!**/backend.env",
  "!**/credentials.json",
  "!**/state.json",
  "!**/.env",
  "!**/.env.*",
  "!**/.jarvis-stage17-*-backups/**",
  "!**/backups/**",
  "!**/*.bak",
  "!**/*.backup",
  "!**/*.dump",
  "!**/*.test.cjs",
  "!**/postgres17/data/**",
  "!**/pg_wal/**",
  "!**/*.gguf",
  "!**/*.gguf.part*",
];
const files =
  base.files == null
    ? ["**/*", ...additions]
    : Array.isArray(base.files)
      ? [...base.files, ...additions]
      : typeof base.files === "string"
        ? [base.files, ...additions]
        : (() => {
            throw new Error("17.5: nieobsługiwany format files w builderze.");
          })();

module.exports = {
  ...base,
  directories: { ...(base.directories || {}), output: "dist/jarvis-17-5" },
  files,
  extraResources: [
    ...extras.filter((x) => x !== llm[0]),
    {
      from: "desktop/ai-runtime",
      to: "llm",
      filter: [
        "bin/**/*",
        "stage17-4-manifest.json",
        "licenses/**/*",
        "LICENSE*",
        "THIRD_PARTY_NOTICES*",
        "QWEN3-8B-GGUF-LICENSE.txt",
        "LLAMA-CPP-LICENSE.txt",
        "THIRD-PARTY-NOTICES.txt",
      ],
    },
  ],
  win: { ...base.win, target: [{ target: "nsis", arch: ["x64"] }] },
  nsis: {
    ...base.nsis,
    oneClick: true,
    perMachine: false,
    deleteAppDataOnUninstall: false,
    runAfterFinish: false,
    createDesktopShortcut: true,
    artifactName: "J.A.R.V.I.S.-Setup-${version}-x64.${ext}",
  },
  publish: [
    { provider: "github", owner: "PawelBawarski", repo: "BawarJARVIS-" },
  ],
};
