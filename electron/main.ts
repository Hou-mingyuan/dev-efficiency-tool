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
import net from "node:net";
import { Marked } from "marked";
import { McpManager, type AiProvider } from "./mcp-manager";
import { AiService, buildPrompt, UI_IMAGE_PROMPT, type DocType } from "./ai-service";
import { ProjectAnalyzer } from "./project-analyzer";

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
    startMcp: "启动 MCP Server",
    stopMcp: "停止 MCP Server",
    mcpStatus: "MCP 状态",
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
    startMcp: "Start MCP Server",
    stopMcp: "Stop MCP Server",
    mcpStatus: "MCP Status",
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
let mcpManager: McpManager | null = null;
const aiService = new AiService();
const defaultCacheDir = app.isPackaged
  ? path.join(path.dirname(process.execPath), ".project-cache")
  : path.join(APP_DIR, ".project-cache");
const projectAnalyzer = new ProjectAnalyzer(defaultCacheDir);
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let currentLocale = "zh";

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
    {
      label: t.mcpStatus,
      submenu: [
        { label: t.startMcp, click: () => mcpManager?.start() },
        { label: t.stopMcp, click: () => mcpManager?.stop() },
      ],
    },
    { type: "separator" },
    {
      label: t.trayExit,
      click: () => {
        saveWindowState();
        tray?.destroy();
        tray = null;
        mcpManager?.stop();
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
  mainWindow = new BrowserWindow({
    ...state,
    minWidth: 900,
    minHeight: 600,
    title: "开发效率提升工具",
    icon: path.join(__dirname, "../public/icon.png"),
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
      mainWindow?.hide();
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
  const iconPath = path.join(__dirname, "../public/icon.png");
  let img: Electron.NativeImage;
  try {
    img = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    img = nativeImage.createEmpty();
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
/*  Port check                                                         */
/* ------------------------------------------------------------------ */

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(true));
    srv.once("listening", () => {
      srv.close();
      resolve(false);
    });
    srv.listen(port);
  });
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
      mcpManager?.addLog(
        "warn",
        `检查更新失败: ${(err instanceof Error ? err : new Error(String(err))).message}`,
        "app",
      );
      return null;
    }
  });

  // MCP
  ipcMain.handle("mcp:getStatus", () => mcpManager?.getStatus());
  ipcMain.handle("mcp:start", wrapIPC(async () => { await mcpManager?.start(); return mcpManager?.getStatus(); }));
  ipcMain.handle("mcp:stop", wrapIPC(async () => { await mcpManager?.stop(); return mcpManager?.getStatus(); }));
  ipcMain.handle("mcp:getLogs", () => mcpManager?.getLogs());
  ipcMain.handle("mcp:clearLogs", () => mcpManager?.clearLogs());
  ipcMain.handle("mcp:getConfig", () => mcpManager?.getConfig());
  ipcMain.handle("mcp:setConfig", wrapIPC(async (_e: any, cfg: any) => {
    if (!mcpManager) return;
    const wasRunning = mcpManager.getStatus().running;
    const { port: prevPort, transport: prevTransport } = mcpManager.getConfig();
    const updated = mcpManager.setConfig(cfg);
    projectAnalyzer.setCacheDir(updated.cachePath?.trim() || null);
    if (wasRunning && mainWindow && (updated.port !== prevPort || updated.transport !== prevTransport)) {
      mainWindow.webContents.send("mcp:configChanged", {
        port: updated.port,
        transport: updated.transport,
        previousPort: prevPort,
        previousTransport: prevTransport,
      });
    }
    return updated;
  }));
  ipcMain.handle("mcp:getMethodologyFiles", () => mcpManager?.getMethodologyFiles());
  ipcMain.handle("mcp:readMethodologyFile", (_e, p: string) => mcpManager?.readMethodologyFile(p));
  ipcMain.handle("mcp:writeMethodologyFile", (_e, p: string, content: string) => mcpManager?.writeMethodologyFile(p, content));
  ipcMain.handle("mcp:getIdeConfigs", () => mcpManager?.detectIdeConfigs());
  ipcMain.handle("mcp:installToIde", (_e, id: string) => mcpManager?.installToIde(id));

  // App utilities
  ipcMain.handle("app:openExternal", (_e, url: string) => shell.openExternal(url));
  ipcMain.handle("app:getVersion", () => app.getVersion());
  ipcMain.handle("app:setAutoLaunch", (_e, v: boolean) => { setAutoLaunch(v); return true; });
  ipcMain.handle("app:getAutoLaunch", () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle("app:healthCheck", wrapIPC(async () => {
    const nodeVersion = process.version;
    const mPath = mcpManager?.getConfig().methodologyPath || "";
    const entryExists = fs.existsSync(path.join(mPath, "dist", "index.js"));
    const mdDir = path.join(mPath, "methodology");
    const mdCount = fs.existsSync(mdDir) ? fs.readdirSync(mdDir).filter((f) => f.endsWith(".md")).length : 0;
    const portUsed = await isPortInUse(mcpManager?.getConfig().port || 3100);
    return {
      nodeVersion,
      electronVersion: process.versions.electron,
      methodologyPath: mPath,
      entryExists,
      methodologyFileCount: mdCount,
      portAvailable: !portUsed,
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
      title: "导出日志",
      defaultPath: `mcp-logs-${new Date().toISOString().slice(0, 10)}.txt`,
      filters: [{ name: "文本文件", extensions: ["txt"] }],
    });
    if (!filePath) return false;
    const text = (mcpManager?.getLogs() || [])
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`)
      .join("\n");
    fs.writeFileSync(filePath, text, "utf-8");
    return true;
  }));
  ipcMain.handle("app:exportConfig", wrapIPC(async () => {
    const { filePath } = await dialog.showSaveDialog(mainWindow!, {
      title: "导出配置",
      defaultPath: "mcp-config-backup.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!filePath) return false;
    const cfg = mcpManager?.getConfig();
    if (!cfg) return false;
    const safe = { ...cfg, aiProviders: cfg.aiProviders.map((p: any) => ({ ...p, apiKey: "***" })) };
    fs.writeFileSync(filePath, JSON.stringify(safe, null, 2), "utf-8");
    return true;
  }));
  ipcMain.handle("app:importConfig", wrapIPC(async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow!, {
      title: "导入配置",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (!filePaths?.length) return null;
    const data = JSON.parse(fs.readFileSync(filePaths[0], "utf-8"));
    mcpManager?.setConfig(data);
    return mcpManager?.getConfig();
  }));

  // Document
  ipcMain.handle("app:parseDocument", wrapIPC(async (_e: any, p: string) => mcpManager?.parseDocument(p)));
  ipcMain.handle("app:selectFile", wrapIPC(async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow!, {
      title: "选择文档",
      filters: [{ name: "文档", extensions: ["docx", "xlsx", "pdf", "md", "txt"] }],
      properties: ["openFile"],
    });
    return filePaths?.[0] || null;
  }));

  ipcMain.handle("app:selectImages", wrapIPC(async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow!, {
      title: "选择图片",
      filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] }],
      properties: ["openFile", "multiSelections"],
    });
    return filePaths || [];
  }));

  ipcMain.handle("app:readImageAsBase64", wrapIPC(async (_e: any, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace(".", "");
    const mimeMap: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
    };
    const mimeType = mimeMap[ext] || "image/png";
    return {
      base64: buf.toString("base64"),
      mimeType,
      name: path.basename(filePath),
      dataUrl: `data:${mimeType};base64,${buf.toString("base64")}`,
    };
  }));
  ipcMain.handle("app:selectDirectory", wrapIPC(async (_e: any, title?: string) => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow!, {
      title: title || "选择目录",
      properties: ["openDirectory"],
    });
    return filePaths?.[0] || null;
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
      const custom = mcpManager
        ?.getConfig()
        .aiProviders?.find((p: any) => p.id === req.providerId && p.enabled && p.apiKey);
      if (custom) provider = custom;
    }
    if (!provider) {
      provider = mcpManager?.getActiveProvider() ?? null;
    }
    if (!provider) {
      throw new Error("未配置可用的 AI 服务商。请前往「配置管理 → AI 模型配置」启用并设置 API Key。");
    }

    const customPrompts = mcpManager?.getConfig().customPrompts;

    let projectContext = "";
    const analyzeProjectPath = req.projectPath || mcpManager?.getConfig().projectPath;
    if (analyzeProjectPath && fs.existsSync(analyzeProjectPath)) {
      try {
        const analysis = projectAnalyzer.getOrAnalyze(analyzeProjectPath);
        projectContext = projectAnalyzer.formatForPrompt(analysis, req.docType);
      } catch (e) {
        mcpManager?.addLog("warn", `项目分析失败: ${(e instanceof Error ? e : new Error(String(e))).message}`, "project-analyzer");
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
      if (abortController.signal.aborted) throw new Error("已停止生成");
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
    mcpManager?.addGenerationRecord(record);
    mcpManager?.addLog(
      "info",
      `AI 生成完成: ${req.docType} (${provider.name})`,
      "ai-gen",
    );
    if (win && !win.isDestroyed()) win.webContents.send("ai:done", result, recordId);
    return result;
  }));
  ipcMain.handle("ai:generateUIImage", wrapIPC(async (event: any, req: any) => {
    let provider: AiProvider | null = null;
    if (req.providerId) {
      const custom = mcpManager
        ?.getConfig()
        .aiProviders?.find((p: any) => p.id === req.providerId && p.enabled && p.apiKey);
      if (custom) provider = custom;
    }
    if (!provider) provider = mcpManager?.getActiveProvider() ?? null;
    if (!provider) throw new Error("未配置可用的 AI 服务商。");

    const images = req.images as Array<{ base64: string; mimeType: string }> | undefined;

    let systemPrompt = UI_IMAGE_PROMPT.system;
    let userPrompt = UI_IMAGE_PROMPT.userPrefix;

    const analyzeProjectPath = req.projectPath || mcpManager?.getConfig().projectPath;
    if (analyzeProjectPath && fs.existsSync(analyzeProjectPath)) {
      try {
        const analysis = projectAnalyzer.getOrAnalyze(analyzeProjectPath);
        const ctx = projectAnalyzer.formatForPrompt(analysis, "ui");
        if (ctx) {
          systemPrompt += `\n\n请结合以下项目分析结果，确保生成的 UI 与项目现有的设计风格、配色方案、组件规范保持一致：`;
          userPrompt += `**项目技术分析：**\n${ctx}\n\n---\n\n`;
        }
      } catch (e) {
        mcpManager?.addLog("warn", `UI 出图项目分析失败: ${(e instanceof Error ? e : new Error(String(e))).message}`, "ai-gen-ui");
      }
    }

    if (req.referenceContent) {
      userPrompt += `**参考文档内容：**\n${req.referenceContent}\n\n---\n\n`;
    }

    if (req.projectName) userPrompt += `**项目/模块名称：** ${req.projectName}\n\n`;
    userPrompt += req.userContent || "请根据参考图片生成 UI 页面";

    const win = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;

    const abortController = new AbortController();
    currentAbortController = abortController;

    let htmlResult: string;
    try {
      htmlResult = await aiService.generateStream(provider, systemPrompt, userPrompt, () => {}, images, abortController.signal);
    } catch (streamErr: unknown) {
      if (abortController.signal.aborted) throw new Error("已停止生成");
      htmlResult = await aiService.generate(provider, systemPrompt, userPrompt, images, abortController.signal);
    } finally {
      if (currentAbortController === abortController) currentAbortController = null;
    }

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

    const outputDir = req.outputDir || mcpManager?.getConfig().outputPath;
    if (!outputDir) throw new Error("未指定输出目录");
    fs.existsSync(outputDir) || fs.mkdirSync(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const imgFormat = req.imageFormat || "png";
    const savedFiles: string[] = [];
    const pageResults: Array<{ name: string; imagePath: string; htmlPath: string }> = [];
    const wrapHtml = (body: string) =>
      `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: -apple-system, "Microsoft YaHei", "PingFang SC", sans-serif; background: #fff; }</style>
</head><body>${body}</body></html>`;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const suffix = pages.length > 1 ? `-${i + 1}` : "";
      const safeName = page.name.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40);
      const imgFileName = `ui-${safeName}${suffix}-${timestamp}.${imgFormat}`;
      const imgFilePath = path.join(outputDir, imgFileName);
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
      const htmlFilePath = path.join(outputDir, htmlFileName);
      fs.writeFileSync(htmlFilePath, fullHtml, "utf-8");
      savedFiles.push(htmlFilePath);

      pageResults.push({ name: page.name, imagePath: imgFilePath, htmlPath: htmlFilePath });
    }

    const recordId = randomUUID();
    mcpManager?.addGenerationRecord({
      id: recordId,
      docType: "ui",
      projectName: req.projectName?.trim() || "",
      createdAt: new Date().toISOString(),
      preview: `[UI 图片 x${pages.length}] ${pages.map((p) => p.name).join(", ")}`,
      outputPath: savedFiles[0],
    });
    mcpManager?.addLog("info", `UI 图片已生成 ${pages.length} 张: ${savedFiles.filter((f) => f.endsWith(`.${imgFormat}`)).join(", ")}`, "ai-gen-ui");
    return { htmlResult, savedFiles, recordId, pages: pageResults };
  }));

  ipcMain.handle("ai:renderHtmlToImage", wrapIPC(async (_e: any, req: any) => {
    const { htmlCode, outputDir, fileName, format } = req as {
      htmlCode: string;
      outputDir: string;
      fileName: string;
      format: "png" | "jpeg" | "gif";
    };
    fs.existsSync(outputDir) || fs.mkdirSync(outputDir, { recursive: true });
    const filePath = path.join(outputDir, fileName);
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
    mcpManager?.addLog("info", `UI 图片已生成: ${fileName}`, "ai-render");
    return filePath;
  }));

  ipcMain.handle("ai:getHistory", () => mcpManager?.getGenerationHistory() ?? []);
  ipcMain.handle("ai:addHistory", (_e, record: any) => { mcpManager?.addGenerationRecord(record); });
  ipcMain.handle("ai:readOutputFile", wrapIPC(async (_e: any, p: string) => {
    if (!p || !fs.existsSync(p)) return null;
    return fs.readFileSync(p, "utf-8");
  }));
  ipcMain.handle("ai:updateHistoryOutput", (_e, data: any) => {
    mcpManager?.updateGenerationOutputPath(data.id, data.outputPath);
  });
  ipcMain.handle(
    "ai:testConnection",
    wrapIPC(async (_e: any, provider: any) => {
      const r = await aiService.testConnection(provider);
      mcpManager?.addLog(
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
      mcpManager?.addLog(
        "info",
        `AI 模型列表已拉取: ${provider?.name ?? provider?.id ?? "unknown"}`,
        "ai-models",
      );
      return r;
    }),
  );
  ipcMain.handle("ai:saveDocument", wrapIPC(async (_e: any, req: any) => {
    fs.existsSync(req.outputDir) || fs.mkdirSync(req.outputDir, { recursive: true });
    const filePath = path.join(req.outputDir, req.fileName);
    const marked = new Marked();

    if (req.format === "docx") {
      const htmlBody = await marked.parse(req.content);
      const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${htmlBody}</body></html>`;
      const HTMLtoDOCX = (await import("html-to-docx")).default;
      const docxBuf = await HTMLtoDOCX(htmlDoc, null, {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      });
      fs.writeFileSync(filePath, Buffer.from(docxBuf as ArrayBuffer));
    } else if (req.format === "pdf") {
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
    } else if (req.format === "png" || req.format === "jpeg" || req.format === "jpg") {
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
      if (req.format === "png") {
        fs.writeFileSync(filePath, capturedImg.toPNG());
      } else {
        fs.writeFileSync(filePath, capturedImg.toJPEG(90));
      }
      imgWin.close();
    } else if (req.format === "gif") {
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
    } else if (req.format === "svg") {
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
    } else if (req.format === "html") {
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

    if (req.historyRecordId) mcpManager?.updateGenerationOutputPath(req.historyRecordId, filePath);
    mcpManager?.addLog(
      "info",
      `文档已保存: ${req.fileName} (${req.format || "md"})`,
      "ai-save",
    );
    return filePath;
  }));

  // Project analysis
  ipcMain.handle("project:analyze", wrapIPC(async (_e: any, projectPath: string) => {
    if (!projectPath) throw new Error("未指定项目路径");
    const result = projectAnalyzer.analyze(projectPath);
    mcpManager?.addLog("info", `项目分析完成: ${projectPath} (${result.structure.totalFiles} 文件)`, "project-analyzer");
    return result;
  }));
  ipcMain.handle("project:getCache", (_e, projectPath: string) => {
    return projectAnalyzer.getCache(projectPath);
  });
  ipcMain.handle("project:getCacheInfo", (_e, projectPath: string) => {
    return projectAnalyzer.getCacheInfo(projectPath);
  });
  ipcMain.handle("project:isCacheValid", (_e, projectPath: string) => {
    return projectAnalyzer.isCacheValid(projectPath);
  });
  ipcMain.handle("project:clearCache", (_e, projectPath: string) => {
    const cleared = projectAnalyzer.clearCache(projectPath);
    if (cleared) mcpManager?.addLog("info", `已清除项目缓存: ${projectPath}`, "project-analyzer");
    return cleared;
  });
  ipcMain.handle("project:clearAllCaches", () => {
    const count = projectAnalyzer.clearAllCaches();
    mcpManager?.addLog("info", `已清除全部项目缓存 (${count} 个)`, "project-analyzer");
    return count;
  });
  ipcMain.handle("project:getCacheDir", () => {
    return projectAnalyzer.cacheDir;
  });
  ipcMain.handle("project:setCacheDir", (_e, dir: string) => {
    projectAnalyzer.setCacheDir(dir || null);
    mcpManager?.addLog("info", `缓存目录已更新: ${projectAnalyzer.cacheDir}`, "project-analyzer");
    return projectAnalyzer.cacheDir;
  });
  ipcMain.handle("project:formatForPrompt", wrapIPC(async (_e: any, projectPath: string, docType: string) => {
    const cached = projectAnalyzer.getOrAnalyze(projectPath);
    return projectAnalyzer.formatForPrompt(cached, docType);
  }));

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
  mcpManager = new McpManager();
  mcpManager.addLog("info", `应用启动 v${app.getVersion()}`, "app");
  if (mcpManager.getConfig().cachePath) {
    projectAnalyzer.setCacheDir(mcpManager.getConfig().cachePath);
  }
  registerIpcHandlers();
  setupAutoUpdater();

  createMainWindow();
  buildAppMenu(currentLocale);
  createTray();
  registerShortcuts();

  if (startHidden) mainWindow?.hide();
  if (mcpManager.getConfig().autoStart) await mcpManager.start();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !tray) {
    mcpManager?.stop();
    app.quit();
  }
});
