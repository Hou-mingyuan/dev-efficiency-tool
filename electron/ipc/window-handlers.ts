import { BrowserWindow, ipcMain } from "electron";
import type { WrapIPC } from "./types";

export interface RegisterWindowHandlersOptions {
  wrapIPC: WrapIPC;
}

export function registerWindowHandlers(options: RegisterWindowHandlersOptions): void {
  const { wrapIPC } = options;

  ipcMain.handle("win:minimize", wrapIPC(async () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  }));

  ipcMain.handle("win:maximize", wrapIPC(async () => {
    const w = BrowserWindow.getFocusedWindow();
    if (w?.isMaximized()) w.unmaximize();
    else w?.maximize();
  }));

  ipcMain.handle("win:close", wrapIPC(async () => {
    BrowserWindow.getFocusedWindow()?.close();
  }));

  ipcMain.handle("win:isMaximized", wrapIPC(async () => {
    return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false;
  }));
}
