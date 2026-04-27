/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>;
  export default component;
}

type IpcCleanup = () => void;

declare global {
  interface AiProvider {
    id: string;
    name: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    enabled: boolean;
  }

  interface ProjectProfile {
    id: string;
    name: string;
    projectPath: string;
    outputPath: string;
    methodologyPath: string;
  }

  interface McpConfig {
    port: number;
    transport: string;
    methodologyPath: string;
    projectPath: string;
    outputPath: string;
    cachePath: string;
    autoStart: boolean;
    aiProviders: AiProvider[];
    activeProviderId: string;
    customPrompts: Record<string, string>;
    projects?: ProjectProfile[];
    activeProjectId?: string;
  }

  type DocType = "prd" | "requirements" | "ui" | "design" | (string & {});

  interface GenerateRequest {
    docType: DocType;
    projectName: string;
    userContent: string;
    referenceContent: string;
    providerId?: string;
    projectPath?: string;
  }

  interface SaveDocumentRequest {
    outputDir: string;
    fileName: string;
    content: string;
    historyRecordId?: string;
    format?: "md" | "docx" | "pdf";
  }

  interface IpcErrorResult {
    __ipcError: true;
    message: string;
  }

  interface GenerationRecord {
    id: string;
    docType: string;
    projectName: string;
    createdAt: string;
    preview: string;
    outputPath?: string;
  }

  interface McpStatus {
    running: boolean;
    pid: number | null;
    port: number;
    transport: string;
    uptime: number;
    startedAt: string | null;
    toolCallCount: number;
  }

  type McpLogLevel = "info" | "warn" | "error";

  interface McpLogEntry {
    timestamp: string;
    level: McpLogLevel;
    message: string;
    source: string;
  }

  interface ProjectCacheInfo {
    projectPath: string;
    analyzedAt: string;
    expired: boolean;
    cacheFile: string;
    sizeBytes: number;
  }

  interface ElectronAPI {
    project: {
      analyze: (projectPath: string) => Promise<unknown | IpcErrorResult>;
      getCache: (projectPath: string) => Promise<unknown | null>;
      getCacheInfo: (projectPath: string) => Promise<ProjectCacheInfo | null>;
      isCacheValid: (projectPath: string) => Promise<boolean>;
      clearCache: (projectPath: string) => Promise<boolean>;
      clearAllCaches: () => Promise<number>;
      getCacheDir: () => Promise<string>;
      setCacheDir: (dir: string) => Promise<string>;
      formatForPrompt: (projectPath: string, docType: string) => Promise<string>;
    };
    ai: {
      generate: (req: GenerateRequest) => Promise<string | IpcErrorResult>;
      stopGenerate: () => Promise<void>;
      saveDocument: (req: SaveDocumentRequest) => Promise<string | IpcErrorResult | null>;
      getHistory: () => Promise<GenerationRecord[] | IpcErrorResult>;
      addHistory: (record: GenerationRecord) => Promise<unknown>;
      readOutputFile: (path: string) => Promise<string | null | IpcErrorResult>;
      updateHistoryOutput: (data: { id: string; outputPath: string }) => Promise<unknown>;
      onChunk: (callback: (chunk: string) => void) => IpcCleanup;
      offChunk: () => void;
      onDone: (callback: (content: string, recordId: string) => void) => IpcCleanup;
      offDone: () => void;
      testConnection: (provider: AiProvider) => Promise<unknown>;
      listModels: (provider: AiProvider) => Promise<string[] | IpcErrorResult>;
      renderHtmlToImage: (req: {
        htmlCode: string;
        outputDir: string;
        fileName: string;
        format: "png" | "jpeg" | "gif";
      }) => Promise<string | IpcErrorResult>;
      generateUIImage: (req: {
        projectName?: string;
        userContent: string;
        providerId?: string;
        images?: Array<{ base64: string; mimeType: string }>;
        outputDir?: string;
        imageFormat?: "png" | "jpeg";
        referenceContent?: string;
        projectPath?: string;
      }) => Promise<{ htmlResult: string; savedFiles: string[]; recordId: string; pages?: Array<{ name: string; imagePath: string; htmlPath: string }> } | IpcErrorResult>;
    };
    mcp: {
      getStatus: () => Promise<McpStatus | IpcErrorResult>;
      start: () => Promise<unknown>;
      stop: () => Promise<unknown>;
      getLogs: () => Promise<McpLogEntry[] | IpcErrorResult>;
      clearLogs: () => Promise<unknown>;
      getConfig: () => Promise<McpConfig | IpcErrorResult>;
      setConfig: (config: McpConfig) => Promise<unknown>;
      getMethodologyFiles: () => Promise<unknown>;
      readMethodologyFile: (path: string) => Promise<unknown>;
      writeMethodologyFile: (path: string, content: string) => Promise<unknown>;
      getIdeConfigs: () => Promise<unknown>;
      installToIde: (ideId: string) => Promise<unknown>;
      onConfigChanged: (callback: (config: McpConfig) => void) => IpcCleanup;
      offConfigChanged: () => void;
    };
    app: {
      openExternal: (url: string) => Promise<unknown>;
      getVersion: () => Promise<string | IpcErrorResult>;
      setAutoLaunch: (enabled: boolean) => Promise<unknown>;
      getAutoLaunch: () => Promise<unknown>;
      healthCheck: () => Promise<unknown>;
      exportLogs: () => Promise<unknown>;
      exportConfig: () => Promise<unknown>;
      importConfig: () => Promise<unknown>;
      parseDocument: (filePath: string) => Promise<DocumentParseResult | IpcErrorResult | null>;
      selectFile: () => Promise<string | null | IpcErrorResult>;
      selectImages: () => Promise<string[] | IpcErrorResult>;
      readImageAsBase64: (filePath: string) => Promise<{
        base64: string;
        mimeType: string;
        name: string;
        dataUrl: string;
      } | null | IpcErrorResult>;
      selectDirectory: (title?: string) => Promise<string | null | IpcErrorResult>;
      getTheme: () => Promise<"light" | "dark" | string | IpcErrorResult>;
      setTheme: (theme: string) => Promise<unknown>;
      checkForUpdates: () => Promise<unknown>;
      onUpdateAvailable: (callback: (info: unknown) => void) => IpcCleanup;
      openInWindow: (target: { path: string; title?: string } | string) => Promise<unknown>;
      setLocale: (locale: string) => Promise<unknown>;
      getLocale: () => Promise<string | IpcErrorResult>;
    };
  }

  type DocumentParseType = "markdown" | "docx" | "xlsx" | "unknown" | "error";

  interface DocumentParseResult {
    content: string;
    type: DocumentParseType;
  }

  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
