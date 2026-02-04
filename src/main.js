const { app, BrowserWindow, Menu, Tray, ipcMain, globalShortcut, dialog, nativeTheme, clipboard, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Simple JSON Store implementation
class SimpleStore {
    constructor(options) {
        this.name = options.name || 'config';
        this.defaults = options.defaults || {};
        this.data = null;
        this.filePath = null;
    }

    init(userDataPath) {
        this.filePath = path.join(userDataPath, `${this.name}.json`);
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const content = fs.readFileSync(this.filePath, 'utf8');
                this.data = JSON.parse(content);
            } else {
                this.data = JSON.parse(JSON.stringify(this.defaults));
                this.save();
            }
        } catch (e) {
            console.error('Failed to load store:', e);
            this.data = JSON.parse(JSON.stringify(this.defaults));
        }
    }

    save() {
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (e) {
            console.error('Failed to save store:', e);
        }
    }

    get(key) {
        if (!key) return this.data;
        const keys = key.split('.');
        let value = this.data;
        for (const k of keys) {
            if (value === undefined || value === null) return undefined;
            value = value[k];
        }
        return value !== undefined ? value : this.getDefault(key);
    }

    getDefault(key) {
        const keys = key.split('.');
        let value = this.defaults;
        for (const k of keys) {
            if (value === undefined || value === null) return undefined;
            value = value[k];
        }
        return value;
    }

    set(key, value) {
        const keys = key.split('.');
        let obj = this.data;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        this.save();
    }
}

// Initialize store for data persistence
const store = new SimpleStore({
    name: 'notes-data',
    defaults: {
        jsonData: { units: {}, groups: {} },
        config: {
            hotkey: { enabled: true, key: 'N', modifiers: ['Control', 'Alt'] },
            unitStyle: { backgroundColor: '#6495ED', textColor: '#FFFFFF', fontFamily: 'Segoe UI', fontSize: 12 },
            window: { x: -1, y: -1, width: 800, height: 600, maximized: false, alwaysOnTop: false, rememberPosition: true, rememberSize: true },
            general: {
                autoSave: true, autoSaveInterval: 30, confirmDelete: true, confirmReset: true, confirmExit: false,
                showTrayIcon: true, minimizeToTray: true, closeToTray: false, startMinimized: false,
                autoBackup: true, backupCount: 10, undoLevels: 20,
                doubleClickToEdit: true, singleClickToCopy: true,
                enableAnimations: true, theme: 'SystemDefault', logLevel: 'Info'
            }
        }
    }
});

let mainWindow;
let tray = null;
let isQuitting = false;

// Paths
const userDataPath = app.getPath('userData');
const backupPath = path.join(userDataPath, 'Backups');
const logPath = path.join(userDataPath, 'Logs');

// Initialize store and directories after app is ready
function initializePaths() {
    if (!fs.existsSync(backupPath)) fs.mkdirSync(backupPath, { recursive: true });
    if (!fs.existsSync(logPath)) fs.mkdirSync(logPath, { recursive: true });
    store.init(userDataPath);
}

