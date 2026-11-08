const path = require("node:path");
const { pathToFileURL } = require("node:url");

const {
  app,
  BrowserWindow,
  protocol,
  net,
  session,
  dialog,
} = require("electron");
const { createWindowOptions } = require("./window-options.cjs");

const { resolveUiAsset } = require("./asset-path.cjs");
const { autoUpdater } = require("electron-updater");
const { createUpdateManager } = require("./updates.cjs");

const DEV_URL = "http://127.0.0.1:4200/";

const APP_URL = "jarvis://app/index.html";

const useBuiltUi = app.isPackaged || process.argv.includes("--preview");

const { withUiSecurityHeaders } = require("./security-policy.cjs");
// Rejestrujemy protokół przed uruchomieniem Electrona.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "jarvis",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);

function getUiDirectory() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "ui");
  }

  return path.resolve(__dirname, "../../frontend/dist/jarvis/browser");
}

function registerUiProtocol() {
  const uiDirectory = getUiDirectory();

  protocol.handle("jarvis", async (request) => {
    const assetPath = resolveUiAsset(uiDirectory, request.url);

    if (!assetPath || request.method !== "GET") {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const response = await net.fetch(pathToFileURL(assetPath).toString());

      return withUiSecurityHeaders(response);
    } catch (error) {
      console.error("Cannot load UI asset:", error);

      return new Response("Not Found", { status: 404 });
    }
  });
}

function createWindow() {
  const window = new BrowserWindow(createWindowOptions());

  // Nie pozwalamy tworzyć dodatkowych okien.
  window.webContents.setWindowOpenHandler(() => ({
    action: "deny",
  }));

  window.webContents.on("will-navigate", (event, navigationUrl) => {
    try {
      const target = new URL(navigationUrl);

      const isAllowed = useBuiltUi
        ? target.protocol === "jarvis:" && target.host === "app"
        : target.origin === new URL(DEV_URL).origin;

      if (!isAllowed) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  window.webContents.on("did-fail-load", (_event, code, description, url) => {
    console.error(`Failed to load ${url}: ${code} ${description}`);
  });

  if (useBuiltUi) {
    window.loadURL(APP_URL);
  } else {
    window.loadURL(DEV_URL);
  }
  return window;
}

app
  .whenReady()
  .then(() => {
    // Na razie nie udzielamy uprawnień systemowych.
    // Obsługę mikrofonu dodamy w lekcji o głosie.
    session.defaultSession.setPermissionRequestHandler(
      (_webContents, _permission, callback) => {
        callback(false);
      },
    );

    if (useBuiltUi) {
      registerUiProtocol();
    }

    const jarvisWindow = createWindow();

    // Aktualizacje uruchamiamy tylko w zainstalowanej aplikacji.
    if (app.isPackaged) {
      const updateManager = createUpdateManager({
        updater: autoUpdater,
        dialog,
        window: jarvisWindow,
        locale: app.getLocale(),
      });

      // Pierwsze sprawdzenie po 15 sekundach.
      const initialCheck = setTimeout(() => {
        void updateManager.check();
      }, 15_000);

      // Kolejne sprawdzenie co 6 godzin.
      const periodicCheck = setInterval(
        () => {
          void updateManager.check();
        },
        6 * 60 * 60 * 1000,
      );

      // Sprzątamy timery przy zamykaniu aplikacji.
      app.once("before-quit", () => {
        clearTimeout(initialCheck);
        clearInterval(periodicCheck);
      });
    }

    // Obsługa ponownego otwarcia okna.
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })
  .catch((error) => {
    console.error("Electron startup failed:", error);
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
