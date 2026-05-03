const { app, BrowserWindow, Menu, Tray, ipcMain, globalShortcut, dialog, nativeTheme, clipboard, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Read GPU mode from config before app is ready
// app.disableHardwareAcceleration() must be called before app.whenReady()
(function applyEarlyGpuSettings() {
    try {
        const earlyUserDataPath = app.getPath('userData');
        const configFilePath = path.join(earlyUserDataPath, 'notes-data.json');
        if (fs.existsSync(configFilePath)) {
            const data = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
            const gpuMode = data?.config?.general?.gpuMode || 'auto';
            if (gpuMode === 'cpu') {
                app.disableHardwareAcceleration();
            } else if (gpuMode === 'gpu') {
                app.commandLine.appendSwitch('enable-gpu-rasterization');
                app.commandLine.appendSwitch('enable-zero-copy');
                app.commandLine.appendSwitch('ignore-gpu-blocklist');
            }
            // 'auto' = Electron defaults, no action needed
        }
    } catch (e) {
        // Silently fail - will use Electron defaults (auto)
        console.error('Failed to read early GPU settings:', e);
    }
})();

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
                this.data = this.deepMerge(JSON.parse(JSON.stringify(this.defaults)), JSON.parse(content));
            } else {
                this.data = JSON.parse(JSON.stringify(this.defaults));
                this.save();
            }
        } catch (e) {
            logError('Failed to load store', { error: e.message });
            this.data = JSON.parse(JSON.stringify(this.defaults));
        }
    }

    deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key] || typeof target[key] !== 'object') target[key] = {};
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }

    save() {
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (e) {
            logError('Failed to save store', { error: e.message });
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
            hotkey: { enabled: false, key: 'N', modifiers: ['Control', 'Alt'] },
            unitStyle: { backgroundColor: '#6495ED', textColor: '#FFFFFF', fontFamily: 'Segoe UI', fontSize: 12 },
            window: { x: -1, y: -1, width: 800, height: 600, maximized: false, alwaysOnTop: false, rememberPosition: true, rememberSize: true },
            general: {
                autoSave: true, autoSaveInterval: 30, confirmDelete: true, confirmReset: true, confirmExit: false,
                showTrayIcon: true, minimizeToTray: false, closeToTray: false, startMinimized: false, startWithWindows: false,
                autoBackup: true, backupCount: 10, undoLevels: 20,
                doubleClickToEdit: true, singleClickToCopy: true,
                autofocus: false, optimizeForLargeFiles: false,
                enableAnimations: true, theme: 'SystemDefault', logLevel: 'None',
                gpuMode: 'auto', backgroundStyle: ''
            }
        }
    }
});

let mainWindow;
let tray = null;
let isQuitting = false;
let isShowingErrorDialog = false;
let lastErrorDialogAt = 0;

// Paths
const userDataPath = app.getPath('userData');
const backupPath = path.join(userDataPath, 'Backups');
const logPath = path.join(userDataPath, 'Logs');
const LOG_LEVELS = {
    None: 0,
    Error: 1,
    Warning: 2,
    Info: 3,
    Debug: 4
};

function normalizeLogLevel(level) {
    if (!level) return 'Info';
    const normalized = String(level).trim();
    if (Object.prototype.hasOwnProperty.call(LOG_LEVELS, normalized)) {
        return normalized;
    }
    return 'Info';
}

function getCurrentLogLevel() {
    try {
        return normalizeLogLevel(store.get('config.general.logLevel'));
    } catch (_) {
        return 'Info';
    }
}

function shouldLog(level) {
    const current = LOG_LEVELS[getCurrentLogLevel()] ?? LOG_LEVELS.Info;
    const requested = LOG_LEVELS[normalizeLogLevel(level)] ?? LOG_LEVELS.Info;
    return requested <= current;
}

function getLogFilePath() {
    const datePart = new Date().toISOString().slice(0, 10);
    return path.join(logPath, `notes-${datePart}.log`);
}

