function createUpdateManager({ updater, dialog, window, locale = "pl" }) {
  const isPolish = locale.toLowerCase().startsWith("pl");

  let checking = false;
  let prompting = false;
  let downloading = false;

  updater.autoDownload = false;

  // electron-updater v6:
  // nie instaluj aktualizacji bez zgody przy zamykaniu.
  updater.autoInstallOnAppQuit = false;

  async function check() {
    if (checking || prompting || downloading) {
      return;
    }

    checking = true;

    try {
      await updater.checkForUpdates();
    } catch (error) {
      console.error("[JARVIS] Update check failed:", error);
    } finally {
      checking = false;
    }
  }

  updater.on("update-available", async (info) => {
    if (prompting || downloading) {
      return;
    }

    prompting = true;

    try {
      const result = await dialog.showMessageBox(window, {
        type: "info",
        title: "J.A.R.V.I.S.",
        message: isPolish
          ? `Dostępna jest wersja ${info.version}`
          : `Version ${info.version} is available`,
        detail: isPolish
          ? "Czy chcesz pobrać aktualizację?"
          : "Would you like to download the update?",
        buttons: isPolish ? ["Pobierz", "Później"] : ["Download", "Later"],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });

      if (result.response === 0) {
        downloading = true;

        try {
          await updater.downloadUpdate();
        } finally {
          downloading = false;
        }
      }
    } catch (error) {
      console.error("[JARVIS] Update download failed:", error);
    } finally {
      prompting = false;
    }
  });

  updater.on("update-downloaded", async (info) => {
    try {
      const result = await dialog.showMessageBox(window, {
        type: "question",
        title: "J.A.R.V.I.S.",
        message: isPolish
          ? `Wersja ${info.version} jest gotowa`
          : `Version ${info.version} is ready`,
        detail: isPolish
          ? "Zainstalować i uruchomić Jarvisa ponownie?"
          : "Install and restart Jarvis now?",
        buttons: isPolish ? ["Zainstaluj", "Później"] : ["Install", "Later"],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });

      if (result.response === 0) {
        updater.quitAndInstall(false, true);
      }
    } catch (error) {
      console.error("[JARVIS] Update installation error:", error);
    }
  });

  updater.on("error", (error) => {
    console.error("[JARVIS] Auto-updater error:", error);
  });

  return { check };
}

module.exports = { createUpdateManager };
