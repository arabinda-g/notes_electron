const canvas = document.getElementById("canvas");
const noteLayer = document.getElementById("noteLayer");
const groupLayer = document.getElementById("groupLayer");
const selectionBox = document.getElementById("selectionBox");
const modalOverlay = document.getElementById("modalOverlay");
const noteTemplate = document.getElementById("noteTemplate");
const groupTemplate = document.getElementById("groupTemplate");
const searchInput = document.getElementById("searchInput");
const noteList = document.getElementById("noteList");
const noteCount = document.getElementById("noteCount");

const btnAdd = document.getElementById("btnAdd");
const btnPaste = document.getElementById("btnPaste");
const btnGroup = document.getElementById("btnGroup");
const btnCopy = document.getElementById("btnCopy");
const btnDelete = document.getElementById("btnDelete");
const btnUndo = document.getElementById("btnUndo");
const btnRedo = document.getElementById("btnRedo");
const btnSave = document.getElementById("btnSave");
const btnImport = document.getElementById("btnImport");
const btnExport = document.getElementById("btnExport");
const btnSettings = document.getElementById("btnSettings");

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
  theme: "system",
  alwaysOnTop: false,
  runInTray: true,
  runOnStartup: false,
  globalHotkey: "Ctrl+Alt+N",
  backupEnabled: true,
  backupCount: 10,
  undoLevels: 20,
  animations: true,
  loggingLevel: "Info"
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
  searchQuery: ""
};

let autosaveTimer = null;

const BUTTON_STYLES = [
  "Blue",
  "Red",
  "Green",
  "Yellow",
  "Purple",
  "Orange",
  "Gray",
  "Teal",
  "Pink",
  "Style10",
  "Style11",
  "Style12",
  "Style13",
  "Style14",
  "Style15",
  "GradientButton",
  "NeonGlowButton",
  "MaterialButton",
  "GlassMorphismButton",
  "NeumorphismButton",
  "Retro3DButton",
  "PremiumCardButton",
  "OutlineButton",
  "PillButton",
  "SkeuomorphicButton"
];

const GROUP_TYPES = ["ResizableGroupBox", "Basic", "Rounded"];

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
    return { Name: "Segoe UI", Size: 11, Style: 0 };
  }
  return {
    Name: font.Name || "Segoe UI",
    Size: Number(font.Size) || 11,
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
    fontSize: `${normalized.Size}px`,
    fontWeight: isBold ? "600" : "400",
    fontStyle: isItalic ? "italic" : "normal"
  };
};

const normalizeNote = (note) => {
  const font = normalizeFont(note.Font);
  return {
    Id: note.Id || note.id || toUUID(),
    Title: note.Title || note.title || "Untitled",
    BackgroundColor: typeof note.BackgroundColor === "number" ? note.BackgroundColor : hexToArgbInt("#ffffff"),
    TextColor: typeof note.TextColor === "number" ? note.TextColor : hexToArgbInt("#111827"),
    Font: font,
    X: Number(note.X) || 200,
    Y: Number(note.Y) || 200,
    Width: Number(note.Width) || 220,
    Height: Number(note.Height) || 140,
    ContentType: note.ContentType || note.contentType || "Text",
    ContentData: note.ContentData || note.contentData || "",
    ContentFormat: note.ContentFormat || note.contentFormat || "plain",
    ButtonType: note.ButtonType || note.buttonType || BUTTON_STYLES[0],
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
    Width: Number(group.Width) || 360,
    Height: Number(group.Height) || 240,
    BorderColor: typeof group.BorderColor === "number" ? group.BorderColor : hexToArgbInt("#94a3b8"),
    BackgroundColor: typeof group.BackgroundColor === "number" ? group.BackgroundColor : hexToArgbInt("#0f172a"),
    TextColor: typeof group.TextColor === "number" ? group.TextColor : hexToArgbInt("#e2e8f0"),
    GroupBoxType: group.GroupBoxType || group.groupBoxType || GROUP_TYPES[0],
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
  if (state.undoStack.length === 0) {
    return;
  }
  const current = JSON.parse(JSON.stringify({ units: state.units, groups: state.groups }));
  state.redoStack.push(current);
  const snapshot = state.undoStack.pop();
  restoreSnapshot(snapshot);
};

const redo = () => {
  if (state.redoStack.length === 0) {
    return;
  }
  const current = JSON.parse(JSON.stringify({ units: state.units, groups: state.groups }));
  state.undoStack.push(current);
  const snapshot = state.redoStack.pop();
  restoreSnapshot(snapshot);
};

const setSelection = (noteIds = [], groupIds = []) => {
  state.selectedNoteIds = new Set(noteIds);
  state.selectedGroupIds = new Set(groupIds);
  updateSelectionStyles();
  updateNoteList();
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
    runInTray: state.settings.runInTray,
    runOnStartup: state.settings.runOnStartup,
    globalHotkey: state.settings.globalHotkey,
    backupEnabled: state.settings.backupEnabled,
    backupCount: state.settings.backupCount
  });
  applyTheme();
};

