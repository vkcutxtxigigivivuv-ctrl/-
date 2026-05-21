const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("shotStudy", {
  selectVideo: () => ipcRenderer.invoke("video:select"),
  saveCapturedFrame: (request) => ipcRenderer.invoke("video:save-captured-frame", request),
  saveProject: (project) => ipcRenderer.invoke("project:save", project),
  openProject: () => ipcRenderer.invoke("project:open"),
  listProjects: () => ipcRenderer.invoke("project:list"),
  loadProject: (projectDir) => ipcRenderer.invoke("project:load", projectDir),
  listLibraryImages: () => ipcRenderer.invoke("library:list-images"),
  updateLibraryImage: (request) => ipcRenderer.invoke("library:update-image", request),
  revealInFolder: (filePath) => ipcRenderer.invoke("file:reveal", filePath),
  exportProject: (request) => ipcRenderer.invoke("project:export", request)
});
