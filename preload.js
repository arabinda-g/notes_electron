const { contextBridge, ipcRenderer, clipboard, nativeImage } = require("electron");

const readClipboard = () => {
  const formats = clipboard.availableFormats();
  if (formats.includes("image/png") || formats.includes("image/jpeg")) {
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      return {
        type: "image",
        format: "image/png",
        data: image.toPNG().toString("base64")
      };
    }
  }

  if (formats.includes("text/plain") || formats.includes("text/rtf")) {
    const text = clipboard.readText();
    if (text) {
      return {
        type: "text",
        format: "text/plain",
        data: text
      };
    }
  }

  const binaryFormat = formats.find(
    (format) => !format.startsWith("text/") && !format.startsWith("image/")
  );
  if (binaryFormat) {
    const buffer = clipboard.readBuffer(binaryFormat);
    if (buffer && buffer.length > 0) {
      return {
        type: "object",
        format: binaryFormat,
        data: buffer.toString("base64")
      };
    }
  }

  return null;
};

const writeClipboard = (payload) => {
  if (!payload || !payload.type) {
    return false;
  }
  if (payload.type === "text") {
    clipboard.writeText(payload.data || "");
    return true;
  }
  if (payload.type === "image") {
    const buffer = Buffer.from(payload.data || "", "base64");
    const image = nativeImage.createFromBuffer(buffer);
    clipboard.writeImage(image);
    return true;
  }
  if (payload.type === "object") {
    const buffer = Buffer.from(payload.data || "", "base64");
    clipboard.writeBuffer(payload.format || "application/octet-stream", buffer);
    return true;
  }
  return false;
};

contextBridge.exposeInMainWorld("notesAPI", {
  loadData: () => ipcRenderer.invoke("notes:loadData"),
  saveData: (data) => ipcRenderer.invoke("notes:saveData", data),
  createBackup: (data, backupCount) => ipcRenderer.invoke("notes:createBackup", data, backupCount),
  showOpenDialog: (options) => ipcRenderer.invoke("notes:showOpenDialog", options),
  showSaveDialog: (options) => ipcRenderer.invoke("notes:showSaveDialog", options),
  readFile: (filePath) => ipcRenderer.invoke("notes:readFile", filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke("notes:writeFile", filePath, content),
  applySettings: (settings) => ipcRenderer.invoke("notes:applySettings", settings),
  toggleWindow: () => ipcRenderer.invoke("notes:toggleWindow"),
  showWindow: () => ipcRenderer.invoke("notes:showWindow"),
  hideWindow: () => ipcRenderer.invoke("notes:hideWindow"),
  getPaths: () => ipcRenderer.invoke("notes:getPaths"),
  readClipboard,
  writeClipboard,
  availableClipboardFormats: () => clipboard.availableFormats()
});
