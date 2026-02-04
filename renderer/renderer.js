const panelContainer = document.getElementById("panelContainer");
const noteLayer = document.getElementById("noteLayer");
const groupLayer = document.getElementById("groupLayer");
const selectionBox = document.getElementById("selectionBox");
const modalOverlay = document.getElementById("modalOverlay");
const noteTemplate = document.getElementById("noteTemplate");
const groupTemplate = document.getElementById("groupTemplate");
const menuDropdown = document.getElementById("menuDropdown");
const statusLabel = document.getElementById("statusLabel");
const contextMenu = document.getElementById("contextMenu");

const createFallbackAPI = () => {
  const storageKey = "notes-electron-fallback-data";
  return {
    loadData: async () => {
      try {
        const raw = localStorage.getItem(storageKey);
        return raw ? JSON.parse(raw) : { Units: {}, Groups: {}, Settings: {} };
      } catch (error) {
        return { Units: {}, Groups: {}, Settings: {} };
      }
    },
    saveData: async (data) => {
      localStorage.setItem(storageKey, JSON.stringify(data || {}));
      return true;
    },
    createBackup: async () => true,
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    showSaveDialog: async () => ({ canceled: true, filePath: null }),
    readFile: async () => null,
    writeFile: async () => false,
    applySettings: async () => true,
    toggleWindow: async () => true,
    showWindow: async () => true,
    hideWindow: async () => true,
    getPaths: async () => ({}),
    readClipboard: () => null,
    writeClipboard: () => false,
    availableClipboardFormats: () => []
  };
};

const api = window.notesAPI || createFallbackAPI();

const defaultSettings = {
  autoSave: true,
  autoSaveInterval: 30,
  confirmDelete: true,
  confirmReset: true,
  confirmExit: true,
  alwaysOnTop: false,
  showTrayIcon: true,
  minimizeToTray: false,
  closeToTray: true,
  startMinimized: false,
  startWithWindows: false,
  globalHotkeyEnabled: true,
  globalHotkey: "Ctrl+Alt+N",
  backupEnabled: true,
  backupCount: 10,
  undoLevels: 20,
  loggingLevel: "Info",
  movable: false,
  autofocus: false,
  doubleClickToEdit: true,
  singleClickToCopy: false,
  optimizeForLargeNotes: false,
  enableAnimations: true,
  windowState: "Normal",
  rememberSize: true,
  rememberPosition: true,
  theme: "System"
};

const state = {
  units: {},
  groups: {},
  settings: { ...defaultSettings },
  selectedNoteIds: new Set(),
  selectedGroupIds: new Set(),
  undoStack: [],
  redoStack: [],
  isDragging: false,
  dragType: null,
  dragStart: null,
  dragSnapshot: null,
  selectionStart: null,
  lastContextTarget: null,
  lastContextPoint: null
};

let autosaveTimer = null;
let statusTimer = null;
let copiedStyle = null;

const BUTTON_STYLES = [
  "Classic",
  "Pastel",
  "Dark",
  "Neon",
  "Earth",
  "Ocean",
  "Sunset",
  "Monochrome",
  "Vibrant",
  "Gradient",
  "Gloss",
  "Embossed",
  "Raised",
  "Inset",
  "Retro",
  "Cyber",
  "Glass",
  "NeonGlow",
  "Golden",
  "Minimal",
  "Bold",
  "Elegant",
  "Playful",
  "Professional"
];

const GROUP_TYPES = [
  "Default",
  "GradientGlass",
  "NeonGlow",
  "Embossed",
  "Retro",
  "Card",
  "Minimal",
  "Dashed",
  "DoubleBorder",
  "ShadowPanel",
  "RoundedNeon",
  "Holographic",
  "VintagePaper",
  "LiquidMetal",
  "Cosmic",
  "Rainbow",
  "AuroraBorealis",
  "CyberCircuit",
  "FireLava",
  "MatrixRain",
  "CrystalIce",
  "PlasmaEnergy",
  "OceanWave",
  "ElectricStorm",
  "StarfieldWarp",
  "HeartbeatPulse",
  "Snowfall",
  "CloudDrift",
  "SparkleShine",
  "RippleWater",
  "BubblesFloat",
  "ConfettiParty",
  "SunburstRays",
  "CherryBlossom",
  "FloatingHearts"
];

const toUUID = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `id-${Math.random().toString(16).slice(2)}-${Date.now()}`;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const argbIntToRgba = (value) => {
  if (typeof value !== "number") {
    return null;
  }
  const argb = value >>> 0;
  const a = (argb >> 24) & 255;
  const r = (argb >> 16) & 255;
  const g = (argb >> 8) & 255;
  const b = argb & 255;
  const alpha = a / 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
};

