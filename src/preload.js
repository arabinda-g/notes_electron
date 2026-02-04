const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Data persistence
    getStoreData: () => ipcRenderer.invoke('get-store-data'),
    saveData: (data) => ipcRenderer.invoke('save-data', data),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    exportFile: (filePath, data) => ipcRenderer.invoke('export-file', filePath, data),
    
    // Theme
    getTheme: () => ipcRenderer.invoke('get-theme'),
    onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (event, theme) => callback(theme)),
    
    // Clipboard
    readClipboardText: () => ipcRenderer.invoke('read-clipboard-text'),
    writeClipboardText: (text) => ipcRenderer.invoke('write-clipboard-text', text),
    readClipboardImage: () => ipcRenderer.invoke('read-clipboard-image'),
    writeClipboardImage: (dataUrl) => ipcRenderer.invoke('write-clipboard-image', dataUrl),
    
    // Dialogs
    showConfirmDialog: (options) => ipcRenderer.invoke('show-confirm-dialog', options),
    
    // Backup
    getBackupList: () => ipcRenderer.invoke('get-backup-list'),
    restoreBackup: (filename) => ipcRenderer.invoke('restore-backup', filename),
    openBackupFolder: () => ipcRenderer.invoke('open-backup-folder'),
    
    // App info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
    
    // Menu commands
    onMenuCommand: (callback) => ipcRenderer.on('menu-command', (event, command, data) => callback(command, data)),
    
    // Import/Export
    onImportData: (callback) => ipcRenderer.on('import-data', (event, data) => callback(data)),
    onRequestExport: (callback) => ipcRenderer.on('request-export', (event, filePath) => callback(filePath))
});