const applyTheme = () => {
  const theme = state.settings.theme;
  document.body.classList.remove("theme-dark", "theme-light");
  if (theme === "dark") {
    document.body.classList.add("theme-dark");
  } else if (theme === "light") {
    document.body.classList.add("theme-light");
  }
};

const renderNote = (note) => {
  const existing = noteLayer.querySelector(`.note[data-id="${note.Id}"]`);
  const element = existing || noteTemplate.content.firstElementChild.cloneNode(true);
  element.dataset.id = note.Id;
  element.style.left = `${note.X}px`;
  element.style.top = `${note.Y}px`;
  element.style.width = `${note.Width}px`;
  element.style.height = `${note.Height}px`;

  const bg = argbIntToRgba(note.BackgroundColor);
  const fg = argbIntToRgba(note.TextColor);
  if (bg) {
    element.style.background = bg;
  }
  if (fg) {
    element.style.color = fg;
  }

  const fontCss = fontToCss(note.Font);
  Object.assign(element.style, fontCss);

  element.classList.remove(...BUTTON_STYLES.map((style) => `btn-style-${style}`));
  element.classList.add(`btn-style-${note.ButtonType}`);

  element.querySelector(".note__title").textContent = note.Title || "Untitled";
  element.querySelector(".note__meta").textContent = note.ContentType || "Text";

  const content = element.querySelector(".note__content");
  content.innerHTML = "";
  if (note.ContentType === "Image") {
    const img = document.createElement("img");
    img.src = `data:image/png;base64,${note.ContentData || ""}`;
    content.appendChild(img);
  } else if (note.ContentType === "Object") {
    content.textContent = `Clipboard Object (${note.ContentFormat || "binary"})`;
  } else {
    content.textContent = note.ContentData || "";
  }

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
  updateNoteList();
};

const updateNoteList = () => {
  noteList.innerHTML = "";
  const query = state.searchQuery.trim().toLowerCase();
  const units = Object.values(state.units)
    .filter((note) => {
      if (!query) return true;
      const tags = (note.Tags || []).join(" ").toLowerCase();
      return (
        (note.Title || "").toLowerCase().includes(query) ||
        (note.ContentData || "").toLowerCase().includes(query) ||
        tags.includes(query) ||
        (note.Category || "").toLowerCase().includes(query)
      );
    })
    .sort((a, b) => new Date(b.ModifiedDate) - new Date(a.ModifiedDate));

  units.forEach((note) => {
    const item = document.createElement("div");
    item.className = "note-list__item";
    if (state.selectedNoteIds.has(note.Id)) {
      item.classList.add("active");
    }
    item.textContent = note.Title || "Untitled";
    item.addEventListener("click", () => {
      setSelection([note.Id], []);
      focusCanvasOn(note);
    });
    noteList.appendChild(item);
  });

  noteCount.textContent = String(units.length);
};

const focusCanvasOn = (note) => {
  const x = Math.max(0, note.X - canvas.clientWidth / 2);
  const y = Math.max(0, note.Y - canvas.clientHeight / 2);
  canvas.scrollTo({ left: x, top: y, behavior: "smooth" });
};

const saveData = async () => {
  await api.saveData(serializeState());
  if (state.settings.backupEnabled) {
    await api.createBackup(serializeState(), state.settings.backupCount);
  }
};

const createNoteFromClipboard = () => {
  const payload = api.readClipboard();
  if (!payload) {
    return;
  }
  pushUndo();
  const note = normalizeNote({
    Title: payload.type === "text" ? "Clipboard Text" : payload.type === "image" ? "Clipboard Image" : "Clipboard Object",
    ContentType: payload.type === "image" ? "Image" : payload.type === "object" ? "Object" : "Text",
    ContentData: payload.data || "",
    ContentFormat: payload.format || "plain",
    X: 200 + Math.random() * 120,
    Y: 200 + Math.random() * 120
  });
  state.units[note.Id] = note;
  renderAll();
};

