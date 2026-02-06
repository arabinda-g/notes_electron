// Main Application Logic

const App = {
    // State
    data: { units: {}, groups: {} },
    config: null,
    undoManager: null,
    
    // UI State
    selectedNotes: new Set(),
    selectedGroup: null,
    copiedStyle: null,
    isMovable: true,
    autoArrange: false,
    autofocus: false,
    
    // Drag state
    isDragging: false,
    hasDragged: false, // True only if mouse actually moved during drag
    dragStartX: 0,
    dragStartY: 0,
    dragOffsets: {},
    
    // Selection rectangle
    isSelecting: false,
    selectionStartX: 0,
    selectionStartY: 0,
    
    // Group resize
    isResizingGroup: false,
    resizingGroupId: null,
    resizeStartWidth: 0,
    resizeStartHeight: 0,
    
    // Timers
    autoSaveTimer: null,
    statusTimer: null,
    clickTimer: null,
    
    // DOM references
    panelContainer: null,
    statusLabel: null,
    selectionRect: null,

    // Initialize application
    async init() {
        this.panelContainer = document.getElementById('panel-container');
        this.statusLabel = document.getElementById('status-label');
        this.selectionRect = document.getElementById('selection-rect');
        
        // Load data and config
        const storeData = await window.electronAPI.getStoreData();
        this.data = this.migrateData(storeData.jsonData);
        this.config = storeData.config;
        
        // Initialize undo manager
        this.undoManager = new UndoRedoManager(this.config.general.undoLevels || 20);
        
        // Initialize dialogs
        Dialogs.init();
        
        // Apply theme
        await this.applyTheme();
        
        // Apply animations setting
        this.applyAnimationsSetting();
        
        // Render notes and groups
        this.render();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup auto-save
        this.setupAutoSave();
        
        // Listen for theme changes
        window.electronAPI.onThemeChanged((theme) => {
            if (this.config.general.theme === 'SystemDefault') {
                this.setTheme(theme);
            }
        });
        
        // Menu commands
        window.electronAPI.onMenuCommand((command, data) => {
            this.handleMenuCommand(command, data);
        });
        
        // Import data
        window.electronAPI.onImportData((data) => {
            this.importData(data);
        });
        
        // Export request
        window.electronAPI.onRequestExport((filePath) => {
            this.exportData(filePath);
        });
        
        // Welcome note if empty
        if (Object.keys(this.data.units).length === 0) {
            this.createWelcomeNote();
        }
        
        this.showStatus('Ready');
    },

    // Migrate data from .NET format
    migrateData(data) {
        if (!data) return { units: {}, groups: {} };
        
        // Handle .NET format (Units/Groups with capital letters)
        const units = data.units || data.Units || {};
        const groups = data.groups || data.Groups || {};
        
        // Convert units
        const migratedUnits = {};
        Object.entries(units).forEach(([key, unit]) => {
            migratedUnits[key] = {
                id: unit.id ?? unit.Id ?? key,
                title: unit.title ?? unit.Title ?? '',
                content: unit.content ?? unit.Content ?? unit.ContentData ?? '',
                contentType: unit.contentType ?? unit.ContentType ?? 'Text',
                contentData: unit.contentData ?? unit.ContentData ?? '',
                backgroundColor: this.convertColor(unit.backgroundColor ?? unit.BackgroundColor),
                textColor: this.convertColor(unit.textColor ?? unit.TextColor),
                fontFamily: unit.fontFamily || (unit.Font ? unit.Font.split(',')[0] : 'Segoe UI'),
                fontSize: unit.fontSize ?? 12,
                fontBold: unit.fontBold ?? false,
                fontItalic: unit.fontItalic ?? false,
                x: unit.x ?? unit.X ?? 50,
                y: unit.y ?? unit.Y ?? 50,
                groupId: unit.groupId ?? unit.GroupId ?? null,
                buttonType: unit.buttonType ?? unit.ButtonType ?? null,
                createdDate: unit.createdDate ?? unit.CreatedDate ?? new Date().toISOString(),
                modifiedDate: unit.modifiedDate ?? unit.ModifiedDate ?? new Date().toISOString()
            };
        });
        
        // Convert groups
        const migratedGroups = {};
        Object.entries(groups).forEach(([key, group]) => {
            migratedGroups[key] = {
                id: group.id ?? group.Id ?? key,
                title: group.title ?? group.Title ?? '',
                x: group.x ?? group.X ?? 50,
                y: group.y ?? group.Y ?? 50,
                width: group.width ?? group.Width ?? 300,
                height: group.height ?? group.Height ?? 200,
                borderColor: this.convertColor(group.borderColor ?? group.BorderColor),
                backgroundColor: this.convertColor(group.backgroundColor ?? group.BackgroundColor),
                textColor: this.convertColor(group.textColor ?? group.TextColor),
                groupBoxType: group.groupBoxType ?? group.GroupBoxType ?? null
            };
        });
        
        return { units: migratedUnits, groups: migratedGroups };
    },

    // Convert color from ARGB int to hex
    convertColor(color) {
        if (!color) return '#6495ED';
        if (typeof color === 'string') return color;
        return Utils.argbToHex(color);
    },

    // Setup event listeners
    setupEventListeners() {
        // Panel mouse events for selection rectangle
        this.panelContainer.addEventListener('mousedown', (e) => this.onPanelMouseDown(e));
        // Use document for mousemove/mouseup so dragging works even when mouse leaves panel
        document.addEventListener('mousemove', (e) => this.onPanelMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onPanelMouseUp(e));
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // Prevent context menu on panel
        this.panelContainer.addEventListener('contextmenu', (e) => {
            if (e.target === this.panelContainer) {
                e.preventDefault();
            }
        });

        // Drag and drop for file import
        this.panelContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        
        this.panelContainer.addEventListener('drop', async (e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            const jsonFile = files.find(f => f.name.endsWith('.json'));
            if (jsonFile) {
                const text = await jsonFile.text();
                try {
                    const data = JSON.parse(text);
                    this.importData(data);
                } catch (err) {
                    this.showStatus('Invalid JSON file');
                }
            }
        });
    },

    // Panel mouse down
    onPanelMouseDown(e) {
        if (e.target !== this.panelContainer) return;
        if (e.button !== 0) return;
        
        // Start selection rectangle
        this.isSelecting = true;
        const rect = this.panelContainer.getBoundingClientRect();
        this.selectionStartX = e.clientX - rect.left + this.panelContainer.scrollLeft;
        this.selectionStartY = e.clientY - rect.top + this.panelContainer.scrollTop;
        
        // Clear selection if not holding Ctrl
        if (!e.ctrlKey) {
            this.clearSelection();
        }
    },

    // Panel mouse move
    onPanelMouseMove(e) {
        if (this.isSelecting) {
            const rect = this.panelContainer.getBoundingClientRect();
            const currentX = e.clientX - rect.left + this.panelContainer.scrollLeft;
            const currentY = e.clientY - rect.top + this.panelContainer.scrollTop;
            
            const x = Math.min(this.selectionStartX, currentX);
            const y = Math.min(this.selectionStartY, currentY);
            const width = Math.abs(currentX - this.selectionStartX);
            const height = Math.abs(currentY - this.selectionStartY);
            
            this.selectionRect.style.left = x + 'px';
            this.selectionRect.style.top = y + 'px';
            this.selectionRect.style.width = width + 'px';
            this.selectionRect.style.height = height + 'px';
            this.selectionRect.style.display = 'block';
            
            // Highlight notes in selection
            this.updateSelectionFromRect({ x, y, width, height });
        }
        
        if (this.isDragging && this.isMovable) {
            this.hasDragged = true;
            const rect = this.panelContainer.getBoundingClientRect();
            const currentX = e.clientX - rect.left + this.panelContainer.scrollLeft;
            const currentY = e.clientY - rect.top + this.panelContainer.scrollTop;
            
            this.selectedNotes.forEach(noteId => {
                const offset = this.dragOffsets[noteId];
                if (offset) {
                    const newX = Math.max(0, currentX - offset.x);
                    const newY = Math.max(0, currentY - offset.y);
                    this.moveNoteElement(noteId, newX, newY);
                }
            });
        }
        
        if (this.isResizingGroup) {
            const rect = this.panelContainer.getBoundingClientRect();
            const currentX = e.clientX - rect.left + this.panelContainer.scrollLeft;
            const currentY = e.clientY - rect.top + this.panelContainer.scrollTop;
            
            const group = this.data.groups[this.resizingGroupId];
            if (group) {
                const newWidth = Math.max(100, currentX - group.x);
                const newHeight = Math.max(80, currentY - group.y);
                this.resizeGroupElement(this.resizingGroupId, newWidth, newHeight);
            }
        }
    },

    // Panel mouse up
    onPanelMouseUp(e) {
        if (this.isSelecting) {
            this.isSelecting = false;
            this.selectionRect.style.display = 'none';
        }
        
        if (this.isDragging) {
            this.isDragging = false;
            document.querySelectorAll('.note-button.dragging').forEach(el => el.classList.remove('dragging'));
            
            // Only save undo/data if mouse actually moved (avoid wasting undo levels on clicks)
            if (this.hasDragged) {
                // Save state for undo BEFORE updating data (data still has pre-move positions)
                this.undoManager.saveState(this.data, 'Move notes');
                
                // Update data from DOM positions
                this.selectedNotes.forEach(noteId => {
                    const element = document.getElementById(`note-${noteId}`);
                    if (element) {
                        this.data.units[noteId].x = parseInt(element.style.left);
                        this.data.units[noteId].y = parseInt(element.style.top);
                    }
                });
                
                this.saveData();
            }
            this.hasDragged = false;
        }
        
        if (this.isResizingGroup) {
            // Save state for undo BEFORE updating data (data still has pre-resize dimensions)
            this.undoManager.saveState(this.data, 'Resize group');
            
            const element = document.getElementById(`group-${this.resizingGroupId}`);
            if (element) {
                this.data.groups[this.resizingGroupId].width = parseInt(element.style.width);
                this.data.groups[this.resizingGroupId].height = parseInt(element.style.height);
            }
            this.isResizingGroup = false;
            this.resizingGroupId = null;
            this.saveData();
        }
    },

    // Update selection from rectangle
    updateSelectionFromRect(selRect) {
        Object.values(this.data.units).forEach(note => {
            const noteRect = {
                x: note.x,
                y: note.y,
                width: 80,
                height: 28
            };
            
            // Get actual element dimensions
            const element = document.getElementById(`note-${note.id}`);
            if (element) {
                noteRect.width = element.offsetWidth;
                noteRect.height = element.offsetHeight;
            }
            
            if (Utils.rectanglesOverlap(selRect, noteRect)) {
                this.selectedNotes.add(note.id);
                element?.classList.add('selected');
            }
        });
    },

    // Keyboard events
    onKeyDown(e) {
        // Ignore if in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }
        
        if (e.key === 'Delete') {
            if (this.selectedNotes.size > 0) {
                this.deleteSelectedNotes();
            }
        } else if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            this.selectAll();
        } else if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            this.undo();
        } else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            this.redo();
        }
    },

    // Render all notes and groups
    render() {
        // Clear container
        this.panelContainer.innerHTML = '';
        
        // Render groups first (they go behind notes)
        Object.values(this.data.groups).forEach(group => {
            this.renderGroup(group);
        });
        
        // Render notes
        Object.values(this.data.units).forEach(note => {
            this.renderNote(note);
        });
    },

    // Render single note
    renderNote(note) {
        const button = document.createElement('button');
        button.id = `note-${note.id}`;
        button.className = 'note-button';
        button.textContent = note.title || 'Untitled';
        
        // Position
        button.style.left = note.x + 'px';
        button.style.top = note.y + 'px';
        
        // Colors
        button.style.backgroundColor = note.backgroundColor || '#6495ED';
        button.style.color = note.textColor || '#FFFFFF';
        
        // Font
        button.style.fontFamily = `"${note.fontFamily || 'Segoe UI'}", sans-serif`;
        button.style.fontSize = (note.fontSize || 12) + 'px';
        if (note.fontBold) button.style.fontWeight = 'bold';
        if (note.fontItalic) button.style.fontStyle = 'italic';
        
        // Apply button type style
        if (note.buttonType) {
            // Try .NET button type mapping first, then ButtonStyles lookup
            const mappedClass = Utils.mapButtonType(note.buttonType);
            if (mappedClass) {
                button.classList.add('style-' + mappedClass);
            } else {
                const styleClass = ButtonStyles.getStyleClass(note.buttonType);
                if (styleClass) {
                    button.classList.add(styleClass);
                }
            }
        }
        
        // Events
        button.addEventListener('mousedown', (e) => this.onNoteMouseDown(e, note.id));
        button.addEventListener('click', (e) => this.onNoteClick(e, note.id));
        button.addEventListener('dblclick', (e) => this.onNoteDblClick(e, note.id));
        button.addEventListener('contextmenu', (e) => this.onNoteContextMenu(e, note.id));
        
        this.panelContainer.appendChild(button);
        
        // Mark as selected if needed
        if (this.selectedNotes.has(note.id)) {
            button.classList.add('selected');
        }
    },

    // Render single group
    renderGroup(group) {
        const groupEl = document.createElement('div');
        groupEl.id = `group-${group.id}`;
        groupEl.className = 'group-box';
        
        // Position and size
        groupEl.style.left = group.x + 'px';
        groupEl.style.top = group.y + 'px';
        groupEl.style.width = group.width + 'px';
        groupEl.style.height = group.height + 'px';
        
        // Colors
        groupEl.style.borderColor = group.borderColor || '#3498DB';
        groupEl.style.backgroundColor = group.backgroundColor || '#ECF0F1';
        
        // Title
        const title = document.createElement('div');
        title.className = 'group-box-title';
        title.textContent = group.title || 'Untitled Group';
        title.style.color = group.textColor || '#2C3E50';
        title.style.backgroundColor = group.backgroundColor || '#ECF0F1';
        groupEl.appendChild(title);
        
        // Content area
        const content = document.createElement('div');
        content.className = 'group-box-content';
        groupEl.appendChild(content);
        
        // Resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'group-resize-handle';
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.isResizingGroup = true;
            this.resizingGroupId = group.id;
        });
        groupEl.appendChild(resizeHandle);
        
        // Apply group style
        if (group.groupBoxType) {
            // Try .NET group type mapping first, then GroupStyles lookup
            const mappedClass = Utils.mapGroupType(group.groupBoxType);
            if (mappedClass) {
                groupEl.classList.add('style-' + mappedClass);
            } else {
                const styleClass = GroupStyles.getStyleClass(group.groupBoxType);
                if (styleClass) {
                    groupEl.classList.add(styleClass);
                }
            }
        }
        
        // Events
        groupEl.addEventListener('contextmenu', (e) => {
            if (e.target === groupEl || e.target === title || e.target === content) {
                e.preventDefault();
                e.stopPropagation();
                this.selectedGroup = group.id;
                Dialogs.showGroupContextMenu(e.clientX, e.clientY, group.id);
            }
        });
        
        this.panelContainer.appendChild(groupEl);
    },

    // Note mouse down
    onNoteMouseDown(e, noteId) {
        if (e.button !== 0) return;
        
        // Add to selection
        if (e.ctrlKey) {
            if (this.selectedNotes.has(noteId)) {
                this.selectedNotes.delete(noteId);
                document.getElementById(`note-${noteId}`)?.classList.remove('selected');
            } else {
                this.selectedNotes.add(noteId);
                document.getElementById(`note-${noteId}`)?.classList.add('selected');
            }
        } else {
            if (!this.selectedNotes.has(noteId)) {
                this.clearSelection();
                this.selectedNotes.add(noteId);
                document.getElementById(`note-${noteId}`)?.classList.add('selected');
            }
        }
        
        // Start drag
        if (this.isMovable && this.selectedNotes.size > 0) {
            this.isDragging = true;
            this.hasDragged = false;
            
            const rect = this.panelContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left + this.panelContainer.scrollLeft;
            const mouseY = e.clientY - rect.top + this.panelContainer.scrollTop;
            
            this.dragOffsets = {};
            this.selectedNotes.forEach(id => {
                const note = this.data.units[id];
                if (note) {
                    this.dragOffsets[id] = {
                        x: mouseX - note.x,
                        y: mouseY - note.y
                    };
                }
                document.getElementById(`note-${id}`)?.classList.add('dragging');
            });
        }
    },

    // Note click
    onNoteClick(e, noteId) {
        e.stopPropagation();
        
        if (this.config.general.singleClickToCopy) {
            // Use timer to distinguish from double-click
            if (this.clickTimer) {
                clearTimeout(this.clickTimer);
                this.clickTimer = null;
            } else {
                this.clickTimer = setTimeout(() => {
                    this.clickTimer = null;
                    this.copyNoteToClipboard(noteId);
                }, 200);
            }
        }
    },

    // Note double click
    onNoteDblClick(e, noteId) {
        e.stopPropagation();
        
        if (this.clickTimer) {
            clearTimeout(this.clickTimer);
            this.clickTimer = null;
        }
        
        if (this.config.general.doubleClickToEdit) {
            this.editNote(noteId);
        }
    },

    // Note context menu
    onNoteContextMenu(e, noteId) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!this.selectedNotes.has(noteId)) {
            this.clearSelection();
            this.selectedNotes.add(noteId);
            document.getElementById(`note-${noteId}`)?.classList.add('selected');
        }
        
        Dialogs.showNoteContextMenu(e.clientX, e.clientY, noteId);
    },

    // Move note element
    moveNoteElement(noteId, x, y) {
        const element = document.getElementById(`note-${noteId}`);
        if (element) {
            element.style.left = x + 'px';
            element.style.top = y + 'px';
        }
    },

    // Resize group element
    resizeGroupElement(groupId, width, height) {
        const element = document.getElementById(`group-${groupId}`);
        if (element) {
            element.style.width = width + 'px';
            element.style.height = height + 'px';
        }
    },

    // Clear selection
    clearSelection() {
        this.selectedNotes.forEach(id => {
            document.getElementById(`note-${id}`)?.classList.remove('selected');
        });
        this.selectedNotes.clear();
    },

    // Select all
    selectAll() {
        Object.keys(this.data.units).forEach(id => {
            this.selectedNotes.add(id);
            document.getElementById(`note-${id}`)?.classList.add('selected');
        });
    },

    // Add note
    addNote(note) {
        this.undoManager.saveState(this.data, 'Add note');
        this.data.units[note.id] = note;
        this.renderNote(note);
        this.saveData();
        this.showStatus('Note added');
        
        if (this.autofocus) {
            this.clearSelection();
            this.selectedNotes.add(note.id);
            document.getElementById(`note-${note.id}`)?.classList.add('selected');
        }
    },

    // Update note
    updateNote(noteId, updates) {
        this.undoManager.saveState(this.data, 'Update note');
        Object.assign(this.data.units[noteId], updates);
        
        // Re-render note
        const oldElement = document.getElementById(`note-${noteId}`);
        if (oldElement) {
            oldElement.remove();
        }
        this.renderNote(this.data.units[noteId]);
        
        this.saveData();
        this.showStatus('Note updated');
    },

    // Delete note
    async deleteNote(noteId) {
        if (this.config.general.confirmDelete) {
            const confirmed = await window.electronAPI.showConfirmDialog({
                title: 'Delete Note',
                message: 'Are you sure you want to delete this note?'
            });
            if (!confirmed) return;
        }
        
        this.undoManager.saveState(this.data, 'Delete note');
        delete this.data.units[noteId];
        document.getElementById(`note-${noteId}`)?.remove();
        this.selectedNotes.delete(noteId);
        this.saveData();
        this.showStatus('Note deleted');
    },

    // Delete selected notes
    async deleteSelectedNotes() {
        if (this.selectedNotes.size === 0) return;
        
        if (this.config.general.confirmDelete) {
            const confirmed = await window.electronAPI.showConfirmDialog({
                title: 'Delete Notes',
                message: `Are you sure you want to delete ${this.selectedNotes.size} note(s)?`
            });
            if (!confirmed) return;
        }
        
        this.undoManager.saveState(this.data, 'Delete notes');
        this.selectedNotes.forEach(id => {
            delete this.data.units[id];
            document.getElementById(`note-${id}`)?.remove();
        });
        this.selectedNotes.clear();
        this.saveData();
        this.showStatus('Notes deleted');
    },

    // Duplicate note
    duplicateNote(noteId) {
        const original = this.data.units[noteId];
        if (!original) return;
        
        const newNote = Utils.deepClone(original);
        newNote.id = Utils.generateId();
        newNote.x += 20;
        newNote.y += 20;
        newNote.createdDate = new Date().toISOString();
        newNote.modifiedDate = new Date().toISOString();
        
        this.addNote(newNote);
    },

    // Copy note content to clipboard
    async copyNoteToClipboard(noteId, transform = null) {
        const note = this.data.units[noteId];
        if (!note) return;
        
        let content = note.content || note.title;
        
        if (transform === 'lower') {
            content = content.toLowerCase();
        } else if (transform === 'upper') {
            content = content.toUpperCase();
        }
        
        if (note.contentType === 'Image' && note.contentData) {
            await window.electronAPI.writeClipboardImage(note.contentData);
            this.showStatus('Image copied to clipboard');
        } else {
            await window.electronAPI.writeClipboardText(content);
            this.showStatus('Copied to clipboard');
        }
    },

    // Copy note content
    copyNoteContent(noteId, transform) {
        this.copyNoteToClipboard(noteId, transform);
    },

    // Edit note
    editNote(noteId) {
        const note = this.data.units[noteId];
        if (note) {
            Dialogs.showEditNoteDialog(note);
        }
    },

    // Copy style
    copyStyle(noteId) {
        const note = this.data.units[noteId];
        if (note) {
            this.copiedStyle = {
                backgroundColor: note.backgroundColor,
                textColor: note.textColor,
                fontFamily: note.fontFamily,
                fontSize: note.fontSize,
                fontBold: note.fontBold,
                fontItalic: note.fontItalic,
                buttonType: note.buttonType
            };
            this.showStatus('Style copied');
        }
    },

    // Paste style
    pasteStyle(noteId) {
        if (!this.copiedStyle) {
            this.showStatus('No style copied');
            return;
        }
        
        this.updateNote(noteId, this.copiedStyle);
    },

    // Apply style to selected notes
    applyStyleToSelected(styleName) {
        if (this.selectedNotes.size === 0) return;
        
        this.undoManager.saveState(this.data, 'Apply style');
        
        const style = ButtonStyles.getStyle(styleName);
        if (!style) return;
        
        this.selectedNotes.forEach(noteId => {
            const element = document.getElementById(`note-${noteId}`);
            if (element) {
                ButtonStyles.applyStyle(element, styleName);
            }
            
            // Update data - persist style name so it survives re-render/reload
            if (this.data.units[noteId]) {
                this.data.units[noteId].buttonType = styleName;
                if (style.bg) {
                    this.data.units[noteId].backgroundColor = style.bg;
                    this.data.units[noteId].textColor = style.text;
                }
            }
        });
        
        this.saveData();
        this.showStatus(`Applied "${styleName}" style`);
    },

    // Add note to group
    addNoteToGroup(noteId, groupId) {
        this.undoManager.saveState(this.data, 'Add to group');
        this.data.units[noteId].groupId = groupId;
        this.saveData();
        this.showStatus('Added to group');
    },

    // Remove note from group
    removeNoteFromGroup(noteId) {
        this.undoManager.saveState(this.data, 'Remove from group');
        this.data.units[noteId].groupId = null;
        this.saveData();
        this.showStatus('Removed from group');
    },

    // Add group
    addGroup(group) {
        this.undoManager.saveState(this.data, 'Add group');
        this.data.groups[group.id] = group;
        this.renderGroup(group);
        this.saveData();
        this.showStatus('Group added');
    },

    // Update group
    updateGroup(groupId, updates) {
        this.undoManager.saveState(this.data, 'Update group');
        Object.assign(this.data.groups[groupId], updates);
        
        // Re-render group
        const oldElement = document.getElementById(`group-${groupId}`);
        if (oldElement) {
            oldElement.remove();
        }
        this.renderGroup(this.data.groups[groupId]);
        
        this.saveData();
        this.showStatus('Group updated');
    },

    // Delete group
    async deleteGroup(groupId) {
        if (this.config.general.confirmDelete) {
            const confirmed = await window.electronAPI.showConfirmDialog({
                title: 'Delete Group',
                message: 'Are you sure you want to delete this group? Notes in the group will not be deleted.'
            });
            if (!confirmed) return;
        }
        
        this.undoManager.saveState(this.data, 'Delete group');
        
        // Remove group reference from notes
        Object.values(this.data.units).forEach(note => {
            if (note.groupId === groupId) {
                note.groupId = null;
            }
        });
        
        delete this.data.groups[groupId];
        document.getElementById(`group-${groupId}`)?.remove();
        this.saveData();
        this.showStatus('Group deleted');
    },

    // Edit group
    editGroup(groupId) {
        const group = this.data.groups[groupId];
        if (group) {
            Dialogs.showGroupDialog(group);
        }
    },

    // Apply group style
    applyGroupStyle(styleName) {
        if (!this.selectedGroup) return;
        
        this.undoManager.saveState(this.data, 'Apply group style');
        
        const element = document.getElementById(`group-${this.selectedGroup}`);
        if (element) {
            GroupStyles.applyStyle(element, styleName);
        }
        
        // Persist the style to data so it survives re-render/reload
        if (this.data.groups[this.selectedGroup]) {
            this.data.groups[this.selectedGroup].groupBoxType = styleName;
        }
        
        this.saveData();
        this.showStatus(`Applied "${styleName}" style`);
    },

    // Add note to group at position
    addNoteToGroupAtPosition(groupId) {
        const group = this.data.groups[groupId];
        if (group) {
            Dialogs.showAddNoteDialog(group.x + 20, group.y + 40);
            // Set group in dialog
            setTimeout(() => {
                document.getElementById('add-group').value = groupId;
            }, 50);
        }
    },

    // Align group buttons
    alignGroupButtons(groupId, alignment) {
        const group = this.data.groups[groupId];
        if (!group) return;
        
        const notesInGroup = Object.values(this.data.units).filter(n => n.groupId === groupId);
        if (notesInGroup.length === 0) return;
        
        this.undoManager.saveState(this.data, 'Align buttons');
        
        notesInGroup.forEach(note => {
            switch (alignment) {
                case 'left':
                    note.x = group.x + 10;
                    break;
                case 'center':
                    const element = document.getElementById(`note-${note.id}`);
                    const width = element ? element.offsetWidth : 80;
                    note.x = group.x + (group.width - width) / 2;
                    break;
                case 'right':
                    const el = document.getElementById(`note-${note.id}`);
                    const w = el ? el.offsetWidth : 80;
                    note.x = group.x + group.width - w - 10;
                    break;
                case 'top':
                    note.y = group.y + 30;
                    break;
                case 'middle':
                    const elem = document.getElementById(`note-${note.id}`);
                    const height = elem ? elem.offsetHeight : 28;
                    note.y = group.y + (group.height - height) / 2;
                    break;
                case 'bottom':
                    const e = document.getElementById(`note-${note.id}`);
                    const h = e ? e.offsetHeight : 28;
                    note.y = group.y + group.height - h - 10;
                    break;
            }
            
            this.moveNoteElement(note.id, note.x, note.y);
        });
        
        this.saveData();
        this.showStatus('Buttons aligned');
    },

    // Auto resize group
    autoResizeGroup(groupId) {
        const group = this.data.groups[groupId];
        if (!group) return;
        
        const notesInGroup = Object.values(this.data.units).filter(n => n.groupId === groupId);
        if (notesInGroup.length === 0) return;
        
        this.undoManager.saveState(this.data, 'Auto resize group');
        
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
        
        notesInGroup.forEach(note => {
            const element = document.getElementById(`note-${note.id}`);
            const width = element ? element.offsetWidth : 80;
            const height = element ? element.offsetHeight : 28;
            
            minX = Math.min(minX, note.x);
            minY = Math.min(minY, note.y);
            maxX = Math.max(maxX, note.x + width);
            maxY = Math.max(maxY, note.y + height);
        });
        
        // Add padding
        group.x = minX - 10;
        group.y = minY - 30;
        group.width = maxX - minX + 20;
        group.height = maxY - minY + 40;
        
        // Re-render
        document.getElementById(`group-${groupId}`)?.remove();
        this.renderGroup(group);
        
        this.saveData();
        this.showStatus('Group resized');
    },

    // Get groups
    getGroups() {
        return Object.values(this.data.groups);
    },

    // Get config
    getConfig() {
        return this.config;
    },

    // Save config
    async saveConfig(config) {
        this.config = config;
        await window.electronAPI.saveConfig(config);
        
        // Apply settings
        this.setupAutoSave();
        this.undoManager.setMaxLevels(config.general.undoLevels);
        this.applyTheme();
        this.applyAnimationsSetting();
    },

    // Reset config
    resetConfig() {
        this.config = {
            hotkey: { enabled: true, key: 'N', modifiers: ['Control', 'Alt'] },
            unitStyle: { backgroundColor: '#6495ED', textColor: '#FFFFFF', fontFamily: 'Segoe UI', fontSize: 12 },
            window: { x: -1, y: -1, width: 800, height: 600, maximized: false, alwaysOnTop: false, rememberPosition: true, rememberSize: true },
            general: {
                autoSave: true, autoSaveInterval: 30, confirmDelete: true, confirmReset: true, confirmExit: false,
                showTrayIcon: true, minimizeToTray: true, closeToTray: false, startMinimized: false,
                autoBackup: true, backupCount: 10, undoLevels: 20,
                doubleClickToEdit: true, singleClickToCopy: true,
                enableAnimations: true, theme: 'SystemDefault', logLevel: 'Info',
                gpuMode: 'auto'
            }
        };
    },

    // Apply default style to all notes
    applyDefaultStyleToAll() {
        this.undoManager.saveState(this.data, 'Apply default style to all');
        
        Object.values(this.data.units).forEach(note => {
            note.backgroundColor = this.config.unitStyle.backgroundColor;
            note.textColor = this.config.unitStyle.textColor;
            note.fontFamily = this.config.unitStyle.fontFamily;
            note.fontSize = this.config.unitStyle.fontSize;
        });
        
        this.render();
        this.saveData();
        this.showStatus('Applied default style to all notes');
    },

    // Undo
    undo() {
        const previousState = this.undoManager.undo(this.data);
        if (previousState) {
            this.data = previousState;
            this.render();
            this.saveData();
            this.showStatus('Undo');
        } else {
            this.showStatus('Nothing to undo');
        }
    },

    // Redo
    redo() {
        const nextState = this.undoManager.redo(this.data);
        if (nextState) {
            this.data = nextState;
            this.render();
            this.saveData();
            this.showStatus('Redo');
        } else {
            this.showStatus('Nothing to redo');
        }
    },

    // Save data
    async saveData() {
        await window.electronAPI.saveData(this.data);
    },

    // Setup auto-save
    setupAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        if (this.config.general.autoSave) {
            const interval = (this.config.general.autoSaveInterval || 30) * 1000;
            this.autoSaveTimer = setInterval(() => {
                this.saveData();
            }, interval);
        }
    },

    // Apply theme
    async applyTheme() {
        let theme = this.config.general.theme;
        
        if (theme === 'SystemDefault') {
            theme = await window.electronAPI.getTheme();
        }
        
        this.setTheme(theme);
    },

    // Set theme
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme.toLowerCase());
    },

    // Apply animations setting
    applyAnimationsSetting() {
        if (this.config.general.enableAnimations) {
            document.documentElement.classList.remove('no-animations');
        } else {
            document.documentElement.classList.add('no-animations');
        }
    },

    // Show status message
    showStatus(message, duration = 3000) {
        this.statusLabel.textContent = message;
        
        if (this.statusTimer) {
            clearTimeout(this.statusTimer);
        }
        
        this.statusTimer = setTimeout(() => {
            this.statusLabel.textContent = '';
        }, duration);
    },

    // Handle menu commands
    handleMenuCommand(command, data) {
        switch (command) {
            case 'new-note':
                Dialogs.showAddNoteDialog();
                break;
            case 'new-group':
                Dialogs.showGroupDialog();
                break;
            case 'save':
                this.saveData();
                this.showStatus('Saved');
                break;
            case 'reload':
                location.reload();
                break;
            case 'reset':
                this.resetData();
                break;
            case 'undo':
                this.undo();
                break;
            case 'redo':
                this.redo();
                break;
            case 'toggle-movable':
                this.isMovable = data;
                this.showStatus(this.isMovable ? 'Movement enabled' : 'Movement disabled');
                break;
            case 'toggle-autofocus':
                this.autofocus = data;
                break;
            case 'toggle-autosave':
                this.config.general.autoSave = data;
                this.setupAutoSave();
                break;
            case 'toggle-autoarrange':
                this.autoArrange = data;
                break;
            case 'settings':
                Dialogs.showSettingsDialog();
                break;
            case 'about':
                Dialogs.showAboutDialog();
                break;
            case 'arrange-grid':
                this.arrangeGrid();
                break;
            case 'arrange-date':
                this.arrangeByDate();
                break;
            case 'arrange-color':
                this.arrangeByColor();
                break;
            case 'arrange-compact':
                this.arrangeCompact();
                break;
            case 'fix-overlaps':
                this.fixOverlaps();
                break;
            case 'apply-style':
                this.applyStyleToSelected(data);
                break;
        }
    },

    // Reset data
    async resetData() {
        if (this.config.general.confirmReset) {
            const confirmed = await window.electronAPI.showConfirmDialog({
                title: 'Reset',
                message: 'Are you sure you want to reset all notes and groups?'
            });
            if (!confirmed) return;
        }
        
        this.undoManager.saveState(this.data, 'Reset');
        this.data = { units: {}, groups: {} };
        this.render();
        this.saveData();
        this.createWelcomeNote();
        this.showStatus('Reset complete');
    },

    // Create welcome note
    createWelcomeNote() {
        const note = {
            id: Utils.generateId(),
            title: 'Welcome to Notes!',
            content: 'Double-click to edit this note. Right-click for more options.',
            contentType: 'Text',
            backgroundColor: '#6495ED',
            textColor: '#FFFFFF',
            fontFamily: 'Segoe UI',
            fontSize: 12,
            x: 50,
            y: 50,
            createdDate: new Date().toISOString(),
            modifiedDate: new Date().toISOString()
        };
        this.data.units[note.id] = note;
        this.renderNote(note);
        this.saveData();
    },

    // Import data
    importData(data) {
        this.undoManager.saveState(this.data, 'Import');
        const migrated = this.migrateData(data);
        
        // Merge with existing
        Object.assign(this.data.units, migrated.units);
        Object.assign(this.data.groups, migrated.groups);
        
        this.render();
        this.saveData();
        this.showStatus('Data imported');
    },

    // Export data
    async exportData(filePath) {
        const success = await window.electronAPI.exportFile(filePath, this.data);
        if (success) {
            this.showStatus('Data exported');
        } else {
            this.showStatus('Export failed');
        }
    },

    // Arrange in grid
    arrangeGrid() {
        this.undoManager.saveState(this.data, 'Arrange grid');
        
        const notes = Object.values(this.data.units);
        const cols = Math.ceil(Math.sqrt(notes.length));
        const spacing = 120;
        const startX = 50;
        const startY = 50;
        
        notes.forEach((note, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            note.x = startX + col * spacing;
            note.y = startY + row * 50;
        });
        
        this.render();
        this.saveData();
        this.showStatus('Arranged in grid');
    },

    // Arrange by date
    arrangeByDate() {
        this.undoManager.saveState(this.data, 'Arrange by date');
        
        const notes = Utils.sortByDate(Object.values(this.data.units), 'createdDate', false);
        const startX = 50;
        const startY = 50;
        const spacing = 40;
        
        notes.forEach((note, index) => {
            note.x = startX;
            note.y = startY + index * spacing;
            this.data.units[note.id] = note;
        });
        
        this.render();
        this.saveData();
        this.showStatus('Arranged by date');
    },

    // Arrange by color
    arrangeByColor() {
        this.undoManager.saveState(this.data, 'Arrange by color');
        
        const notes = Utils.sortByColor(Object.values(this.data.units), 'backgroundColor');
        const cols = 5;
        const spacing = 120;
        const startX = 50;
        const startY = 50;
        
        notes.forEach((note, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            note.x = startX + col * spacing;
            note.y = startY + row * 50;
            this.data.units[note.id] = note;
        });
        
        this.render();
        this.saveData();
        this.showStatus('Arranged by color');
    },

    // Arrange compact
    arrangeCompact() {
        this.undoManager.saveState(this.data, 'Arrange compact');
        
        const notes = Object.values(this.data.units);
        const startX = 10;
        const startY = 10;
        let currentX = startX;
        let currentY = startY;
        const rowHeight = 35;
        const spacing = 10;
        const maxWidth = this.panelContainer.clientWidth - 50;
        
        notes.forEach(note => {
            const element = document.getElementById(`note-${note.id}`);
            const width = element ? element.offsetWidth : 80;
            
            if (currentX + width > maxWidth) {
                currentX = startX;
                currentY += rowHeight;
            }
            
            note.x = currentX;
            note.y = currentY;
            currentX += width + spacing;
        });
        
        this.render();
        this.saveData();
        this.showStatus('Arranged compact');
    },

    // Fix overlaps
    fixOverlaps() {
        this.undoManager.saveState(this.data, 'Fix overlaps');
        
        const notes = Object.values(this.data.units);
        const padding = 10;
        
        for (let i = 0; i < notes.length; i++) {
            for (let j = i + 1; j < notes.length; j++) {
                const note1 = notes[i];
                const note2 = notes[j];
                
                const el1 = document.getElementById(`note-${note1.id}`);
                const el2 = document.getElementById(`note-${note2.id}`);
                
                const rect1 = {
                    x: note1.x,
                    y: note1.y,
                    width: el1 ? el1.offsetWidth : 80,
                    height: el1 ? el1.offsetHeight : 28
                };
                
                const rect2 = {
                    x: note2.x,
                    y: note2.y,
                    width: el2 ? el2.offsetWidth : 80,
                    height: el2 ? el2.offsetHeight : 28
                };
                
                if (Utils.rectanglesOverlap(rect1, rect2)) {
                    // Move note2 to the right or below
                    note2.x = rect1.x + rect1.width + padding;
                }
            }
        }
        
        this.render();
        this.saveData();
        this.showStatus('Overlaps fixed');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init().then(() => {
        // Auto-run tests in dev mode (when DevTools is present)
        setTimeout(() => {
            if (window.__devtools_open || window.runTests) {
                console.log('Auto-running tests...');
                App.runTests();
            }
        }, 1000);
    });
});