const argbIntToHex = (value) => {
  if (typeof value !== "number") {
    return "#ffffff";
  }
  const argb = value >>> 0;
  const r = (argb >> 16) & 255;
  const g = (argb >> 8) & 255;
  const b = argb & 255;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

const hexToArgbInt = (hex) => {
  if (!hex) {
    return 0xffffffff | 0;
  }
  const raw = hex.replace("#", "");
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const a = 255;
  const argb = ((a & 255) << 24) | ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
  return argb | 0;
};

const normalizeFont = (font) => {
  if (!font || typeof font !== "object") {
    return { Name: "Segoe UI", Size: 9, Style: 0 };
  }
  return {
    Name: font.Name || "Segoe UI",
    Size: Number(font.Size) || 9,
    Style: Number(font.Style) || 0
  };
};

const fontToCss = (font) => {
  const normalized = normalizeFont(font);
  const style = normalized.Style;
  const isBold = (style & 1) === 1;
  const isItalic = (style & 2) === 2;
  return {
    fontFamily: normalized.Name,
    fontSize: `${normalized.Size}pt`,
    fontWeight: isBold ? "600" : "400",
    fontStyle: isItalic ? "italic" : "normal"
  };
};

const normalizeNote = (note) => {
  const font = normalizeFont(note.Font);
  return {
    Id: note.Id || note.id || toUUID(),
    Title: note.Title || note.title || "Untitled",
    BackgroundColor: typeof note.BackgroundColor === "number" ? note.BackgroundColor : hexToArgbInt("#f5f5f5"),
    TextColor: typeof note.TextColor === "number" ? note.TextColor : hexToArgbInt("#000000"),
    Font: font,
    X: Number(note.X) || 20,
    Y: Number(note.Y) || 20,
    ContentType: note.ContentType || note.contentType || "Text",
    ContentData: note.ContentData || note.contentData || "",
    ContentFormat: note.ContentFormat || note.contentFormat || "plain",
    ButtonType: note.ButtonType || note.buttonType || "Classic",
    CreatedDate: note.CreatedDate || note.createdDate || new Date().toISOString(),
    ModifiedDate: note.ModifiedDate || note.modifiedDate || new Date().toISOString(),
    Category: note.Category || note.category || "",
    Tags: Array.isArray(note.Tags || note.tags) ? note.Tags || note.tags : [],
    GroupId: note.GroupId || note.groupId || null
  };
};

const normalizeGroup = (group) => {
  return {
    Id: group.Id || group.id || toUUID(),
    Title: group.Title || group.title || "Group",
    X: Number(group.X) || 120,
    Y: Number(group.Y) || 120,
    Width: Number(group.Width) || 300,
    Height: Number(group.Height) || 200,
    BorderColor: typeof group.BorderColor === "number" ? group.BorderColor : hexToArgbInt("#7a7a7a"),
    BackgroundColor: typeof group.BackgroundColor === "number" ? group.BackgroundColor : hexToArgbInt("#f0f0f0"),
    TextColor: typeof group.TextColor === "number" ? group.TextColor : hexToArgbInt("#000000"),
    GroupBoxType: group.GroupBoxType || group.groupBoxType || "Default",
    CreatedDate: group.CreatedDate || group.createdDate || new Date().toISOString(),
    ModifiedDate: group.ModifiedDate || group.modifiedDate || new Date().toISOString()
  };
};

const normalizeIncoming = (data) => {
  const units = {};
  const groups = {};
  const rawUnits = data?.Units || data?.units || {};
  const rawGroups = data?.Groups || data?.groups || {};

  Object.values(rawUnits).forEach((unit) => {
    const normalized = normalizeNote(unit);
    units[normalized.Id] = normalized;
  });

  Object.values(rawGroups).forEach((group) => {
    const normalized = normalizeGroup(group);
    groups[normalized.Id] = normalized;
  });

  return {
    units,
    groups,
    settings: {
      ...defaultSettings,
      ...(data?.Settings || data?.settings || {})
    }
  };
};

const serializeState = () => ({
  Units: state.units,
  Groups: state.groups,
  Settings: state.settings
});

const pushUndo = () => {
  const snapshot = JSON.parse(JSON.stringify({ units: state.units, groups: state.groups }));
  state.undoStack.push(snapshot);
  if (state.undoStack.length > state.settings.undoLevels) {
    state.undoStack.shift();
  }
  state.redoStack = [];
};

const restoreSnapshot = (snapshot) => {
  state.units = snapshot.units || {};
  state.groups = snapshot.groups || {};
  state.selectedNoteIds.clear();
  state.selectedGroupIds.clear();
  renderAll();
};

const undo = () => {
  if (state.undoStack.length === 0) return;
  const current = JSON.parse(JSON.stringify({ units: state.units, groups: state.groups }));
  state.redoStack.push(current);
  const snapshot = state.undoStack.pop();
  restoreSnapshot(snapshot);
};

const redo = () => {
  if (state.redoStack.length === 0) return;
  const current = JSON.parse(JSON.stringify({ units: state.units, groups: state.groups }));
  state.undoStack.push(current);
  const snapshot = state.redoStack.pop();
  restoreSnapshot(snapshot);
};

const setStatus = (value) => {
  if (statusTimer) {
    clearTimeout(statusTimer);
  }
  statusLabel.textContent = value || "";
  const lower = (value || "").toLowerCase();
  const isError = lower.includes("error") || lower.includes("failed");
  statusTimer = setTimeout(() => {
    if (!isError) {
      statusLabel.textContent = "Ready";
    }
  }, isError ? 6000 : 3000);
};

const setSelection = (noteIds = [], groupIds = []) => {
  state.selectedNoteIds = new Set(noteIds);
  state.selectedGroupIds = new Set(groupIds);
  updateSelectionStyles();
};

const updateSelectionStyles = () => {
  document.querySelectorAll(".note").forEach((node) => {
    const id = node.dataset.id;
    node.classList.toggle("selected", state.selectedNoteIds.has(id));
  });
  document.querySelectorAll(".group-box").forEach((node) => {
    const id = node.dataset.id;
    node.classList.toggle("selected", state.selectedGroupIds.has(id));
  });
};

const applySettings = () => {
  api.applySettings({
    alwaysOnTop: state.settings.alwaysOnTop,
    runInTray: state.settings.showTrayIcon,
    runOnStartup: state.settings.startWithWindows,
    globalHotkey: state.settings.globalHotkeyEnabled ? state.settings.globalHotkey : "",
    backupEnabled: state.settings.backupEnabled,
    backupCount: state.settings.backupCount
  });
};

const stylePreset = (name) => {
  const presets = {
    Classic: { bg: "#f5f5f5", fg: "#000000" },
    Pastel: { bg: "#f8e8ff", fg: "#4b2a63" },
    Dark: { bg: "#444444", fg: "#ffffff" },
    Neon: { bg: "#0f0f0f", fg: "#39ff14" },
    Earth: { bg: "#e8dbc5", fg: "#4a3b2a" },
    Ocean: { bg: "#d7eef8", fg: "#0b4a6b" },
    Sunset: { bg: "#ffd7b5", fg: "#7a3e00" },
    Monochrome: { bg: "#f0f0f0", fg: "#222222" },
    Vibrant: { bg: "#ffe680", fg: "#7a1f1f" },
    Gradient: { bg: "#e6f0ff", fg: "#1f3b7a" },
    Gloss: { bg: "#f5faff", fg: "#1f2b3f" },
    Embossed: { bg: "#e0e0e0", fg: "#111111" },
    Raised: { bg: "#f2f2f2", fg: "#222222" },
    Inset: { bg: "#e8e8e8", fg: "#333333" },
    Retro: { bg: "#ffefc2", fg: "#5f3b1d" },
    Cyber: { bg: "#0d1b2a", fg: "#4cc9f0" },
    Glass: { bg: "#e9f3ff", fg: "#1f2b3f" },
    NeonGlow: { bg: "#111111", fg: "#00f5d4" },
    Golden: { bg: "#ffe9a6", fg: "#6d4c00" },
    Minimal: { bg: "#ffffff", fg: "#111111" },
    Bold: { bg: "#cce1ff", fg: "#0a2a66" },
    Elegant: { bg: "#f6f1e7", fg: "#4a3b2a" },
    Playful: { bg: "#ffd6e8", fg: "#7a1f4f" },
    Professional: { bg: "#e6e6e6", fg: "#1f1f1f" }
  };
  return presets[name] || presets.Classic;
};

const renderNote = (note) => {
  const existing = noteLayer.querySelector(`.note[data-id="${note.Id}"]`);
  const element = existing || noteTemplate.content.firstElementChild.cloneNode(true);
  element.dataset.id = note.Id;
  element.style.left = `${note.X}px`;
  element.style.top = `${note.Y}px`;
  element.style.minWidth = "80px";
  element.style.minHeight = "40px";
  element.style.padding = "8px 12px";

  const preset = stylePreset(note.ButtonType);
  const bg = argbIntToRgba(note.BackgroundColor) || preset.bg;
  const fg = argbIntToRgba(note.TextColor) || preset.fg;
  element.style.background = bg;
  element.style.color = fg;

  const fontCss = fontToCss(note.Font);
  Object.assign(element.style, fontCss);

  element.querySelector(".note__text").textContent = note.Title || "Untitled";

  if (!existing) {
    noteLayer.appendChild(element);
  }
};

const renderGroup = (group) => {
  const existing = groupLayer.querySelector(`.group-box[data-id="${group.Id}"]`);
  const element = existing || groupTemplate.content.firstElementChild.cloneNode(true);
  element.dataset.id = group.Id;
  element.style.left = `${group.X}px`;
  element.style.top = `${group.Y}px`;
  element.style.width = `${group.Width}px`;
  element.style.height = `${group.Height}px`;

  const border = argbIntToRgba(group.BorderColor);
  const bg = argbIntToRgba(group.BackgroundColor);
  const fg = argbIntToRgba(group.TextColor);
  if (border) {
    element.style.borderColor = border;
  }
  if (bg) {
    element.style.background = bg;
  }
  if (fg) {
    element.querySelector(".group-box__title").style.color = fg;
  }
  element.querySelector(".group-box__title").textContent = group.Title || "Group";

  if (!existing) {
    groupLayer.appendChild(element);
  }
};

const renderAll = () => {
  noteLayer.innerHTML = "";
  groupLayer.innerHTML = "";
  Object.values(state.groups).forEach(renderGroup);
  Object.values(state.units).forEach(renderNote);
  updateSelectionStyles();
};

const saveData = async () => {
  await api.saveData(serializeState());
  if (state.settings.backupEnabled) {
    await api.createBackup(serializeState(), state.settings.backupCount);
  }
  setStatus("Saved");
};

const loadData = async () => {
  const data = await api.loadData();
  const normalized = normalizeIncoming(data);
  state.units = normalized.units;
  state.groups = normalized.groups;
  state.settings = { ...state.settings, ...normalized.settings };
  applySettings();
  renderAll();
  setStatus("Ready");
};

const exportData = async () => {
  const result = await api.showSaveDialog({
    title: "Export Notes",
    defaultPath: "notes-export.json",
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return;
  await api.writeFile(result.filePath, JSON.stringify(serializeState(), null, 2));
  setStatus("Export complete");
};

const importData = async () => {
  const result = await api.showOpenDialog({
    title: "Import Notes",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"]
  });
  if (result.canceled || !result.filePaths?.length) return;
  const content = await api.readFile(result.filePaths[0]);
  if (!content) return;
  try {
    const parsed = JSON.parse(content);
    const normalized = normalizeIncoming(parsed);
    pushUndo();
    state.units = normalized.units;
    state.groups = normalized.groups;
    state.settings = { ...state.settings, ...normalized.settings };
    renderAll();
    setStatus("Import complete");
  } catch (error) {
    setStatus("Import failed");
  }
};

const resetData = () => {
  if (state.settings.confirmReset && !window.confirm("Reset all notes?")) return;
  pushUndo();
  state.units = {};
  state.groups = {};
  renderAll();
  setStatus("Reset complete");
};

const confirmDelete = () => {
  if (!state.settings.confirmDelete) return true;
  return window.confirm("Delete selected items?");
};

const deleteSelection = () => {
  if (state.selectedNoteIds.size === 0 && state.selectedGroupIds.size === 0) return;
  if (!confirmDelete()) return;
  pushUndo();
  state.selectedNoteIds.forEach((id) => delete state.units[id]);
  state.selectedGroupIds.forEach((id) => {
    delete state.groups[id];
    Object.values(state.units).forEach((note) => {
      if (note.GroupId === id) note.GroupId = null;
    });
  });
  setSelection();
  renderAll();
  setStatus("Deleted");
};

const updateSelectionFromRectangle = (rect, additive) => {
  const selected = new Set(additive ? state.selectedNoteIds : []);
  const groupSelected = new Set(additive ? state.selectedGroupIds : []);

  Object.values(state.units).forEach((note) => {
    const el = noteLayer.querySelector(`.note[data-id="${note.Id}"]`);
    if (!el) return;
    const x = note.X;
    const y = note.Y;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const within = x >= rect.x && y >= rect.y && x + width <= rect.x + rect.width && y + height <= rect.y + rect.height;
    if (within) selected.add(note.Id);
  });

  Object.values(state.groups).forEach((group) => {
    const within =
      group.X >= rect.x &&
      group.Y >= rect.y &&
      group.X + group.Width <= rect.x + rect.width &&
      group.Y + group.Height <= rect.y + rect.height;
    if (within) groupSelected.add(group.Id);
  });

  state.selectedNoteIds = selected;
  state.selectedGroupIds = groupSelected;
  updateSelectionStyles();
};

const getPanelPoint = (event) => {
  const rect = panelContainer.getBoundingClientRect();
  return {
    x: event.clientX - rect.left + panelContainer.scrollLeft,
    y: event.clientY - rect.top + panelContainer.scrollTop
  };
};

const startSelection = (event) => {
  if (event.button !== 0) return;
  state.selectionStart = getPanelPoint(event);
  selectionBox.classList.remove("hidden");
  selectionBox.style.left = `${state.selectionStart.x}px`;
  selectionBox.style.top = `${state.selectionStart.y}px`;
  selectionBox.style.width = "0px";
  selectionBox.style.height = "0px";
};

const updateSelection = (event) => {
  if (!state.selectionStart) return;
  const current = getPanelPoint(event);
  const x = Math.min(state.selectionStart.x, current.x);
  const y = Math.min(state.selectionStart.y, current.y);
  const width = Math.abs(state.selectionStart.x - current.x);
  const height = Math.abs(state.selectionStart.y - current.y);
  selectionBox.style.left = `${x}px`;
  selectionBox.style.top = `${y}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
  updateSelectionFromRectangle({ x, y, width, height }, event.ctrlKey);
};

const endSelection = () => {
  state.selectionStart = null;
  selectionBox.classList.add("hidden");
};

const handleNoteMouseDown = (event, note) => {
  event.stopPropagation();
  if (event.button !== 0) return;

  const additive = event.ctrlKey;
  if (!state.selectedNoteIds.has(note.Id)) {
    setSelection(additive ? [...state.selectedNoteIds, note.Id] : [note.Id], []);
  } else if (additive) {
    const next = new Set(state.selectedNoteIds);
    next.delete(note.Id);
    setSelection([...next], []);
  }

  if (!state.settings.movable) {
    return;
  }
  state.isDragging = true;
  state.dragType = "note";
  state.dragStart = getPanelPoint(event);
  state.dragSnapshot = Array.from(state.selectedNoteIds).map((id) => ({
    id,
    x: state.units[id].X,
    y: state.units[id].Y
  }));
};

const handleGroupMouseDown = (event, group, isResize, dir) => {
  event.stopPropagation();
  if (event.button !== 0) return;
  if (!state.selectedGroupIds.has(group.Id)) {
    setSelection([], [group.Id]);
  }
  if (!state.settings.movable) {
    return;
  }
  state.isDragging = true;
  state.dragType = isResize ? "group-resize" : "group-move";
  state.dragStart = getPanelPoint(event);
  state.dragSnapshot = {
    group: { ...group },
    notes: Object.values(state.units).filter((note) => note.GroupId === group.Id),
    dir
  };
};

const handlePanelMouseMove = (event) => {
  if (state.selectionStart) {
    updateSelection(event);
    return;
  }
  if (!state.isDragging || !state.dragStart) return;

  const current = getPanelPoint(event);
  const dx = current.x - state.dragStart.x;
  const dy = current.y - state.dragStart.y;

  if (state.dragType === "note") {
    state.dragSnapshot.forEach((item) => {
      const note = state.units[item.id];
      if (!note) return;
      note.X = Math.round(item.x + dx);
      note.Y = Math.round(item.y + dy);
      note.ModifiedDate = new Date().toISOString();
    });
    renderAll();
  }

  if (state.dragType === "group-move") {
    const group = state.groups[state.dragSnapshot.group.Id];
    if (!group) return;
    group.X = Math.round(state.dragSnapshot.group.X + dx);
    group.Y = Math.round(state.dragSnapshot.group.Y + dy);
    group.ModifiedDate = new Date().toISOString();
    state.dragSnapshot.notes.forEach((note) => {
      const target = state.units[note.Id];
      if (target) {
        target.X = Math.round(note.X + dx);
        target.Y = Math.round(note.Y + dy);
        target.ModifiedDate = new Date().toISOString();
      }
    });
    renderAll();
  }

  if (state.dragType === "group-resize") {
    const group = state.groups[state.dragSnapshot.group.Id];
    if (!group) return;
    const dir = state.dragSnapshot.dir;
    const original = state.dragSnapshot.group;
    const minWidth = 100;
    const minHeight = 80;

    if (dir.includes("e")) {
      group.Width = clamp(original.Width + dx, minWidth, 2000);
    }
    if (dir.includes("s")) {
      group.Height = clamp(original.Height + dy, minHeight, 2000);
    }
    if (dir.includes("w")) {
      group.Width = clamp(original.Width - dx, minWidth, 2000);
      group.X = Math.round(original.X + dx);
    }
    if (dir.includes("n")) {
      group.Height = clamp(original.Height - dy, minHeight, 2000);
      group.Y = Math.round(original.Y + dy);
    }
    group.ModifiedDate = new Date().toISOString();
    renderAll();
  }
};

const handlePanelMouseUp = () => {
  if (state.isDragging) {
    pushUndo();
    if (state.dragType === "note") {
      updateGroupMembership(Array.from(state.selectedNoteIds));
    }
  }
  state.isDragging = false;
  state.dragType = null;
  state.dragStart = null;
  state.dragSnapshot = null;
  endSelection();
};

const updateGroupMembership = (noteIds) => {
  noteIds.forEach((id) => {
    const note = state.units[id];
    if (!note) return;
    const group = Object.values(state.groups).find((grp) => {
      const el = noteLayer.querySelector(`.note[data-id="${note.Id}"]`);
      const width = el ? el.offsetWidth : 80;
      const height = el ? el.offsetHeight : 40;
      const within =
        note.X + width / 2 >= grp.X &&
        note.X + width / 2 <= grp.X + grp.Width &&
        note.Y + height / 2 >= grp.Y &&
        note.Y + height / 2 <= grp.Y + grp.Height;
      return within;
    });
    note.GroupId = group ? group.Id : null;
  });
};

const openModal = (content) => {
  modalOverlay.innerHTML = "";
  modalOverlay.appendChild(content);
  modalOverlay.classList.remove("hidden");
  modalOverlay.style.pointerEvents = "auto";
};

const closeModal = () => {
  modalOverlay.classList.add("hidden");
  modalOverlay.innerHTML = "";
  modalOverlay.style.pointerEvents = "none";
};

const openFontDialog = (font, onSave) => {
  const modal = document.createElement("div");
  modal.className = "win-dialog";
  modal.style.width = "360px";
  modal.innerHTML = `<div class="dialog-title">Font</div>`;

  const nameInput = document.createElement("input");
  nameInput.className = "win-input";
  nameInput.value = font?.Name || "Segoe UI";

  const sizeInput = document.createElement("input");
  sizeInput.className = "win-number";
  sizeInput.type = "number";
  sizeInput.value = font?.Size || 9;

  const row1 = document.createElement("div");
  row1.className = "win-form-row";
  row1.innerHTML = `<div class="label">Font</div>`;
  row1.appendChild(nameInput);

  const row2 = document.createElement("div");
  row2.className = "win-form-row";
  row2.innerHTML = `<div class="label">Size</div>`;
  row2.appendChild(sizeInput);

  const actions = document.createElement("div");
  actions.className = "win-actions";

  const cancelButton = document.createElement("button");
  cancelButton.className = "win-button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", closeModal);

  const okButton = document.createElement("button");
  okButton.className = "win-button primary";
  okButton.textContent = "OK";
  okButton.addEventListener("click", () => {
    onSave({
      Name: nameInput.value || "Segoe UI",
      Size: Number(sizeInput.value) || 9,
      Style: 0
    });
    closeModal();
  });

  actions.appendChild(cancelButton);
  actions.appendChild(okButton);
  modal.appendChild(row1);
  modal.appendChild(row2);
  modal.appendChild(actions);
  openModal(modal);
};

const openNoteModal = (note) => {
  const isEdit = !!note;
  const working = note ? { ...note } : normalizeNote({});

  const modal = document.createElement("div");
  modal.className = "win-dialog";
  modal.style.width = "523px";
  modal.style.height = "397px";

  const title = document.createElement("div");
  title.className = "dialog-title";
  title.textContent = isEdit ? "Edit" : "Add";
  modal.appendChild(title);

  const rowTitle = document.createElement("div");
  rowTitle.className = "win-form-row";
  rowTitle.innerHTML = `<div class="label">Title</div>`;
  const titleInput = document.createElement("input");
  titleInput.className = "win-input";
  titleInput.value = working.Title || "";
  rowTitle.appendChild(titleInput);

  const rowGroup = document.createElement("div");
  rowGroup.className = "win-form-row";
  rowGroup.innerHTML = `<div class="label">Group</div>`;
  const groupSelect = document.createElement("select");
  groupSelect.className = "win-select";
  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "";
  groupSelect.appendChild(noneOption);
  Object.values(state.groups).forEach((group) => {
    const option = document.createElement("option");
    option.value = group.Id;
    option.textContent = group.Title;
    if (working.GroupId === group.Id) option.selected = true;
    groupSelect.appendChild(option);
  });
  rowGroup.appendChild(groupSelect);

  const rowBg = document.createElement("div");
  rowBg.className = "win-form-row";
  rowBg.innerHTML = `<div class="label">Background Color</div>`;
  const btnBg = document.createElement("button");
  btnBg.className = "win-button";
  btnBg.textContent = "Change";
  const bgInput = document.createElement("input");
  bgInput.type = "color";
  bgInput.value = argbIntToHex(working.BackgroundColor);
  bgInput.className = "hidden";
  btnBg.addEventListener("click", () => bgInput.click());
  bgInput.addEventListener("input", () => {
    working.BackgroundColor = hexToArgbInt(bgInput.value);
  });
  rowBg.appendChild(btnBg);
  rowBg.appendChild(bgInput);

  const rowText = document.createElement("div");
  rowText.className = "win-form-row";
  rowText.innerHTML = `<div class="label">Text Color</div>`;
  const btnText = document.createElement("button");
  btnText.className = "win-button";
  btnText.textContent = "Change";
  const textInput = document.createElement("input");
  textInput.type = "color";
  textInput.value = argbIntToHex(working.TextColor);
  textInput.className = "hidden";
  btnText.addEventListener("click", () => textInput.click());
  textInput.addEventListener("input", () => {
    working.TextColor = hexToArgbInt(textInput.value);
  });
  rowText.appendChild(btnText);
  rowText.appendChild(textInput);

  const rowFont = document.createElement("div");
  rowFont.className = "win-form-row";
  rowFont.innerHTML = `<div class="label">Font</div>`;
  const btnFont = document.createElement("button");
  btnFont.className = "win-button";
  btnFont.textContent = "Change";
  btnFont.addEventListener("click", () => {
    openFontDialog(working.Font, (font) => {
      working.Font = normalizeFont(font);
    });
  });
  rowFont.appendChild(btnFont);

  const rowContentType = document.createElement("div");
  rowContentType.className = "win-form-row";
  rowContentType.innerHTML = `<div class="label">Content</div>`;
  const contentTypeSelect = document.createElement("select");
  contentTypeSelect.className = "win-select";
  ["Text", "Image", "Object"].forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    if (working.ContentType === type) option.selected = true;
    contentTypeSelect.appendChild(option);
  });
  rowContentType.appendChild(contentTypeSelect);

  const contentPanel = document.createElement("div");
  contentPanel.style.marginLeft = "128px";
  contentPanel.style.width = "352px";
  contentPanel.style.height = "132px";

  const textPanel = document.createElement("div");
  textPanel.className = "content-panel";
  const textLabel = document.createElement("div");
  textLabel.textContent = "Content";
  textLabel.style.marginBottom = "4px";
  const textArea = document.createElement("textarea");
  textArea.className = "win-textarea";
  textArea.value = working.ContentType === "Text" ? working.ContentData : "";
  textPanel.appendChild(textLabel);
  textPanel.appendChild(textArea);

  const imagePanel = document.createElement("div");
  imagePanel.className = "content-panel hidden";
  const pasteImage = document.createElement("button");
  pasteImage.className = "win-button paste-button";
  pasteImage.textContent = "Paste from Clipboard";
  const imagePreview = document.createElement("img");
  imagePreview.className = "image-preview";
  imagePanel.appendChild(pasteImage);
  imagePanel.appendChild(imagePreview);

  const objectPanel = document.createElement("div");
  objectPanel.className = "content-panel hidden";
  const pasteObject = document.createElement("button");
  pasteObject.className = "win-button paste-button";
  pasteObject.textContent = "Paste from Clipboard";
  const objectSummary = document.createElement("div");
  objectSummary.className = "object-summary";
  objectSummary.textContent = "Clipboard formats will appear here.";
  objectPanel.appendChild(pasteObject);
  objectPanel.appendChild(objectSummary);

  contentPanel.appendChild(textPanel);
  contentPanel.appendChild(imagePanel);
  contentPanel.appendChild(objectPanel);

  const updateContentVisibility = () => {
    textPanel.classList.toggle("hidden", contentTypeSelect.value !== "Text");
    imagePanel.classList.toggle("hidden", contentTypeSelect.value !== "Image");
    objectPanel.classList.toggle("hidden", contentTypeSelect.value !== "Object");
  };

  contentTypeSelect.addEventListener("change", () => {
    updateContentVisibility();
  });

  pasteImage.addEventListener("click", () => {
    const payload = api.readClipboard();
    if (!payload || payload.type !== "image") return;
    working.ContentType = "Image";
    working.ContentData = payload.data || "";
    working.ContentFormat = payload.format || "image/png";
    contentTypeSelect.value = "Image";
    imagePreview.src = `data:image/png;base64,${working.ContentData}`;
    updateContentVisibility();
  });

  pasteObject.addEventListener("click", () => {
    const payload = api.readClipboard();
    if (!payload || payload.type !== "object") return;
    working.ContentType = "Object";
    working.ContentData = payload.data || "";
    working.ContentFormat = payload.format || "binary";
    contentTypeSelect.value = "Object";
    objectSummary.textContent = "Clipboard formats captured.";
    updateContentVisibility();
  });

  updateContentVisibility();

  const actions = document.createElement("div");
  actions.className = "win-actions";
  actions.style.marginTop = "8px";
  actions.style.position = "absolute";
  actions.style.bottom = "12px";
  actions.style.right = "12px";

  const btnSave = document.createElement("button");
  btnSave.className = "win-button primary";
  btnSave.textContent = "Save";
  btnSave.addEventListener("click", () => {
    working.Title = titleInput.value.trim() || "Untitled";
    working.ContentType = contentTypeSelect.value;
    if (working.ContentType === "Text") {
      working.ContentData = textArea.value;
      working.ContentFormat = "plain";
    }
    working.Font = normalizeFont(working.Font);
    working.GroupId = groupSelect.value || null;
    working.ModifiedDate = new Date().toISOString();
    pushUndo();
    state.units[working.Id] = working;
    renderAll();
    closeModal();
  });

  const btnCancel = document.createElement("button");
  btnCancel.className = "win-button";
  btnCancel.textContent = "Cancel";
  btnCancel.addEventListener("click", closeModal);

  actions.appendChild(btnSave);
  actions.appendChild(btnCancel);

  modal.appendChild(rowTitle);
  modal.appendChild(rowGroup);
  modal.appendChild(rowBg);
  modal.appendChild(rowText);
  modal.appendChild(rowFont);
  modal.appendChild(rowContentType);
  modal.appendChild(contentPanel);
  modal.appendChild(actions);

  openModal(modal);
};

const openGroupModal = (group) => {
  const isEdit = !!group;
  const working = group ? { ...group } : normalizeGroup({});

  const modal = document.createElement("div");
  modal.className = "win-dialog";
  modal.style.width = "504px";
  modal.style.height = "320px";
  const title = document.createElement("div");
  title.className = "dialog-title";
  title.textContent = "Add Group";
  modal.appendChild(title);

  const rowTitle = document.createElement("div");
  rowTitle.className = "win-form-row";
  rowTitle.innerHTML = `<div class="label">Title</div>`;
  const titleInput = document.createElement("input");
  titleInput.className = "win-input";
  titleInput.value = working.Title || "";
  rowTitle.appendChild(titleInput);

  const rowX = document.createElement("div");
  rowX.className = "win-form-row";
  rowX.innerHTML = `<div class="label">X</div>`;
  const xInput = document.createElement("input");
  xInput.type = "number";
  xInput.className = "win-number";
  xInput.value = working.X;
  rowX.appendChild(xInput);

  const rowY = document.createElement("div");
  rowY.className = "win-form-row";
  rowY.innerHTML = `<div class="label">Y</div>`;
  const yInput = document.createElement("input");
  yInput.type = "number";
  yInput.className = "win-number";
  yInput.value = working.Y;
  rowY.appendChild(yInput);

  const rowWidth = document.createElement("div");
  rowWidth.className = "win-form-row";
  rowWidth.innerHTML = `<div class="label">Width</div>`;
  const widthInput = document.createElement("input");
  widthInput.type = "number";
  widthInput.className = "win-number";
  widthInput.value = working.Width;
  rowWidth.appendChild(widthInput);

  const rowHeight = document.createElement("div");
  rowHeight.className = "win-form-row";
  rowHeight.innerHTML = `<div class="label">Height</div>`;
  const heightInput = document.createElement("input");
  heightInput.type = "number";
  heightInput.className = "win-number";
  heightInput.value = working.Height;
  rowHeight.appendChild(heightInput);

  const rowBorder = document.createElement("div");
  rowBorder.className = "win-form-row";
  rowBorder.innerHTML = `<div class="label">Border Color</div>`;
  const btnBorder = document.createElement("button");
  btnBorder.className = "win-button";
  btnBorder.textContent = "Select Color";
  const borderInput = document.createElement("input");
  borderInput.type = "color";
  borderInput.value = argbIntToHex(working.BorderColor);
  borderInput.className = "hidden";
  btnBorder.addEventListener("click", () => borderInput.click());
  borderInput.addEventListener("input", () => {
    working.BorderColor = hexToArgbInt(borderInput.value);
  });
  rowBorder.appendChild(btnBorder);
  rowBorder.appendChild(borderInput);

  const rowBg = document.createElement("div");
  rowBg.className = "win-form-row";
  rowBg.innerHTML = `<div class="label">Background Color</div>`;
  const btnBg = document.createElement("button");
  btnBg.className = "win-button";
  btnBg.textContent = "Select Color";
  const bgInput = document.createElement("input");
  bgInput.type = "color";
  bgInput.value = argbIntToHex(working.BackgroundColor);
  bgInput.className = "hidden";
  btnBg.addEventListener("click", () => bgInput.click());
  bgInput.addEventListener("input", () => {
    working.BackgroundColor = hexToArgbInt(bgInput.value);
  });
  rowBg.appendChild(btnBg);
  rowBg.appendChild(bgInput);

  const rowText = document.createElement("div");
  rowText.className = "win-form-row";
  rowText.innerHTML = `<div class="label">Text Color</div>`;
  const btnText = document.createElement("button");
  btnText.className = "win-button";
  btnText.textContent = "Select Color";
  const textInput = document.createElement("input");
  textInput.type = "color";
  textInput.value = argbIntToHex(working.TextColor);
  textInput.className = "hidden";
  btnText.addEventListener("click", () => textInput.click());
  textInput.addEventListener("input", () => {
    working.TextColor = hexToArgbInt(textInput.value);
  });
  rowText.appendChild(btnText);
  rowText.appendChild(textInput);

  const actions = document.createElement("div");
  actions.className = "win-actions";
  actions.style.position = "absolute";
  actions.style.bottom = "12px";
  actions.style.right = "12px";

  const btnSave = document.createElement("button");
  btnSave.className = "win-button primary";
  btnSave.textContent = "Save";
  btnSave.addEventListener("click", () => {
    working.Title = titleInput.value.trim() || "Group";
    working.X = Number(xInput.value) || 0;
    working.Y = Number(yInput.value) || 0;
    working.Width = Number(widthInput.value) || 300;
    working.Height = Number(heightInput.value) || 200;
    working.ModifiedDate = new Date().toISOString();
    pushUndo();
    state.groups[working.Id] = working;
    renderAll();
    closeModal();
  });

  const btnCancel = document.createElement("button");
  btnCancel.className = "win-button";
  btnCancel.textContent = "Cancel";
  btnCancel.addEventListener("click", closeModal);

  actions.appendChild(btnSave);
  actions.appendChild(btnCancel);

  modal.appendChild(rowTitle);
  modal.appendChild(rowX);
  modal.appendChild(rowY);
  modal.appendChild(rowWidth);
  modal.appendChild(rowHeight);
  modal.appendChild(rowBorder);
  modal.appendChild(rowBg);
  modal.appendChild(rowText);
  modal.appendChild(actions);

  openModal(modal);
};

const openAboutModal = () => {
  const modal = document.createElement("div");
  modal.className = "win-dialog about-dialog";

  const header = document.createElement("div");
  header.className = "about-header";
  header.innerHTML = `<div class="about-title">Notes</div><div class="about-version">Version 2.0.0</div>`;

  const body = document.createElement("div");
  body.className = "about-body";
  body.innerHTML = `
    <div>A modern note-taking application for Windows</div>
    <div class="muted" style="margin-top: 10px;">Copyright © 2024-2025</div>
    <div class="muted" style="margin-top: 8px;">Built with .NET 9.0 and Windows Forms</div>
  `;

  const footer = document.createElement("div");
  footer.className = "about-footer";
  const okButton = document.createElement("button");
  okButton.className = "win-button";
  okButton.textContent = "OK";
  okButton.addEventListener("click", closeModal);
  footer.appendChild(okButton);

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  openModal(modal);
};

const openSettingsModal = () => {
  const modal = document.createElement("div");
  modal.className = "win-dialog";
  modal.style.width = "713px";
  modal.style.height = "457px";

  const tabControl = document.createElement("div");
  tabControl.className = "tab-control";

  const tabs = [
    { id: "general", label: "General" },
    { id: "hotkeys", label: "Hotkeys" },
    { id: "window", label: "Window" },
    { id: "defaultStyle", label: "Default Style" },
    { id: "backup", label: "Backup" },
    { id: "advanced", label: "Advanced" }
  ];

  const tabHeader = document.createElement("div");
  tabHeader.className = "tab-header";
  const tabBody = document.createElement("div");
  tabBody.className = "tab-body";

  const renderTabContent = (id) => {
    tabBody.innerHTML = "";
    if (id === "general") {
      const autoSaveGroup = document.createElement("div");
      autoSaveGroup.className = "form-group";
      autoSaveGroup.innerHTML = `<div class="form-group-title">Auto Save</div>`;
      const chkAutoSave = document.createElement("label");
      chkAutoSave.className = "checkbox";
      const chkAutoSaveInput = document.createElement("input");
      chkAutoSaveInput.type = "checkbox";
      chkAutoSaveInput.checked = state.settings.autoSave;
      chkAutoSave.appendChild(chkAutoSaveInput);
      chkAutoSave.appendChild(document.createTextNode("Enable automatic saving"));
      const intervalRow = document.createElement("div");
      intervalRow.style.marginTop = "6px";
      intervalRow.innerHTML = `Auto-save interval (5-300): `;
      const intervalInput = document.createElement("input");
      intervalInput.type = "number";
      intervalInput.className = "win-number";
      intervalInput.style.width = "74px";
      intervalInput.value = state.settings.autoSaveInterval;
      intervalRow.appendChild(intervalInput);
      intervalRow.appendChild(document.createTextNode(" seconds"));
      autoSaveGroup.appendChild(chkAutoSave);
      autoSaveGroup.appendChild(intervalRow);

      const confirmGroup = document.createElement("div");
      confirmGroup.className = "form-group";
      confirmGroup.innerHTML = `<div class="form-group-title">Confirmation Dialogs</div>`;
      const chkDelete = document.createElement("label");
      chkDelete.className = "checkbox";
      const chkDeleteInput = document.createElement("input");
      chkDeleteInput.type = "checkbox";
      chkDeleteInput.checked = state.settings.confirmDelete;
      chkDelete.appendChild(chkDeleteInput);
      chkDelete.appendChild(document.createTextNode("Confirm before delete"));
      const chkReset = document.createElement("label");
      chkReset.className = "checkbox";
      const chkResetInput = document.createElement("input");
      chkResetInput.type = "checkbox";
      chkResetInput.checked = state.settings.confirmReset;
      chkReset.appendChild(chkResetInput);
      chkReset.appendChild(document.createTextNode("Confirm before reset"));
      const chkExit = document.createElement("label");
      chkExit.className = "checkbox";
      const chkExitInput = document.createElement("input");
      chkExitInput.type = "checkbox";
      chkExitInput.checked = state.settings.confirmExit;
      chkExit.appendChild(chkExitInput);
      chkExit.appendChild(document.createTextNode("Confirm before exit"));
      confirmGroup.appendChild(chkDelete);
      confirmGroup.appendChild(chkReset);
      confirmGroup.appendChild(chkExit);

      const trayGroup = document.createElement("div");
      trayGroup.className = "form-group";
      trayGroup.innerHTML = `<div class="form-group-title">System Tray</div>`;
      const chkShowTray = document.createElement("label");
      chkShowTray.className = "checkbox";
      const chkShowTrayInput = document.createElement("input");
      chkShowTrayInput.type = "checkbox";
      chkShowTrayInput.checked = state.settings.showTrayIcon;
      chkShowTray.appendChild(chkShowTrayInput);
      chkShowTray.appendChild(document.createTextNode("Show system tray icon"));
      const chkMinimizeTray = document.createElement("label");
      chkMinimizeTray.className = "checkbox";
      const chkMinimizeTrayInput = document.createElement("input");
      chkMinimizeTrayInput.type = "checkbox";
      chkMinimizeTrayInput.checked = state.settings.minimizeToTray;
      chkMinimizeTray.appendChild(chkMinimizeTrayInput);
      chkMinimizeTray.appendChild(document.createTextNode("Minimize to system tray"));
      const chkCloseTray = document.createElement("label");
      chkCloseTray.className = "checkbox";
      const chkCloseTrayInput = document.createElement("input");
      chkCloseTrayInput.type = "checkbox";
      chkCloseTrayInput.checked = state.settings.closeToTray;
      chkCloseTray.appendChild(chkCloseTrayInput);
      chkCloseTray.appendChild(document.createTextNode("Close to tray (keep hotkeys active)"));
      const chkStartMin = document.createElement("label");
      chkStartMin.className = "checkbox";
      const chkStartMinInput = document.createElement("input");
      chkStartMinInput.type = "checkbox";
      chkStartMinInput.checked = state.settings.startMinimized;
      chkStartMin.appendChild(chkStartMinInput);
      chkStartMin.appendChild(document.createTextNode("Start minimized"));
      const chkStartWin = document.createElement("label");
      chkStartWin.className = "checkbox";
      const chkStartWinInput = document.createElement("input");
      chkStartWinInput.type = "checkbox";
      chkStartWinInput.checked = state.settings.startWithWindows;
      chkStartWin.appendChild(chkStartWinInput);
      chkStartWin.appendChild(document.createTextNode("Start with Windows"));
      trayGroup.appendChild(chkShowTray);
      trayGroup.appendChild(chkMinimizeTray);
      trayGroup.appendChild(chkCloseTray);
      trayGroup.appendChild(chkStartMin);
      trayGroup.appendChild(chkStartWin);

      const themeGroup = document.createElement("div");
      themeGroup.className = "form-group";
      themeGroup.innerHTML = `<div class="form-group-title">Theme</div>`;
      const themeRow = document.createElement("div");
      themeRow.className = "win-form-row";
      themeRow.innerHTML = `<div class="label">Application theme:</div>`;
      const themeSelect = document.createElement("select");
      themeSelect.className = "win-select";
      ["System", "Light", "Dark"].forEach((t) => {
        const option = document.createElement("option");
        option.value = t;
        option.textContent = t;
        if (state.settings.theme === t) option.selected = true;
        themeSelect.appendChild(option);
      });
      themeRow.appendChild(themeSelect);
      themeGroup.appendChild(themeRow);

      const configPathTitle = document.createElement("div");
      configPathTitle.textContent = "Config file location:";
      configPathTitle.style.marginTop = "6px";
      const configPathValue = document.createElement("div");
      configPathValue.textContent = " ";
      configPathValue.style.maxWidth = "659px";
      configPathValue.style.cursor = "pointer";

      tabBody.appendChild(autoSaveGroup);
      tabBody.appendChild(confirmGroup);
      tabBody.appendChild(trayGroup);
      tabBody.appendChild(themeGroup);
      tabBody.appendChild(configPathTitle);
      tabBody.appendChild(configPathValue);

      const saveSettings = () => {
        state.settings.autoSave = chkAutoSaveInput.checked;
        state.settings.autoSaveInterval = Number(intervalInput.value) || 30;
        state.settings.confirmDelete = chkDeleteInput.checked;
        state.settings.confirmReset = chkResetInput.checked;
        state.settings.confirmExit = chkExitInput.checked;
        state.settings.showTrayIcon = chkShowTrayInput.checked;
        state.settings.minimizeToTray = chkMinimizeTrayInput.checked;
        state.settings.closeToTray = chkCloseTrayInput.checked;
        state.settings.startMinimized = chkStartMinInput.checked;
        state.settings.startWithWindows = chkStartWinInput.checked;
        state.settings.theme = themeSelect.value;
      };

      tabBody.dataset.save = saveSettings.toString();
    }

    if (id === "hotkeys") {
      const group = document.createElement("div");
      group.className = "form-group";
      group.innerHTML = `<div class="form-group-title">Global Hotkeys</div>`;
      const chkEnabled = document.createElement("label");
      chkEnabled.className = "checkbox";
      const chkInput = document.createElement("input");
      chkInput.type = "checkbox";
      chkInput.checked = state.settings.globalHotkeyEnabled;
      chkEnabled.appendChild(chkInput);
      chkEnabled.appendChild(document.createTextNode("Enable global hotkey"));
      const modifierRow = document.createElement("div");
      modifierRow.className = "win-form-row";
      modifierRow.innerHTML = `<div class="label">Modifier keys</div>`;
      const modifierList = document.createElement("div");
      modifierList.style.display = "grid";
      modifierList.style.gridTemplateColumns = "1fr 1fr";
      ["Ctrl", "Alt", "Shift", "Win"].forEach((key) => {
        const label = document.createElement("label");
        label.className = "checkbox";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = state.settings.globalHotkey?.includes(key) || false;
        label.appendChild(input);
        label.appendChild(document.createTextNode(key));
        modifierList.appendChild(label);
      });
      modifierRow.appendChild(modifierList);
      const hotkeyRow = document.createElement("div");
      hotkeyRow.className = "win-form-row";
      hotkeyRow.innerHTML = `<div class="label">Hotkey</div>`;
      const hotkeySelect = document.createElement("select");
      hotkeySelect.className = "win-select";
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = key;
        hotkeySelect.appendChild(option);
      });
      hotkeySelect.value = state.settings.globalHotkey?.split("+").pop() || "N";
      hotkeyRow.appendChild(hotkeySelect);
      group.appendChild(chkEnabled);
      group.appendChild(modifierRow);
      group.appendChild(hotkeyRow);
      tabBody.appendChild(group);

      const saveSettings = () => {
        state.settings.globalHotkeyEnabled = chkInput.checked;
        const modifiers = Array.from(modifierList.querySelectorAll("input"))
          .map((input, idx) => (input.checked ? ["Ctrl", "Alt", "Shift", "Win"][idx] : null))
          .filter(Boolean);
        state.settings.globalHotkey = [...modifiers, hotkeySelect.value].join("+");
      };
      tabBody.dataset.save = saveSettings.toString();
    }

    if (id === "window") {
      const startup = document.createElement("div");
      startup.className = "form-group";
      startup.innerHTML = `<div class="form-group-title">Startup Window</div>`;
      const row = document.createElement("div");
      row.className = "win-form-row";
      row.innerHTML = `<div class="label">Window state:</div>`;
      const select = document.createElement("select");
      select.className = "win-select";
      ["Normal", "Maximized", "Minimized"].forEach((stateValue) => {
        const option = document.createElement("option");
        option.value = stateValue;
        option.textContent = stateValue;
        if (state.settings.windowState === stateValue) option.selected = true;
        select.appendChild(option);
      });
      row.appendChild(select);
      startup.appendChild(row);

      const behavior = document.createElement("div");
      behavior.className = "form-group";
      behavior.innerHTML = `<div class="form-group-title">Window Behavior</div>`;
      const chkSize = document.createElement("label");
      chkSize.className = "checkbox";
      const chkSizeInput = document.createElement("input");
      chkSizeInput.type = "checkbox";
      chkSizeInput.checked = state.settings.rememberSize;
      chkSize.appendChild(chkSizeInput);
      chkSize.appendChild(document.createTextNode("Remember window size"));
      const chkPos = document.createElement("label");
      chkPos.className = "checkbox";
      const chkPosInput = document.createElement("input");
      chkPosInput.type = "checkbox";
      chkPosInput.checked = state.settings.rememberPosition;
      chkPos.appendChild(chkPosInput);
      chkPos.appendChild(document.createTextNode("Remember window position"));
      const chkTop = document.createElement("label");
      chkTop.className = "checkbox";
      const chkTopInput = document.createElement("input");
      chkTopInput.type = "checkbox";
      chkTopInput.checked = state.settings.alwaysOnTop;
      chkTop.appendChild(chkTopInput);
      chkTop.appendChild(document.createTextNode("Always on top"));
      behavior.appendChild(chkSize);
      behavior.appendChild(chkPos);
      behavior.appendChild(chkTop);

      tabBody.appendChild(startup);
      tabBody.appendChild(behavior);

      const saveSettings = () => {
        state.settings.windowState = select.value;
        state.settings.rememberSize = chkSizeInput.checked;
        state.settings.rememberPosition = chkPosInput.checked;
        state.settings.alwaysOnTop = chkTopInput.checked;
      };
      tabBody.dataset.save = saveSettings.toString();
    }

    if (id === "defaultStyle") {
      const group = document.createElement("div");
      group.className = "form-group";
      group.style.width = "400px";
      group.innerHTML = `<div class="form-group-title">Default Note Style</div>`;
      const rowBg = document.createElement("div");
      rowBg.className = "win-form-row";
      rowBg.innerHTML = `<div class="label">Background Color</div>`;
      const btnBg = document.createElement("button");
      btnBg.className = "win-button";
      btnBg.textContent = "Background Color";
      rowBg.appendChild(btnBg);
      const rowText = document.createElement("div");
      rowText.className = "win-form-row";
      rowText.innerHTML = `<div class="label">Text Color</div>`;
      const btnText = document.createElement("button");
      btnText.className = "win-button";
      btnText.textContent = "Text Color";
      rowText.appendChild(btnText);
      const rowFont = document.createElement("div");
      rowFont.className = "win-form-row";
      rowFont.innerHTML = `<div class="label">Font</div>`;
      const btnFont = document.createElement("button");
      btnFont.className = "win-button";
      btnFont.textContent = `${state.settings.defaultFontName || "Segoe UI"}, ${state.settings.defaultFontSize || 9}pt`;
      rowFont.appendChild(btnFont);
      const btnApply = document.createElement("button");
      btnApply.className = "win-button";
      btnApply.textContent = "Apply Style to All Existing Notes";
      btnApply.style.width = "200px";
      btnApply.addEventListener("click", () => {
        pushUndo();
        Object.values(state.units).forEach((note) => {
          if (state.settings.defaultBackgroundColor) {
            note.BackgroundColor = state.settings.defaultBackgroundColor;
          }
          if (state.settings.defaultTextColor) {
            note.TextColor = state.settings.defaultTextColor;
          }
          if (state.settings.defaultFontName) {
            note.Font = normalizeFont({
              Name: state.settings.defaultFontName,
              Size: state.settings.defaultFontSize || 9,
              Style: 0
            });
          }
        });
        renderAll();
      });
      group.appendChild(rowBg);
      group.appendChild(rowText);
      group.appendChild(rowFont);
      group.appendChild(btnApply);
      tabBody.appendChild(group);

      const saveSettings = () => {
        state.settings.defaultFontName = state.settings.defaultFontName || "Segoe UI";
        state.settings.defaultFontSize = state.settings.defaultFontSize || 9;
      };
      tabBody.dataset.save = saveSettings.toString();
    }

    if (id === "backup") {
      const group = document.createElement("div");
      group.className = "form-group";
      group.style.width = "400px";
      group.innerHTML = `<div class="form-group-title">Backup Management</div>`;
      const chkAuto = document.createElement("label");
      chkAuto.className = "checkbox";
      const chkAutoInput = document.createElement("input");
      chkAutoInput.type = "checkbox";
      chkAutoInput.checked = state.settings.backupEnabled;
      chkAuto.appendChild(chkAutoInput);
      chkAuto.appendChild(document.createTextNode("Create automatic backups"));
      const rowCount = document.createElement("div");
      rowCount.style.marginTop = "8px";
      rowCount.textContent = "Maximum number of backups: ";
      const countInput = document.createElement("input");
      countInput.type = "number";
      countInput.className = "win-number";
      countInput.style.width = "80px";
      countInput.value = state.settings.backupCount;
      rowCount.appendChild(countInput);
      const btnRestore = document.createElement("button");
      btnRestore.className = "win-button";
      btnRestore.textContent = "Restore from Backup...";
      btnRestore.style.marginTop = "8px";
      const btnOpen = document.createElement("button");
      btnOpen.className = "win-button";
      btnOpen.textContent = "Open Backup Folder";
      btnOpen.style.marginLeft = "8px";
      btnRestore.addEventListener("click", importData);
      btnOpen.addEventListener("click", async () => {
        await api.getPaths();
      });
      group.appendChild(chkAuto);
      group.appendChild(rowCount);
      const btnRow = document.createElement("div");
      btnRow.appendChild(btnRestore);
      btnRow.appendChild(btnOpen);
      group.appendChild(btnRow);
      tabBody.appendChild(group);

      const saveSettings = () => {
        state.settings.backupEnabled = chkAutoInput.checked;
        state.settings.backupCount = Number(countInput.value) || 10;
      };
      tabBody.dataset.save = saveSettings.toString();
    }

    if (id === "advanced") {
      const behavior = document.createElement("div");
      behavior.className = "form-group";
      behavior.innerHTML = `<div class="form-group-title">Application Behavior</div>`;
      const rowUndo = document.createElement("div");
      rowUndo.className = "win-form-row";
      rowUndo.innerHTML = `<div class="label">Undo levels (5-50):</div>`;
      const undoInput = document.createElement("input");
      undoInput.type = "number";
      undoInput.className = "win-number";
      undoInput.value = state.settings.undoLevels;
      rowUndo.appendChild(undoInput);
      const chkDouble = document.createElement("label");
      chkDouble.className = "checkbox";
      const chkDoubleInput = document.createElement("input");
      chkDoubleInput.type = "checkbox";
      chkDoubleInput.checked = state.settings.doubleClickToEdit;
      chkDouble.appendChild(chkDoubleInput);
      chkDouble.appendChild(document.createTextNode("Double-click to edit"));
      const chkSingle = document.createElement("label");
      chkSingle.className = "checkbox";
      const chkSingleInput = document.createElement("input");
      chkSingleInput.type = "checkbox";
      chkSingleInput.checked = state.settings.singleClickToCopy;
      chkSingle.appendChild(chkSingleInput);
      chkSingle.appendChild(document.createTextNode("Single-click to copy"));
      behavior.appendChild(rowUndo);
      behavior.appendChild(chkDouble);
      behavior.appendChild(chkSingle);

      const performance = document.createElement("div");
      performance.className = "form-group";
      performance.innerHTML = `<div class="form-group-title">Performance</div>`;
      const chkOptimize = document.createElement("label");
      chkOptimize.className = "checkbox";
      const chkOptimizeInput = document.createElement("input");
      chkOptimizeInput.type = "checkbox";
      chkOptimizeInput.checked = state.settings.optimizeForLargeNotes;
      chkOptimize.appendChild(chkOptimizeInput);
      chkOptimize.appendChild(document.createTextNode("Optimize for large number of notes"));
      const chkAnimations = document.createElement("label");
      chkAnimations.className = "checkbox";
      const chkAnimationsInput = document.createElement("input");
      chkAnimationsInput.type = "checkbox";
      chkAnimationsInput.checked = state.settings.enableAnimations;
      chkAnimations.appendChild(chkAnimationsInput);
      chkAnimations.appendChild(document.createTextNode("Enable animations"));
      performance.appendChild(chkOptimize);
      performance.appendChild(chkAnimations);

      const logging = document.createElement("div");
      logging.className = "form-group";
      logging.innerHTML = `<div class="form-group-title">Logging / Debugging</div>`;
      const logRow = document.createElement("div");
      logRow.className = "win-form-row";
      logRow.innerHTML = `<div class="label">Log Level:</div>`;
      const logSelect = document.createElement("select");
      logSelect.className = "win-select";
      ["None", "Error", "Warning", "Info", "Debug"].forEach((level) => {
        const option = document.createElement("option");
        option.value = level;
        option.textContent = level;
        if (state.settings.loggingLevel === level) option.selected = true;
        logSelect.appendChild(option);
      });
      logRow.appendChild(logSelect);
      const logActions = document.createElement("div");
      const btnOpenLog = document.createElement("button");
      btnOpenLog.className = "win-button";
      btnOpenLog.textContent = "Open Log File";
      const btnClearLog = document.createElement("button");
      btnClearLog.className = "win-button";
      btnClearLog.textContent = "Clear Old Logs";
      logActions.appendChild(btnOpenLog);
      logActions.appendChild(btnClearLog);
      logging.appendChild(logRow);
      logging.appendChild(logActions);

      tabBody.appendChild(behavior);
      tabBody.appendChild(performance);
      tabBody.appendChild(logging);

      const saveSettings = () => {
        state.settings.undoLevels = Number(undoInput.value) || 20;
        state.settings.doubleClickToEdit = chkDoubleInput.checked;
        state.settings.singleClickToCopy = chkSingleInput.checked;
        state.settings.optimizeForLargeNotes = chkOptimizeInput.checked;
        state.settings.enableAnimations = chkAnimationsInput.checked;
        state.settings.loggingLevel = logSelect.value;
      };
      tabBody.dataset.save = saveSettings.toString();
    }
  };

  tabs.forEach((tab, index) => {
    const btn = document.createElement("div");
    btn.className = `tab ${index === 0 ? "active" : ""}`;
    btn.textContent = tab.label;
    btn.dataset.id = tab.id;
    btn.addEventListener("click", () => {
      tabHeader.querySelectorAll(".tab").forEach((node) => node.classList.remove("active"));
      btn.classList.add("active");
      renderTabContent(tab.id);
    });
    tabHeader.appendChild(btn);
  });

  tabControl.appendChild(tabHeader);
  tabControl.appendChild(tabBody);
  modal.appendChild(tabControl);

  renderTabContent("general");

  const btnSave = document.createElement("button");
  btnSave.className = "win-button primary";
  btnSave.textContent = "Save";
  btnSave.style.position = "absolute";
  btnSave.style.right = "108px";
  btnSave.style.bottom = "12px";
  btnSave.addEventListener("click", () => {
    const saveFn = tabBody.dataset.save;
    if (saveFn) {
      new Function(`return (${saveFn})`)()();
    }
    applySettings();
    setupAutosave();
    closeModal();
  });

  const btnCancel = document.createElement("button");
  btnCancel.className = "win-button";
  btnCancel.textContent = "Cancel";
  btnCancel.style.position = "absolute";
  btnCancel.style.right = "12px";
  btnCancel.style.bottom = "12px";
  btnCancel.addEventListener("click", closeModal);

  const btnReset = document.createElement("button");
  btnReset.className = "win-button";
  btnReset.textContent = "Reset to Defaults";
  btnReset.style.position = "absolute";
  btnReset.style.left = "12px";
  btnReset.style.bottom = "12px";
  btnReset.addEventListener("click", () => {
    state.settings = { ...defaultSettings };
    renderTabContent("general");
  });

  modal.appendChild(btnSave);
  modal.appendChild(btnCancel);
  modal.appendChild(btnReset);
  openModal(modal);
};

const createNote = (x = 20, y = 20) => {
  const note = normalizeNote({
    Title: "New Note",
    X: x,
    Y: y
  });
  pushUndo();
  state.units[note.Id] = note;
  renderAll();
};

const createGroupFromSelection = () => {
  if (state.selectedNoteIds.size === 0) {
    openGroupModal();
    return;
  }
  const notes = Array.from(state.selectedNoteIds).map((id) => state.units[id]).filter(Boolean);
  if (notes.length === 0) return;
  const positions = notes.map((note) => {
    const el = noteLayer.querySelector(`.note[data-id="${note.Id}"]`);
    return {
      x: note.X,
      y: note.Y,
      w: el ? el.offsetWidth : 80,
      h: el ? el.offsetHeight : 40
    };
  });
  const minX = Math.min(...positions.map((n) => n.x));
  const minY = Math.min(...positions.map((n) => n.y));
  const maxX = Math.max(...positions.map((n) => n.x + n.w));
  const maxY = Math.max(...positions.map((n) => n.y + n.h));
  const group = normalizeGroup({
    Title: "Group",
    X: minX - 20,
    Y: minY - 20,
    Width: maxX - minX + 40,
    Height: maxY - minY + 40
  });
  pushUndo();
  state.groups[group.Id] = group;
  notes.forEach((note) => {
    note.GroupId = group.Id;
  });
  renderAll();
  setSelection([], [group.Id]);
};

const copySelectedToClipboard = () => {
  const firstId = Array.from(state.selectedNoteIds)[0];
  if (!firstId) return;
  const note = state.units[firstId];
  if (!note) return;
  api.writeClipboard({
    type: "text",
    format: "text/plain",
    data: note.Title || ""
  });
  setStatus("Copied");
};

const arrangeGrid = (compact = false) => {
  const notes = Object.values(state.units);
  if (!notes.length) return;
  const gap = compact ? 12 : 20;
  const startX = 20;
  const startY = 20;
  let x = startX;
  let y = startY;
  let rowHeight = 0;
  notes.forEach((note) => {
    const el = noteLayer.querySelector(`.note[data-id="${note.Id}"]`);
    const width = el ? el.offsetWidth : 80;
    const height = el ? el.offsetHeight : 40;
    if (x + width > 900) {
      x = startX;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    note.X = x;
    note.Y = y;
    x += width + gap;
    rowHeight = Math.max(rowHeight, height);
  });
  renderAll();
};

const arrangeByDate = () => {
  const notes = Object.values(state.units).sort((a, b) => new Date(b.ModifiedDate) - new Date(a.ModifiedDate));
  notes.forEach((note, idx) => {
    note.X = 20;
    note.Y = 20 + idx * 50;
  });
  renderAll();
};

const arrangeByColor = () => {
  const notes = Object.values(state.units).sort((a, b) => a.BackgroundColor - b.BackgroundColor);
  notes.forEach((note, idx) => {
    note.X = 20 + (idx % 5) * 140;
    note.Y = 20 + Math.floor(idx / 5) * 50;
  });
  renderAll();
};

const fixOverlaps = () => {
  const notes = Object.values(state.units);
  notes.forEach((note, idx) => {
    note.X = note.X + idx * 5;
    note.Y = note.Y + idx * 5;
  });
  renderAll();
};

const applyStyleToSelection = (styleName) => {
  pushUndo();
  const targets = state.selectedNoteIds.size
    ? Array.from(state.selectedNoteIds)
    : Object.keys(state.units);
  targets.forEach((id) => {
    const note = state.units[id];
    if (!note) return;
    note.ButtonType = styleName;
    const preset = stylePreset(styleName);
    note.BackgroundColor = hexToArgbInt(preset.bg);
    note.TextColor = hexToArgbInt(preset.fg);
    note.ModifiedDate = new Date().toISOString();
  });
  renderAll();
};

const copyStyle = () => {
  const firstId = Array.from(state.selectedNoteIds)[0];
  if (!firstId) return;
  const note = state.units[firstId];
  copiedStyle = {
    BackgroundColor: note.BackgroundColor,
    TextColor: note.TextColor,
    Font: note.Font,
    ButtonType: note.ButtonType
  };
  setStatus("Style copied");
};

const pasteStyle = () => {
  if (!copiedStyle) return;
  pushUndo();
  state.selectedNoteIds.forEach((id) => {
    const note = state.units[id];
    if (!note) return;
    note.BackgroundColor = copiedStyle.BackgroundColor;
    note.TextColor = copiedStyle.TextColor;
    note.Font = copiedStyle.Font;
    note.ButtonType = copiedStyle.ButtonType;
    note.ModifiedDate = new Date().toISOString();
  });
  renderAll();
};

const showMenu = (items, x, y, container) => {
  const menu = container || menuDropdown;
  menu.innerHTML = "";
  items.forEach((item) => {
    if (item.type === "separator") {
      const sep = document.createElement("div");
      sep.className = "menu-separator";
      menu.appendChild(sep);
      return;
    }
    const entry = document.createElement("div");
    entry.className = "menu-entry";
    if (item.disabled) entry.classList.add("disabled");
    entry.textContent = `${item.checked ? "✓ " : ""}${item.label}`;
    if (item.shortcut) {
      const shortcut = document.createElement("span");
      shortcut.className = "shortcut";
      shortcut.textContent = item.shortcut;
      entry.appendChild(shortcut);
    }
    entry.addEventListener("click", () => {
      if (item.disabled) return;
      hideMenu();
      if (item.onClick) item.onClick();
    });
    entry.addEventListener("mouseenter", () => {
      if (item.submenu) {
        const rect = entry.getBoundingClientRect();
        showMenu(item.submenu, rect.right - 2, rect.top, contextMenu);
        contextMenu.classList.remove("hidden");
      }
    });
    menu.appendChild(entry);
  });
  if (typeof x === "number" && typeof y === "number") {
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }
  menu.classList.remove("hidden");
};

const hideMenu = () => {
  menuDropdown.classList.add("hidden");
  contextMenu.classList.add("hidden");
  contextMenu.innerHTML = "";
};

const getMenuDefinition = (key) => {
  if (key === "file") {
    return [
      { label: "New Note...", shortcut: "Ctrl+N", onClick: () => openNoteModal() },
      { label: "New Group...", shortcut: "Ctrl+Shift+G", onClick: () => openGroupModal() },
      { label: "Save", shortcut: "Ctrl+S", onClick: saveData },
      { type: "separator" },
      { label: "Import...", onClick: importData },
      { label: "Export...", onClick: exportData },
      { type: "separator" },
      { label: "Reload", shortcut: "Ctrl+R", onClick: loadData },
      { label: "Reset", onClick: resetData },
      { type: "separator" },
      { label: "Exit", shortcut: "Ctrl+Q", onClick: () => api.hideWindow() }
    ];
  }
  if (key === "edit") {
    return [
      { label: "Undo", shortcut: "Ctrl+Z", onClick: undo },
      { label: "Redo", shortcut: "Ctrl+Y", onClick: redo },
      { type: "separator" },
      {
        label: "Movable",
        checked: state.settings.movable,
        onClick: () => {
          state.settings.movable = !state.settings.movable;
        }
      },
      {
        label: "Autofocus",
        checked: state.settings.autofocus,
        onClick: () => {
          state.settings.autofocus = !state.settings.autofocus;
        }
      },
      {
        label: "Auto Save",
        checked: state.settings.autoSave,
        onClick: () => {
          state.settings.autoSave = !state.settings.autoSave;
        }
      },
      { label: "Auto arrange", onClick: arrangeGrid },
      { type: "separator" },
      { label: "Settings", onClick: openSettingsModal }
    ];
  }
  if (key === "view") {
    return [
      {
        label: "Arrange",
        submenu: [
          { label: "Grid", onClick: arrangeGrid },
          { label: "By Date", onClick: arrangeByDate },
          { label: "By Color", onClick: arrangeByColor },
          { label: "Compact", onClick: () => arrangeGrid(true) }
        ]
      },
      { type: "separator" },
      { label: "Fix Overlaps", onClick: fixOverlaps },
      { type: "separator" },
      {
        label: "Styles",
        submenu: [
          { label: "Random", onClick: () => applyStyleToSelection(BUTTON_STYLES[Math.floor(Math.random() * BUTTON_STYLES.length)]) },
          { type: "separator" },
          ...BUTTON_STYLES.map((style) => ({
            label: style,
            onClick: () => applyStyleToSelection(style)
          }))
        ]
      }
    ];
  }
  if (key === "help") {
    return [{ label: "About", onClick: openAboutModal }];
  }
  return [];
};

const showContextForNote = (note, x, y) => {
  const groupItems = Object.values(state.groups).map((group) => ({
    label: group.Title,
    onClick: () => {
      note.GroupId = group.Id;
      renderAll();
    }
  }));
  const items = [
    {
      label: "Styles",
      submenu: [
        { label: "Random", onClick: () => applyStyleToSelection(BUTTON_STYLES[Math.floor(Math.random() * BUTTON_STYLES.length)]) },
        { type: "separator" },
        ...BUTTON_STYLES.map((style) => ({ label: style, onClick: () => applyStyleToSelection(style) }))
      ]
    },
    { type: "separator" },
    { label: "Edit", onClick: () => openNoteModal(note) },
    { label: "Delete", onClick: deleteSelection },
    { type: "separator" },
    {
      label: "Copy in lowercase",
      onClick: () => {
        api.writeClipboard({ type: "text", format: "text/plain", data: (note.Title || "").toLowerCase() });
      }
    },
    {
      label: "Copy in uppercase",
      onClick: () => {
        api.writeClipboard({ type: "text", format: "text/plain", data: (note.Title || "").toUpperCase() });
      }
    },
    { type: "separator" },
    {
      label: "Duplicate",
      onClick: () => {
        const copy = normalizeNote({ ...note, Id: toUUID(), X: note.X + 20, Y: note.Y + 20 });
        pushUndo();
        state.units[copy.Id] = copy;
        renderAll();
      }
    },
    { label: "Copy Style", onClick: copyStyle },
    { label: "Paste Style", onClick: pasteStyle },
    { type: "separator" },
    { label: "Add to Group", submenu: groupItems.length ? groupItems : [{ label: "(none)", disabled: true }] },
    { label: "Remove from Group", onClick: () => { note.GroupId = null; renderAll(); } }
  ];
  showMenu(items, x, y, contextMenu);
  contextMenu.classList.remove("hidden");
};

const showContextForGroup = (group, x, y) => {
  const items = [
    {
      label: "Add button here",
      onClick: () => {
        const point = state.lastContextPoint || { x: group.X + 20, y: group.Y + 20 };
        createNote(point.x, point.y);
      }
    },
    { type: "separator" },
    { label: "Edit", onClick: () => openGroupModal(group) },
    { label: "Delete", onClick: deleteSelection },
    { type: "separator" },
    {
      label: "Align Buttons",
      submenu: [
        { label: "Left", onClick: () => alignGroup(group, "left") },
        { label: "Center", onClick: () => alignGroup(group, "center") },
        { label: "Right", onClick: () => alignGroup(group, "right") },
        { label: "Top", onClick: () => alignGroup(group, "top") },
        { label: "Middle", onClick: () => alignGroup(group, "middle") },
        { label: "Bottom", onClick: () => alignGroup(group, "bottom") }
      ]
    },
    { label: "Auto Resize", onClick: () => autoResizeGroup(group) },
    { type: "separator" },
    {
      label: "Styles",
      submenu: [
        { label: "Default", onClick: () => { group.GroupBoxType = "Default"; renderAll(); } },
        { label: "Random", onClick: () => { group.GroupBoxType = GROUP_TYPES[Math.floor(Math.random() * GROUP_TYPES.length)]; renderAll(); } },
        { type: "separator" },
        ...GROUP_TYPES.map((type) => ({
          label: type,
          onClick: () => {
            group.GroupBoxType = type;
            renderAll();
          }
        }))
      ]
    }
  ];
  showMenu(items, x, y, contextMenu);
  contextMenu.classList.remove("hidden");
};

const alignGroup = (group, mode) => {
  const notes = Object.values(state.units).filter((note) => note.GroupId === group.Id);
  notes.forEach((note) => {
    const el = noteLayer.querySelector(`.note[data-id="${note.Id}"]`);
    const width = el ? el.offsetWidth : 80;
    const height = el ? el.offsetHeight : 40;
    if (mode === "left") note.X = group.X + 8;
    if (mode === "center") note.X = group.X + (group.Width - width) / 2;
    if (mode === "right") note.X = group.X + group.Width - width - 8;
    if (mode === "top") note.Y = group.Y + 18;
    if (mode === "middle") note.Y = group.Y + (group.Height - height) / 2;
    if (mode === "bottom") note.Y = group.Y + group.Height - height - 8;
    note.ModifiedDate = new Date().toISOString();
  });
  renderAll();
};

const autoResizeGroup = (group) => {
  const notes = Object.values(state.units).filter((note) => note.GroupId === group.Id);
  if (!notes.length) return;
  const boxes = notes.map((note) => {
    const el = noteLayer.querySelector(`.note[data-id="${note.Id}"]`);
    return {
      x: note.X,
      y: note.Y,
      w: el ? el.offsetWidth : 80,
      h: el ? el.offsetHeight : 40
    };
  });
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  group.X = minX - 10;
  group.Y = minY - 10;
  group.Width = maxX - minX + 20;
  group.Height = maxY - minY + 20;
  renderAll();
};

const setupAutosave = () => {
  if (autosaveTimer) clearInterval(autosaveTimer);
  autosaveTimer = setInterval(() => {
    if (!state.settings.autoSave) return;
    saveData();
  }, clamp(state.settings.autoSaveInterval, 5, 300) * 1000);
};

const wireEvents = () => {
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", (event) => {
      const menuKey = item.dataset.menu;
      const rect = item.getBoundingClientRect();
      showMenu(getMenuDefinition(menuKey), rect.left, rect.bottom);
      document.querySelectorAll(".menu-item").forEach((node) => node.classList.remove("active"));
      item.classList.add("active");
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".menu-bar") && !event.target.closest(".menu-dropdown")) {
      hideMenu();
      document.querySelectorAll(".menu-item").forEach((node) => node.classList.remove("active"));
    }
  });

  panelContainer.addEventListener("mousedown", (event) => {
    if (event.target.closest(".note") || event.target.closest(".group-box")) return;
    if (!event.ctrlKey) setSelection([], []);
    startSelection(event);
  });
  panelContainer.addEventListener("mousemove", handlePanelMouseMove);
  panelContainer.addEventListener("mouseup", handlePanelMouseUp);
  panelContainer.addEventListener("mouseleave", handlePanelMouseUp);

  noteLayer.addEventListener("mousedown", (event) => {
    const noteEl = event.target.closest(".note");
    if (!noteEl) return;
    const note = state.units[noteEl.dataset.id];
    if (!note) return;
    handleNoteMouseDown(event, note);
  });

  noteLayer.addEventListener("dblclick", (event) => {
    const noteEl = event.target.closest(".note");
    if (!noteEl) return;
    const note = state.units[noteEl.dataset.id];
    if (!note) return;
    if (state.settings.doubleClickToEdit) openNoteModal(note);
  });

  noteLayer.addEventListener("click", (event) => {
    const noteEl = event.target.closest(".note");
    if (!noteEl) return;
    const note = state.units[noteEl.dataset.id];
    if (!note) return;
    if (state.settings.singleClickToCopy) {
      api.writeClipboard({ type: "text", format: "text/plain", data: note.Title || "" });
      setStatus("Copied");
    }
  });

  noteLayer.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const noteEl = event.target.closest(".note");
    if (!noteEl) return;
    const note = state.units[noteEl.dataset.id];
    if (!note) return;
    state.lastContextPoint = getPanelPoint(event);
    setSelection([note.Id], []);
    showContextForNote(note, event.clientX, event.clientY);
  });

  groupLayer.addEventListener("mousedown", (event) => {
    const resizeHandle = event.target.closest(".group-box__resize");
    const groupEl = event.target.closest(".group-box");
    if (!groupEl) return;
    const group = state.groups[groupEl.dataset.id];
    if (!group) return;
    if (resizeHandle) {
      handleGroupMouseDown(event, group, true, resizeHandle.dataset.dir);
    } else if (event.target.closest(".group-box__legend")) {
      handleGroupMouseDown(event, group, false);
    }
  });

  groupLayer.addEventListener("dblclick", (event) => {
    const groupEl = event.target.closest(".group-box");
    if (!groupEl) return;
    const group = state.groups[groupEl.dataset.id];
    if (!group) return;
    openGroupModal(group);
  });

  groupLayer.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const groupEl = event.target.closest(".group-box");
    if (!groupEl) return;
    const group = state.groups[groupEl.dataset.id];
    if (!group) return;
    state.lastContextPoint = getPanelPoint(event);
    setSelection([], [group.Id]);
    showContextForGroup(group, event.clientX, event.clientY);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Delete") deleteSelection();
    if (event.ctrlKey && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setSelection(Object.keys(state.units), Object.keys(state.groups));
    }
    if (event.ctrlKey && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    }
    if (event.ctrlKey && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
    }
    if (event.ctrlKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveData();
    }
    if (event.ctrlKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      openNoteModal();
    }
    if (event.ctrlKey && event.key.toLowerCase() === "q") {
      event.preventDefault();
      if (!state.settings.confirmExit || window.confirm("Exit Notes?")) {
        api.hideWindow();
      }
    }
  });
};

const initialize = async () => {
  await loadData();
  applySettings();
  renderAll();
  wireEvents();
  setupAutosave();
};

initialize();

modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) closeModal();
});

window.addEventListener("beforeunload", () => {
  saveData();
});
