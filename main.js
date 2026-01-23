const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;
let tray = null;
let currentSettings = {
  alwaysOnTop: false,
  runInTray: true,
  runOnStartup: false,
  globalHotkey: "Ctrl+Alt+N",
  backupEnabled: true,
  backupCount: 10
};

const dataFilePath = () => path.join(app.getPath("userData"), "notes-data.json");
const backupDirPath = () => path.join(app.getPath("userData"), "Backups");

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const getDefaultData = () => ({
  Units: {},
  Groups: {},
  Settings: {}
});

const readJsonSafe = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const writeJsonSafe = (filePath, data) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
};

const normalizeIncomingData = (data) => {
  if (!data || typeof data !== "object") {
    return getDefaultData();
  }
  const normalized = {
    Units: data.Units || data.units || {},
    Groups: data.Groups || data.groups || {},
    Settings: data.Settings || data.settings || {}
  };
  return normalized;
};

const createTrayIcon = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
      <rect width="16" height="16" rx="3" fill="#4f46e5"/>
      <path d="M4 4h8v8H4z" fill="#ffffff"/>
      <path d="M6 6h4v4H6z" fill="#4f46e5"/>
    </svg>
  `;
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
  );
  image.setTemplateImage(true);
  return image;
};

const buildTrayMenu = () => {
  return Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: "Hide",
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      }
    }
  ]);
};

const ensureTray = () => {
  if (tray) {
    return;
  }
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Notes");
  tray.setContextMenu(buildTrayMenu());
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
};

const destroyTray = () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
};

const applySettingsToMain = (settings) => {
  currentSettings = {
    ...currentSettings,
    ...settings
  };

  if (mainWindow) {
    mainWindow.setAlwaysOnTop(!!currentSettings.alwaysOnTop);
  }

  if (currentSettings.runInTray) {
    ensureTray();
  } else {
    destroyTray();
  }

  globalShortcut.unregisterAll();
  if (currentSettings.globalHotkey) {
    try {
      globalShortcut.register(currentSettings.globalHotkey, () => {
        if (!mainWindow) {
          return;
        }
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      });
    } catch (error) {
      // ignore invalid hotkey
    }
  }

  app.setLoginItemSettings({
    openAtLogin: !!currentSettings.runOnStartup
  });
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("close", (event) => {
    if (currentSettings.runInTray && !app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

app.whenReady().then(() => {
  createWindow();
  applySettingsToMain(currentSettings);
});

app.on("before-quit", () => {
  app.isQuiting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("notes:loadData", () => {
  const data = readJsonSafe(dataFilePath());
  return normalizeIncomingData(data);
});

ipcMain.handle("notes:saveData", (event, data) => {
  writeJsonSafe(dataFilePath(), normalizeIncomingData(data));
  return true;
});

ipcMain.handle("notes:createBackup", (event, data, backupCount) => {
  if (!data) {
    return false;
  }
  const dirPath = backupDirPath();
  ensureDir(dirPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(dirPath, `notes-backup-${timestamp}.json`);
  writeJsonSafe(filePath, normalizeIncomingData(data));

  try {
    const files = fs
      .readdirSync(dirPath)
      .filter((file) => file.endsWith(".json"))
      .map((file) => ({
        file,
        time: fs.statSync(path.join(dirPath, file)).mtimeMs
      }))
      .sort((a, b) => b.time - a.time);
    const maxCount = Math.max(1, Number(backupCount) || currentSettings.backupCount || 10);
    files.slice(maxCount).forEach((entry) => {
      fs.unlinkSync(path.join(dirPath, entry.file));
    });
  } catch (error) {
    // ignore cleanup errors
  }

  return true;
});

ipcMain.handle("notes:showOpenDialog", async (event, options) => {
  if (!mainWindow) {
    return { canceled: true, filePaths: [] };
  }
  return dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle("notes:showSaveDialog", async (event, options) => {
  if (!mainWindow) {
    return { canceled: true, filePath: null };
  }
  return dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle("notes:readFile", (event, filePath) => {
  if (!filePath) {
    return null;
  }
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return null;
  }
});

ipcMain.handle("notes:writeFile", (event, filePath, content) => {
  if (!filePath) {
    return false;
  }
  try {
    fs.writeFileSync(filePath, content, "utf8");
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.handle("notes:applySettings", (event, settings) => {
  applySettingsToMain(settings || {});
  return true;
});

ipcMain.handle("notes:toggleWindow", () => {
  if (!mainWindow) {
    return false;
  }
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
  return true;
});

ipcMain.handle("notes:showWindow", () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return true;
  }
  return false;
});

ipcMain.handle("notes:hideWindow", () => {
  if (mainWindow) {
    mainWindow.hide();
    return true;
  }
  return false;
});

ipcMain.handle("notes:getPaths", () => {
  return {
    userData: app.getPath("userData"),
    dataFile: dataFilePath(),
    backups: backupDirPath()
  };
});