// Test suite for development
App.runTests = async function() {
    console.log('=== Notes App Automated Tests ===\n');
    let passed = 0, failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`✓ ${name}`);
            passed++;
        } catch (e) {
            console.error(`✗ ${name}: ${e.message}`);
            failed++;
        }
    }

    // Core objects
    test('App object exists', () => { if (!App) throw new Error(); });
    test('Utils object exists', () => { if (!Utils) throw new Error(); });
    test('Dialogs object exists', () => { if (!Dialogs) throw new Error(); });
    test('ButtonStyles object exists', () => { if (!ButtonStyles) throw new Error(); });
    test('GroupStyles object exists', () => { if (!GroupStyles) throw new Error(); });

    // DOM elements
    test('Panel container exists', () => { if (!document.getElementById('panel-container')) throw new Error(); });
    test('Status bar exists', () => { if (!document.getElementById('status-bar')) throw new Error(); });
    test('Add Note dialog exists', () => { if (!document.getElementById('add-note-dialog')) throw new Error(); });
    test('Edit Note dialog exists', () => { if (!document.getElementById('edit-note-dialog')) throw new Error(); });
    test('Group dialog exists', () => { if (!document.getElementById('group-dialog')) throw new Error(); });
    test('Settings dialog exists', () => { if (!document.getElementById('settings-dialog')) throw new Error(); });
    test('About dialog exists', () => { if (!document.getElementById('about-dialog')) throw new Error(); });
    test('Context menus exist', () => { 
        if (!document.getElementById('note-context-menu')) throw new Error();
        if (!document.getElementById('group-context-menu')) throw new Error();
    });

    // Utils functions
    test('Utils.generateId works', () => {
        const id = Utils.generateId();
        if (!id || !id.startsWith('id_')) throw new Error();
    });
    test('Utils.getContrastColor works', () => {
        if (Utils.getContrastColor('#FFFFFF') !== '#000000') throw new Error();
        if (Utils.getContrastColor('#000000') !== '#FFFFFF') throw new Error();
    });
    test('Utils.deepClone works', () => {
        const obj = {a: {b: 1}};
        const clone = Utils.deepClone(obj);
        clone.a.b = 2;
        if (obj.a.b !== 1) throw new Error();
    });

    // Styles
    test('ButtonStyles has 20+ styles', () => {
        if (ButtonStyles.getAllStyleNames().length < 20) throw new Error();
    });
    test('GroupStyles has 30+ styles', () => {
        if (GroupStyles.getAllStyleNames().length < 30) throw new Error();
    });

    // Data structure
    test('App.data has units and groups', () => {
        if (!App.data.units || !App.data.groups) throw new Error();
    });
    test('Welcome note exists', () => {
        const notes = Object.values(App.data.units);
        if (!notes.some(n => n.title && n.title.includes('Welcome'))) throw new Error();
    });

    // Note CRUD
    const testNoteId = Utils.generateId();
    test('Add note works', () => {
        const count = Object.keys(App.data.units).length;
        App.addNote({
            id: testNoteId, title: 'Test Note', content: 'Test', contentType: 'Text',
            backgroundColor: '#FF0000', textColor: '#FFF', fontFamily: 'Arial', fontSize: 12,
            x: 100, y: 100, createdDate: new Date().toISOString(), modifiedDate: new Date().toISOString()
        });
        if (Object.keys(App.data.units).length !== count + 1) throw new Error();
        if (!document.getElementById(`note-${testNoteId}`)) throw new Error();
    });
    test('Update note works', () => {
        App.updateNote(testNoteId, { title: 'Updated Test' });
        if (App.data.units[testNoteId].title !== 'Updated Test') throw new Error();
    });
    test('Duplicate note works', () => {
        const count = Object.keys(App.data.units).length;
        App.duplicateNote(testNoteId);
        if (Object.keys(App.data.units).length !== count + 1) throw new Error();
    });

    // Group CRUD
    const testGroupId = Utils.generateId();
    test('Add group works', () => {
        const count = Object.keys(App.data.groups).length;
        App.addGroup({
            id: testGroupId, title: 'Test Group', x: 200, y: 200, width: 300, height: 200,
            borderColor: '#3498DB', backgroundColor: '#ECF0F1', textColor: '#2C3E50'
        });
        if (Object.keys(App.data.groups).length !== count + 1) throw new Error();
        if (!document.getElementById(`group-${testGroupId}`)) throw new Error();
    });
    test('Update group works', () => {
        App.updateGroup(testGroupId, { title: 'Updated Group' });
        if (App.data.groups[testGroupId].title !== 'Updated Group') throw new Error();
    });

    // Selection
    test('Selection works', () => {
        App.clearSelection();
        if (App.selectedNotes.size !== 0) throw new Error();
        App.selectedNotes.add(testNoteId);
        if (App.selectedNotes.size !== 1) throw new Error();
    });

    // Copy style
    test('Copy style works', () => {
        App.copyStyle(testNoteId);
        if (!App.copiedStyle || !App.copiedStyle.backgroundColor) throw new Error();
    });

    // Dialogs
    test('Show/hide dialog works', () => {
        Dialogs.showDialog('about-dialog');
        if (document.getElementById('about-dialog').style.display !== 'flex') throw new Error();
        Dialogs.closeDialog('about-dialog');
        if (document.getElementById('about-dialog').style.display !== 'none') throw new Error();
    });

    // Undo
    test('Undo manager exists', () => {
        if (!App.undoManager) throw new Error();
    });

    // Config
    test('Config has required sections', () => {
        const cfg = App.getConfig();
        if (!cfg.general || !cfg.hotkey || !cfg.window || !cfg.unitStyle) throw new Error();
    });

    // Theme
    test('Theme is set', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        if (!['light', 'dark'].includes(theme)) throw new Error();
    });

    // Status
    test('Status message works', () => {
        App.showStatus('Test message');
        if (document.getElementById('status-label').textContent !== 'Test message') throw new Error();
    });

    // Cleanup
    delete App.data.units[testNoteId];
    document.getElementById(`note-${testNoteId}`)?.remove();
    // Clean up duplicated note
    const dupNote = Object.values(App.data.units).find(n => n.title === 'Updated Test' && n.id !== testNoteId);
    if (dupNote) {
        delete App.data.units[dupNote.id];
        document.getElementById(`note-${dupNote.id}`)?.remove();
    }
    delete App.data.groups[testGroupId];
    document.getElementById(`group-${testGroupId}`)?.remove();

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    return { passed, failed };
};

window.App = App;
