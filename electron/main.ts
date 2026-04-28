import {
  app,
  BrowserWindow,
  globalShortcut,
  session,
  ipcMain,
  nativeImage,
  Tray,
  Menu,
  dialog,
  type MenuItemConstructorOptions,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import pkg from "electron-updater";
import { AppManager, isPathWithinBase } from "./app-manager";
import { AiService } from "./ai-service";
import { ProjectAnalyzer } from "./project-analyzer";
import { registerAiHandlers } from "./ipc/ai-handlers";
import { registerAppHandlers } from "./ipc/app-handlers";
import { registerDocumentSaveHandlers } from "./ipc/document-save-handlers";
import { registerHistoryHandlers } from "./ipc/history-handlers";
import { registerProjectHandlers } from "./ipc/project-handlers";
import { registerWindowHandlers } from "./ipc/window-handlers";
import type { WrapIPC } from "./ipc/types";

const { autoUpdater } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(os.homedir(), ".dev-efficiency-tool");

/* ------------------------------------------------------------------ */
/*  Menu i18n labels                                                   */
/* ------------------------------------------------------------------ */

const MENU_LABELS: Record<string, Record<string, string>> = {
  zh: {
    file: "文件",
    edit: "编辑",
    view: "视图",
    window: "窗口",
    help: "帮助",
    undo: "撤销",
    redo: "重做",
    cut: "剪切",
    copy: "复制",
    paste: "粘贴",
    selectAll: "全选",
    delete: "删除",
    reload: "重新加载",
    forceReload: "强制重新加载",
    toggleDevTools: "开发者工具",
    resetZoom: "重置缩放",
    zoomIn: "放大",
    zoomOut: "缩小",
    fullscreen: "全屏",
    minimize: "最小化",
    close: "关闭",
    quit: "退出",
    about: "关于",
    learnMore: "了解更多",
    showMainWindow: "显示主窗口",
    trayExit: "退出",
  },
  en: {
    file: "File",
    edit: "Edit",
    view: "View",
    window: "Window",
    help: "Help",
    undo: "Undo",
    redo: "Redo",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    selectAll: "Select All",
    delete: "Delete",
    reload: "Reload",
    forceReload: "Force Reload",
    toggleDevTools: "Toggle DevTools",
    resetZoom: "Reset Zoom",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    fullscreen: "Toggle Fullscreen",
    minimize: "Minimize",
    close: "Close",
    quit: "Quit",
    about: "About",
    learnMore: "Learn More",
    showMainWindow: "Show Main Window",
    trayExit: "Exit",
  },
};

const CHILD_WINDOW_TITLES: Record<string, string> = {
  "/gen/prd": "生成 PRD",
  "/gen/requirements": "生成需求文档",
  "/gen/ui": "生成 UI 设计",
  "/gen/design": "生成详细设计",
};

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let appManager: AppManager | null = null;
const aiService = new AiService();
const defaultCacheDir = app.isPackaged
  ? path.join(path.dirname(process.execPath), ".project-cache")
  : path.join(APP_DIR, ".project-cache");
const projectAnalyzer = new ProjectAnalyzer(defaultCacheDir);
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const trustedFilePaths = new Set<string>();
const trustedDirectoryPaths = new Set<string>();
const RECENT_ERROR_LOG_TTL_MS = 3000;
const RECENT_ERROR_LOG_LIMIT = 200;
const recentErrorLogs = new Map<string, number>();

let currentLocale = "zh";

function formatUnknownError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack || err.message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function addErrorLog(source: string, message: string, err?: unknown): void {
  const detail = err === undefined ? message : `${message}: ${formatUnknownError(err)}`;
  const now = Date.now();
  const key = `${source}|${detail}`.slice(0, 2000);
  const previous = recentErrorLogs.get(key);
  if (previous && now - previous < RECENT_ERROR_LOG_TTL_MS) return;
  recentErrorLogs.set(key, now);
  if (recentErrorLogs.size > RECENT_ERROR_LOG_LIMIT) {
    for (const [oldKey, reportedAt] of recentErrorLogs) {
      if (now - reportedAt > RECENT_ERROR_LOG_TTL_MS) {
        recentErrorLogs.delete(oldKey);
      }
    }
    while (recentErrorLogs.size > RECENT_ERROR_LOG_LIMIT) {
      const first = recentErrorLogs.keys().next().value;
      if (!first) break;
      recentErrorLogs.delete(first);
    }
  }
  try {
    appManager?.addLog("error", detail, source);
  } catch {
    /* ignore logging failures */
  }
  console.error(`[${source}] ${detail}`);
}

function setupGlobalExceptionLogging(): void {
  process.on("uncaughtException", (err) => {
    addErrorLog("main", "主进程未捕获异常", err);
  });
  process.on("unhandledRejection", (reason) => {
    addErrorLog("main", "主进程未处理 Promise 拒绝", reason);
  });
  app.on("child-process-gone", (_event, details: any) => {
    addErrorLog(
      "child-process",
      `子进程异常退出: type=${details?.type ?? "unknown"}, reason=${details?.reason ?? "unknown"}, exitCode=${details?.exitCode ?? "unknown"}, name=${details?.name ?? ""}, serviceName=${details?.serviceName ?? ""}`,
    );
  });
}

function attachWindowDiagnostics(win: BrowserWindow, label: string): void {
  win.on("unresponsive", () => {
    addErrorLog("window", `${label} 窗口无响应`);
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    addErrorLog("renderer", `${label} 渲染进程异常退出: reason=${details.reason}, exitCode=${details.exitCode}`);
  });
  win.webContents.on("preload-error", (_event, preloadPath, error) => {
    addErrorLog("preload", `${label} preload 加载异常: ${preloadPath}`, error);
  });
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    addErrorLog("renderer", `${label} 页面加载失败: ${errorCode} ${errorDescription} ${validatedURL}`);
  });
  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (level < 2) return;
    appManager?.addLog(level === 2 ? "warn" : "error", `${label} 控制台: ${message} (${sourceId}:${line})`, "renderer-console");
  });
}

