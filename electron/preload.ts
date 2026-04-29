import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

export type IpcCleanup = () => void;

function serializeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    message: String(error),
  };
}

function reportPreloadError(source: string, message: string, error: unknown): void {
  const detail = serializeError(error);
  void ipcRenderer.invoke("app:logRendererError", {
    source,
    level: "error",
    message: `${message}: ${detail.message}`,
    stack: detail.stack,
  }).catch(() => {
    /* avoid recursive logging failures */
  });
}

async function invoke<T = any>(channel: string, ...args: unknown[]): Promise<T> {
  try {
    return await ipcRenderer.invoke(channel, ...args) as T;
  } catch (error) {
    reportPreloadError("preload-ipc", `IPC 调用异常 ${channel}`, error);
    throw error;
  }
}

/** Payload forwarded from main after the IPC event. */
function listenPayload<T>(channel: string, callback: (payload: T) => void): IpcCleanup {
  const listener = (_event: IpcRendererEvent, payload: T) => {
    try {
      callback(payload);
    } catch (error) {
      reportPreloadError("preload-event", `IPC 事件处理异常 ${channel}`, error);
      throw error;
    }
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

/** Two values after the IPC event (e.g. streamed completion + id). */
function listenPair<T, U>(channel: string, callback: (a: T, b: U) => void): IpcCleanup {
  const listener = (_event: IpcRendererEvent, a: T, b: U) => {
    try {
      callback(a, b);
    } catch (error) {
      reportPreloadError("preload-event", `IPC 事件处理异常 ${channel}`, error);
      throw error;
    }
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

export interface ElectronAPI {
  win: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
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
    deleteHistory: (id: string) => Promise<unknown>;
    onChunk: (callback: (chunk: unknown) => void) => IpcCleanup;
    offChunk: (cleanup?: IpcCleanup) => void;
    onDone: (callback: (payload: unknown) => void) => IpcCleanup;
    offDone: (cleanup?: IpcCleanup) => void;
    onValidation: (callback: (payload: unknown) => void) => IpcCleanup;
    offValidation: (cleanup?: IpcCleanup) => void;
    testConnection: (provider: unknown) => Promise<unknown>;
    listModels: (provider: unknown) => Promise<unknown>;
    analyzeUIPrompt: (req: unknown) => Promise<unknown>;
    renderHtmlToImage: (req: unknown) => Promise<unknown>;
    generatePrdImages: (req: unknown) => Promise<unknown>;
    generateUIImage: (req: unknown) => Promise<unknown>;
    generateFigmaFile: (req: unknown) => Promise<unknown>;
    onImageProgress: (callback: (progress: unknown) => void) => IpcCleanup;
    offImageProgress: (cleanup?: IpcCleanup) => void;
    onPageReady: (callback: (page: unknown) => void) => IpcCleanup;
    offPageReady: (cleanup?: IpcCleanup) => void;
    checkFilesExist: (paths: string[]) => Promise<Record<string, boolean>>;
  };
  app: {
    getConfig: () => Promise<unknown>;
    setConfig: (config: unknown) => Promise<unknown>;
    onConfigChanged: (callback: (config: unknown) => void) => IpcCleanup;
    offConfigChanged: (cleanup?: IpcCleanup) => void;
    getLogs: () => Promise<unknown>;
    clearLogs: () => Promise<unknown>;
    logRendererError: (payload: unknown) => Promise<unknown>;
    getMethodologyFiles: () => Promise<unknown>;
    readMethodologyFile: (path: string) => Promise<unknown>;
    writeMethodologyFile: (path: string, content: string) => Promise<unknown>;
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
  win: {
    minimize: () => invoke("win:minimize"),
    maximize: () => invoke("win:maximize"),
    close: () => invoke("win:close"),
    isMaximized: () => invoke("win:isMaximized"),
  },
  project: {
    analyze: (projectPath) => invoke("project:analyze", projectPath),
    getCache: (projectPath) => invoke("project:getCache", projectPath),
    getCacheInfo: (projectPath) => invoke("project:getCacheInfo", projectPath),
    isCacheValid: (projectPath) => invoke("project:isCacheValid", projectPath),
    clearCache: (projectPath) => invoke("project:clearCache", projectPath),
    clearAllCaches: () => invoke("project:clearAllCaches"),
    getCacheDir: () => invoke("project:getCacheDir"),
    setCacheDir: (dir) => invoke("project:setCacheDir", dir),
    formatForPrompt: (projectPath, docType) => invoke("project:formatForPrompt", projectPath, docType),
  },
  ai: {
    generate: (req) => invoke("ai:generate", req),
    stopGenerate: () => invoke("ai:stopGenerate"),
    saveDocument: (req) => invoke("ai:saveDocument", req),
    getHistory: () => invoke("ai:getHistory"),
    addHistory: (record) => invoke("ai:addHistory", record),
    readOutputFile: (path) => invoke("ai:readOutputFile", path),
    updateHistoryOutput: (data) => invoke("ai:updateHistoryOutput", data),
    deleteHistory: (id) => invoke("ai:deleteHistory", id),
    onChunk: (callback) => listenPayload("ai:chunk", callback),
    offChunk: (cleanup?: IpcCleanup) => {
      if (cleanup) cleanup();
    },
    onDone: (callback) => listenPayload("ai:done", callback),
    offDone: (cleanup?: IpcCleanup) => {
      if (cleanup) cleanup();
    },
    onValidation: (callback) => listenPayload("ai:validation", callback),
    offValidation: (cleanup?: IpcCleanup) => {
      if (cleanup) cleanup();
    },
    testConnection: (provider) => invoke("ai:testConnection", provider),
    listModels: (provider) => invoke("ai:listModels", provider),
    analyzeUIPrompt: (req) => invoke("ai:analyzeUIPrompt", req),
    renderHtmlToImage: (req) => invoke("ai:renderHtmlToImage", req),
    generatePrdImages: (req) => invoke("ai:generatePrdImages", req),
    generateUIImage: (req) => invoke("ai:generateUIImage", req),
    generateFigmaFile: (req) => invoke("ai:generateFigmaFile", req),
    onImageProgress: (callback) => listenPayload("ai:imageProgress", callback),
    offImageProgress: (cleanup?: IpcCleanup) => {
      if (cleanup) cleanup();
    },
    onPageReady: (callback) => listenPayload("ai:pageReady", callback),
    offPageReady: (cleanup?: IpcCleanup) => {
      if (cleanup) cleanup();
    },
    checkFilesExist: (paths) => invoke("ai:checkFilesExist", paths),
  },
  app: {
    getConfig: () => invoke("app:getConfig"),
    setConfig: (config) => invoke("app:setConfig", config),
    onConfigChanged: (callback) => listenPayload("app:configChanged", callback),
    offConfigChanged: (cleanup?: IpcCleanup) => {
      if (cleanup) cleanup();
      else ipcRenderer.removeAllListeners("app:configChanged");
    },
    getLogs: () => invoke("app:getLogs"),
    clearLogs: () => invoke("app:clearLogs"),
    logRendererError: (payload) => invoke("app:logRendererError", payload),
    getMethodologyFiles: () => invoke("app:getMethodologyFiles"),
    readMethodologyFile: (path) => invoke("app:readMethodologyFile", path),
    writeMethodologyFile: (path, content) =>
      invoke("app:writeMethodologyFile", path, content),
    openExternal: (url) => invoke("app:openExternal", url),
    getVersion: () => invoke("app:getVersion"),
    setAutoLaunch: (enabled) => invoke("app:setAutoLaunch", enabled),
    getAutoLaunch: () => invoke("app:getAutoLaunch"),
    healthCheck: () => invoke("app:healthCheck"),
    exportLogs: () => invoke("app:exportLogs"),
    exportConfig: () => invoke("app:exportConfig"),
    importConfig: () => invoke("app:importConfig"),
    parseDocument: (filePath) => invoke("app:parseDocument", filePath),
    selectFile: () => invoke("app:selectFile"),
    selectImages: () => invoke("app:selectImages"),
    readImageAsBase64: (filePath) => invoke("app:readImageAsBase64", filePath),
    selectDirectory: (options) => invoke("app:selectDirectory", options),
    getTheme: () => invoke("app:getTheme"),
    setTheme: (theme) => invoke("app:setTheme", theme),
    checkForUpdates: () => invoke("app:checkForUpdates"),
    onUpdateAvailable: (callback) => listenPayload("app:updateAvailable", callback),
    openInWindow: (target) => invoke("app:openInWindow", target),
    setLocale: (locale) => invoke("app:setLocale", locale),
    getLocale: () => invoke("app:getLocale"),
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