const copySelectedToClipboard = () => {
  const firstId = Array.from(state.selectedNoteIds)[0];
  if (!firstId) {
    return;
  }
  const note = state.units[firstId];
  if (!note) {
    return;
  }
  if (note.ContentType === "Image") {
    api.writeClipboard({
      type: "image",
      format: "image/png",
      data: note.ContentData
    });
  } else if (note.ContentType === "Object") {
    api.writeClipboard({
      type: "object",
      format: note.ContentFormat || "application/octet-stream",
      data: note.ContentData
    });
  } else {
    api.writeClipboard({
      type: "text",
      format: "text/plain",
      data: note.ContentData || ""
    });
  }
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

const buildInput = (label, input) => {
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  const span = document.createElement("span");
  span.className = "field-label";
  span.textContent = label;
  wrapper.appendChild(span);
  wrapper.appendChild(input);
  return wrapper;
};

const openNoteModal = (note) => {
  const isEdit = !!note;
  const working = note ? { ...note } : normalizeNote({});

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal__header">
      <div class="modal__title">${isEdit ? "Edit Note" : "Add Note"}</div>
    </div>
  `;

  const titleInput = document.createElement("input");
  titleInput.className = "text-input";
  titleInput.value = working.Title || "";

  const contentTypeSelect = document.createElement("select");
  contentTypeSelect.className = "select-input";
  ["Text", "Image", "Object"].forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    if (working.ContentType === type) {
      option.selected = true;
    }
    contentTypeSelect.appendChild(option);
  });

  const contentArea = document.createElement("textarea");
  contentArea.className = "text-area";
  contentArea.value = working.ContentType === "Text" ? working.ContentData : "";

  const imageInput = document.createElement("input");
  imageInput.type = "file";
  imageInput.accept = "image/*";
  imageInput.className = "text-input";
  imageInput.classList.add("hidden");

  const objectInfo = document.createElement("div");
  objectInfo.className = "muted";
  objectInfo.textContent = working.ContentType === "Object" ? "Clipboard object stored." : "Paste clipboard object to update.";

  const buttonTypeSelect = document.createElement("select");
  buttonTypeSelect.className = "select-input";
  BUTTON_STYLES.forEach((style) => {
    const option = document.createElement("option");
    option.value = style;
    option.textContent = style;
    if (working.ButtonType === style) {
      option.selected = true;
    }
    buttonTypeSelect.appendChild(option);
  });

  const backgroundInput = document.createElement("input");
  backgroundInput.type = "color";
  backgroundInput.className = "text-input";
  backgroundInput.value = argbIntToHex(working.BackgroundColor);

  const textColorInput = document.createElement("input");
  textColorInput.type = "color";
  textColorInput.className = "text-input";
  textColorInput.value = argbIntToHex(working.TextColor);

  const fontNameInput = document.createElement("input");
  fontNameInput.className = "text-input";
  fontNameInput.value = working.Font?.Name || "Segoe UI";

  const fontSizeInput = document.createElement("input");
  fontSizeInput.type = "number";
  fontSizeInput.className = "text-input";
  fontSizeInput.value = working.Font?.Size || 11;

  const tagsInput = document.createElement("input");
  tagsInput.className = "text-input";
  tagsInput.placeholder = "tag1, tag2";
  tagsInput.value = (working.Tags || []).join(", ");

  const categoryInput = document.createElement("input");
  categoryInput.className = "text-input";
  categoryInput.value = working.Category || "";

  const groupSelect = document.createElement("select");
  groupSelect.className = "select-input";
  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "No Group";
  groupSelect.appendChild(noneOption);
  Object.values(state.groups).forEach((group) => {
    const option = document.createElement("option");
    option.value = group.Id;
    option.textContent = group.Title;
    if (working.GroupId === group.Id) {
      option.selected = true;
    }
    groupSelect.appendChild(option);
  });

  const pasteClipboardButton = document.createElement("button");
  pasteClipboardButton.className = "tool-button";
  pasteClipboardButton.textContent = "Paste Clipboard";
  pasteClipboardButton.addEventListener("click", () => {
    const payload = api.readClipboard();
    if (!payload) {
      return;
    }
    if (payload.type === "image") {
      contentTypeSelect.value = "Image";
      working.ContentType = "Image";
      working.ContentData = payload.data;
      working.ContentFormat = payload.format;
      contentArea.value = "";
      objectInfo.textContent = "Image pasted from clipboard.";
    } else if (payload.type === "object") {
      contentTypeSelect.value = "Object";
      working.ContentType = "Object";
      working.ContentData = payload.data;
      working.ContentFormat = payload.format;
      contentArea.value = "";
      objectInfo.textContent = `Clipboard object stored (${payload.format}).`;
    } else {
      contentTypeSelect.value = "Text";
      working.ContentType = "Text";
      working.ContentData = payload.data;
      working.ContentFormat = payload.format;
      contentArea.value = payload.data;
      objectInfo.textContent = "Text pasted from clipboard.";
    }
    syncContentType();
  });

  const contentRow = document.createElement("div");
  contentRow.className = "field-row";
  contentRow.appendChild(buildInput("Content Type", contentTypeSelect));
  contentRow.appendChild(buildInput("Button Style", buttonTypeSelect));

  const colorRow = document.createElement("div");
  colorRow.className = "field-row";
  colorRow.appendChild(buildInput("Background", backgroundInput));
  colorRow.appendChild(buildInput("Text Color", textColorInput));

  const fontRow = document.createElement("div");
  fontRow.className = "field-row";
  fontRow.appendChild(buildInput("Font Name", fontNameInput));
  fontRow.appendChild(buildInput("Font Size", fontSizeInput));

  const metaRow = document.createElement("div");
  metaRow.className = "field-row";
  metaRow.appendChild(buildInput("Category", categoryInput));
  metaRow.appendChild(buildInput("Group", groupSelect));

  const tagsField = buildInput("Tags", tagsInput);

  const contentField = buildInput("Content", contentArea);
  const imageField = buildInput("Image", imageInput);
  const objectField = buildInput("Clipboard Object", objectInfo);

  const actions = document.createElement("div");
  actions.className = "modal__actions";

  const cancelButton = document.createElement("button");
  cancelButton.className = "tool-button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", closeModal);

  const saveButton = document.createElement("button");
  saveButton.className = "tool-button primary";
  saveButton.textContent = isEdit ? "Update" : "Create";
  saveButton.addEventListener("click", () => {
    working.Title = titleInput.value.trim() || "Untitled";
    working.ContentType = contentTypeSelect.value;
    if (working.ContentType === "Text") {
      working.ContentData = contentArea.value;
      working.ContentFormat = "plain";
    }
    working.ButtonType = buttonTypeSelect.value;
    working.BackgroundColor = hexToArgbInt(backgroundInput.value);
    working.TextColor = hexToArgbInt(textColorInput.value);
    working.Font = normalizeFont({
      Name: fontNameInput.value || "Segoe UI",
      Size: Number(fontSizeInput.value) || 11,
      Style: working.Font?.Style || 0
    });
    working.Tags = tagsInput.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    working.Category = categoryInput.value.trim();
    working.GroupId = groupSelect.value || null;
    working.ModifiedDate = new Date().toISOString();

    pushUndo();
    state.units[working.Id] = working;
    renderAll();
    closeModal();
  });

  actions.appendChild(cancelButton);
  actions.appendChild(saveButton);

  modal.appendChild(buildInput("Title", titleInput));
  modal.appendChild(contentRow);
  modal.appendChild(contentField);
  modal.appendChild(imageField);
  modal.appendChild(objectField);
  modal.appendChild(pasteClipboardButton);
  modal.appendChild(colorRow);
  modal.appendChild(fontRow);
  modal.appendChild(tagsField);
  modal.appendChild(metaRow);
  modal.appendChild(actions);

  const syncContentType = () => {
    const type = contentTypeSelect.value;
    contentField.classList.toggle("hidden", type !== "Text");
    imageField.classList.toggle("hidden", type !== "Image");
    objectField.classList.toggle("hidden", type !== "Object");
  };

  syncContentType();

  imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1] || "";
      working.ContentType = "Image";
      working.ContentData = base64;
      working.ContentFormat = "image/png";
      contentTypeSelect.value = "Image";
      syncContentType();
    };
    reader.readAsDataURL(file);
  });

  openModal(modal);
};

const openGroupModal = (group) => {
  const isEdit = !!group;
  const working = group ? { ...group } : normalizeGroup({});

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal__header">
      <div class="modal__title">${isEdit ? "Edit Group" : "Add Group"}</div>
    </div>
  `;

  const titleInput = document.createElement("input");
  titleInput.className = "text-input";
  titleInput.value = working.Title || "";

  const widthInput = document.createElement("input");
  widthInput.type = "number";
  widthInput.className = "text-input";
  widthInput.value = working.Width || 360;

  const heightInput = document.createElement("input");
  heightInput.type = "number";
  heightInput.className = "text-input";
  heightInput.value = working.Height || 240;

  const borderInput = document.createElement("input");
  borderInput.type = "color";
  borderInput.className = "text-input";
  borderInput.value = argbIntToHex(working.BorderColor);

  const backgroundInput = document.createElement("input");
  backgroundInput.type = "color";
  backgroundInput.className = "text-input";
  backgroundInput.value = argbIntToHex(working.BackgroundColor);

  const textColorInput = document.createElement("input");
  textColorInput.type = "color";
  textColorInput.className = "text-input";
  textColorInput.value = argbIntToHex(working.TextColor);

  const typeSelect = document.createElement("select");
  typeSelect.className = "select-input";
  GROUP_TYPES.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    if (working.GroupBoxType === type) {
      option.selected = true;
    }
    typeSelect.appendChild(option);
  });

  const sizeRow = document.createElement("div");
  sizeRow.className = "field-row";
  sizeRow.appendChild(buildInput("Width", widthInput));
  sizeRow.appendChild(buildInput("Height", heightInput));

  const colorRow = document.createElement("div");
  colorRow.className = "field-row";
  colorRow.appendChild(buildInput("Border", borderInput));
  colorRow.appendChild(buildInput("Background", backgroundInput));

  const textRow = document.createElement("div");
  textRow.className = "field-row";
  textRow.appendChild(buildInput("Text Color", textColorInput));
  textRow.appendChild(buildInput("Group Type", typeSelect));

  const actions = document.createElement("div");
  actions.className = "modal__actions";

  const cancelButton = document.createElement("button");
  cancelButton.className = "tool-button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", closeModal);

  const saveButton = document.createElement("button");
  saveButton.className = "tool-button primary";
  saveButton.textContent = isEdit ? "Update" : "Create";
  saveButton.addEventListener("click", () => {
    working.Title = titleInput.value.trim() || "Group";
    working.Width = Number(widthInput.value) || 360;
    working.Height = Number(heightInput.value) || 240;
    working.BorderColor = hexToArgbInt(borderInput.value);
    working.BackgroundColor = hexToArgbInt(backgroundInput.value);
    working.TextColor = hexToArgbInt(textColorInput.value);
    working.GroupBoxType = typeSelect.value;

    pushUndo();
    state.groups[working.Id] = working;
    renderAll();
    closeModal();
  });

  actions.appendChild(cancelButton);
  actions.appendChild(saveButton);

  modal.appendChild(buildInput("Title", titleInput));
  modal.appendChild(sizeRow);
  modal.appendChild(colorRow);
  modal.appendChild(textRow);
  modal.appendChild(actions);

  openModal(modal);
};