function normalizeFsPath(p: string): string {
  return path.resolve(p);
}

function trustFilePath(filePath: string): string {
  const resolved = normalizeFsPath(filePath);
  trustedFilePaths.add(resolved);
  return resolved;
}

function trustDirectoryPath(dirPath: string): string {
  const resolved = normalizeFsPath(dirPath);
  trustedDirectoryPaths.add(resolved);
  return resolved;
}

function configuredTrustedRoots(): string[] {
  const cfg = appManager?.getConfig();
  return [
    cfg?.projectPath,
    cfg?.outputPath,
    cfg?.methodologyPath,
    cfg?.cachePath,
    ...trustedDirectoryPaths,
  ].filter((p): p is string => Boolean(p?.trim()));
}

function isTrustedPath(filePath: string): boolean {
  const resolved = normalizeFsPath(filePath);
  if (trustedFilePaths.has(resolved)) return true;
  return configuredTrustedRoots().some((root) => isPathWithinBase(root, resolved));
}

function isKnownHistoryOutputPath(filePath: string): boolean {
  const resolved = normalizeFsPath(filePath);
  return (appManager?.getGenerationHistory() ?? []).some((r) => (
    r.outputPath ? normalizeFsPath(r.outputPath) === resolved : false
  ));
}

function assertTrustedReadPath(filePath: string, label: string): string {
  if (!filePath || typeof filePath !== "string") {
    throw new Error(`${label}: invalid path`);
  }
  const resolved = normalizeFsPath(filePath);
  if (!isTrustedPath(resolved) && !isKnownHistoryOutputPath(resolved)) {
    throw new Error(currentLocale === "zh" ? `${label} 不在可信路径范围内` : `${label} is outside trusted paths`);
  }
  return resolved;
}