function serializeLogDetails(details) {
    if (details === undefined || details === null) return '';
    if (typeof details === 'string') return details;
    try {
        return JSON.stringify(details);
    } catch (_) {
        return String(details);
    }
}

function writeLog(level, message, details = null) {
    const normalizedLevel = normalizeLogLevel(level);
    if (!shouldLog(normalizedLevel)) return;

    try {
        if (!fs.existsSync(logPath)) {
            fs.mkdirSync(logPath, { recursive: true });
        }

        const timestamp = new Date().toISOString();
        const detailsText = serializeLogDetails(details);
        const line = detailsText
            ? `[${timestamp}] [${normalizedLevel}] ${message} | ${detailsText}`
            : `[${timestamp}] [${normalizedLevel}] ${message}`;
        fs.appendFileSync(getLogFilePath(), `${line}\n`, 'utf8');
    } catch (_) {
        // Never throw from logger.
    }
}

function logError(message, details = null) { writeLog('Error', message, details); }
function logWarning(message, details = null) { writeLog('Warning', message, details); }
function logInfo(message, details = null) { writeLog('Info', message, details); }
function logDebug(message, details = null) { writeLog('Debug', message, details); }

function formatErrorDetails(errorLike) {
    if (!errorLike) return '';
    if (errorLike instanceof Error) {
        return errorLike.stack || errorLike.message || String(errorLike);
    }
    if (typeof errorLike === 'object') {
        try {
            return JSON.stringify(errorLike);
        } catch (_) {
            return String(errorLike);
        }
    }
    return String(errorLike);
}

function showUserErrorDialog(title, message, details = '') {
    // Prevent message box storms during repeated runtime failures.
    const now = Date.now();
    if (isShowingErrorDialog) return;
    if (now - lastErrorDialogAt < 2500) return;
    lastErrorDialogAt = now;
    isShowingErrorDialog = true;

    const detailText = details ? `\n\nDetails:\n${details}` : '';
    const fullMessage = `${message}\n\nA log entry has been written to the Logs folder.${detailText}`;

    const cleanup = () => {
        isShowingErrorDialog = false;
    };

    try {
        if (mainWindow && !mainWindow.isDestroyed()) {
            dialog.showMessageBox(mainWindow, {
                type: 'error',
                title,
                message: fullMessage,
                buttons: ['OK'],
                defaultId: 0
            }).finally(cleanup);
            return;
        }
        dialog.showMessageBox({
            type: 'error',
            title,
            message: fullMessage,
            buttons: ['OK'],
            defaultId: 0
        }).finally(cleanup);
    } catch (_) {
        // Fallback if showMessageBox cannot be displayed in current state.
        try {
            dialog.showErrorBox(title, fullMessage);
        } finally {
            cleanup();
        }
    }
}

function registerGlobalExceptionHandlers() {
    process.on('uncaughtException', (error) => {
        const details = formatErrorDetails(error);
        logError('Uncaught exception in main process', { details });
        showUserErrorDialog('Unexpected Error', 'An unexpected application error occurred.', details);
    });

    process.on('unhandledRejection', (reason) => {
        const details = formatErrorDetails(reason);
        logError('Unhandled promise rejection in main process', { details });
        showUserErrorDialog('Unexpected Error', 'An unhandled background error occurred.', details);
    });
}

// Initialize store and directories after app is ready
function initializePaths() {
    if (!fs.existsSync(backupPath)) fs.mkdirSync(backupPath, { recursive: true });
    if (!fs.existsSync(logPath)) fs.mkdirSync(logPath, { recursive: true });
    store.init(userDataPath);
}

