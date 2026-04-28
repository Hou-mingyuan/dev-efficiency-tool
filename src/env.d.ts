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

  interface AppConfig {
    methodologyPath: string;
    projectPath: string;
    outputPath: string;
    cachePath: string;
    aiProviders: AiProvider[];
    activeProviderId: string;
    customPrompts: Record<string, string>;
    projects?: ProjectProfile[];
    activeProjectId?: string;
    figmaConnector: FigmaConnectorConfig;
  }

  interface FigmaConnectorConfig {
    enabled: boolean;
    defaultFileName: string;
    mode: "plugin-json";
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
    format?: "md" | "docx" | "pdf" | "png" | "jpeg" | "gif" | "svg" | "html";
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

  type LogLevel = "info" | "warn" | "error";

  interface LogEntry {
    timestamp: string;
    level: LogLevel;
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
    win: {
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
    };
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
      deleteHistory: (id: string) => Promise<unknown>;
      onChunk: (callback: (chunk: string) => void) => IpcCleanup;
      offChunk: (cleanup?: IpcCleanup) => void;
      onDone: (callback: (content: string, recordId: string) => void) => IpcCleanup;
      offDone: (cleanup?: IpcCleanup) => void;
      testConnection: (provider: AiProvider) => Promise<unknown>;
      listModels: (provider: AiProvider) => Promise<string[] | IpcErrorResult>;
      analyzeUIPrompt: (req: {
        projectName?: string;
        userContent: string;
        providerId?: string;
        images?: Array<{ base64: string; mimeType: string }>;
        referenceContent?: string;
        projectPath?: string;
        isModuleScope?: boolean;
      }) => Promise<{ analyzedPrompt: string } | IpcErrorResult>;
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
        imageMode?: "fast" | "quality";
        analyzedPrompt?: string;
        referenceContent?: string;
        projectPath?: string;
      }) => Promise<{ htmlResult: string; savedFiles: string[]; recordId: string; pages?: Array<{ name: string; imagePath: string; htmlPath: string }> } | IpcErrorResult>;
      generateFigmaFile: (req: {
        projectName?: string;
        analyzedPrompt: string;
        providerId?: string;
        outputDir?: string;
        fileNameTemplate?: string;
        referenceContent?: string;
        projectPath?: string;
      }) => Promise<{ filePath: string; fileName: string; recordId: string; figmaJson: unknown } | IpcErrorResult>;
      onImageProgress: (callback: (progress: { stage: string; current: number; total: number; message: string }) => void) => () => void;
      offImageProgress: (cleanup?: IpcCleanup) => void;
      onPageReady: (callback: (page: { name: string; imagePath: string; htmlPath: string; index: number; total: number }) => void) => () => void;
      offPageReady: (cleanup?: IpcCleanup) => void;
      checkFilesExist: (paths: string[]) => Promise<Record<string, boolean>>;
    };
    app: {
      getConfig: () => Promise<AppConfig | IpcErrorResult>;
      setConfig: (config: AppConfig) => Promise<unknown>;
      onConfigChanged: (callback: (config: AppConfig) => void) => IpcCleanup;
      offConfigChanged: (cleanup?: IpcCleanup) => void;
      getLogs: () => Promise<LogEntry[] | IpcErrorResult>;
      clearLogs: () => Promise<unknown>;
      logRendererError: (payload: {
        level?: "error" | "warn";
        message?: string;
        stack?: string;
        source?: string;
        line?: number;
        column?: number;
        url?: string;
      }) => Promise<unknown>;
      getMethodologyFiles: () => Promise<unknown>;
      readMethodologyFile: (path: string) => Promise<unknown>;
      writeMethodologyFile: (path: string, content: string) => Promise<unknown>;
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

  type DocumentParseType = "markdown" | "docx" | "xlsx" | "pdf" | "unknown" | "error";

  interface DocumentParseResult {
    content: string;
    type: DocumentParseType;
  }

  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