function assertTrustedHistoryOutputPath(filePath: unknown, label: string): string | undefined {
  if (filePath === undefined || filePath === null || filePath === "") {
    return undefined;
  }
  if (typeof filePath !== "string") {
    throw new Error(`${label}: invalid path`);
  }
  const resolved = normalizeFsPath(filePath);
  if (!isTrustedPath(resolved)) {
    throw new Error(currentLocale === "zh" ? `${label} 不在可信路径范围内` : `${label} is outside trusted paths`);
  }
  assertExistingFile(resolved, label);
  return resolved;
}

function sanitizeGenerationRecord(record: any): any {
  if (!record || typeof record !== "object") {
    throw new Error(currentLocale === "zh" ? "生成记录无效" : "Invalid generation record");
  }
  const safe = { ...record };
  const outputPath = assertTrustedHistoryOutputPath(
    safe.outputPath,
    currentLocale === "zh" ? "历史输出文件" : "History output file",
  );
  if (outputPath) {
    safe.outputPath = outputPath;
  } else {
    delete safe.outputPath;
  }
  return safe;
}

function assertExistingFile(filePath: string, label: string): string {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(currentLocale === "zh" ? `${label} 不存在` : `${label} does not exist`);
  }
  return filePath;
}

function assertTrustedOutputDirectory(outputDir: string): string {
  if (!outputDir) {
    throw new Error(currentLocale === "zh" ? "未指定输出路径" : "No output path specified");
  }
  const resolvedDir = normalizeFsPath(outputDir);
  if (!configuredTrustedRoots().some((root) => isPathWithinBase(root, resolvedDir) || normalizeFsPath(root) === resolvedDir)) {
    throw new Error(currentLocale === "zh" ? "输出目录不在可信路径范围内" : "Output directory is outside trusted paths");
  }
  return resolvedDir;
}

function assertTrustedOutputPath(outputDir: string, fileName: string): string {
  if (!fileName || fileName !== path.basename(fileName)) {
    throw new Error(currentLocale === "zh" ? "输出文件名非法" : "Invalid output file name");
  }
  const resolvedDir = assertTrustedOutputDirectory(outputDir);
  const resolvedFile = normalizeFsPath(path.join(resolvedDir, fileName));
  if (!isPathWithinBase(resolvedDir, resolvedFile)) {
    throw new Error(currentLocale === "zh" ? "输出文件名非法" : "Invalid output file name");
  }
  return resolvedFile;
}

function assertSafeExternalUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(currentLocale === "zh" ? "无效的外部链接" : "Invalid external URL");
  }
  if (!["https:", "http:", "mailto:"].includes(url.protocol)) {
    throw new Error(currentLocale === "zh" ? "不支持的外部链接协议" : "Unsupported external URL protocol");
  }
  return url.toString();
}

/* ------------------------------------------------------------------ */
/*  Locale persistence                                                 */
/* ------------------------------------------------------------------ */

function loadLocale(): string {
  try {
    const f = path.join(APP_DIR, "locale.json");
    if (fs.existsSync(f)) {
      return JSON.parse(fs.readFileSync(f, "utf-8")).locale || "zh";
    }
  } catch { /* ignore */ }
  return "zh";
}

function saveLocale(locale: string) {
  fs.existsSync(APP_DIR) || fs.mkdirSync(APP_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(APP_DIR, "locale.json"),
    JSON.stringify({ locale }),
    "utf-8"
  );
}

/* ------------------------------------------------------------------ */
/*  Application Menu (i18n-aware)                                      */
/* ------------------------------------------------------------------ */

