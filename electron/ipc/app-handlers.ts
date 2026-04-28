import { app, dialog, ipcMain, shell, type BrowserWindow } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AppManager } from "../app-manager";
import type { ProjectAnalyzer } from "../project-analyzer";
import type { WrapIPC } from "./types";

export interface RegisterAppHandlersOptions {
  appManager: () => AppManager | null;
  mainWindow: () => BrowserWindow | null;
  currentLocale: () => string;
  setCurrentLocale: (locale: string) => void;
  saveLocale: (locale: string) => void;
  buildAppMenu: (locale: string) => void;
  buildTrayMenu: (locale: string) => void;
  createChildWindow: (route: string) => void;
  checkForUpdates: () => Promise<unknown>;
  setAutoLaunch: (enabled: boolean) => void;
  projectAnalyzer: ProjectAnalyzer;
  wrapIPC: WrapIPC;
  assertSafeExternalUrl: (url: string) => string;
  assertTrustedReadPath: (filePath: string, label: string) => string;
  assertExistingFile: (filePath: string, label: string) => string;
  trustFilePath: (filePath: string) => string;
  trustDirectoryPath: (dirPath: string) => string;
}

const ALLOWED_DOCUMENT_EXTENSIONS = new Set([".docx", ".xlsx", ".xls", ".pdf", ".md", ".txt"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]);

interface RendererErrorPayload {
  level?: "error" | "warn";
  message?: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
  url?: string;
}

function assertAllowedExtension(filePath: string, label: string, allowed: Set<string>, locale: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (!allowed.has(ext)) {
    throw new Error(locale === "zh" ? `${label} 格式不受支持` : `${label} format is not supported`);
  }
  return ext;
}