function loadNativeImageFromCandidates(candidatePaths, purpose) {
    for (const iconPath of candidatePaths) {
        if (!iconPath || !fs.existsSync(iconPath)) continue;
        try {
            const image = nativeImage.createFromPath(iconPath);
            if (!image.isEmpty()) {
                return image;
            }
            logWarning(`${purpose} icon file exists but could not be decoded`, { iconPath });
        } catch (e) {
            logWarning(`Failed to load ${purpose} icon candidate`, { iconPath, error: e.message });
        }
    }
    return null;
}

function getAppIconCandidates() {
    return [
        process.platform === 'darwin' ? path.join(__dirname, '../resources/Notes.icns') : null,
        path.join(__dirname, '../resources/Notes.png'),
        path.join(__dirname, '../resources/Notes.ico')
    ].filter(Boolean);
}

function getDockIconCandidates() {
    return [
        process.platform === 'darwin' ? path.join(__dirname, '../resources/NotesDock.png') : null,
        ...getAppIconCandidates()
    ].filter(Boolean);
}

function applyDockIcon() {
    if (process.platform !== 'darwin' || !app.dock) return;

    const dockIcon = loadNativeImageFromCandidates(getDockIconCandidates(), 'Dock');
    if (dockIcon) {
        app.dock.setIcon(dockIcon);
    } else {
        logWarning('No valid application icon found for macOS dock');
    }
}

function getWindowIconPath() {
    const candidates = [
        process.platform === 'darwin' ? path.join(__dirname, '../resources/Notes.icns') : null,
        path.join(__dirname, '../resources/Notes.png'),
        path.join(__dirname, '../resources/Notes.ico')
    ].filter(Boolean);

    return candidates.find(iconPath => fs.existsSync(iconPath));
}

