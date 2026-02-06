// Dialog Management

const Dialogs = {
    currentFontCallback: null,
    currentFontData: null,

    // Initialize all dialogs
    init() {
        this.initAddNoteDialog();
        this.initEditNoteDialog();
        this.initGroupDialog();
        this.initSettingsDialog();
        this.initAboutDialog();
        this.initFontDialog();
        this.initContextMenus();

        // Close dialogs on overlay click
        document.querySelectorAll('.dialog-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeDialog(overlay.id);
                }
            });
        });

        // Close dialogs on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const visibleDialog = document.querySelector('.dialog-overlay:not([style*="display: none"])');
                if (visibleDialog) {
                    this.closeDialog(visibleDialog.id);
                }
            }
        });
    },

    // Show dialog
    showDialog(id) {
        const dialog = document.getElementById(id);
        if (dialog) {
            dialog.style.display = 'flex';
            // Focus first input
            const firstInput = dialog.querySelector('input:not([type="color"]), textarea, select');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 50);
            }
        }
    },

    // Close dialog
    closeDialog(id) {
        const dialog = document.getElementById(id);
        if (dialog) {
            dialog.style.display = 'none';
        }
    },

    // Initialize Add Note Dialog
    initAddNoteDialog() {
        const dialog = document.getElementById('add-note-dialog');
        
        // Content type switch
        document.getElementById('add-content-type').addEventListener('change', (e) => {
            this.switchContentPanel('add', e.target.value);
        });

        // Color buttons
        this.initColorPicker('add-bg-color', 'add-bg-color-btn');
        this.initColorPicker('add-text-color', 'add-text-color-btn');

        // Font button
        document.getElementById('add-font-btn').addEventListener('click', () => {
            const fontStr = document.getElementById('add-font-btn').textContent;
            this.showFontDialog(fontStr, (newFont) => {
                document.getElementById('add-font-btn').textContent = newFont;
            });
        });

        // Paste image
        document.getElementById('add-paste-image').addEventListener('click', async () => {
            const imageData = await window.electronAPI.readClipboardImage();
            if (imageData) {
                const preview = document.getElementById('add-image-preview');
                preview.textContent = '';
                const img = document.createElement('img');
                img.src = imageData;
                img.alt = 'Preview';
                preview.appendChild(img);
                preview.dataset.imageData = imageData;
            } else {
                App.showStatus('No image in clipboard');
            }
        });

        // Paste object
        document.getElementById('add-paste-object').addEventListener('click', async () => {
            const text = await window.electronAPI.readClipboardText();
            if (text) {
                document.getElementById('add-object-summary').textContent = `Text content: ${text.substring(0, 100)}...`;
                document.getElementById('add-object-summary').dataset.objectData = text;
            } else {
                App.showStatus('No content in clipboard');
            }
        });

        // Save button
        document.getElementById('add-save-btn').addEventListener('click', () => {
            this.saveAddNote();
        });

        // Cancel button
        document.getElementById('add-cancel-btn').addEventListener('click', () => {
            this.closeDialog('add-note-dialog');
        });

        // Keyboard shortcuts
        dialog.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveAddNote();
            } else if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.saveAddNote();
            }
        });
    },

    // Initialize Edit Note Dialog
    initEditNoteDialog() {
        const dialog = document.getElementById('edit-note-dialog');

        // Content type switch
        document.getElementById('edit-content-type').addEventListener('change', (e) => {
            this.switchContentPanel('edit', e.target.value);
        });

        // Color buttons
        this.initColorPicker('edit-bg-color', 'edit-bg-color-btn');
        this.initColorPicker('edit-text-color', 'edit-text-color-btn');

        // Font button
        document.getElementById('edit-font-btn').addEventListener('click', () => {
            const fontStr = document.getElementById('edit-font-btn').textContent;
            this.showFontDialog(fontStr, (newFont) => {
                document.getElementById('edit-font-btn').textContent = newFont;
            });
        });

        // Paste image
        document.getElementById('edit-paste-image').addEventListener('click', async () => {
            const imageData = await window.electronAPI.readClipboardImage();
            if (imageData) {
                const preview = document.getElementById('edit-image-preview');
                preview.textContent = '';
                const img = document.createElement('img');
                img.src = imageData;
                img.alt = 'Preview';
                preview.appendChild(img);
                preview.dataset.imageData = imageData;
            } else {
                App.showStatus('No image in clipboard');
            }
        });

        // Paste object
        document.getElementById('edit-paste-object').addEventListener('click', async () => {
            const text = await window.electronAPI.readClipboardText();
            if (text) {
                document.getElementById('edit-object-summary').textContent = `Text content: ${text.substring(0, 100)}...`;
                document.getElementById('edit-object-summary').dataset.objectData = text;
            } else {
                App.showStatus('No content in clipboard');
            }
        });

        // Save button
        document.getElementById('edit-save-btn').addEventListener('click', () => {
            this.saveEditNote();
        });

        // Cancel button
        document.getElementById('edit-cancel-btn').addEventListener('click', () => {
            this.closeDialog('edit-note-dialog');
        });

        // Keyboard shortcuts
        dialog.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveEditNote();
            } else if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.saveEditNote();
            }
        });
    },

    // Initialize Group Dialog
    initGroupDialog() {
        const dialog = document.getElementById('group-dialog');

        // Color buttons
        this.initColorPicker('group-border-color', 'group-border-color-btn');
        this.initColorPicker('group-bg-color', 'group-bg-color-btn');
        this.initColorPicker('group-text-color', 'group-text-color-btn');

        // Save button
        document.getElementById('group-save-btn').addEventListener('click', () => {
            this.saveGroup();
        });

        // Cancel button
        document.getElementById('group-cancel-btn').addEventListener('click', () => {
            this.closeDialog('group-dialog');
        });

        // Keyboard shortcuts
        dialog.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveGroup();
            } else if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.saveGroup();
            }
        });
    },

    // Initialize Settings Dialog
    initSettingsDialog() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
            });
        });

        // Populate hotkey select
        const hotkeySelect = document.getElementById('setting-hotkey');
        hotkeySelect.innerHTML = '';
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
            hotkeySelect.innerHTML += `<option value="${letter}">${letter}</option>`;
        });
        for (let i = 1; i <= 12; i++) {
            hotkeySelect.innerHTML += `<option value="F${i}">F${i}</option>`;
        }

        // Color buttons
        this.initColorPicker('setting-unit-bg', 'setting-unit-bg-btn');
        this.initColorPicker('setting-unit-text', 'setting-unit-text-btn');

        // Font button
        document.getElementById('setting-unit-font-btn').addEventListener('click', () => {
            const fontStr = document.getElementById('setting-unit-font-btn').textContent;
            this.showFontDialog(fontStr, (newFont) => {
                document.getElementById('setting-unit-font-btn').textContent = newFont;
            });
        });

        // Apply to all
        document.getElementById('setting-apply-to-all').addEventListener('click', () => {
            App.applyDefaultStyleToAll();
        });

        // Backup list refresh
        document.getElementById('tab-backup').addEventListener('click', async () => {
            await this.refreshBackupList();
        });

        // Restore backup
        document.getElementById('setting-restore-backup').addEventListener('click', async () => {
            const select = document.getElementById('setting-backup-list');
            if (select.value) {
                const data = await window.electronAPI.restoreBackup(select.value);
                if (data) {
                    App.importData(data);
                    this.closeDialog('settings-dialog');
                    App.showStatus('Backup restored');
                }
            }
        });

        // Open backup folder
        document.getElementById('setting-open-backup-folder').addEventListener('click', () => {
            window.electronAPI.openBackupFolder();
        });

        // Reset button
        document.getElementById('settings-reset-btn').addEventListener('click', async () => {
            const confirmed = await window.electronAPI.showConfirmDialog({
                title: 'Reset Settings',
                message: 'Are you sure you want to reset all settings to defaults?'
            });
            if (confirmed) {
                App.resetConfig();
                this.loadSettingsFromConfig();
            }
        });

        // Save button
        document.getElementById('settings-save-btn').addEventListener('click', () => {
            this.saveSettings();
        });

        // Cancel button
        document.getElementById('settings-cancel-btn').addEventListener('click', () => {
            this.closeDialog('settings-dialog');
        });
    },

    // Initialize About Dialog
    initAboutDialog() {
        document.getElementById('about-ok-btn').addEventListener('click', () => {
            this.closeDialog('about-dialog');
        });
    },

    // Initialize Font Dialog
    initFontDialog() {
        const preview = document.getElementById('font-preview');
        
        const updatePreview = () => {
            const family = document.getElementById('font-family').value;
            const size = document.getElementById('font-size').value;
            const bold = document.getElementById('font-bold').checked;
            const italic = document.getElementById('font-italic').checked;
            
            preview.style.fontFamily = `"${family}", sans-serif`;
            preview.style.fontSize = `${size}px`;
            preview.style.fontWeight = bold ? 'bold' : 'normal';
            preview.style.fontStyle = italic ? 'italic' : 'normal';
        };

        document.getElementById('font-family').addEventListener('change', updatePreview);
        document.getElementById('font-size').addEventListener('input', updatePreview);
        document.getElementById('font-bold').addEventListener('change', updatePreview);
        document.getElementById('font-italic').addEventListener('change', updatePreview);

        document.getElementById('font-ok-btn').addEventListener('click', () => {
            if (this.currentFontCallback) {
                const family = document.getElementById('font-family').value;
                const size = document.getElementById('font-size').value;
                const bold = document.getElementById('font-bold').checked;
                const italic = document.getElementById('font-italic').checked;
                
                const fontStr = Utils.buildFontString(family, size, bold, italic);
                this.currentFontCallback(fontStr);
            }
            this.closeDialog('font-dialog');
        });

        document.getElementById('font-cancel-btn').addEventListener('click', () => {
            this.closeDialog('font-dialog');
        });
    },

    // Initialize Context Menus
    initContextMenus() {
        // Populate note styles submenu
        const noteStylesSubmenu = document.getElementById('note-styles-submenu');
        ButtonStyles.getAllStyleNames().forEach(name => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.textContent = name;
            item.addEventListener('click', () => {
                App.applyStyleToSelected(name);
                this.hideContextMenus();
            });
            noteStylesSubmenu.appendChild(item);
        });

        // Populate group styles submenu
        const groupStylesSubmenu = document.getElementById('group-styles-submenu');
        GroupStyles.getAllStyleNames().forEach(name => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.textContent = name;
            item.addEventListener('click', () => {
                App.applyGroupStyle(name);
                this.hideContextMenus();
            });
            groupStylesSubmenu.appendChild(item);
        });

        // Note context menu items
        document.querySelectorAll('#note-context-menu > .context-menu-item:not(.context-menu-submenu)').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleNoteContextAction(action);
                this.hideContextMenus();
            });
        });

        // Group context menu items
        document.querySelectorAll('#group-context-menu > .context-menu-item:not(.context-menu-submenu)').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleGroupContextAction(action);
                this.hideContextMenus();
            });
        });

        // Align submenu items
        document.querySelectorAll('#group-context-menu .context-submenu .context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleGroupContextAction(action);
                this.hideContextMenus();
            });
        });

        // Hide context menu on click elsewhere
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                this.hideContextMenus();
            }
        });
    },

    // Show note context menu
    showNoteContextMenu(x, y, noteId) {
        this.hideContextMenus();
        
        const menu = document.getElementById('note-context-menu');
        menu.dataset.noteId = noteId;
        
        // Update groups submenu
        this.updateGroupsSubmenu(noteId);
        
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'block';
        
        // Adjust if off screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (y - rect.height) + 'px';
        }
    },

    // Show group context menu
    showGroupContextMenu(x, y, groupId) {
        this.hideContextMenus();
        
        const menu = document.getElementById('group-context-menu');
        menu.dataset.groupId = groupId;
        
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'block';
        
        // Adjust if off screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (y - rect.height) + 'px';
        }
    },

    // Hide all context menus
    hideContextMenus() {
        document.querySelectorAll('.context-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    },

    // Update groups submenu
    updateGroupsSubmenu(noteId) {
        const submenu = document.getElementById('note-groups-submenu');
        submenu.innerHTML = '';
        
        const groups = App.getGroups();
        if (groups.length === 0) {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.textContent = '(No groups)';
            item.style.color = 'var(--text-secondary)';
            submenu.appendChild(item);
        } else {
            groups.forEach(group => {
                const item = document.createElement('div');
                item.className = 'context-menu-item';
                item.textContent = group.title;
                item.addEventListener('click', () => {
                    App.addNoteToGroup(noteId, group.id);
                    this.hideContextMenus();
                });
                submenu.appendChild(item);
            });
        }
    },

    // Handle note context menu action
    handleNoteContextAction(action) {
        const noteId = document.getElementById('note-context-menu').dataset.noteId;
        
        switch (action) {
            case 'edit':
                App.editNote(noteId);
                break;
            case 'delete':
                App.deleteNote(noteId);
                break;
            case 'copy-lower':
                App.copyNoteContent(noteId, 'lower');
                break;
            case 'copy-upper':
                App.copyNoteContent(noteId, 'upper');
                break;
            case 'duplicate':
                App.duplicateNote(noteId);
                break;
            case 'copy-style':
                App.copyStyle(noteId);
                break;
            case 'paste-style':
                App.pasteStyle(noteId);
                break;
            case 'remove-from-group':
                App.removeNoteFromGroup(noteId);
                break;
        }
    },

    // Handle group context menu action
    handleGroupContextAction(action) {
        const groupId = document.getElementById('group-context-menu').dataset.groupId;
        
        switch (action) {
            case 'add-button':
                App.addNoteToGroupAtPosition(groupId);
                break;
            case 'edit-group':
                App.editGroup(groupId);
                break;
            case 'delete-group':
                App.deleteGroup(groupId);
                break;
            case 'align-left':
                App.alignGroupButtons(groupId, 'left');
                break;
            case 'align-center':
                App.alignGroupButtons(groupId, 'center');
                break;
            case 'align-right':
                App.alignGroupButtons(groupId, 'right');
                break;
            case 'align-top':
                App.alignGroupButtons(groupId, 'top');
                break;
            case 'align-middle':
                App.alignGroupButtons(groupId, 'middle');
                break;
            case 'align-bottom':
                App.alignGroupButtons(groupId, 'bottom');
                break;
            case 'auto-resize':
                App.autoResizeGroup(groupId);
                break;
        }
    },

    // Switch content panel
    switchContentPanel(prefix, type) {
        document.querySelectorAll(`#${prefix}-content-panels .content-panel`).forEach(panel => {
            panel.classList.remove('active');
        });
        
        const panelId = `${prefix}-${type.toLowerCase()}-panel`;
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.add('active');
        }
    },

    // Initialize color picker
    initColorPicker(inputId, buttonId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);
        
        button.addEventListener('click', () => input.click());
        
        input.addEventListener('input', () => {
            button.style.backgroundColor = input.value;
            button.style.color = Utils.getContrastColor(input.value);
        });
    },

    // Show font dialog
    showFontDialog(currentFont, callback) {
        this.currentFontCallback = callback;
        
        const parsed = Utils.parseFont(currentFont);
        document.getElementById('font-family').value = parsed.family;
        document.getElementById('font-size').value = parsed.size;
        document.getElementById('font-bold').checked = parsed.bold;
        document.getElementById('font-italic').checked = parsed.italic;
        
        // Update preview
        const preview = document.getElementById('font-preview');
        preview.style.fontFamily = `"${parsed.family}", sans-serif`;
        preview.style.fontSize = `${parsed.size}px`;
        preview.style.fontWeight = parsed.bold ? 'bold' : 'normal';
        preview.style.fontStyle = parsed.italic ? 'italic' : 'normal';
        
        this.showDialog('font-dialog');
    },

    // Show Add Note dialog
    showAddNoteDialog(x = 50, y = 50) {
        // Reset form
        document.getElementById('add-title').value = '';
        document.getElementById('add-content').value = '';
        document.getElementById('add-content-type').value = 'Text';
        this.switchContentPanel('add', 'Text');
        
        // Set default colors from config
        const config = App.getConfig();
        const bgColor = config.unitStyle.backgroundColor || '#6495ED';
        const textColor = config.unitStyle.textColor || '#FFFFFF';
        
        document.getElementById('add-bg-color').value = bgColor;
        document.getElementById('add-bg-color-btn').style.backgroundColor = bgColor;
        document.getElementById('add-text-color').value = textColor;
        document.getElementById('add-text-color-btn').style.backgroundColor = textColor;
        
        const fontStr = Utils.buildFontString(
            config.unitStyle.fontFamily || 'Segoe UI',
            config.unitStyle.fontSize || 12
        );
        document.getElementById('add-font-btn').textContent = fontStr;
        
        // Populate groups
        this.populateGroupSelect('add-group');
        
        // Store position
        document.getElementById('add-note-dialog').dataset.x = x;
        document.getElementById('add-note-dialog').dataset.y = y;
        
        // Clear image/object data
        document.getElementById('add-image-preview').innerHTML = '';
        document.getElementById('add-image-preview').dataset.imageData = '';
        document.getElementById('add-object-summary').textContent = '';
        document.getElementById('add-object-summary').dataset.objectData = '';
        
        this.showDialog('add-note-dialog');
    },

    // Show Edit Note dialog
    showEditNoteDialog(note) {
        document.getElementById('edit-title').value = note.title || '';
        
        // Set colors
        const bgColor = note.backgroundColor || '#6495ED';
        const textColor = note.textColor || '#FFFFFF';
        
        document.getElementById('edit-bg-color').value = bgColor;
        document.getElementById('edit-bg-color-btn').style.backgroundColor = bgColor;
        document.getElementById('edit-text-color').value = textColor;
        document.getElementById('edit-text-color-btn').style.backgroundColor = textColor;
        
        // Set font
        const fontStr = Utils.buildFontString(
            note.fontFamily || 'Segoe UI',
            note.fontSize || 12,
            note.fontBold || false,
            note.fontItalic || false
        );
        document.getElementById('edit-font-btn').textContent = fontStr;
        
        // Populate groups
        this.populateGroupSelect('edit-group', note.groupId);
        
        // Set content type and content
        const contentType = note.contentType || 'Text';
        document.getElementById('edit-content-type').value = contentType;
        this.switchContentPanel('edit', contentType);
        
        if (contentType === 'Text') {
            document.getElementById('edit-content').value = note.content || '';
        } else if (contentType === 'Image') {
            if (note.contentData) {
                const preview = document.getElementById('edit-image-preview');
                preview.textContent = '';
                const img = document.createElement('img');
                img.src = note.contentData;
                img.alt = 'Preview';
                preview.appendChild(img);
                preview.dataset.imageData = note.contentData;
            }
        } else if (contentType === 'Object') {
            if (note.contentData) {
                document.getElementById('edit-object-summary').textContent = `Object data stored`;
                document.getElementById('edit-object-summary').dataset.objectData = note.contentData;
            }
        }
        
        // Store note ID
        document.getElementById('edit-note-dialog').dataset.noteId = note.id;
        
        this.showDialog('edit-note-dialog');
    },

    // Show Group dialog
    showGroupDialog(group = null) {
        const isEdit = group !== null;
        
        document.getElementById('group-dialog-title').textContent = isEdit ? 'Edit Group' : 'Add Group';
        
        if (isEdit) {
            document.getElementById('group-title').value = group.title || '';
            document.getElementById('group-x').value = group.x || 50;
            document.getElementById('group-y').value = group.y || 50;
            document.getElementById('group-width').value = group.width || 300;
            document.getElementById('group-height').value = group.height || 200;
            
            const borderColor = group.borderColor || '#3498DB';
            const bgColor = group.backgroundColor || '#ECF0F1';
            const textColor = group.textColor || '#2C3E50';
            
            document.getElementById('group-border-color').value = borderColor;
            document.getElementById('group-border-color-btn').style.backgroundColor = borderColor;
            document.getElementById('group-bg-color').value = bgColor;
            document.getElementById('group-bg-color-btn').style.backgroundColor = bgColor;
            document.getElementById('group-text-color').value = textColor;
            document.getElementById('group-text-color-btn').style.backgroundColor = textColor;
            
            document.getElementById('group-dialog').dataset.groupId = group.id;
        } else {
            document.getElementById('group-title').value = '';
            document.getElementById('group-x').value = 50;
            document.getElementById('group-y').value = 50;
            document.getElementById('group-width').value = 300;
            document.getElementById('group-height').value = 200;
            
            document.getElementById('group-border-color').value = '#3498DB';
            document.getElementById('group-border-color-btn').style.backgroundColor = '#3498DB';
            document.getElementById('group-bg-color').value = '#ECF0F1';
            document.getElementById('group-bg-color-btn').style.backgroundColor = '#ECF0F1';
            document.getElementById('group-text-color').value = '#2C3E50';
            document.getElementById('group-text-color-btn').style.backgroundColor = '#2C3E50';
            
            document.getElementById('group-dialog').dataset.groupId = '';
        }
        
        this.showDialog('group-dialog');
    },

    // Show Settings dialog
    showSettingsDialog() {
        this.loadSettingsFromConfig();
        this.refreshBackupList();
        this.showDialog('settings-dialog');
    },

    // Load settings from config
    loadSettingsFromConfig() {
        const config = App.getConfig();
        
        // General
        document.getElementById('setting-autosave').checked = config.general.autoSave;
        document.getElementById('setting-autosave-interval').value = config.general.autoSaveInterval;
        document.getElementById('setting-confirm-delete').checked = config.general.confirmDelete;
        document.getElementById('setting-confirm-reset').checked = config.general.confirmReset;
        document.getElementById('setting-confirm-exit').checked = config.general.confirmExit;
        document.getElementById('setting-show-tray').checked = config.general.showTrayIcon;
        document.getElementById('setting-minimize-to-tray').checked = config.general.minimizeToTray;
        document.getElementById('setting-close-to-tray').checked = config.general.closeToTray;
        document.getElementById('setting-start-minimized').checked = config.general.startMinimized;
        document.getElementById('setting-theme').value = config.general.theme;
        
        // Hotkeys
        document.getElementById('setting-hotkey-enabled').checked = config.hotkey.enabled;
        document.getElementById('setting-mod-ctrl').checked = config.hotkey.modifiers.includes('Control');
        document.getElementById('setting-mod-alt').checked = config.hotkey.modifiers.includes('Alt');
        document.getElementById('setting-mod-shift').checked = config.hotkey.modifiers.includes('Shift');
        document.getElementById('setting-hotkey').value = config.hotkey.key;
        
        // Window
        document.getElementById('setting-remember-position').checked = config.window.rememberPosition;
        document.getElementById('setting-remember-size').checked = config.window.rememberSize;
        document.getElementById('setting-always-on-top').checked = config.window.alwaysOnTop;
        
        // Default Style
        const bgColor = config.unitStyle.backgroundColor || '#6495ED';
        const textColor = config.unitStyle.textColor || '#FFFFFF';
        document.getElementById('setting-unit-bg').value = bgColor;
        document.getElementById('setting-unit-bg-btn').style.backgroundColor = bgColor;
        document.getElementById('setting-unit-text').value = textColor;
        document.getElementById('setting-unit-text-btn').style.backgroundColor = textColor;
        
        const fontStr = Utils.buildFontString(
            config.unitStyle.fontFamily || 'Segoe UI',
            config.unitStyle.fontSize || 12
        );
        document.getElementById('setting-unit-font-btn').textContent = fontStr;
        
        // Backup
        document.getElementById('setting-auto-backup').checked = config.general.autoBackup;
        document.getElementById('setting-backup-count').value = config.general.backupCount;
        
        // Advanced
        document.getElementById('setting-undo-levels').value = config.general.undoLevels;
        document.getElementById('setting-double-click-edit').checked = config.general.doubleClickToEdit;
        document.getElementById('setting-single-click-copy').checked = config.general.singleClickToCopy;
        document.getElementById('setting-enable-animations').checked = config.general.enableAnimations;
        document.getElementById('setting-gpu-mode').value = config.general.gpuMode || 'auto';
    },

    // Refresh backup list
    async refreshBackupList() {
        const list = await window.electronAPI.getBackupList();
        const select = document.getElementById('setting-backup-list');
        select.innerHTML = '';
        list.forEach(filename => {
            const option = document.createElement('option');
            option.value = filename;
            option.textContent = filename.replace('backup_', '').replace('.json', '');
            select.appendChild(option);
        });
    },

    // Show About dialog
    async showAboutDialog() {
        const version = await window.electronAPI.getAppVersion();
        document.getElementById('about-version').textContent = `Version ${version}`;
        this.showDialog('about-dialog');
    },

    // Populate group select
    populateGroupSelect(selectId, selectedGroupId = '') {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">(None)</option>';
        
        App.getGroups().forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.title;
            if (group.id === selectedGroupId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    },

    // Save Add Note
    saveAddNote() {
        const title = document.getElementById('add-title').value.trim();
        
        if (!title) {
            document.getElementById('add-title').classList.add('error');
            App.showStatus('Title is required');
            return;
        }
        
        document.getElementById('add-title').classList.remove('error');
        
        const dialog = document.getElementById('add-note-dialog');
        const contentType = document.getElementById('add-content-type').value;
        
        let content = '';
        let contentData = '';
        
        if (contentType === 'Text') {
            content = document.getElementById('add-content').value;
        } else if (contentType === 'Image') {
            contentData = document.getElementById('add-image-preview').dataset.imageData || '';
            if (!contentData) {
                App.showStatus('Please paste an image first');
                return;
            }
        } else if (contentType === 'Object') {
            contentData = document.getElementById('add-object-summary').dataset.objectData || '';
            if (!contentData) {
                App.showStatus('Please paste object data first');
                return;
            }
        }
        
        const fontStr = document.getElementById('add-font-btn').textContent;
        const parsedFont = Utils.parseFont(fontStr);
        
        const note = {
            id: Utils.generateId(),
            title: title,
            content: content,
            contentType: contentType,
            contentData: contentData,
            backgroundColor: document.getElementById('add-bg-color').value,
            textColor: document.getElementById('add-text-color').value,
            fontFamily: parsedFont.family,
            fontSize: parsedFont.size,
            fontBold: parsedFont.bold,
            fontItalic: parsedFont.italic,
            x: parseInt(dialog.dataset.x) || 50,
            y: parseInt(dialog.dataset.y) || 50,
            groupId: document.getElementById('add-group').value || null,
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString()
        };
        
        App.addNote(note);
        this.closeDialog('add-note-dialog');
    },

    // Save Edit Note
    saveEditNote() {
        const noteId = document.getElementById('edit-note-dialog').dataset.noteId;
        const title = document.getElementById('edit-title').value.trim();
        
        if (!title) {
            document.getElementById('edit-title').classList.add('error');
            App.showStatus('Title is required');
            return;
        }
        
        document.getElementById('edit-title').classList.remove('error');
        
        const contentType = document.getElementById('edit-content-type').value;
        
        let content = '';
        let contentData = '';
        
        if (contentType === 'Text') {
            content = document.getElementById('edit-content').value;
        } else if (contentType === 'Image') {
            contentData = document.getElementById('edit-image-preview').dataset.imageData || '';
        } else if (contentType === 'Object') {
            contentData = document.getElementById('edit-object-summary').dataset.objectData || '';
        }
        
        const fontStr = document.getElementById('edit-font-btn').textContent;
        const parsedFont = Utils.parseFont(fontStr);
        
        const updates = {
            title: title,
            content: content,
            contentType: contentType,
            contentData: contentData,
            backgroundColor: document.getElementById('edit-bg-color').value,
            textColor: document.getElementById('edit-text-color').value,
            fontFamily: parsedFont.family,
            fontSize: parsedFont.size,
            fontBold: parsedFont.bold,
            fontItalic: parsedFont.italic,
            groupId: document.getElementById('edit-group').value || null,
            modifiedDate: new Date().toISOString()
        };
        
        App.updateNote(noteId, updates);
        this.closeDialog('edit-note-dialog');
    },

    // Save Group
    saveGroup() {
        const title = document.getElementById('group-title').value.trim();
        
        if (!title) {
            document.getElementById('group-title').classList.add('error');
            App.showStatus('Title is required');
            return;
        }
        
        document.getElementById('group-title').classList.remove('error');
        
        const groupId = document.getElementById('group-dialog').dataset.groupId;
        const isEdit = !!groupId;
        
        const group = {
            id: isEdit ? groupId : Utils.generateId(),
            title: title,
            x: parseInt(document.getElementById('group-x').value) || 50,
            y: parseInt(document.getElementById('group-y').value) || 50,
            width: Math.max(100, parseInt(document.getElementById('group-width').value) || 300),
            height: Math.max(80, parseInt(document.getElementById('group-height').value) || 200),
            borderColor: document.getElementById('group-border-color').value,
            backgroundColor: document.getElementById('group-bg-color').value,
            textColor: document.getElementById('group-text-color').value
        };
        
        if (isEdit) {
            App.updateGroup(groupId, group);
        } else {
            App.addGroup(group);
        }
        
        this.closeDialog('group-dialog');
    },

    // Save Settings
    async saveSettings() {
        const config = App.getConfig();
        
        // General
        config.general.autoSave = document.getElementById('setting-autosave').checked;
        config.general.autoSaveInterval = parseInt(document.getElementById('setting-autosave-interval').value) || 30;
        config.general.confirmDelete = document.getElementById('setting-confirm-delete').checked;
        config.general.confirmReset = document.getElementById('setting-confirm-reset').checked;
        config.general.confirmExit = document.getElementById('setting-confirm-exit').checked;
        config.general.showTrayIcon = document.getElementById('setting-show-tray').checked;
        config.general.minimizeToTray = document.getElementById('setting-minimize-to-tray').checked;
        config.general.closeToTray = document.getElementById('setting-close-to-tray').checked;
        config.general.startMinimized = document.getElementById('setting-start-minimized').checked;
        config.general.theme = document.getElementById('setting-theme').value;
        
        // Hotkeys
        config.hotkey.enabled = document.getElementById('setting-hotkey-enabled').checked;
        config.hotkey.modifiers = [];
        if (document.getElementById('setting-mod-ctrl').checked) config.hotkey.modifiers.push('Control');
        if (document.getElementById('setting-mod-alt').checked) config.hotkey.modifiers.push('Alt');
        if (document.getElementById('setting-mod-shift').checked) config.hotkey.modifiers.push('Shift');
        config.hotkey.key = document.getElementById('setting-hotkey').value;
        
        // Window
        config.window.rememberPosition = document.getElementById('setting-remember-position').checked;
        config.window.rememberSize = document.getElementById('setting-remember-size').checked;
        config.window.alwaysOnTop = document.getElementById('setting-always-on-top').checked;
        
        // Default Style
        config.unitStyle.backgroundColor = document.getElementById('setting-unit-bg').value;
        config.unitStyle.textColor = document.getElementById('setting-unit-text').value;
        
        const fontStr = document.getElementById('setting-unit-font-btn').textContent;
        const parsedFont = Utils.parseFont(fontStr);
        config.unitStyle.fontFamily = parsedFont.family;
        config.unitStyle.fontSize = parsedFont.size;
        
        // Backup
        config.general.autoBackup = document.getElementById('setting-auto-backup').checked;
        config.general.backupCount = parseInt(document.getElementById('setting-backup-count').value) || 10;
        
        // Advanced
        config.general.undoLevels = parseInt(document.getElementById('setting-undo-levels').value) || 20;
        config.general.doubleClickToEdit = document.getElementById('setting-double-click-edit').checked;
        config.general.singleClickToCopy = document.getElementById('setting-single-click-copy').checked;
        config.general.enableAnimations = document.getElementById('setting-enable-animations').checked;
        
        const previousGpuMode = config.general.gpuMode || 'auto';
        config.general.gpuMode = document.getElementById('setting-gpu-mode').value;
        const gpuModeChanged = previousGpuMode !== config.general.gpuMode;
        
        App.saveConfig(config);
        this.closeDialog('settings-dialog');
        App.showStatus('Settings saved');
        
        // Prompt restart if GPU mode changed
        if (gpuModeChanged) {
            const modeLabels = { auto: 'Auto', gpu: 'GPU', cpu: 'CPU' };
            const confirmed = await window.electronAPI.showConfirmDialog({
                title: 'Restart Required',
                message: `Rendering mode changed to "${modeLabels[config.general.gpuMode]}". The app needs to restart for this change to take effect.\n\nRestart now?`,
                buttons: ['Restart Now', 'Later']
            });
            if (confirmed) {
                window.electronAPI.restartApp();
            }
        }
    }
};

window.Dialogs = Dialogs;
