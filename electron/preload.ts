import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

export type IpcCleanup = () => void;

/** Payload forwarded from main after the IPC event. */
function listenPayload<T>(channel: string, callback: (payload: T) => void): IpcCleanup {
  const listener = (_event: IpcRendererEvent, payload: T) => {
    callback(payload);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

/** Two values after the IPC event (e.g. streamed completion + id). */
function listenPair<T, U>(channel: string, callback: (a: T, b: U) => void): IpcCleanup {
  const listener = (_event: IpcRendererEvent, a: T, b: U) => {
    callback(a, b);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

export interface ElectronAPI {
  project: {
    analyze: (projectPath: string) => Promise<unknown>;
    getCache: (projectPath: string) => Promise<unknown>;
    getCacheInfo: (projectPath: string) => Promise<unknown>;
    isCacheValid: (projectPath: string) => Promise<unknown>;
    clearCache: (projectPath: string) => Promise<unknown>;
    clearAllCaches: () => Promise<unknown>;
    getCacheDir: () => Promise<unknown>;
    setCacheDir: (dir: string) => Promise<unknown>;
    formatForPrompt: (projectPath: string, docType: string) => Promise<unknown>;
  };
  ai: {
    generate: (req: unknown) => Promise<unknown>;
    stopGenerate: () => Promise<void>;
    saveDocument: (req: unknown) => Promise<unknown>;
    getHistory: () => Promise<unknown>;
    addHistory: (record: unknown) => Promise<unknown>;
    readOutputFile: (path: string) => Promise<unknown>;
    updateHistoryOutput: (data: unknown) => Promise<unknown>;
    onChunk: (callback: (chunk: unknown) => void) => IpcCleanup;
    offChunk: (cleanup?: IpcCleanup) => void;
    onDone: (callback: (content: unknown, recordId: unknown) => void) => IpcCleanup;
    offDone: (cleanup?: IpcCleanup) => void;
    testConnection: (provider: unknown) => Promise<unknown>;
    listModels: (provider: unknown) => Promise<unknown>;
    renderHtmlToImage: (req: unknown) => Promise<unknown>;
    generateUIImage: (req: unknown) => Promise<unknown>;
    onImageProgress: (callback: (progress: unknown) => void) => IpcCleanup;
    offImageProgress: (cleanup?: IpcCleanup) => void;
    onPageReady: (callback: (page: unknown) => void) => IpcCleanup;
    offPageReady: (cleanup?: IpcCleanup) => void;
    checkFilesExist: (paths: string[]) => Promise<Record<string, boolean>>;
  };
  mcp: {
    getStatus: () => Promise<unknown>;
    start: () => Promise<unknown>;
    stop: () => Promise<unknown>;
    getLogs: () => Promise<unknown>;
    clearLogs: () => Promise<unknown>;
    getConfig: () => Promise<unknown>;
    setConfig: (config: unknown) => Promise<unknown>;
    getMethodologyFiles: () => Promise<unknown>;
    readMethodologyFile: (path: string) => Promise<unknown>;
    writeMethodologyFile: (path: string, content: string) => Promise<unknown>;
    getIdeConfigs: () => Promise<unknown>;
    installToIde: (ideId: unknown) => Promise<unknown>;
    onConfigChanged: (callback: (config: unknown) => void) => IpcCleanup;
    offConfigChanged: (cleanup?: IpcCleanup) => void;
  };
  app: {
    openExternal: (url: string) => Promise<unknown>;
    getVersion: () => Promise<unknown>;
    setAutoLaunch: (enabled: boolean) => Promise<unknown>;
    getAutoLaunch: () => Promise<unknown>;
    healthCheck: () => Promise<unknown>;
    exportLogs: () => Promise<unknown>;
    exportConfig: () => Promise<unknown>;
    importConfig: () => Promise<unknown>;
    parseDocument: (filePath: string) => Promise<unknown>;
    selectFile: () => Promise<unknown>;
    selectImages: () => Promise<unknown>;
    readImageAsBase64: (filePath: string) => Promise<unknown>;
    selectDirectory: (options?: unknown) => Promise<unknown>;
    getTheme: () => Promise<unknown>;
    setTheme: (theme: string) => Promise<unknown>;
    checkForUpdates: () => Promise<unknown>;
    onUpdateAvailable: (callback: (info: unknown) => void) => IpcCleanup;
    openInWindow: (target: unknown) => Promise<unknown>;
    setLocale: (locale: string) => Promise<unknown>;
    getLocale: () => Promise<unknown>;
  };
}

const electronAPI: ElectronAPI = {
  project: {
    analyze: (projectPath) => ipcRenderer.invoke("project:analyze", projectPath),
    getCache: (projectPath) => ipcRenderer.invoke("project:getCache", projectPath),
    getCacheInfo: (projectPath) => ipcRenderer.invoke("project:getCacheInfo", projectPath),
    isCacheValid: (projectPath) => ipcRenderer.invoke("project:isCacheValid", projectPath),
    clearCache: (projectPath) => ipcRenderer.invoke("project:clearCache", projectPath),
    clearAllCaches: () => ipcRenderer.invoke("project:clearAllCaches"),
    getCacheDir: () => ipcRenderer.invoke("project:getCacheDir"),
    setCacheDir: (dir) => ipcRenderer.invoke("project:setCacheDir", dir),
    formatForPrompt: (projectPath, docType) => ipcRenderer.invoke("project:formatForPrompt", projectPath, docType),
  },
  ai: {
    generate: (req) => ipcRenderer.invoke("ai:generate", req),
    stopGenerate: () => ipcRenderer.invoke("ai:stopGenerate"),
    saveDocument: (req) => ipcRenderer.invoke("ai:saveDocument", req),
    getHistory: () => ipcRenderer.invoke("ai:getHistory"),
    addHistory: (record) => ipcRenderer.invoke("ai:addHistory", record),
    readOutputFile: (path) => ipcRenderer.invoke("ai:readOutputFile", path),
    updateHistoryOutput: (data) => ipcRenderer.invoke("ai:updateHistoryOutput", data),
    onChunk: (callback) => listenPayload("ai:chunk", callback),
    offChunk: (cleanup?: IpcCleanup) => {
      if (cleanup) cleanup();
      else ipcRenderer.removeAllListeners("ai:chunk");
    },
    onDone: (callback) => listenPair("ai:done", callback),
    offDone: (cleanup?: IpcCleanup) => {
      if (cleanup) cleanup();
      else ipcRenderer.removeAllListeners("ai:done");
    },
    testConnection: (provider) => ipcRenderer.invoke("ai:testConnection", provider),
    listModels: (provider) => ipcRenderer.invoke("ai:listModels", provider),
    renderHtmlToImage: (req) => ipcRenderer.invoke("ai:renderHtmlToImage", req),
    generateUIImage: (req) => ipcRenderer.invoke("ai:generateUIImage", req),
    onImageProgress: (callback) => listenPayload("ai:imageProgress", callback),
    offImageProgress: (cleanup?: IpcCleanup) => {
      if (cleanup) cleanup();
      else ipcRenderer.removeAllListeners("ai:imageProgress");
    },
    onPageReady: (callback) => listenPayload("ai:pageReady", callback),
    offPageReady: (cleanup?: IpcCleanup) => {
      if (cleanup) cleanup();
      else ipcRenderer.removeAllListeners("ai:pageReady");
    },
    checkFilesExist: (paths) => ipcRenderer.invoke("ai:checkFilesExist", paths),
  },
  mcp: {
    getStatus: () => ipcRenderer.invoke("mcp:getStatus"),
    start: () => ipcRenderer.invoke("mcp:start"),
    stop: () => ipcRenderer.invoke("mcp:stop"),
    getLogs: () => ipcRenderer.invoke("mcp:getLogs"),
    clearLogs: () => ipcRenderer.invoke("mcp:clearLogs"),
    getConfig: () => ipcRenderer.invoke("mcp:getConfig"),
    setConfig: (config) => ipcRenderer.invoke("mcp:setConfig", config),
    getMethodologyFiles: () => ipcRenderer.invoke("mcp:getMethodologyFiles"),
    readMethodologyFile: (path) => ipcRenderer.invoke("mcp:readMethodologyFile", path),
    writeMethodologyFile: (path, content) =>
      ipcRenderer.invoke("mcp:writeMethodologyFile", path, content),
    getIdeConfigs: () => ipcRenderer.invoke("mcp:getIdeConfigs"),
    installToIde: (id) => ipcRenderer.invoke("mcp:installToIde", id),
    onConfigChanged: (callback) => listenPayload("mcp:configChanged", callback),
    offConfigChanged: (cleanup?: IpcCleanup) => {
      if (cleanup) cleanup();
      else ipcRenderer.removeAllListeners("mcp:configChanged");
    },
  },
  app: {
    openExternal: (url) => ipcRenderer.invoke("app:openExternal", url),
    getVersion: () => ipcRenderer.invoke("app:getVersion"),
    setAutoLaunch: (enabled) => ipcRenderer.invoke("app:setAutoLaunch", enabled),
    getAutoLaunch: () => ipcRenderer.invoke("app:getAutoLaunch"),
    healthCheck: () => ipcRenderer.invoke("app:healthCheck"),
    exportLogs: () => ipcRenderer.invoke("app:exportLogs"),
    exportConfig: () => ipcRenderer.invoke("app:exportConfig"),
    importConfig: () => ipcRenderer.invoke("app:importConfig"),
    parseDocument: (filePath) => ipcRenderer.invoke("app:parseDocument", filePath),
    selectFile: () => ipcRenderer.invoke("app:selectFile"),
    selectImages: () => ipcRenderer.invoke("app:selectImages"),
    readImageAsBase64: (filePath) => ipcRenderer.invoke("app:readImageAsBase64", filePath),
    selectDirectory: (options) => ipcRenderer.invoke("app:selectDirectory", options),
    getTheme: () => ipcRenderer.invoke("app:getTheme"),
    setTheme: (theme) => ipcRenderer.invoke("app:setTheme", theme),
    checkForUpdates: () => ipcRenderer.invoke("app:checkForUpdates"),
    onUpdateAvailable: (callback) => listenPayload("app:updateAvailable", callback),
    openInWindow: (target) => ipcRenderer.invoke("app:openInWindow", target),
    setLocale: (locale) => ipcRenderer.invoke("app:setLocale", locale),
    getLocale: () => ipcRenderer.invoke("app:getLocale"),
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
