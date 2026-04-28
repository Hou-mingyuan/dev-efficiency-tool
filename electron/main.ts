import {
  app,
  BrowserWindow,
  globalShortcut,
  session,
  ipcMain,
  shell,
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
import { randomUUID } from "node:crypto";
import { Marked } from "marked";
import { AppManager, isPathWithinBase, type AiProvider } from "./app-manager";
import {
  AiService,
  buildPrompt,
  buildUIAnalyzePrompt,
  buildUIImagePrompt,
  type DocType,
} from "./ai-service";
import { ProjectAnalyzer } from "./project-analyzer";
import { registerProjectHandlers } from "./ipc/project-handlers";
import { registerWindowHandlers } from "./ipc/window-handlers";

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
const ALLOWED_DOCUMENT_EXTENSIONS = new Set([".docx", ".xlsx", ".xls", ".pdf", ".md", ".txt"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]);
const ALLOWED_SAVE_FORMATS = new Set(["md", "txt", "docx", "pdf", "png", "jpeg", "jpg", "gif", "svg", "html"]);

let currentLocale = "zh";

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

function assertAllowedExtension(filePath: string, label: string, allowed: Set<string>): string {
  const ext = path.extname(filePath).toLowerCase();
  if (!allowed.has(ext)) {
    throw new Error(currentLocale === "zh" ? `${label} 格式不受支持` : `${label} format is not supported`);
  }
  return ext;
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

function wrapIPC<T extends (...args: any[]) => any>(fn: T) {
  return async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (err) {
      return {
        __ipcError: true,
        message: (err instanceof Error ? err : new Error(String(err))).message,
      };
    }
  };
}

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
  void autoUpdater.checkForUpdatesAndNotify();
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
  registerWindowHandlers();

  // Locale (NEW – menu i18n)
  ipcMain.handle("app:setLocale", (_e, locale: string) => {
    const normalized = locale.startsWith("zh") ? "zh" : "en";
    currentLocale = normalized;
    saveLocale(normalized);
    buildAppMenu(normalized);
    buildTrayMenu(normalized);
    return normalized;
  });
  ipcMain.handle("app:getLocale", () => currentLocale);

  // Child windows & updates
  ipcMain.handle("app:openInWindow", (_e, route: string) => {
    createChildWindow(String(route));
  });
  ipcMain.handle("app:checkForUpdates", async () => {
    if (!app.isPackaged) return { skipped: true };
    try {
      return await autoUpdater.checkForUpdates();
    } catch (err) {
      appManager?.addLog(
        "warn",
        `检查更新失败: ${(err instanceof Error ? err : new Error(String(err))).message}`,
        "app",
      );
      return null;
    }
  });

  // Config & Logs
  ipcMain.handle("app:getLogs", () => appManager?.getLogs());
  ipcMain.handle("app:clearLogs", () => appManager?.clearLogs());
  ipcMain.handle("app:getConfig", () => appManager?.getConfig());
  ipcMain.handle("app:setConfig", wrapIPC(async (_e: any, cfg: any) => {
    if (!appManager) return;
    const updated = appManager.setConfig(cfg);
    projectAnalyzer.setCacheDir(updated.cachePath?.trim() || null);
    if (mainWindow) {
      mainWindow.webContents.send("app:configChanged", updated);
    }
    return updated;
  }));
  ipcMain.handle("app:getMethodologyFiles", () => appManager?.getMethodologyFiles());
  ipcMain.handle("app:readMethodologyFile", (_e, p: string) => appManager?.readMethodologyFile(p));
  ipcMain.handle("app:writeMethodologyFile", (_e, p: string, content: string) => appManager?.writeMethodologyFile(p, content));

  // App utilities
  ipcMain.handle("app:openExternal", wrapIPC(async (_e: any, url: string) => shell.openExternal(assertSafeExternalUrl(url))));
  ipcMain.handle("app:getVersion", () => app.getVersion());
  ipcMain.handle("app:setAutoLaunch", (_e, v: boolean) => { setAutoLaunch(v); return true; });
  ipcMain.handle("app:getAutoLaunch", () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle("app:healthCheck", wrapIPC(async () => {
    const nodeVersion = process.version;
    const mPath = appManager?.getConfig().methodologyPath || "";
    const entryExists = fs.existsSync(path.join(mPath, "dist", "index.js"));
    const mdDir = path.join(mPath, "methodology");
    const mdCount = fs.existsSync(mdDir) ? fs.readdirSync(mdDir).filter((f) => f.endsWith(".md")).length : 0;
    return {
      nodeVersion,
      electronVersion: process.versions.electron,
      methodologyPath: mPath,
      entryExists,
      methodologyFileCount: mdCount,
      platform: process.platform,
      arch: process.arch,
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024),
        free: Math.round(os.freemem() / 1024 / 1024),
      },
    };
  }));

  // Export / import
  ipcMain.handle("app:exportLogs", wrapIPC(async () => {
    const { filePath } = await dialog.showSaveDialog(mainWindow!, {
      title: currentLocale === "zh" ? "导出日志" : "Export Logs",
      defaultPath: `app-logs-${new Date().toISOString().slice(0, 10)}.txt`,
      filters: [{ name: currentLocale === "zh" ? "文本文件" : "Text Files", extensions: ["txt"] }],
    });
    if (!filePath) return false;
    const text = (appManager?.getLogs() || [])
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`)
      .join("\n");
    fs.writeFileSync(filePath, text, "utf-8");
    return true;
  }));
  ipcMain.handle("app:exportConfig", wrapIPC(async () => {
    const { filePath } = await dialog.showSaveDialog(mainWindow!, {
      title: currentLocale === "zh" ? "导出配置" : "Export Config",
      defaultPath: "config-backup.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!filePath) return false;
    const cfg = appManager?.getConfig();
    if (!cfg) return false;
    const safe = { ...cfg, aiProviders: cfg.aiProviders.map((p: any) => ({ ...p, apiKey: "***" })) };
    fs.writeFileSync(filePath, JSON.stringify(safe, null, 2), "utf-8");
    return true;
  }));
  ipcMain.handle("app:importConfig", wrapIPC(async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow!, {
      title: currentLocale === "zh" ? "导入配置" : "Import Config",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (!filePaths?.length) return null;
    const raw = fs.readFileSync(filePaths[0], "utf-8");
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(currentLocale === "zh" ? "配置文件格式错误，请选择有效的 JSON 文件" : "Invalid config file format. Please select a valid JSON file.");
    }
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new Error(currentLocale === "zh" ? "配置文件结构无效" : "Invalid config file structure");
    }
    if (!data.aiProviders && !data.activeProviderId) {
      throw new Error(currentLocale === "zh"
        ? "配置文件结构不正确，缺少必要字段"
        : "Invalid config file structure, missing required fields");
    }
    appManager?.setConfig(data);
    return appManager?.getConfig();
  }));

  // Document
  ipcMain.handle("app:parseDocument", wrapIPC(async (_e: any, p: string) => {
    const filePath = assertTrustedReadPath(p, currentLocale === "zh" ? "文档文件" : "Document file");
    assertAllowedExtension(filePath, currentLocale === "zh" ? "文档文件" : "Document file", ALLOWED_DOCUMENT_EXTENSIONS);
    assertExistingFile(filePath, currentLocale === "zh" ? "文档文件" : "Document file");
    return appManager?.parseDocument(filePath);
  }));
  ipcMain.handle("app:selectFile", wrapIPC(async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow!, {
      title: currentLocale === "zh" ? "选择文档" : "Select Document",
      filters: [{ name: currentLocale === "zh" ? "文档" : "Documents", extensions: ["docx", "xlsx", "pdf", "md", "txt"] }],
      properties: ["openFile"],
    });
    return filePaths?.[0] ? trustFilePath(filePaths[0]) : null;
  }));

  ipcMain.handle("app:selectImages", wrapIPC(async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow!, {
      title: currentLocale === "zh" ? "选择图片" : "Select Images",
      filters: [{ name: currentLocale === "zh" ? "图片" : "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] }],
      properties: ["openFile", "multiSelections"],
    });
    return (filePaths || []).map((filePath) => trustFilePath(filePath));
  }));

  ipcMain.handle("app:readImageAsBase64", wrapIPC(async (_e: any, filePath: string) => {
    if (!filePath) return null;
    const safePath = assertTrustedReadPath(filePath, currentLocale === "zh" ? "图片文件" : "Image file");
    assertAllowedExtension(safePath, currentLocale === "zh" ? "图片文件" : "Image file", ALLOWED_IMAGE_EXTENSIONS);
    assertExistingFile(safePath, currentLocale === "zh" ? "图片文件" : "Image file");
    const buf = fs.readFileSync(safePath);
    const ext = path.extname(safePath).toLowerCase().replace(".", "");
    const mimeMap: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
    };
    const mimeType = mimeMap[ext] || "image/png";
    return {
      base64: buf.toString("base64"),
      mimeType,
      name: path.basename(safePath),
      dataUrl: `data:${mimeType};base64,${buf.toString("base64")}`,
    };
  }));
  ipcMain.handle("app:selectDirectory", wrapIPC(async (_e: any, title?: string) => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow!, {
      title: title || (currentLocale === "zh" ? "选择目录" : "Select Directory"),
      properties: ["openDirectory"],
    });
    return filePaths?.[0] ? trustDirectoryPath(filePaths[0]) : null;
  }));

  // AI
  let currentAbortController: AbortController | null = null;

  ipcMain.handle("ai:stopGenerate", () => {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
  });

  ipcMain.handle("ai:generate", wrapIPC(async (event: any, req: any) => {
    let provider: AiProvider | null = null;
    if (req.providerId) {
      const custom = appManager
        ?.getConfig()
        .aiProviders?.find((p: any) => p.id === req.providerId && p.enabled && p.apiKey);
      if (custom) provider = custom;
    }
    if (!provider) {
      provider = appManager?.getActiveProvider() ?? null;
    }
    if (!provider) {
      throw new Error(currentLocale === "zh"
        ? "未配置可用的 AI 服务商。请前往「配置管理 → AI 模型配置」启用并设置 API Key。"
        : "No AI provider configured. Go to Settings → AI Providers to enable and set an API Key.");
    }

    const customPrompts = appManager?.getConfig().customPrompts;

    let projectContext = "";
    const analyzeProjectPath = req.projectPath || appManager?.getConfig().projectPath;
    if (analyzeProjectPath && fs.existsSync(analyzeProjectPath)) {
      try {
        const analysis = projectAnalyzer.getOrAnalyze(analyzeProjectPath);
        projectContext = projectAnalyzer.formatForPrompt(analysis, req.docType);
      } catch (e) {
        appManager?.addLog("warn", `项目分析失败: ${(e instanceof Error ? e : new Error(String(e))).message}`, "project-analyzer");
      }
    }

    const { system, user } = buildPrompt(
      req.docType as DocType,
      req.projectName,
      req.userContent,
      req.referenceContent,
      customPrompts,
      projectContext,
    );
    const win = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;

    const images = req.images as Array<{ base64: string; mimeType: string }> | undefined;

    const abortController = new AbortController();
    currentAbortController = abortController;

    let result: string;
    try {
      result = await aiService.generateStream(provider, system, user, (chunk: string) => {
        if (win && !win.isDestroyed()) win.webContents.send("ai:chunk", chunk);
      }, images, abortController.signal);
    } catch (streamErr: unknown) {
      if (abortController.signal.aborted) throw new Error(currentLocale === "zh" ? "已停止生成" : "Generation stopped");
      result = await aiService.generate(provider, system, user, images, abortController.signal);
    } finally {
      if (currentAbortController === abortController) currentAbortController = null;
    }

    const recordId = randomUUID();
    const record = {
      id: recordId,
      docType: req.docType,
      projectName: req.projectName?.trim() || "",
      createdAt: new Date().toISOString(),
      preview: result.slice(0, 200),
    };
    appManager?.addGenerationRecord(record);
    appManager?.addLog(
      "info",
      `AI 生成完成: ${req.docType} (${provider.name})`,
      "ai-gen",
    );
    if (win && !win.isDestroyed()) win.webContents.send("ai:done", result, recordId);
    return result;
  }));

  ipcMain.handle("ai:analyzeUIPrompt", wrapIPC(async (_event: any, req: any) => {
    let provider: AiProvider | null = null;
    if (req.providerId) {
      const custom = appManager
        ?.getConfig()
        .aiProviders?.find((p: any) => p.id === req.providerId && p.enabled && p.apiKey);
      if (custom) provider = custom;
    }
    if (!provider) provider = appManager?.getActiveProvider() ?? null;
    if (!provider) throw new Error(currentLocale === "zh" ? "未配置可用的 AI 服务商。" : "No AI provider configured.");

    const images = req.images as Array<{ base64: string; mimeType: string }> | undefined;

    let projectContext = "";
    const analyzeProjectPath = req.projectPath || appManager?.getConfig().projectPath;
    if (analyzeProjectPath && fs.existsSync(analyzeProjectPath)) {
      try {
        const analysis = projectAnalyzer.getOrAnalyze(analyzeProjectPath);
        projectContext = projectAnalyzer.formatForPrompt(analysis, "ui");
      } catch (e) {
        appManager?.addLog("warn", `UI 提示词分析项目失败: ${(e instanceof Error ? e : new Error(String(e))).message}`, "ai-ui-analyze");
      }
    }

    const { system, user } = buildUIAnalyzePrompt({
      projectName: req.projectName,
      userContent: req.userContent,
      referenceContent: req.referenceContent,
      projectContext,
      imageCount: images?.length ?? 0,
      isModuleScope: Boolean(req.isModuleScope),
    });

    const abortController = new AbortController();
    currentAbortController = abortController;
    try {
      const analyzedPrompt = await aiService.generate(provider, system, user, images, abortController.signal);
      appManager?.addLog("info", `UI 提示词分析完成: ${provider.name}`, "ai-ui-analyze");
      return { analyzedPrompt };
    } finally {
      if (currentAbortController === abortController) currentAbortController = null;
    }
  }));

  ipcMain.handle("ai:generateUIImage", wrapIPC(async (event: any, req: any) => {
    let provider: AiProvider | null = null;
    if (req.providerId) {
      const custom = appManager
        ?.getConfig()
        .aiProviders?.find((p: any) => p.id === req.providerId && p.enabled && p.apiKey);
      if (custom) provider = custom;
    }
    if (!provider) provider = appManager?.getActiveProvider() ?? null;
    if (!provider) throw new Error(currentLocale === "zh" ? "未配置可用的 AI 服务商。" : "No AI provider configured.");

    const images = req.images as Array<{ base64: string; mimeType: string }> | undefined;

    let projectContext = "";

    const analyzeProjectPath = req.projectPath || appManager?.getConfig().projectPath;
    if (analyzeProjectPath && fs.existsSync(analyzeProjectPath)) {
      try {
        const analysis = projectAnalyzer.getOrAnalyze(analyzeProjectPath);
        projectContext = projectAnalyzer.formatForPrompt(analysis, "ui");
      } catch (e) {
        appManager?.addLog("warn", `UI 出图项目分析失败: ${(e instanceof Error ? e : new Error(String(e))).message}`, "ai-gen-ui");
      }
    }

    const analyzedPrompt = String(req.analyzedPrompt || req.userContent || "").trim();
    if (!analyzedPrompt) {
      throw new Error(currentLocale === "zh" ? "未提供 UI 出图提示词" : "No UI image prompt provided");
    }
    const { system: systemPrompt, user: userPrompt } = buildUIImagePrompt({
      projectName: req.projectName,
      analyzedPrompt,
      referenceContent: req.referenceContent,
      projectContext,
      imageCount: images?.length ?? 0,
    });

    const win = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    const sendProgress = (stage: string, current: number, total: number, msg: string) => {
      try { win?.webContents.send("ai:imageProgress", { stage, current, total, message: msg }); } catch { /* ignore */ }
    };

    const abortController = new AbortController();
    currentAbortController = abortController;

    sendProgress("generating", 0, 0, "AI 正在生成 UI 代码...");

    let chunkCount = 0;
    let htmlResult: string;
    try {
      htmlResult = await aiService.generateStream(provider, systemPrompt, userPrompt, () => {
        chunkCount++;
        if (chunkCount % 10 === 0) sendProgress("generating", chunkCount, 0, `AI 生成中... (${chunkCount} 片段)`);
      }, images, abortController.signal);
    } catch (streamErr: unknown) {
      if (abortController.signal.aborted) throw new Error(currentLocale === "zh" ? "已停止生成" : "Generation stopped");
      htmlResult = await aiService.generate(provider, systemPrompt, userPrompt, images, abortController.signal);
    } finally {
      if (currentAbortController === abortController) currentAbortController = null;
    }

    sendProgress("parsing", 0, 0, "正在解析 HTML 页面...");

    htmlResult = htmlResult.replace(/^```html?\s*/i, "").replace(/```\s*$/, "").trim();

    const pageRegex = /<!--\s*PAGE_START:\s*(.+?)\s*-->([\s\S]*?)<!--\s*PAGE_END\s*-->/gi;
    const pages: Array<{ name: string; html: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = pageRegex.exec(htmlResult)) !== null) {
      const name = match[1].trim();
      const html = match[2].replace(/^```html?\s*/i, "").replace(/```\s*$/, "").trim();
      if (html) pages.push({ name, html });
    }
    if (!pages.length) {
      pages.push({ name: "UI Design", html: htmlResult });
    }

    sendProgress("rendering", 0, pages.length, `共 ${pages.length} 个页面，准备渲染...`);

    const outputDir = assertTrustedOutputDirectory(req.outputDir || appManager?.getConfig().outputPath || "");
    fs.existsSync(outputDir) || fs.mkdirSync(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const imgFormat = req.imageFormat === "jpeg" ? "jpeg" : "png";
    const savedFiles: string[] = [];
    const pageResults: Array<{ name: string; imagePath: string; htmlPath: string }> = [];
    const wrapHtml = (body: string) =>
      `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: -apple-system, "Microsoft YaHei", "PingFang SC", sans-serif; background: #fff; }</style>
</head><body>${body}</body></html>`;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      sendProgress("rendering", i + 1, pages.length, `正在渲染: ${page.name} (${i + 1}/${pages.length})`);
      const suffix = pages.length > 1 ? `-${i + 1}` : "";
      const safeName = page.name.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40);
      const imgFileName = `ui-${safeName}${suffix}-${timestamp}.${imgFormat}`;
      const imgFilePath = assertTrustedOutputPath(outputDir, imgFileName);
      const fullHtml = wrapHtml(page.html);

      const renderWin = new BrowserWindow({ show: false, width: 1280, height: 800 });
      await renderWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
      await new Promise((r) => setTimeout(r, 800));
      const contentH = await renderWin.webContents.executeJavaScript("document.body.scrollHeight") as number;
      renderWin.setSize(1280, Math.min(contentH + 40, 16000));
      await new Promise((r) => setTimeout(r, 400));
      const captured = await renderWin.webContents.capturePage();
      if (imgFormat === "jpeg") {
        fs.writeFileSync(imgFilePath, captured.toJPEG(92));
      } else {
        fs.writeFileSync(imgFilePath, captured.toPNG());
      }
      renderWin.close();
      savedFiles.push(imgFilePath);

      const htmlFileName = `ui-${safeName}${suffix}-${timestamp}.html`;
      const htmlFilePath = assertTrustedOutputPath(outputDir, htmlFileName);
      fs.writeFileSync(htmlFilePath, fullHtml, "utf-8");
      savedFiles.push(htmlFilePath);

      pageResults.push({ name: page.name, imagePath: imgFilePath, htmlPath: htmlFilePath });
      try { win?.webContents.send("ai:pageReady", { name: page.name, imagePath: imgFilePath, htmlPath: htmlFilePath, index: i, total: pages.length }); } catch { /* ignore */ }
    }

    sendProgress("done", pages.length, pages.length, `全部完成，共 ${pages.length} 个页面`);

    const recordId = randomUUID();
    appManager?.addGenerationRecord({
      id: recordId,
      docType: "ui",
      projectName: req.projectName?.trim() || "",
      createdAt: new Date().toISOString(),
      preview: `[UI 图片 x${pages.length}] ${pages.map((p) => p.name).join(", ")}`,
      outputPath: savedFiles[0],
    });
    appManager?.addLog("info", `UI 图片已生成 ${pages.length} 张: ${savedFiles.filter((f) => f.endsWith(`.${imgFormat}`)).join(", ")}`, "ai-gen-ui");
    return { htmlResult, savedFiles, recordId, pages: pageResults };
  }));

  ipcMain.handle("ai:checkFilesExist", wrapIPC(async (_e: any, paths: string[]) => {
    const result: Record<string, boolean> = {};
    for (const p of paths || []) {
      if (typeof p !== "string" || !p) {
        continue;
      }
      result[p] = isTrustedPath(p) || isKnownHistoryOutputPath(p) ? fs.existsSync(p) : false;
    }
    return result;
  }));

  ipcMain.handle("ai:renderHtmlToImage", wrapIPC(async (_e: any, req: any) => {
    const { htmlCode, outputDir, fileName, format } = req as {
      htmlCode: string;
      outputDir: string;
      fileName: string;
      format: "png" | "jpeg" | "gif";
    };
    if (!["png", "jpeg", "gif"].includes(format)) {
      throw new Error(currentLocale === "zh" ? "不支持的图片格式" : "Unsupported image format");
    }
    const safeOutputDir = assertTrustedOutputDirectory(outputDir);
    fs.existsSync(safeOutputDir) || fs.mkdirSync(safeOutputDir, { recursive: true });
    const filePath = assertTrustedOutputPath(safeOutputDir, fileName);
    const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif; background: #fff; }
</style></head><body>${htmlCode}</body></html>`;
    const renderWin = new BrowserWindow({ show: false, width: 1280, height: 800 });
    await renderWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlDoc)}`);
    await new Promise((r) => setTimeout(r, 800));
    const ch = await renderWin.webContents.executeJavaScript("document.body.scrollHeight") as number;
    renderWin.setSize(1280, Math.min(ch + 40, 16000));
    await new Promise((r) => setTimeout(r, 400));

    if (format === "gif") {
      const { GifWriter } = await import("omggif");
      const viewH = 720;
      renderWin.setSize(1280, viewH);
      await new Promise((r) => setTimeout(r, 200));
      const totalH = await renderWin.webContents.executeJavaScript("document.body.scrollHeight") as number;
      const step = Math.floor(viewH * 0.7);
      const positions = [0];
      let sy = step;
      while (sy < totalH - viewH) { positions.push(sy); sy += step; }
      if (totalH > viewH) positions.push(totalH - viewH);
      const bitmaps: Buffer[] = [];
      for (const pos of positions) {
        await renderWin.webContents.executeJavaScript(`window.scrollTo(0, ${pos})`);
        await new Promise((r) => setTimeout(r, 200));
        const img = await renderWin.webContents.capturePage();
        bitmaps.push(img.toBitmap());
      }
      const sz = (await renderWin.webContents.capturePage()).getSize();
      renderWin.close();
      const w = sz.width;
      const h = sz.height;
      const palette: number[] = [];
      for (let r = 0; r < 6; r++)
        for (let g = 0; g < 6; g++)
          for (let b = 0; b < 6; b++)
            palette.push((r * 51) | ((g * 51) << 8) | ((b * 51) << 16));
      while (palette.length < 256) {
        const gray = Math.round((palette.length - 216) * (255 / 39));
        palette.push(gray | (gray << 8) | (gray << 16));
      }
      function nearIdx(r: number, g: number, b: number) {
        return Math.round(r / 51) * 36 + Math.round(g / 51) * 6 + Math.round(b / 51);
      }
      const outBuf = Buffer.alloc(w * h * bitmaps.length * 2 + 65536);
      const gw = new GifWriter(outBuf, w, h, { loop: 0, palette });
      for (const rgba of bitmaps) {
        const indexed = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) {
          const off = i * 4;
          indexed[i] = nearIdx(rgba[off], rgba[off + 1], rgba[off + 2]);
        }
        gw.addFrame(0, 0, w, h, indexed, { delay: 150, dispose: 0 });
      }
      fs.writeFileSync(filePath, Buffer.from(outBuf.buffer, 0, gw.end()));
    } else {
      const captured = await renderWin.webContents.capturePage();
      renderWin.close();
      if (format === "jpeg") {
        fs.writeFileSync(filePath, captured.toJPEG(92));
      } else {
        fs.writeFileSync(filePath, captured.toPNG());
      }
    }
    appManager?.addLog("info", `UI 图片已生成: ${fileName}`, "ai-render");
    return filePath;
  }));

  ipcMain.handle("ai:getHistory", () => appManager?.getGenerationHistory() ?? []);
  ipcMain.handle("ai:addHistory", (_e, record: any) => { appManager?.addGenerationRecord(record); });
  ipcMain.handle("ai:deleteHistory", (_e, id: string) => { appManager?.deleteGenerationRecord(id); return true; });
  ipcMain.handle("ai:readOutputFile", wrapIPC(async (_e: any, p: string) => {
    if (!p) return null;
    const filePath = assertTrustedReadPath(p, currentLocale === "zh" ? "输出文件" : "Output file");
    if (!fs.existsSync(filePath)) return null;
    assertExistingFile(filePath, currentLocale === "zh" ? "输出文件" : "Output file");
    return fs.readFileSync(filePath, "utf-8");
  }));
  ipcMain.handle("ai:updateHistoryOutput", (_e, data: any) => {
    appManager?.updateGenerationOutputPath(data.id, data.outputPath);
  });
  ipcMain.handle(
    "ai:testConnection",
    wrapIPC(async (_e: any, provider: any) => {
      const r = await aiService.testConnection(provider);
      appManager?.addLog(
        "info",
        `AI 连接测试完成: ${provider?.name ?? provider?.id ?? "unknown"}`,
        "ai-test",
      );
      return r;
    }),
  );
  ipcMain.handle(
    "ai:listModels",
    wrapIPC(async (_e: any, provider: any) => {
      const r = await aiService.listModels(provider);
      appManager?.addLog(
        "info",
        `AI 模型列表已拉取: ${provider?.name ?? provider?.id ?? "unknown"}`,
        "ai-models",
      );
      return r;
    }),
  );
  ipcMain.handle("ai:saveDocument", wrapIPC(async (_e: any, req: any) => {
    const format = String(req.format || "md").toLowerCase();
    if (!ALLOWED_SAVE_FORMATS.has(format)) {
      throw new Error(currentLocale === "zh" ? "不支持的保存格式" : "Unsupported save format");
    }
    const filePath = assertTrustedOutputPath(req.outputDir, req.fileName);
    const outputDir = path.dirname(filePath);
    fs.existsSync(outputDir) || fs.mkdirSync(outputDir, { recursive: true });
    const marked = new Marked();

    if (format === "docx") {
      const htmlBody = await marked.parse(req.content);
      const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${htmlBody}</body></html>`;
      const HTMLtoDOCX = (await import("html-to-docx")).default;
      const docxBuf = await HTMLtoDOCX(htmlDoc, null, {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      });
      fs.writeFileSync(filePath, Buffer.from(docxBuf as ArrayBuffer));
    } else if (format === "pdf") {
      const htmlBody = await marked.parse(req.content);
      const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 14px; line-height: 1.8; padding: 20px 40px; color: #1a1a1a; }
  h1 { font-size: 24px; border-bottom: 2px solid #1890ff; padding-bottom: 8px; }
  h2 { font-size: 20px; border-bottom: 1px solid #e8e8e8; padding-bottom: 6px; }
  h3 { font-size: 16px; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
  pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: transparent; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  th, td { border: 1px solid #e8e8e8; padding: 8px 12px; text-align: left; }
  th { background: #fafafa; font-weight: 600; }
  blockquote { border-left: 4px solid #1890ff; margin: 1em 0; padding: 8px 16px; color: #666; background: #f0f7ff; }
</style></head><body>${htmlBody}</body></html>`;
      const pdfWin = new BrowserWindow({ show: false, width: 800, height: 600 });
      await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlDoc)}`);
      const pdfData = await pdfWin.webContents.printToPDF({
        printBackground: true,
        margins: { marginType: "default" },
      });
      fs.writeFileSync(filePath, pdfData);
      pdfWin.close();
    } else if (format === "png" || format === "jpeg" || format === "jpg") {
      const htmlBody = await marked.parse(req.content);
      const imgStyle = `
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 14px; line-height: 1.8; padding: 40px; color: #1a1a1a; background: #fff; margin: 0; }
  h1 { font-size: 24px; border-bottom: 2px solid #1890ff; padding-bottom: 8px; }
  h2 { font-size: 20px; border-bottom: 1px solid #e8e8e8; padding-bottom: 6px; }
  h3 { font-size: 16px; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
  pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: transparent; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  th, td { border: 1px solid #e8e8e8; padding: 8px 12px; text-align: left; }
  th { background: #fafafa; font-weight: 600; }
  blockquote { border-left: 4px solid #1890ff; margin: 1em 0; padding: 8px 16px; color: #666; background: #f0f7ff; }
  img { max-width: 100%; height: auto; }`;
      const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${imgStyle}</style></head><body>${htmlBody}</body></html>`;
      const imgWin = new BrowserWindow({ show: false, width: 1200, height: 800 });
      await imgWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlDoc)}`);
      await new Promise((r) => setTimeout(r, 500));
      const contentHeight = await imgWin.webContents.executeJavaScript("document.body.scrollHeight");
      imgWin.setSize(1200, Math.min(contentHeight + 40, 16000));
      await new Promise((r) => setTimeout(r, 300));
      const capturedImg = await imgWin.webContents.capturePage();
      if (format === "png") {
        fs.writeFileSync(filePath, capturedImg.toPNG());
      } else {
        fs.writeFileSync(filePath, capturedImg.toJPEG(90));
      }
      imgWin.close();
    } else if (format === "gif") {
      const { GifWriter } = await import("omggif");
      const htmlBody = await marked.parse(req.content);
      const gifCss = `
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 14px; line-height: 1.8; padding: 40px; color: #1a1a1a; background: #fff; margin: 0; }
  h1 { font-size: 24px; border-bottom: 2px solid #1890ff; padding-bottom: 8px; }
  h2 { font-size: 20px; border-bottom: 1px solid #e8e8e8; padding-bottom: 6px; }
  h3 { font-size: 16px; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
  pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: transparent; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  th, td { border: 1px solid #e8e8e8; padding: 8px 12px; text-align: left; }
  th { background: #fafafa; font-weight: 600; }
  blockquote { border-left: 4px solid #1890ff; margin: 1em 0; padding: 8px 16px; color: #666; background: #f0f7ff; }
  img { max-width: 100%; height: auto; }`;
      const gifHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${gifCss}</style></head><body>${htmlBody}</body></html>`;
      const viewW = 800;
      const viewH = 600;
      const gifWin = new BrowserWindow({ show: false, width: viewW, height: viewH });
      await gifWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(gifHtml)}`);
      await new Promise((r) => setTimeout(r, 600));
      const totalH = await gifWin.webContents.executeJavaScript("document.body.scrollHeight") as number;
      const scrollStep = Math.floor(viewH * 0.7);
      const positions = [0];
      let sy = scrollStep;
      while (sy < totalH - viewH) { positions.push(sy); sy += scrollStep; }
      if (totalH > viewH) positions.push(totalH - viewH);
      const frames: Buffer[] = [];
      for (const pos of positions) {
        await gifWin.webContents.executeJavaScript(`window.scrollTo(0, ${pos})`);
        await new Promise((r) => setTimeout(r, 200));
        const img = await gifWin.webContents.capturePage();
        frames.push(img.toBitmap());
      }
      const size = (await gifWin.webContents.capturePage()).getSize();
      gifWin.close();
      const w = size.width;
      const h = size.height;
      const palette: number[] = [];
      for (let r = 0; r < 6; r++)
        for (let g = 0; g < 6; g++)
          for (let b = 0; b < 6; b++)
            palette.push((r * 51) | ((g * 51) << 8) | ((b * 51) << 16));
      while (palette.length < 256) {
        const gray = Math.round((palette.length - 216) * (255 / 39));
        palette.push(gray | (gray << 8) | (gray << 16));
      }
      function nearestIdx(r: number, g: number, b: number): number {
        const ri = Math.round(r / 51);
        const gi = Math.round(g / 51);
        const bi = Math.round(b / 51);
        return ri * 36 + gi * 6 + bi;
      }
      const outBuf = Buffer.alloc(w * h * frames.length * 2 + 65536);
      const gw = new GifWriter(outBuf, w, h, { loop: 0, palette });
      for (const rgba of frames) {
        const indexed = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) {
          const off = i * 4;
          indexed[i] = nearestIdx(rgba[off], rgba[off + 1], rgba[off + 2]);
        }
        gw.addFrame(0, 0, w, h, indexed, { delay: 150, dispose: 0 });
      }
      const finalGif = Buffer.from(outBuf.buffer, 0, gw.end());
      fs.writeFileSync(filePath, finalGif);
    } else if (format === "svg") {
      const htmlBody = await marked.parse(req.content);
      const svgDoc = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="960" height="auto" viewBox="0 0 960 800">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif; font-size: 14px; line-height: 1.8; padding: 32px; color: #1a1a1a;">
      ${htmlBody}
    </div>
  </foreignObject>
</svg>`;
      fs.writeFileSync(filePath, svgDoc, "utf-8");
    } else if (format === "html") {
      const htmlBody = await marked.parse(req.content);
      const htmlDoc = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${req.fileName?.replace(/\.html$/, "") || "UI Design"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 15px; line-height: 1.8; color: #1a1a1a; background: #f8f9fa; }
    .container { max-width: 960px; margin: 0 auto; padding: 40px 32px; background: #fff; min-height: 100vh; box-shadow: 0 0 20px rgba(0,0,0,0.05); }
    h1 { font-size: 28px; border-bottom: 3px solid #1890ff; padding-bottom: 12px; margin-bottom: 24px; }
    h2 { font-size: 22px; border-bottom: 1px solid #e8e8e8; padding-bottom: 8px; margin: 32px 0 16px; }
    h3 { font-size: 18px; margin: 24px 0 12px; }
    p { margin: 0.8em 0; }
    code { background: #f0f2f5; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: "JetBrains Mono", "Fira Code", monospace; }
    pre { background: #282c34; color: #abb2bf; padding: 20px; border-radius: 8px; overflow-x: auto; margin: 1em 0; }
    pre code { background: transparent; padding: 0; color: inherit; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; }
    th, td { border: 1px solid #e8e8e8; padding: 10px 14px; text-align: left; }
    th { background: #fafafa; font-weight: 600; }
    blockquote { border-left: 4px solid #1890ff; margin: 1em 0; padding: 12px 20px; color: #555; background: #f0f7ff; border-radius: 0 6px 6px 0; }
    ul, ol { padding-left: 2em; margin: 0.5em 0; }
    li { margin: 0.3em 0; }
    img { max-width: 100%; height: auto; border-radius: 6px; }
    a { color: #1890ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    hr { border: none; border-top: 1px solid #e8e8e8; margin: 24px 0; }
  </style>
</head>
<body><div class="container">${htmlBody}</div></body>
</html>`;
      fs.writeFileSync(filePath, htmlDoc, "utf-8");
    } else {
      fs.writeFileSync(filePath, req.content, "utf-8");
    }

    if (req.historyRecordId) appManager?.updateGenerationOutputPath(req.historyRecordId, filePath);
    appManager?.addLog(
      "info",
      `文档已保存: ${req.fileName} (${format})`,
      "ai-save",
    );
    return filePath;
  }));

  registerProjectHandlers({
    appManager: () => appManager,
    currentLocale: () => currentLocale,
    projectAnalyzer,
    wrapIPC,
  });

  // Theme
  ipcMain.handle("app:getTheme", () => {
    const f = path.join(APP_DIR, "theme.json");
    try {
      if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf-8")).theme || "light";
    } catch { /* ignore */ }
    return "light";
  });
  ipcMain.handle("app:setTheme", (_e, theme: string) => {
    fs.existsSync(APP_DIR) || fs.mkdirSync(APP_DIR, { recursive: true });
    fs.writeFileSync(path.join(APP_DIR, "theme.json"), JSON.stringify({ theme }), "utf-8");
    return theme;
  });
}

/* ------------------------------------------------------------------ */
/*  App lifecycle                                                      */
/* ------------------------------------------------------------------ */

const startHidden = process.argv.includes("--hidden");

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
