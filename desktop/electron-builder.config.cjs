module.exports = {
  appId: "dev.bawar.jarvis",
  productName: "J.A.R.V.I.S.",

  directories: {
    output: "release",
    buildResources: "build",
  },

  files: ["electron/**/*", "package.json"],

  extraResources: [
    {
      from: "../frontend/dist/jarvis/browser",
      to: "ui",
      filter: ["**/*"],
    },
  ],

  asar: true,

  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
    ],
    icon: "build/icon.svg",
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
    installerLanguages: ["pl_PL", "en_US"],
    multiLanguageInstaller: true,
    artifactName: "JARVIS-Setup-${version}-${arch}.${ext}",
  },
};