function createWindow() {
    const config = store.get('config');
    const windowConfig = config.window;

    const windowOptions = {
        width: windowConfig.width || 800,
        height: windowConfig.height || 600,
        minWidth: 400,
        minHeight: 300,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../resources/Notes.ico'),
        show: false
    };

    if (windowConfig.rememberPosition && windowConfig.x !== -1 && windowConfig.y !== -1) {
        windowOptions.x = windowConfig.x;
        windowOptions.y = windowConfig.y;
    }

    mainWindow = new BrowserWindow(windowOptions);

    if (windowConfig.maximized) {
        mainWindow.maximize();
    }

    if (windowConfig.alwaysOnTop) {
        mainWindow.setAlwaysOnTop(true);
    }

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.once('ready-to-show', () => {
        if (!config.general.startMinimized) {
            mainWindow.show();
        }
        // Open DevTools for debugging (remove in production)
        if (process.argv.includes('--dev')) {
            mainWindow.webContents.openDevTools();
        }
    });

    mainWindow.on('close', (event) => {
        if (!isQuitting && config.general.closeToTray && tray) {
            event.preventDefault();
            mainWindow.hide();
            return;
        }
        
        // Save window state
        if (!mainWindow.isMaximized()) {
            const bounds = mainWindow.getBounds();
            store.set('config.window.x', bounds.x);
            store.set('config.window.y', bounds.y);
            store.set('config.window.width', bounds.width);
            store.set('config.window.height', bounds.height);
        }
        store.set('config.window.maximized', mainWindow.isMaximized());
    });

    mainWindow.on('minimize', () => {
        if (config.general.minimizeToTray && tray) {
            mainWindow.hide();
        }
    });

    createMenu();
    
    if (config.general.showTrayIcon) {
        createTray();
    }

    registerGlobalHotkey();
}

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                { label: 'New Note', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu-command', 'new-note') },
                { label: 'New Group', accelerator: 'CmdOrCtrl+Shift+G', click: () => mainWindow.webContents.send('menu-command', 'new-group') },
                { type: 'separator' },
                { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu-command', 'save') },
                { type: 'separator' },
                { label: 'Import', click: () => handleImport() },
                { label: 'Export', click: () => handleExport() },
                { type: 'separator' },
                { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.webContents.send('menu-command', 'reload') },
                { label: 'Reset', click: () => mainWindow.webContents.send('menu-command', 'reset') },
                { type: 'separator' },
                { label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; app.quit(); } }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow.webContents.send('menu-command', 'undo') },
                { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => mainWindow.webContents.send('menu-command', 'redo') },
                { type: 'separator' },
                { label: 'Movable', accelerator: 'CmdOrCtrl+D', type: 'checkbox', checked: true, click: (menuItem) => mainWindow.webContents.send('menu-command', 'toggle-movable', menuItem.checked) },
                { label: 'Autofocus', type: 'checkbox', checked: false, click: (menuItem) => mainWindow.webContents.send('menu-command', 'toggle-autofocus', menuItem.checked) },
                { label: 'Auto Save', type: 'checkbox', checked: store.get('config.general.autoSave'), click: (menuItem) => {
                    store.set('config.general.autoSave', menuItem.checked);
                    mainWindow.webContents.send('menu-command', 'toggle-autosave', menuItem.checked);
                }},
                { label: 'Auto Arrange', type: 'checkbox', checked: false, click: (menuItem) => mainWindow.webContents.send('menu-command', 'toggle-autoarrange', menuItem.checked) },
                { type: 'separator' },
                { label: 'Settings', click: () => mainWindow.webContents.send('menu-command', 'settings') }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Arrange',
                    submenu: [
                        { label: 'Grid Layout', click: () => mainWindow.webContents.send('menu-command', 'arrange-grid') },
                        { label: 'By Date', click: () => mainWindow.webContents.send('menu-command', 'arrange-date') },
                        { label: 'By Color', click: () => mainWindow.webContents.send('menu-command', 'arrange-color') },
                        { label: 'Compact', click: () => mainWindow.webContents.send('menu-command', 'arrange-compact') }
                    ]
                },
                { label: 'Fix Overlaps', click: () => mainWindow.webContents.send('menu-command', 'fix-overlaps') },
                { type: 'separator' },
                {
                    label: 'Styles',
                    submenu: getStylesSubmenu()
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                { label: 'About', click: () => mainWindow.webContents.send('menu-command', 'about') }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function getStylesSubmenu() {
    const styles = [
        'Classic Blue', 'Pastel Pink', 'Dark Mode', 'Neon Green', 'Earth Tones',
        'Ocean Blue', 'Sunset Orange', 'Monochrome', 'Vibrant Purple',
        { type: 'separator' },
        '3D Gradient', 'Glossy 3D', 'Embossed', 'Raised Button', 'Inset Shadow',
        { type: 'separator' },
        'Retro 80s', 'Cyberpunk', 'Glassmorphism', 'Neon Glow', 'Golden Premium',
        { type: 'separator' },
        'Minimal Clean', 'Bold Impact', 'Elegant Serif', 'Playful Comic', 'Professional'
    ];
    
    return styles.map(style => {
        if (style.type === 'separator') return style;
        return { label: style, click: () => mainWindow.webContents.send('menu-command', 'apply-style', style) };
    });
}

function createTray() {
    const iconPath = path.join(__dirname, '../resources/Notes.ico');
    if (!fs.existsSync(iconPath)) {
        // Create a simple icon if not exists
        tray = new Tray(nativeImage.createEmpty());
    } else {
        tray = new Tray(iconPath);
    }

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open', click: () => { mainWindow.show(); mainWindow.focus(); } },
        { type: 'separator' },
        { label: 'Reset Position', click: () => { mainWindow.setPosition(100, 100); mainWindow.show(); } },
        { label: 'Reset Size', click: () => { mainWindow.setSize(800, 600); mainWindow.show(); } },
        { type: 'separator' },
        { label: 'Exit', click: () => { isQuitting = true; app.quit(); } }
    ]);

    tray.setToolTip('Notes');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
        mainWindow.show();
        mainWindow.focus();
    });
}