function createWindow() {
    const config = store.get('config');
    const windowConfig = config.window;
    logInfo('Creating main window');

    const windowOptions = {
        width: windowConfig.rememberSize ? (windowConfig.width || 800) : 800,
        height: windowConfig.rememberSize ? (windowConfig.height || 600) : 600,
        minWidth: 400,
        minHeight: 300,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false
    };

    // On macOS, keep dock icon controlled only via app.dock.setIcon().
    if (process.platform !== 'darwin') {
        const windowIconPath = getWindowIconPath();
        if (windowIconPath) {
            windowOptions.icon = windowIconPath;
        }
    }

    if (windowConfig.rememberPosition && windowConfig.x !== -1 && windowConfig.y !== -1) {
        windowOptions.x = windowConfig.x;
        windowOptions.y = windowConfig.y;
    }

    mainWindow = new BrowserWindow(windowOptions);
    applyDockIcon();
    mainWindow.webContents.on('render-process-gone', (event, details) => {
        logError('Renderer process terminated unexpectedly', details);
        showUserErrorDialog(
            'Renderer Process Error',
            'The UI process crashed or was terminated. Please restart the app.',
            formatErrorDetails(details)
        );
    });

    mainWindow.webContents.on('unresponsive', () => {
        logWarning('Renderer process became unresponsive');
        showUserErrorDialog(
            'Application Not Responding',
            'The application UI is not responding. You may need to wait or restart.',
            ''
        );
    });

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
        logInfo('Main window ready');
        // Open DevTools for debugging (remove in production)
        if (process.argv.includes('--dev')) {
            mainWindow.webContents.openDevTools();
        }
    });

    mainWindow.on('close', async (event) => {
        const currentConfig = store.get('config');
        if (!isQuitting && currentConfig.general.closeToTray && tray) {
            event.preventDefault();
            mainWindow.hide();
            return;
        }
        
        // Confirm before exit if enabled (and not already quitting via menu/tray)
        if (!isQuitting && currentConfig.general.confirmExit) {
            event.preventDefault();
            const result = await dialog.showMessageBox(mainWindow, {
                type: 'question',
                buttons: ['Exit', 'Cancel'],
                defaultId: 1,
                title: 'Confirm Exit',
                message: 'Are you sure you want to exit?'
            });
            if (result.response === 0) {
                isQuitting = true;
                mainWindow.close();
            }
            return;
        }
        
        // Save window state (batch update to avoid multiple disk writes)
        const windowState = store.get('config.window') || {};
        if (!mainWindow.isMaximized()) {
            const bounds = mainWindow.getBounds();
            windowState.x = bounds.x;
            windowState.y = bounds.y;
            windowState.width = bounds.width;
            windowState.height = bounds.height;
        }
        windowState.maximized = mainWindow.isMaximized();
        store.set('config.window', windowState);
    });

    mainWindow.on('minimize', () => {
        const currentConfig = store.get('config');
        if (currentConfig.general.minimizeToTray && tray) {
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
                { label: 'Autofocus', type: 'checkbox', checked: !!store.get('config.general.autofocus'), click: (menuItem) => mainWindow.webContents.send('menu-command', 'toggle-autofocus', menuItem.checked) },
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
                { label: 'Toggle Developer Tools', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow.webContents.toggleDevTools() },
                { type: 'separator' },
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

function getTrayIconImage() {
    // Prefer platform-appropriate images if present; fall back safely.
    const candidatePaths = [
        process.platform === 'darwin' ? path.join(__dirname, '../resources/NotesTemplate.png') : null,
        path.join(__dirname, '../resources/Notes.png'),
        path.join(__dirname, '../resources/Notes.ico')
    ].filter(Boolean);

    for (const iconPath of candidatePaths) {
        if (!fs.existsSync(iconPath)) continue;
        try {
            let image = nativeImage.createFromPath(iconPath);
            if (!image.isEmpty()) {
                const isTemplateAsset = /template/i.test(path.basename(iconPath));
                if (process.platform === 'darwin') {
                    // Keep macOS menu bar icons at the expected size.
                    image = image.resize({ width: 16, height: 16, quality: 'best' });
                }
                if (process.platform === 'darwin' && typeof image.setTemplateImage === 'function') {
                    // Only mark explicitly named template assets as template images.
                    image.setTemplateImage(isTemplateAsset);
                }
                return image;
            }
            logWarning('Tray icon file exists but could not be decoded', { iconPath });
        } catch (e) {
            logWarning('Failed to load tray icon candidate', { iconPath, error: e.message });
        }
    }

    return nativeImage.createEmpty();
}

function createTray() {
    try {
        tray = new Tray(getTrayIconImage());
    } catch (e) {
        // Never block app startup on tray icon failures.
        logError('Failed to create system tray icon', { error: e.message });
        tray = null;
        return;
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
    globalShortcut.unregisterAll();

    if (!config || !config.hotkey || !config.hotkey.enabled) return;

    const modifiers = Array.isArray(config.hotkey.modifiers) ? config.hotkey.modifiers.join('+') : '';
    const accelerator = modifiers ? `${modifiers}+${config.hotkey.key}` : config.hotkey.key;
    
    try {
        const registered = globalShortcut.register(accelerator, () => {
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
            }
        });
        if (!registered) {
            logWarning('Global hotkey registration failed', { accelerator });
        }
    } catch (e) {
        logError('Failed to register hotkey', { error: e.message });
    }
}

function applyStartWithWindowsSetting(enabled) {
    // Startup registration is only supported on Windows.
    if (process.platform !== 'win32') return;

    // In development mode, avoid registering Electron itself at login.
    if (!app.isPackaged) return;

    try {
        app.setLoginItemSettings({
            openAtLogin: !!enabled,
            path: process.execPath
        });
    } catch (e) {
        logError('Failed to apply startup setting', { error: e.message });
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
            const importFilePath = result.filePaths[0];
            const importFileSize = fs.statSync(importFilePath).size;
            if (importFileSize > (50 * 1024 * 1024)) {
                const confirmation = await dialog.showMessageBox(mainWindow, {
                    type: 'warning',
                    title: 'Large Import File',
                    message: 'This file is larger than 50 MB and may take time to import. Continue?',
                    buttons: ['Continue', 'Cancel'],
                    defaultId: 1,
                    cancelId: 1
                });
                if (confirmation.response !== 0) {
                    return;
                }
            }

            const data = fs.readFileSync(importFilePath, 'utf8');
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
        const exportFilePath = path.extname(result.filePath) ? result.filePath : `${result.filePath}.json`;
        mainWindow.webContents.send('request-export', exportFilePath);
    }
}

// IPC Handlers
ipcMain.handle('get-store-data', () => {
    return {
        jsonData: store.get('jsonData'),
        config: store.get('config')
    };
});

let lastBackupTime = 0;
const BACKUP_INTERVAL_MS = 5 * 60 * 1000; // At most one backup every 5 minutes

ipcMain.handle('save-data', (event, data) => {
    store.set('jsonData', data);
    logDebug('Data saved');
    // Throttle backups to avoid creating one every auto-save cycle
    const now = Date.now();
    if (now - lastBackupTime >= BACKUP_INTERVAL_MS) {
        createBackup(data);
        lastBackupTime = now;
    }
    return true;
});

ipcMain.handle('save-config', (event, config) => {
    store.set('config', config);
    logInfo('Configuration saved', {
        logLevel: config.general.logLevel,
        startWithWindows: !!config.general.startWithWindows
    });
    
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

    // Update startup registration
    applyStartWithWindowsSetting(config.general.startWithWindows);

    // Refresh menu checkbox states from persisted config.
    createMenu();
    
    return true;
});

ipcMain.handle('log-message', (event, level, message, details) => {
    const safeMessage = typeof message === 'string' ? message.slice(0, 2000) : 'Renderer log';
    const safeDetails = details && typeof details === 'object' ? details : { details: details ?? null };
    writeLog(level, `[renderer] ${safeMessage}`, safeDetails);
    return true;
});

ipcMain.handle('export-file', (event, filePath, data) => {
    try {
        const optimizeForLargeFiles = !!store.get('config.general.optimizeForLargeFiles');
        const spacing = optimizeForLargeFiles ? 0 : 2;
        fs.writeFileSync(filePath, JSON.stringify(data, null, spacing), 'utf8');
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

ipcMain.handle('capture-clipboard-object', () => {
    try {
        const formats = clipboard.availableFormats();
        if (!formats || formats.length === 0) return null;

        const serializedFormats = {};
        let totalBytes = 0;
        for (const format of formats) {
            try {
                const buf = clipboard.readBuffer(format);
                if (!buf || buf.length === 0) continue;
                serializedFormats[format] = buf.toString('base64');
                totalBytes += buf.length;
            } catch (_) {
                // Skip unreadable formats and continue.
            }
        }

        const capturedFormats = Object.keys(serializedFormats);
        if (capturedFormats.length === 0) return null;

        const textPreview = (clipboard.readText() || '').slice(0, 120);
        return {
            version: 1,
            capturedAt: new Date().toISOString(),
            formatCount: capturedFormats.length,
            totalBytes,
            textPreview,
            formats: serializedFormats
        };
    } catch (e) {
        logError('Failed to capture clipboard object', { error: e.message });
        return null;
    }
});

ipcMain.handle('write-clipboard-object', (event, payload) => {
    try {
        if (!payload || typeof payload !== 'object') return false;
        if (!payload.formats || typeof payload.formats !== 'object') return false;

        const formats = Object.entries(payload.formats);
        if (formats.length === 0) return false;

        // Replace clipboard contents with captured multi-format data.
        clipboard.clear();
        for (const [format, base64] of formats) {
            if (!format || typeof base64 !== 'string' || !base64) continue;
            try {
                const buf = Buffer.from(base64, 'base64');
                if (buf.length === 0) continue;
                clipboard.writeBuffer(format, buf);
            } catch (_) {
                // Continue restoring remaining formats.
            }
        }
        return true;
    } catch (e) {
        logError('Failed to restore clipboard object', { error: e.message });
        return false;
    }
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

ipcMain.handle('select-background-image', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Background Image',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
        properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    try {
        const srcPath = result.filePaths[0];
        const bgDir = path.join(userDataPath, 'backgrounds');
        if (!fs.existsSync(bgDir)) {
            fs.mkdirSync(bgDir, { recursive: true });
        }
        const ext = path.extname(srcPath);
        const filename = 'bg_' + Date.now() + ext;
        const destPath = path.join(bgDir, filename);
        fs.copyFileSync(srcPath, destPath);
        return filename;
    } catch (e) {
        logError('Failed to copy background image', { error: e.message });
        return null;
    }
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
        // Sanitize filename to prevent path traversal
        const sanitized = path.basename(filename);
        const filePath = path.join(backupPath, sanitized);
        // Verify the resolved path is still within the backup directory
        if (!filePath.startsWith(backupPath)) return null;
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
});

ipcMain.handle('open-backup-folder', () => {
    return shell.openPath(backupPath)
        .then((err) => err === '')
        .catch(() => false);
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('get-user-data-path', () => {
    return userDataPath;
});

ipcMain.handle('get-config-path', () => {
    return path.join(userDataPath, 'notes-data.json');
});

ipcMain.handle('restart-app', () => {
    app.relaunch();
    app.exit(0);
});

ipcMain.handle('get-gpu-info', () => {
    return {
        gpuFeatureStatus: app.getGPUFeatureStatus(),
    };
});

ipcMain.handle('open-log-folder', () => {
    return shell.openPath(logPath)
        .then((err) => err === '')
        .catch(() => false);
});

ipcMain.handle('open-current-log-file', () => {
    try {
        if (!fs.existsSync(logPath)) {
            fs.mkdirSync(logPath, { recursive: true });
        }
        const currentLogPath = getLogFilePath();
        if (!fs.existsSync(currentLogPath)) {
            fs.writeFileSync(currentLogPath, '', 'utf8');
        }
        return shell.openPath(currentLogPath)
            .then((err) => err === '')
            .catch(() => false);
    } catch (e) {
        logError('Failed to open current log file', { error: e.message });
        return false;
    }
});

ipcMain.handle('clear-old-logs', (event, days) => {
    try {
        const keepDays = Number.isFinite(Number(days)) ? Math.max(1, Number(days)) : 7;
        if (!fs.existsSync(logPath)) {
            return { ok: true, deletedCount: 0 };
        }

        const cutoff = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
        let deletedCount = 0;
        const entries = fs.readdirSync(logPath);
        for (const file of entries) {
            if (!file.endsWith('.log')) continue;
            const filePath = path.join(logPath, file);
            let stats;
            try {
                stats = fs.statSync(filePath);
            } catch (_) {
                continue;
            }
            if (stats.mtimeMs < cutoff) {
                try {
                    fs.unlinkSync(filePath);
                    deletedCount += 1;
                } catch (_) {
                    // Continue clearing other files.
                }
            }
        }

        logInfo('Cleared old log files', { keepDays, deletedCount });
        return { ok: true, deletedCount };
    } catch (e) {
        logError('Failed to clear old logs', { error: e.message });
        return { ok: false, deletedCount: 0 };
    }
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
        logError('Backup failed', { error: e.message });
    }
}

nativeTheme.on('updated', () => {
    if (mainWindow) {
        mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
    }
});

app.whenReady().then(() => {
    initializePaths();
    logInfo('Application starting', {
        version: app.getVersion(),
        platform: process.platform
    });

    // Apply dock icon early, then keep it stable when creating windows.
    applyDockIcon();

    applyStartWithWindowsSetting(store.get('config.general.startWithWindows'));
    createWindow();
});

registerGlobalExceptionHandlers();

app.on('window-all-closed', () => {
    logInfo('All windows closed');
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
    logInfo('Application quitting');
    isQuitting = true;
});
