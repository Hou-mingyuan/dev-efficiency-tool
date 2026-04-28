export interface IpcErrorResult {
  __ipcError: true;
  message: string;
}

export type WrapIPC = <T extends (...args: any[]) => any>(
  fn: T,
) => (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | IpcErrorResult>;