function registerGlobalHotkey() {
    const config = store.get('config');
    if (!config.hotkey.enabled) return;

    globalShortcut.unregisterAll();
    
    const modifiers = config.hotkey.modifiers.join('+');
    const accelerator = modifiers ? `${modifiers}+${config.hotkey.key}` : config.hotkey.key;
    
    try {
        globalShortcut.register(accelerator, () => {
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
            }
        });
    } catch (e) {
        console.error('Failed to register hotkey:', e);
    }
}

async function handleImport() {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Import Notes',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        try {
            const data = fs.readFileSync(result.filePaths[0], 'utf8');
            const jsonData = JSON.parse(data);
            mainWindow.webContents.send('import-data', jsonData);
        } catch (e) {
            dialog.showErrorBox('Import Error', 'Failed to import file: ' + e.message);
        }
    }
}

async function handleExport() {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Notes',
        defaultPath: 'notes_export.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (!result.canceled && result.filePath) {
        mainWindow.webContents.send('request-export', result.filePath);
    }
}

// IPC Handlers
ipcMain.handle('get-store-data', () => {
    return {
        jsonData: store.get('jsonData'),
        config: store.get('config')
    };
});

ipcMain.handle('save-data', (event, data) => {
    store.set('jsonData', data);
    createBackup(data);
    return true;
});

ipcMain.handle('save-config', (event, config) => {
    store.set('config', config);
    
    // Update tray
    if (config.general.showTrayIcon && !tray) {
        createTray();
    } else if (!config.general.showTrayIcon && tray) {
        tray.destroy();
        tray = null;
    }
    
    // Update hotkey
    registerGlobalHotkey();
    
    // Update always on top
    mainWindow.setAlwaysOnTop(config.window.alwaysOnTop);
    
    return true;
});

ipcMain.handle('export-file', (event, filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        return false;
    }
});

ipcMain.handle('get-theme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

ipcMain.handle('read-clipboard-text', () => {
    return clipboard.readText();
});

ipcMain.handle('write-clipboard-text', (event, text) => {
    clipboard.writeText(text);
    return true;
});

ipcMain.handle('read-clipboard-image', () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) return null;
    return image.toDataURL();
});

ipcMain.handle('write-clipboard-image', (event, dataUrl) => {
    const image = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(image);
    return true;
});

ipcMain.handle('show-confirm-dialog', async (event, options) => {
    const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: options.buttons || ['Yes', 'No'],
        defaultId: 0,
        title: options.title || 'Confirm',
        message: options.message
    });
    return result.response === 0;
});

ipcMain.handle('show-color-dialog', async (event, currentColor) => {
    // Electron doesn't have a native color picker, so we'll handle this in the renderer
    return null;
});

ipcMain.handle('get-backup-list', () => {
    if (!fs.existsSync(backupPath)) return [];
    return fs.readdirSync(backupPath)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();
});

ipcMain.handle('restore-backup', async (event, filename) => {
    try {
        const filePath = path.join(backupPath, filename);
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
});

ipcMain.handle('open-backup-folder', () => {
    shell.openPath(backupPath);
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('get-user-data-path', () => {
    return userDataPath;
});

function createBackup(data) {
    const config = store.get('config');
    if (!config.general.autoBackup) return;

    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -1);
        const filename = `backup_${timestamp}.json`;
        fs.writeFileSync(path.join(backupPath, filename), JSON.stringify(data, null, 2));

        // Clean old backups
        const backups = fs.readdirSync(backupPath)
            .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
            .sort()
            .reverse();
        
        while (backups.length > config.general.backupCount) {
            const old = backups.pop();
            fs.unlinkSync(path.join(backupPath, old));
        }
    } catch (e) {
        console.error('Backup failed:', e);
    }
}

nativeTheme.on('updated', () => {
    if (mainWindow) {
        mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
    }
});

app.whenReady().then(() => {
    initializePaths();
    createWindow();
});

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    isQuitting = true;
});
