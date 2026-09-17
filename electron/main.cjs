const { app, BrowserWindow, clipboard, ipcMain, Notification, shell } = require("electron");
const path = require("path");
const { analyze, slugFromUrl } = require("./market.cjs");
const { createSniper } = require("./sniper.cjs");

let sniper;

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: "#08111e",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) window.loadURL(devUrl);
  else window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("market:analyze", (_event, url) => analyze(url));
  ipcMain.handle("market:sniper-list", () => sniper.list());
  ipcMain.handle("market:sniper-add", (_event, watch) => sniper.add(watch));
  ipcMain.handle("market:sniper-remove", (_event, id) => sniper.remove(id));
  ipcMain.handle("market:open", (_event, url) => { slugFromUrl(url); return shell.openExternal(url); });
  ipcMain.handle("market:copy", (_event, text) => clipboard.writeText(String(text).slice(0, 4000)));
  sniper = createSniper({
    storagePath: path.join(app.getPath("userData"), "sniper-watches.json"),
    notify: (title, body) => { new Notification({ title: `Deal found: ${title}`, body }).show(); shell.beep(); },
    publish: (watches) => BrowserWindow.getAllWindows().forEach((window) => window.webContents.send("market:sniper-update", watches)),
  });
  createWindow();
  sniper.start();
  app.on("activate", () => BrowserWindow.getAllWindows().length || createWindow());
});

app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
