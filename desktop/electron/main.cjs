const { registerWorkspaceIpc } = require('./workspace-access.cjs');
const { registerLabIpc } = require('./lab-ipc.cjs');
const { startPackagedBackend, stopPackagedBackend } = require('./backend-runtime.cjs');
const { startPackagedQwen, stopPackagedQwen } = require('./qwen-runtime.cjs');
const { startPackagedDatabase, stopPackagedDatabase } = require('./postgres-runtime.cjs');
const { registerChatIpc } = require('./chat-ipc.cjs');
const { registerAgentIpc } = require('./agent-proposal-ipc.cjs');
const { registerSandboxIpc } = require('./agent-sandbox-check.cjs'); // JARVIS_STAGE16_4_SANDBOX // JARVIS_STAGE16_PLANNER
const { registerProjectTestIpc } = require('./agent-project-test.cjs');
const { createDeploymentGate, registerWorkspaceApplyIpc } = require('./agent-workspace-apply.cjs'); // JARVIS_16_6_NATIVE_APPLY // JARVIS_STAGE16_5_PROJECT_TEST
const { registerResearchIpc, registerResearchOpenIpc } = require('./research-ipc.cjs');
const { checkInternet } = require('./connectivity.cjs');
const { shell } = require('electron');
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const {
  app,
  BrowserWindow,
  protocol,
  net,
  session,
  dialog,
  ipcMain,
} = require("electron");
const { createWindowOptions } = require("./window-options.cjs");
const { createRuntimeLifecycle } = require('./runtime-lifecycle.cjs');
const packagedRuntime = createRuntimeLifecycle({
  startDatabase: startPackagedDatabase,
  startQwen: startPackagedQwen,
  startBackend: startPackagedBackend,
  stopBackend: stopPackagedBackend,
  stopQwen: stopPackagedQwen,
  stopDatabase: stopPackagedDatabase,
});
const ownsInstanceLock = !app.isPackaged || app.requestSingleInstanceLock();
if (!ownsInstanceLock) app.quit();
app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows()[0];
  if (window) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
});

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

const { checkPrivateHealth } = require("./backend-bridge.cjs");

const { isTrustedSender } = require("./ipc-sender.cjs");

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
  .then(async () => {
    if (!ownsInstanceLock) return;
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

    // Rejestrujemy IPC tylko raz, przed stworzeniem okna.
    ipcMain.handle("jarvis:private-health", async (event) => {
      if (!isTrustedSender(event, useBuiltUi)) {
        throw new Error("Untrusted IPC sender");
      }

      return checkPrivateHealth(
        process.env.JARVIS_SESSION_TOKEN
      );
    });

    // Fixed, allowlisted connectivity and external-page actions.
    ipcMain.handle('jarvis:check-internet', async (event) => {
      if (!isTrustedSender(event, useBuiltUi)) throw new Error('Untrusted IPC sender');
      return checkInternet(net);
    });
    ipcMain.handle('jarvis:open-releases', async (event) => {
      if (!isTrustedSender(event, useBuiltUi)) throw new Error('Untrusted IPC sender');
      await shell.openExternal('https://github.com/PawelBawarski/BawarJARVIS-/releases');
      return true;
    });
    ipcMain.handle('jarvis:open-project', async (event) => {
      if (!isTrustedSender(event, useBuiltUi)) throw new Error('Untrusted IPC sender');
      await shell.openExternal('https://github.com/PawelBawarski/BawarJARVIS-');
      return true;
    });

    // Chat: fixed HTTP endpoints, validated sender, token only in Electron main.
    registerChatIpc(ipcMain, (event) => isTrustedSender(event, useBuiltUi));
    registerAgentIpc(ipcMain, (event) => isTrustedSender(event, useBuiltUi));
    registerSandboxIpc(ipcMain, (event) => isTrustedSender(event, useBuiltUi));
    const deploymentGate = createDeploymentGate({ userDataDir: app.getPath('userData'), dialog });
    registerProjectTestIpc(ipcMain, (event) => isTrustedSender(event, useBuiltUi), {
      userDataDir: app.getPath('userData'),
      onPassed: (request, sourceSha256) => deploymentGate.issueGrant(request, sourceSha256),
    });
    registerWorkspaceApplyIpc(ipcMain, (event) => isTrustedSender(event, useBuiltUi), deploymentGate);
    // JARVIS_15_RESEARCH_MEMORY - only fixed research operations and approved Wikimedia links.
    registerResearchIpc(ipcMain, (event) => isTrustedSender(event, useBuiltUi));
    registerResearchOpenIpc(ipcMain, (event) => isTrustedSender(event, useBuiltUi), shell);
    registerLabIpc(ipcMain, (event) => isTrustedSender(event, useBuiltUi));
    registerWorkspaceIpc(ipcMain, (event) => isTrustedSender(event, useBuiltUi), { dialog, userDataDir: app.getPath('userData') });
    // Desktop 11.5: the packaged Electron app owns its local Java process.
    if (app.isPackaged) {
      // Native first-run consent/setup precedes the main application window.
      try {
        await packagedRuntime.start({
          resourcesPath: process.resourcesPath,
          onUnexpectedExit: (message) => {
            if (!packagedRuntime.isStopping()) {
              dialog.showErrorBox('J.A.R.V.I.S. — Qwen', message);
              app.quit();
            }
          },
        });
      } catch (error) {
        if (!packagedRuntime.isStopping()) {
          dialog.showErrorBox('J.A.R.V.I.S. — Backend', String(error?.message || error));
        }
        app.quit();
        return;
      }
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

let shutdownComplete = false;
let shutdownPending = false;
app.on('before-quit', (event) => {
  if (!app.isPackaged || shutdownComplete) return;
  event.preventDefault();
  if (shutdownPending) return;
  shutdownPending = true;
  void packagedRuntime.stop()
    .then(() => { shutdownComplete = true; app.quit(); })
    .catch(() => {
      shutdownPending = false;
      dialog.showErrorBox('J.A.R.V.I.S. — zamykanie',
        'Nie potwierdzono zakończenia procesów aplikacji. Zachowano dane. Spróbuj zamknąć aplikację ponownie.');
    });
});