function buildAppMenu(locale: string) {
  const t = MENU_LABELS[locale] || MENU_LABELS.zh;

  const template: MenuItemConstructorOptions[] = [
    {
      label: t.file,
      submenu: [
        { label: t.quit, role: "quit" },
      ],
    },
    {
      label: t.edit,
      submenu: [
        { label: t.undo, role: "undo" },
        { label: t.redo, role: "redo" },
        { type: "separator" },
        { label: t.cut, role: "cut" },
        { label: t.copy, role: "copy" },
        { label: t.paste, role: "paste" },
        { label: t.delete, role: "delete" },
        { type: "separator" },
        { label: t.selectAll, role: "selectAll" },
      ],
    },
    {
      label: t.view,
      submenu: [
        { label: t.reload, role: "reload" },
        { label: t.forceReload, role: "forceReload" },
        { label: t.toggleDevTools, role: "toggleDevTools" },
        { type: "separator" },
        { label: t.resetZoom, role: "resetZoom" },
        { label: t.zoomIn, role: "zoomIn" },
        { label: t.zoomOut, role: "zoomOut" },
        { type: "separator" },
        { label: t.fullscreen, role: "togglefullscreen" },
      ],
    },
    {
      label: t.window,
      submenu: [
        { label: t.minimize, role: "minimize" },
        { label: t.close, role: "close" },
      ],
    },
    {
      label: t.help,
      submenu: [
        {
          label: t.about,
          click: () => {
            dialog.showMessageBox({
              type: "info",
              title: locale === "zh" ? "关于" : "About",
              message: `开发效率提升工具 v${app.getVersion()}`,
              detail:
                locale === "zh"
                  ? "AI 驱动的软件开发全流程效率工具"
                  : "AI-powered full-lifecycle software development tool",
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/* ------------------------------------------------------------------ */
/*  Tray menu (i18n-aware)                                             */
/* ------------------------------------------------------------------ */

function buildTrayMenu(locale: string) {
  if (!tray) return;
  const t = MENU_LABELS[locale] || MENU_LABELS.zh;

  const ctxMenu = Menu.buildFromTemplate([
    {
      label: t.showMainWindow,
      accelerator: "CmdOrCtrl+Shift+M",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    {
      label: t.trayExit,
      click: () => {
        saveWindowState();
        tray?.destroy();
        tray = null;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(ctxMenu);
}

/* ------------------------------------------------------------------ */
/*  Window state persistence                                           */
/* ------------------------------------------------------------------ */

const WINDOW_STATE_PATH = path.join(APP_DIR, "window-state.json");

function loadWindowState(): { width: number; height: number; x?: number; y?: number; isMaximized?: boolean } {
  try {
    if (fs.existsSync(WINDOW_STATE_PATH))
      return JSON.parse(fs.readFileSync(WINDOW_STATE_PATH, "utf-8"));
  } catch { /* ignore */ }
  return { width: 1200, height: 800, isMaximized: false };
}

function saveWindowState() {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const state = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: mainWindow.isMaximized(),
  };
  fs.existsSync(APP_DIR) || fs.mkdirSync(APP_DIR, { recursive: true });
  fs.writeFileSync(WINDOW_STATE_PATH, JSON.stringify(state), "utf-8");
}

/* ------------------------------------------------------------------ */
/*  Create windows                                                     */
/* ------------------------------------------------------------------ */

function createMainWindow() {
  const state = loadWindowState();
  const iconCandidates = [
    path.join(__dirname, "../public/icon.png"),
    path.join(process.resourcesPath || "", "app.asar", "dist", "icon.png"),
  ];
  let windowIcon: string | undefined;
  for (const p of iconCandidates) {
    if (fs.existsSync(p)) { windowIcon = p; break; }
  }

  mainWindow = new BrowserWindow({
    ...state,
    minWidth: 900,
    minHeight: 600,
    title: "开发效率提升工具",
    frame: false,
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  attachWindowDiagnostics(mainWindow, "主窗口");

  if (state.isMaximized) mainWindow.maximize();

  mainWindow.on("close", (e) => {
    saveWindowState();
    if (tray) {
      e.preventDefault();
      const t = MENU_LABELS[currentLocale] || MENU_LABELS.zh;
      const options = {
        type: "question" as const,
        buttons: currentLocale === "zh"
          ? ["最小化到托盘", "退出应用", "取消"]
          : ["Minimize to Tray", "Quit", "Cancel"],
        defaultId: 0,
        cancelId: 2,
        title: currentLocale === "zh" ? "关闭窗口" : "Close Window",
        message: currentLocale === "zh"
          ? "是否将应用最小化到系统托盘？"
          : "Minimize application to system tray?",
      };
      const choice = dialog.showMessageBoxSync(mainWindow!, options);
      if (choice === 0) {
        mainWindow?.hide();
      } else if (choice === 1) {
        tray?.destroy();
        tray = null;
        app.quit();
      }
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function resolveRendererUrl(route: string): string {
  const r = route.startsWith("/") ? route : `/${route}`;
  if (VITE_DEV_SERVER_URL)
    return `${VITE_DEV_SERVER_URL.replace(/\/$/, "")}/#${r}`;
  const file = path.join(__dirname, "../dist/index.html");
  return `${pathToFileURL(file).href}#${r}`;
}

function createChildWindow(route: string) {
  const r = route.startsWith("/") ? route : `/${route}`;
  const subtitle = CHILD_WINDOW_TITLES[r];
  const title = subtitle ? `开发效率提升工具 — ${subtitle}` : "开发效率提升工具";

  const child = new BrowserWindow({
    minWidth: 800,
    minHeight: 500,
    title,
    icon: path.join(__dirname, "../public/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  attachWindowDiagnostics(child, title);
  child.loadURL(resolveRendererUrl(r));
}

/* ------------------------------------------------------------------ */
/*  System tray                                                        */
/* ------------------------------------------------------------------ */

function createTray() {
  const candidates = [
    path.join(__dirname, "../public/icon.png"),
    path.join(process.resourcesPath || "", "app.asar", "dist", "icon.png"),
    path.join(__dirname, "../dist/icon.png"),
  ];
  let img: Electron.NativeImage = nativeImage.createEmpty();
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        img = nativeImage.createFromPath(p).resize({ width: 16, height: 16 });
        break;
      } catch { /* try next */ }
    }
  }
  tray = new Tray(img);
  tray.setToolTip("开发效率提升工具");
  buildTrayMenu(currentLocale);

  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

/* ------------------------------------------------------------------ */
/*  Global shortcuts                                                   */
/* ------------------------------------------------------------------ */

function registerShortcuts() {
  globalShortcut.register("CmdOrCtrl+Shift+M", () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Auto-launch                                                        */
/* ------------------------------------------------------------------ */

function setAutoLaunch(enable: boolean) {
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: process.execPath,
    args: ["--hidden"],
  });
}

/* ------------------------------------------------------------------ */
/*  IPC error wrapper                                                  */
/* ------------------------------------------------------------------ */

const wrapIPC: WrapIPC = <T extends (...args: any[]) => any>(fn: T) => {
  return async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (err) {
      const message = (err instanceof Error ? err : new Error(String(err))).message;
      addErrorLog("ipc", "IPC 调用失败", err);
      return {
        __ipcError: true,
        message,
      };
    }
  };
};

/* ------------------------------------------------------------------ */
/*  Auto updater                                                       */
/* ------------------------------------------------------------------ */

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.on("update-available", (info: { version?: string }) => {
    for (const win of BrowserWindow.getAllWindows())
      win.webContents.send("app:updateAvailable", info);
  });
  autoUpdater.on("update-downloaded", (info: { version?: string }) => {
    const data = { version: info.version ?? "" };
    for (const win of BrowserWindow.getAllWindows())
      win.webContents.send("app:updateDownloaded", data);
  });
  autoUpdater.on("error", (err: Error) => {
    console.error("[autoUpdater] error", err);
  });
  void autoUpdater.checkForUpdatesAndNotify().catch((err: unknown) => {
    console.error("[autoUpdater] check failed", err);
  });
}

/* ------------------------------------------------------------------ */
/*  CSP                                                                */
/* ------------------------------------------------------------------ */

function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders ?? {} };
    headers["Content-Security-Policy"] = [
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://releases.example.com " +
      "https://*.openai.com https://*.anthropic.com https://*.deepseek.com " +
      "https://*.aliyuncs.com https://*.bigmodel.cn https://*.moonshot.cn https://*.volces.com",
    ];
    callback({ responseHeaders: headers });
  });
}

/* ------------------------------------------------------------------ */
/*  Register all IPC handlers                                          */
/* ------------------------------------------------------------------ */

function registerIpcHandlers() {
  registerWindowHandlers({ wrapIPC });
  registerAppHandlers({
    appManager: () => appManager,
    mainWindow: () => mainWindow,
    currentLocale: () => currentLocale,
    setCurrentLocale: (locale) => { currentLocale = locale; },
    saveLocale,
    buildAppMenu,
    buildTrayMenu,
    createChildWindow,
    checkForUpdates: () => autoUpdater.checkForUpdates(),
    setAutoLaunch,
    projectAnalyzer,
    wrapIPC,
    assertSafeExternalUrl,
    assertTrustedReadPath,
    assertExistingFile,
    trustFilePath,
    trustDirectoryPath,
  });
  registerHistoryHandlers({
    appManager: () => appManager,
    currentLocale: () => currentLocale,
    wrapIPC,
    sanitizeGenerationRecord,
    assertTrustedReadPath,
    assertExistingFile,
    assertTrustedHistoryOutputPath,
  });
  registerAiHandlers({
    appManager: () => appManager,
    mainWindow: () => mainWindow,
    currentLocale: () => currentLocale,
    aiService,
    projectAnalyzer,
    wrapIPC,
    assertTrustedOutputDirectory,
    assertTrustedOutputPath,
    isTrustedPath,
    isKnownHistoryOutputPath,
  });
  registerDocumentSaveHandlers({
    appManager: () => appManager,
    currentLocale: () => currentLocale,
    wrapIPC,
    assertTrustedOutputPath,
  });

  registerProjectHandlers({
    appManager: () => appManager,
    currentLocale: () => currentLocale,
    projectAnalyzer,
    wrapIPC,
  });

  // Theme
  ipcMain.handle("app:getTheme", wrapIPC(async () => {
    const f = path.join(APP_DIR, "theme.json");
    try {
      if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf-8")).theme || "light";
    } catch { /* ignore */ }
    return "light";
  }));
  ipcMain.handle("app:setTheme", wrapIPC(async (_e: any, theme: string) => {
    fs.existsSync(APP_DIR) || fs.mkdirSync(APP_DIR, { recursive: true });
    fs.writeFileSync(path.join(APP_DIR, "theme.json"), JSON.stringify({ theme }), "utf-8");
    return theme;
  }));
}

/* ------------------------------------------------------------------ */
/*  App lifecycle                                                      */
/* ------------------------------------------------------------------ */

const startHidden = process.argv.includes("--hidden");

setupGlobalExceptionLogging();

app.whenReady().then(async () => {
  setupCSP();
  currentLocale = loadLocale();
  appManager = new AppManager();
  appManager.addLog("info", `应用启动 v${app.getVersion()}`, "app");
  if (appManager.getConfig().cachePath) {
    projectAnalyzer.setCacheDir(appManager.getConfig().cachePath);
  }
  registerIpcHandlers();
  setupAutoUpdater();

  createMainWindow();
  buildAppMenu(currentLocale);
  createTray();
  registerShortcuts();

  if (startHidden) mainWindow?.hide();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !tray) {
    app.quit();
  }
});
