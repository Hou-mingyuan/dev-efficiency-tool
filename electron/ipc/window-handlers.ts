import { BrowserWindow, ipcMain } from "electron";

export function registerWindowHandlers(): void {
  ipcMain.handle("win:minimize", () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });

  ipcMain.handle("win:maximize", () => {
    const w = BrowserWindow.getFocusedWindow();
    if (w?.isMaximized()) w.unmaximize();
    else w?.maximize();
  });

  ipcMain.handle("win:close", () => {
    BrowserWindow.getFocusedWindow()?.close();
  });

  ipcMain.handle("win:isMaximized", () => {
    return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false;
  });
}
