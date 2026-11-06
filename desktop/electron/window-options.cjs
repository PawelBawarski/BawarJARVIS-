function createWindowOptions() {
  return {
    title: "J.A.R.V.I.S.",
    width: 1360,
    height: 860,
    minWidth: 480,
    minHeight: 420,
    center: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#090e19",

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
    },
  };
}

module.exports = { createWindowOptions };