const openSettingsModal = () => {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal__header">
      <div class="modal__title">Settings</div>
    </div>
  `;

  const autoSaveToggle = document.createElement("select");
  autoSaveToggle.className = "select-input";
  ["true", "false"].forEach((val) => {
    const option = document.createElement("option");
    option.value = val;
    option.textContent = val === "true" ? "Enabled" : "Disabled";
    if (String(state.settings.autoSave) === val) {
      option.selected = true;
    }
    autoSaveToggle.appendChild(option);
  });

  const intervalInput = document.createElement("input");
  intervalInput.type = "number";
  intervalInput.className = "text-input";
  intervalInput.value = state.settings.autoSaveInterval;

  const confirmToggle = document.createElement("select");
  confirmToggle.className = "select-input";
  ["true", "false"].forEach((val) => {
    const option = document.createElement("option");
    option.value = val;
    option.textContent = val === "true" ? "Enabled" : "Disabled";
    if (String(state.settings.confirmDelete) === val) {
      option.selected = true;
    }
    confirmToggle.appendChild(option);
  });

  const themeSelect = document.createElement("select");
  themeSelect.className = "select-input";
  ["system", "light", "dark"].forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme;
    option.textContent = theme;
    if (state.settings.theme === theme) {
      option.selected = true;
    }
    themeSelect.appendChild(option);
  });

  const alwaysOnTopToggle = document.createElement("select");
  alwaysOnTopToggle.className = "select-input";
  ["true", "false"].forEach((val) => {
    const option = document.createElement("option");
    option.value = val;
    option.textContent = val === "true" ? "Enabled" : "Disabled";
    if (String(state.settings.alwaysOnTop) === val) {
      option.selected = true;
    }
    alwaysOnTopToggle.appendChild(option);
  });

  const runInTrayToggle = document.createElement("select");
  runInTrayToggle.className = "select-input";
  ["true", "false"].forEach((val) => {
    const option = document.createElement("option");
    option.value = val;
    option.textContent = val === "true" ? "Enabled" : "Disabled";
    if (String(state.settings.runInTray) === val) {
      option.selected = true;
    }
    runInTrayToggle.appendChild(option);
  });

  const runOnStartupToggle = document.createElement("select");
  runOnStartupToggle.className = "select-input";
  ["true", "false"].forEach((val) => {
    const option = document.createElement("option");
    option.value = val;
    option.textContent = val === "true" ? "Enabled" : "Disabled";
    if (String(state.settings.runOnStartup) === val) {
      option.selected = true;
    }
    runOnStartupToggle.appendChild(option);
  });

  const hotkeyInput = document.createElement("input");
  hotkeyInput.className = "text-input";
  hotkeyInput.value = state.settings.globalHotkey || "";

  const backupToggle = document.createElement("select");
  backupToggle.className = "select-input";
  ["true", "false"].forEach((val) => {
    const option = document.createElement("option");
    option.value = val;
    option.textContent = val === "true" ? "Enabled" : "Disabled";
    if (String(state.settings.backupEnabled) === val) {
      option.selected = true;
    }
    backupToggle.appendChild(option);
  });

  const backupCountInput = document.createElement("input");
  backupCountInput.type = "number";
  backupCountInput.className = "text-input";
  backupCountInput.value = state.settings.backupCount;

  const undoInput = document.createElement("input");
  undoInput.type = "number";
  undoInput.className = "text-input";
  undoInput.value = state.settings.undoLevels;

  const logSelect = document.createElement("select");
  logSelect.className = "select-input";
  ["None", "Error", "Warning", "Info", "Debug"].forEach((level) => {
    const option = document.createElement("option");
    option.value = level;
    option.textContent = level;
    if (state.settings.loggingLevel === level) {
      option.selected = true;
    }
    logSelect.appendChild(option);
  });

  const layout1 = document.createElement("div");
  layout1.className = "field-row";
  layout1.appendChild(buildInput("Auto Save", autoSaveToggle));
  layout1.appendChild(buildInput("Interval (sec)", intervalInput));

  const layout2 = document.createElement("div");
  layout2.className = "field-row";
  layout2.appendChild(buildInput("Confirm Delete", confirmToggle));
  layout2.appendChild(buildInput("Theme", themeSelect));

  const layout3 = document.createElement("div");
  layout3.className = "field-row";
  layout3.appendChild(buildInput("Always On Top", alwaysOnTopToggle));
  layout3.appendChild(buildInput("Run In Tray", runInTrayToggle));

  const layout4 = document.createElement("div");
  layout4.className = "field-row";
  layout4.appendChild(buildInput("Run On Startup", runOnStartupToggle));
  layout4.appendChild(buildInput("Global Hotkey", hotkeyInput));

  const layout5 = document.createElement("div");
  layout5.className = "field-row";
  layout5.appendChild(buildInput("Backup", backupToggle));
  layout5.appendChild(buildInput("Backup Count", backupCountInput));

  const layout6 = document.createElement("div");
  layout6.className = "field-row";
  layout6.appendChild(buildInput("Undo Levels", undoInput));
  layout6.appendChild(buildInput("Logging", logSelect));

  const actions = document.createElement("div");
  actions.className = "modal__actions";

  const cancelButton = document.createElement("button");
  cancelButton.className = "tool-button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", closeModal);

  const saveButton = document.createElement("button");
  saveButton.className = "tool-button primary";
  saveButton.textContent = "Save";
  saveButton.addEventListener("click", () => {
    state.settings.autoSave = autoSaveToggle.value === "true";
    state.settings.autoSaveInterval = Number(intervalInput.value) || 30;
    state.settings.confirmDelete = confirmToggle.value === "true";
    state.settings.theme = themeSelect.value;
    state.settings.alwaysOnTop = alwaysOnTopToggle.value === "true";
    state.settings.runInTray = runInTrayToggle.value === "true";
    state.settings.runOnStartup = runOnStartupToggle.value === "true";
    state.settings.globalHotkey = hotkeyInput.value.trim();
    state.settings.backupEnabled = backupToggle.value === "true";
    state.settings.backupCount = Number(backupCountInput.value) || 10;
    state.settings.undoLevels = Number(undoInput.value) || 20;
    state.settings.loggingLevel = logSelect.value;

    applySettings();
    setupAutosave();
    closeModal();
  });

  actions.appendChild(cancelButton);
  actions.appendChild(saveButton);

  modal.appendChild(layout1);
  modal.appendChild(layout2);
  modal.appendChild(layout3);
  modal.appendChild(layout4);
  modal.appendChild(layout5);
  modal.appendChild(layout6);
  modal.appendChild(actions);

  openModal(modal);
};

const confirmDelete = () => {
  if (!state.settings.confirmDelete) {
    return true;
  }
  return window.confirm("Delete selected items?");
};

const deleteSelection = () => {
  if (state.selectedNoteIds.size === 0 && state.selectedGroupIds.size === 0) {
    return;
  }
  if (!confirmDelete()) {
    return;
  }
  pushUndo();
  state.selectedNoteIds.forEach((id) => delete state.units[id]);
  state.selectedGroupIds.forEach((id) => {
    delete state.groups[id];
    Object.values(state.units).forEach((note) => {
      if (note.GroupId === id) {
        note.GroupId = null;
      }
    });
  });
  setSelection();
  renderAll();
};

const createGroupFromSelection = () => {
  if (state.selectedNoteIds.size === 0) {
    openGroupModal();
    return;
  }
  const notes = Array.from(state.selectedNoteIds).map((id) => state.units[id]).filter(Boolean);
  if (notes.length === 0) {
    return;
  }
  const minX = Math.min(...notes.map((n) => n.X));
  const minY = Math.min(...notes.map((n) => n.Y));
  const maxX = Math.max(...notes.map((n) => n.X + n.Width));
  const maxY = Math.max(...notes.map((n) => n.Y + n.Height));
  const group = normalizeGroup({
    Title: "Group",
    X: minX - 20,
    Y: minY - 40,
    Width: maxX - minX + 40,
    Height: maxY - minY + 60
  });
  pushUndo();
  state.groups[group.Id] = group;
  notes.forEach((note) => {
    note.GroupId = group.Id;
  });
  renderAll();
  setSelection([], [group.Id]);
};

const exportData = async () => {
  const result = await api.showSaveDialog({
    title: "Export Notes",
    defaultPath: "notes-export.json",
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) {
    return;
  }
  await api.writeFile(result.filePath, JSON.stringify(serializeState(), null, 2));
};

const importData = async () => {
  const result = await api.showOpenDialog({
    title: "Import Notes",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"]
  });
  if (result.canceled || !result.filePaths?.length) {
    return;
  }
  const content = await api.readFile(result.filePaths[0]);
  if (!content) {
    return;
  }
  try {
    const parsed = JSON.parse(content);
    const normalized = normalizeIncoming(parsed);
    pushUndo();
    state.units = normalized.units;
    state.groups = normalized.groups;
    state.settings = { ...state.settings, ...normalized.settings };
    renderAll();
  } catch (error) {
    // ignore invalid files
  }
};

const updateSelectionFromRectangle = (rect, additive) => {
  const selected = new Set(additive ? state.selectedNoteIds : []);
  const groupSelected = new Set(additive ? state.selectedGroupIds : []);

  Object.values(state.units).forEach((note) => {
    const within =
      note.X >= rect.x &&
      note.Y >= rect.y &&
      note.X + note.Width <= rect.x + rect.width &&
      note.Y + note.Height <= rect.y + rect.height;
    if (within) {
      selected.add(note.Id);
    }
  });

  Object.values(state.groups).forEach((group) => {
    const within =
      group.X >= rect.x &&
      group.Y >= rect.y &&
      group.X + group.Width <= rect.x + rect.width &&
      group.Y + group.Height <= rect.y + rect.height;
    if (within) {
      groupSelected.add(group.Id);
    }
  });

  state.selectedNoteIds = selected;
  state.selectedGroupIds = groupSelected;
  updateSelectionStyles();
  updateNoteList();
};

const getCanvasPoint = (event) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left + canvas.scrollLeft,
    y: event.clientY - rect.top + canvas.scrollTop
  };
};

const startSelection = (event) => {
  if (event.button !== 0) return;
  state.selectionStart = getCanvasPoint(event);
  selectionBox.classList.remove("hidden");
  selectionBox.style.left = `${state.selectionStart.x}px`;
  selectionBox.style.top = `${state.selectionStart.y}px`;
  selectionBox.style.width = "0px";
  selectionBox.style.height = "0px";
};

const updateSelection = (event) => {
  if (!state.selectionStart) return;
  const current = getCanvasPoint(event);
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

  state.isDragging = true;
  state.dragType = "note";
  state.dragStart = getCanvasPoint(event);
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
  state.isDragging = true;
  state.dragType = isResize ? "group-resize" : "group-move";
  state.dragStart = getCanvasPoint(event);
  state.dragSnapshot = {
    group: { ...group },
    notes: Object.values(state.units).filter((note) => note.GroupId === group.Id)
  };
  state.dragSnapshot.dir = dir;
};

const handleCanvasMouseMove = (event) => {
  if (state.selectionStart) {
    updateSelection(event);
    return;
  }
  if (!state.isDragging || !state.dragStart) return;

  const current = getCanvasPoint(event);
  const dx = current.x - state.dragStart.x;
  const dy = current.y - state.dragStart.y;

  if (state.dragType === "note") {
    state.dragSnapshot.forEach((item) => {
      const note = state.units[item.id];
      if (!note) return;
      note.X = Math.round(item.x + dx);
      note.Y = Math.round(item.y + dy);
    });
    renderAll();
  }

  if (state.dragType === "group-move") {
    const group = state.groups[state.dragSnapshot.group.Id];
    if (!group) return;
    group.X = Math.round(state.dragSnapshot.group.X + dx);
    group.Y = Math.round(state.dragSnapshot.group.Y + dy);
    state.dragSnapshot.notes.forEach((note) => {
      const target = state.units[note.Id];
      if (target) {
        target.X = Math.round(note.X + dx);
        target.Y = Math.round(note.Y + dy);
      }
    });
    renderAll();
  }

  if (state.dragType === "group-resize") {
    const group = state.groups[state.dragSnapshot.group.Id];
    if (!group) return;
    const dir = state.dragSnapshot.dir;
    const original = state.dragSnapshot.group;
    const minWidth = 120;
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
    renderAll();
  }
};

const handleCanvasMouseUp = () => {
  if (state.isDragging) {
    pushUndo();
  }
  if (state.dragType === "note") {
    updateGroupMembership(Array.from(state.selectedNoteIds));
    state.selectedNoteIds.forEach((id) => {
      const note = state.units[id];
      if (note) {
        note.ModifiedDate = new Date().toISOString();
      }
    });
  }
  if (state.dragType === "group-move" || state.dragType === "group-resize") {
    state.selectedGroupIds.forEach((id) => {
      const group = state.groups[id];
      if (group) {
        group.ModifiedDate = new Date().toISOString();
      }
    });
  }
  state.isDragging = false;
  state.dragType = null;
  state.dragStart = null;
  state.dragSnapshot = null;
  endSelection();
};

const wireEvents = () => {
  btnAdd.addEventListener("click", () => openNoteModal());
  btnPaste.addEventListener("click", createNoteFromClipboard);
  btnGroup.addEventListener("click", createGroupFromSelection);
  btnCopy.addEventListener("click", copySelectedToClipboard);
  btnDelete.addEventListener("click", deleteSelection);
  btnUndo.addEventListener("click", undo);
  btnRedo.addEventListener("click", redo);
  btnSave.addEventListener("click", saveData);
  btnExport.addEventListener("click", exportData);
  btnImport.addEventListener("click", importData);
  btnSettings.addEventListener("click", openSettingsModal);

  searchInput.addEventListener("input", (event) => {
    state.searchQuery = event.target.value;
    updateNoteList();
  });

  canvas.addEventListener("mousedown", (event) => {
    if (event.target.closest(".note") || event.target.closest(".group-box")) {
      return;
    }
    if (!event.ctrlKey) {
      setSelection([], []);
    }
    startSelection(event);
  });

  canvas.addEventListener("mousemove", handleCanvasMouseMove);
  canvas.addEventListener("mouseup", handleCanvasMouseUp);
  canvas.addEventListener("mouseleave", handleCanvasMouseUp);

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
    openNoteModal(note);
  });

  groupLayer.addEventListener("mousedown", (event) => {
    const resizeHandle = event.target.closest(".group-box__resize");
    const groupEl = event.target.closest(".group-box");
    if (!groupEl) return;
    const group = state.groups[groupEl.dataset.id];
    if (!group) return;
    if (resizeHandle) {
      handleGroupMouseDown(event, group, true, resizeHandle.dataset.dir);
    } else if (event.target.closest(".group-box__header")) {
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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Delete") {
      deleteSelection();
    }
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
    if (event.ctrlKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      searchInput.focus();
    }
  });
};

const setupAutosave = () => {
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
  }
  autosaveTimer = setInterval(() => {
    if (!state.settings.autoSave) {
      return;
    }
    saveData();
  }, clamp(state.settings.autoSaveInterval, 5, 300) * 1000);
};

const updateGroupMembership = (noteIds) => {
  noteIds.forEach((id) => {
    const note = state.units[id];
    if (!note) return;
    const group = Object.values(state.groups).find((grp) => {
      const within =
        note.X + note.Width / 2 >= grp.X &&
        note.X + note.Width / 2 <= grp.X + grp.Width &&
        note.Y + note.Height / 2 >= grp.Y &&
        note.Y + note.Height / 2 <= grp.Y + grp.Height;
      return within;
    });
    note.GroupId = group ? group.Id : null;
  });
};

const initialize = async () => {
  const data = await api.loadData();
  const normalized = normalizeIncoming(data);
  state.units = normalized.units;
  state.groups = normalized.groups;
  state.settings = normalized.settings;
  applySettings();
  renderAll();
  wireEvents();
  setupAutosave();
};

initialize();

modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) {
    closeModal();
  }
});

window.addEventListener("beforeunload", () => {
  saveData();
});