export function registerAppHandlers(options: RegisterAppHandlersOptions): void {
  const {
    appManager,
    mainWindow,
    currentLocale,
    setCurrentLocale,
    saveLocale,
    buildAppMenu,
    buildTrayMenu,
    createChildWindow,
    checkForUpdates,
    setAutoLaunch,
    projectAnalyzer,
    wrapIPC,
    assertSafeExternalUrl,
    assertTrustedReadPath,
    assertExistingFile,
    trustFilePath,
    trustDirectoryPath,
  } = options;

  ipcMain.handle("app:setLocale", wrapIPC(async (_e: any, locale: string) => {
    const normalized = locale.startsWith("zh") ? "zh" : "en";
    setCurrentLocale(normalized);
    saveLocale(normalized);
    buildAppMenu(normalized);
    buildTrayMenu(normalized);
    return normalized;
  }));
  ipcMain.handle("app:getLocale", wrapIPC(async () => currentLocale()));

  ipcMain.handle("app:openInWindow", wrapIPC(async (_e: any, route: string) => {
    createChildWindow(String(route));
  }));
  ipcMain.handle("app:checkForUpdates", wrapIPC(async () => {
    if (!app.isPackaged) return { skipped: true };
    try {
      return await checkForUpdates();
    } catch (err) {
      appManager()?.addLog(
        "warn",
        `检查更新失败: ${(err instanceof Error ? err : new Error(String(err))).message}`,
        "app",
      );
      return null;
    }
  }));

  ipcMain.handle("app:getLogs", wrapIPC(async () => appManager()?.getLogs()));
  ipcMain.handle("app:clearLogs", wrapIPC(async () => appManager()?.clearLogs()));
  ipcMain.handle("app:logRendererError", wrapIPC(async (_e: any, payload: RendererErrorPayload) => {
    const p = payload && typeof payload === "object" ? payload : {};
    const level = p.level === "warn" ? "warn" : "error";
    const message = [
      p.message || "Renderer error",
      p.stack,
      p.url ? `url=${p.url}` : "",
      p.line !== undefined ? `line=${p.line}` : "",
      p.column !== undefined ? `column=${p.column}` : "",
    ].filter(Boolean).join("\n");
    appManager()?.addLog(level, message.slice(0, 8000), p.source || "renderer");
    return true;
  }));
  ipcMain.handle("app:getConfig", wrapIPC(async () => appManager()?.getConfig()));
  ipcMain.handle("app:setConfig", wrapIPC(async (_e: any, cfg: any) => {
    const manager = appManager();
    if (!manager) return;
    const updated = manager.setConfig(cfg);
    projectAnalyzer.setCacheDir(updated.cachePath?.trim() || null);
    mainWindow()?.webContents.send("app:configChanged", updated);
    return updated;
  }));
  ipcMain.handle("app:getMethodologyFiles", wrapIPC(async () => appManager()?.getMethodologyFiles()));
  ipcMain.handle("app:readMethodologyFile", wrapIPC(async (_e: any, p: string) => appManager()?.readMethodologyFile(p)));
  ipcMain.handle("app:writeMethodologyFile", wrapIPC(async (_e: any, p: string, content: string) => appManager()?.writeMethodologyFile(p, content)));

  ipcMain.handle("app:openExternal", wrapIPC(async (_e: any, url: string) => shell.openExternal(assertSafeExternalUrl(url))));
  ipcMain.handle("app:getVersion", wrapIPC(async () => app.getVersion()));
  ipcMain.handle("app:setAutoLaunch", wrapIPC(async (_e: any, v: boolean) => { setAutoLaunch(v); return true; }));
  ipcMain.handle("app:getAutoLaunch", wrapIPC(async () => app.getLoginItemSettings().openAtLogin));
  ipcMain.handle("app:healthCheck", wrapIPC(async () => {
    const nodeVersion = process.version;
    const mPath = appManager()?.getConfig().methodologyPath || "";
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

  ipcMain.handle("app:exportLogs", wrapIPC(async () => {
    const { filePath } = await dialog.showSaveDialog(mainWindow()!, {
      title: currentLocale() === "zh" ? "导出日志" : "Export Logs",
      defaultPath: `app-logs-${new Date().toISOString().slice(0, 10)}.txt`,
      filters: [{ name: currentLocale() === "zh" ? "文本文件" : "Text Files", extensions: ["txt"] }],
    });
    if (!filePath) return false;
    const text = (appManager()?.getLogs() || [])
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`)
      .join("\n");
    fs.writeFileSync(filePath, text, "utf-8");
    return true;
  }));
  ipcMain.handle("app:exportConfig", wrapIPC(async () => {
    const { filePath } = await dialog.showSaveDialog(mainWindow()!, {
      title: currentLocale() === "zh" ? "导出配置" : "Export Config",
      defaultPath: "config-backup.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!filePath) return false;
    const cfg = appManager()?.getConfig();
    if (!cfg) return false;
    const safe = { ...cfg, aiProviders: cfg.aiProviders.map((p: any) => ({ ...p, apiKey: "***" })) };
    fs.writeFileSync(filePath, JSON.stringify(safe, null, 2), "utf-8");
    return true;
  }));
  ipcMain.handle("app:importConfig", wrapIPC(async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow()!, {
      title: currentLocale() === "zh" ? "导入配置" : "Import Config",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (!filePaths?.length) return null;
    const raw = fs.readFileSync(filePaths[0], "utf-8");
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(currentLocale() === "zh" ? "配置文件格式错误，请选择有效的 JSON 文件" : "Invalid config file format. Please select a valid JSON file.");
    }
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new Error(currentLocale() === "zh" ? "配置文件结构无效" : "Invalid config file structure");
    }
    if (!data.aiProviders && !data.activeProviderId) {
      throw new Error(currentLocale() === "zh"
        ? "配置文件结构不正确，缺少必要字段"
        : "Invalid config file structure, missing required fields");
    }
    appManager()?.setConfig(data);
    return appManager()?.getConfig();
  }));

  ipcMain.handle("app:parseDocument", wrapIPC(async (_e: any, p: string) => {
    const filePath = assertTrustedReadPath(p, currentLocale() === "zh" ? "文档文件" : "Document file");
    assertAllowedExtension(filePath, currentLocale() === "zh" ? "文档文件" : "Document file", ALLOWED_DOCUMENT_EXTENSIONS, currentLocale());
    assertExistingFile(filePath, currentLocale() === "zh" ? "文档文件" : "Document file");
    return appManager()?.parseDocument(filePath);
  }));
  ipcMain.handle("app:selectFile", wrapIPC(async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow()!, {
      title: currentLocale() === "zh" ? "选择文档" : "Select Document",
      filters: [{ name: currentLocale() === "zh" ? "文档" : "Documents", extensions: ["docx", "xlsx", "pdf", "md", "txt"] }],
      properties: ["openFile"],
    });
    return filePaths?.[0] ? trustFilePath(filePaths[0]) : null;
  }));

  ipcMain.handle("app:selectImages", wrapIPC(async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow()!, {
      title: currentLocale() === "zh" ? "选择图片" : "Select Images",
      filters: [{ name: currentLocale() === "zh" ? "图片" : "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] }],
      properties: ["openFile", "multiSelections"],
    });
    return (filePaths || []).map((filePath) => trustFilePath(filePath));
  }));

  ipcMain.handle("app:readImageAsBase64", wrapIPC(async (_e: any, filePath: string) => {
    if (!filePath) return null;
    const safePath = assertTrustedReadPath(filePath, currentLocale() === "zh" ? "图片文件" : "Image file");
    assertAllowedExtension(safePath, currentLocale() === "zh" ? "图片文件" : "Image file", ALLOWED_IMAGE_EXTENSIONS, currentLocale());
    assertExistingFile(safePath, currentLocale() === "zh" ? "图片文件" : "Image file");
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
    const { filePaths } = await dialog.showOpenDialog(mainWindow()!, {
      title: title || (currentLocale() === "zh" ? "选择目录" : "Select Directory"),
      properties: ["openDirectory"],
    });
    return filePaths?.[0] ? trustDirectoryPath(filePaths[0]) : null;
  }));
}
