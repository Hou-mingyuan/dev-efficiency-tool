import { ipcMain } from "electron";
import fs from "node:fs";
import type { AppManager } from "../app-manager";
import type { WrapIPC } from "./types";

export interface RegisterHistoryHandlersOptions {
  appManager: () => AppManager | null;
  currentLocale: () => string;
  wrapIPC: WrapIPC;
  sanitizeGenerationRecord: (record: any) => any;
  assertTrustedReadPath: (filePath: string, label: string) => string;
  assertExistingFile: (filePath: string, label: string) => string;
  assertTrustedHistoryOutputPath: (filePath: unknown, label: string) => string | undefined;
}

export function registerHistoryHandlers(options: RegisterHistoryHandlersOptions): void {
  const {
    appManager,
    currentLocale,
    wrapIPC,
    sanitizeGenerationRecord,
    assertTrustedReadPath,
    assertExistingFile,
    assertTrustedHistoryOutputPath,
  } = options;

  ipcMain.handle("ai:getHistory", wrapIPC(async () => appManager()?.getGenerationHistory() ?? []));
  ipcMain.handle("ai:addHistory", wrapIPC(async (_e: any, record: any) => {
    appManager()?.addGenerationRecord(sanitizeGenerationRecord(record));
  }));
  ipcMain.handle("ai:deleteHistory", wrapIPC(async (_e: any, id: string) => {
    appManager()?.deleteGenerationRecord(id);
    return true;
  }));
  ipcMain.handle("ai:readOutputFile", wrapIPC(async (_e: any, p: string) => {
    if (!p) return null;
    const filePath = assertTrustedReadPath(p, currentLocale() === "zh" ? "输出文件" : "Output file");
    if (!fs.existsSync(filePath)) return null;
    assertExistingFile(filePath, currentLocale() === "zh" ? "输出文件" : "Output file");
    return fs.readFileSync(filePath, "utf-8");
  }));
  ipcMain.handle("ai:updateHistoryOutput", wrapIPC(async (_e: any, data: any) => {
    if (!data || typeof data !== "object" || typeof data.id !== "string") {
      throw new Error(currentLocale() === "zh" ? "生成记录无效" : "Invalid generation record");
    }
    const outputPath = assertTrustedHistoryOutputPath(
      data.outputPath,
      currentLocale() === "zh" ? "历史输出文件" : "History output file",
    );
    if (!outputPath) {
      throw new Error(currentLocale() === "zh" ? "未指定历史输出文件" : "No history output file specified");
    }
    appManager()?.updateGenerationOutputPath(data.id, outputPath);
  }));
}
