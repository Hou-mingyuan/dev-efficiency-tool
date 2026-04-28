import { ipcMain } from "electron";
import type { AppManager } from "../app-manager";
import type { ProjectAnalyzer } from "../project-analyzer";
import type { WrapIPC } from "./types";

export interface RegisterProjectHandlersOptions {
  appManager: () => AppManager | null;
  currentLocale: () => string;
  projectAnalyzer: ProjectAnalyzer;
  wrapIPC: WrapIPC;
}

export function registerProjectHandlers(options: RegisterProjectHandlersOptions): void {
  const { appManager, currentLocale, projectAnalyzer, wrapIPC } = options;

  ipcMain.handle("project:analyze", wrapIPC(async (_e: any, projectPath: string) => {
    if (!projectPath) {
      throw new Error(currentLocale() === "zh" ? "未指定项目路径" : "No project path specified");
    }
    const result = projectAnalyzer.analyze(projectPath);
    appManager()?.addLog(
      "info",
      `项目分析完成: ${projectPath} (${result.structure.totalFiles} 文件)`,
      "project-analyzer",
    );
    return result;
  }));

  ipcMain.handle("project:getCache", wrapIPC(async (_e: any, projectPath: string) => {
    return projectAnalyzer.getCache(projectPath);
  }));

  ipcMain.handle("project:getCacheInfo", wrapIPC(async (_e: any, projectPath: string) => {
    return projectAnalyzer.getCacheInfo(projectPath);
  }));

  ipcMain.handle("project:isCacheValid", wrapIPC(async (_e: any, projectPath: string) => {
    return projectAnalyzer.isCacheValid(projectPath);
  }));

  ipcMain.handle("project:clearCache", wrapIPC(async (_e: any, projectPath: string) => {
    const cleared = projectAnalyzer.clearCache(projectPath);
    if (cleared) {
      appManager()?.addLog("info", `已清除项目缓存: ${projectPath}`, "project-analyzer");
    }
    return cleared;
  }));

  ipcMain.handle("project:clearAllCaches", wrapIPC(async () => {
    const count = projectAnalyzer.clearAllCaches();
    appManager()?.addLog("info", `已清除全部项目缓存 (${count} 个)`, "project-analyzer");
    return count;
  }));

  ipcMain.handle("project:getCacheDir", wrapIPC(async () => {
    return projectAnalyzer.cacheDir;
  }));

  ipcMain.handle("project:setCacheDir", wrapIPC(async (_e: any, dir: string) => {
    projectAnalyzer.setCacheDir(dir || null);
    appManager()?.addLog("info", `缓存目录已更新: ${projectAnalyzer.cacheDir}`, "project-analyzer");
    return projectAnalyzer.cacheDir;
  }));

  ipcMain.handle("project:formatForPrompt", wrapIPC(async (_e: any, projectPath: string, docType: string) => {
    const cached = projectAnalyzer.getOrAnalyze(projectPath);
    return projectAnalyzer.formatForPrompt(cached, docType);
  }));
}
