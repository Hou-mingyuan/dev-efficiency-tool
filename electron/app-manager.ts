import { safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ENCRYPTED_API_KEY_PREFIX = "__ENC__:";

export const MAX_GEN_HISTORY = 50;

export type AiProviderId =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "qwen"
  | "zhipu"
  | "moonshot"
  | "doubao"
  | "custom";

export interface AiProvider {
  id: AiProviderId;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

export interface ProjectProfile {
  id: string;
  name: string;
  projectPath: string;
  outputPath: string;
  methodologyPath: string;
}

export interface AppConfig {
  methodologyPath: string;
  projectPath: string;
  outputPath: string;
  cachePath: string;
  aiProviders: AiProvider[];
  activeProviderId: string;
  customPrompts: Record<string, string>;
  projects: ProjectProfile[];
  activeProjectId: string;
  figmaConnector: FigmaConnectorConfig;
}

export interface FigmaConnectorConfig {
  enabled: boolean;
  defaultFileName: string;
  mode: "plugin-json";
}

export const DEFAULT_AI_PROVIDERS: AiProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
    enabled: false,
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    apiKey: "",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-6",
    enabled: false,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    apiKey: "",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-v4-flash",
    enabled: false,
  },
  {
    id: "qwen",
    name: "通义千问 (Qwen)",
    apiKey: "",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.6-plus",
    enabled: false,
  },
  {
    id: "zhipu",
    name: "智谱 (GLM)",
    apiKey: "",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-5",
    enabled: false,
  },
  {
    id: "moonshot",
    name: "月之暗面 (Kimi)",
    apiKey: "",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "kimi-k2.6",
    enabled: false,
  },
  {
    id: "doubao",
    name: "豆包 (Doubao)",
    apiKey: "",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-2.0-pro",
    enabled: false,
  },
  {
    id: "custom",
    name: "自定义 (OpenAI 兼容)",
    apiKey: "",
    baseUrl: "",
    model: "",
    enabled: false,
  },
];

export const DEFAULT_APP_CONFIG: AppConfig = {
  methodologyPath: "",
  projectPath: "",
  outputPath: "",
  cachePath: "",
  aiProviders: DEFAULT_AI_PROVIDERS,
  activeProviderId: "",
  customPrompts: {},
  projects: [],
  activeProjectId: "",
  figmaConnector: {
    enabled: false,
    defaultFileName: "{projectName}-UI设计-{timestamp}",
    mode: "plugin-json",
  },
};

function cloneAppConfig(config: AppConfig): AppConfig {
  return {
    ...config,
    aiProviders: (config.aiProviders ?? DEFAULT_AI_PROVIDERS).map((provider) => ({ ...provider })),
    customPrompts: { ...(config.customPrompts ?? {}) },
    projects: (config.projects ?? []).map((project) => ({ ...project })),
    figmaConnector: {
      ...DEFAULT_APP_CONFIG.figmaConnector,
      ...(config.figmaConnector ?? {}),
    },
  };
}

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  source: string;
}

export interface MethodologyFileInfo {
  name: string;
  path: string;
  size: number;
}

export type DocumentParseType = "markdown" | "docx" | "xlsx" | "pdf" | "unknown" | "error";

export interface DocumentParseResult {
  content: string;
  type: DocumentParseType;
}

export interface GenerationRecord {
  id: string;
  docType: string;
  projectName: string;
  createdAt: string;
  preview: string;
  outputPath?: string;
}

export function isPathWithinBase(baseDir: string, candidatePath: string): boolean {
  if (!baseDir) return false;
  const baseResolved = path.resolve(baseDir);
  const targetResolved = path.resolve(candidatePath);
  if (targetResolved === baseResolved) return true;
  const rel = path.relative(baseResolved, targetResolved);
  if (!rel) return true;
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

export interface AppManagerOptions {
  appDataDir?: string;
  detectMethodologyPath?: boolean;
}

export class AppManager {
  static readonly LOG_ROTATE_BYTES = 5 * 1024 * 1024;

  logs: LogEntry[] = [];
  config: AppConfig;

  private readonly configPath: string;
  private readonly appLogFile: string;
  private readonly genHistoryPath: string;
  private warnedPlaintextApiKey = false;

  constructor(options: AppManagerOptions = {}) {
    const appData = options.appDataDir ?? path.join(os.homedir(), ".lng-methodology-desktop");
    this.configPath = path.join(appData, "config.json");
    this.appLogFile = path.join(appData, "app.log");
    this.genHistoryPath = path.join(appData, "gen-history.json");
    this.config = this.loadConfig();
    if (options.detectMethodologyPath !== false) {
      this.detectMethodologyPath();
    }
  }

  decryptProviderApiKey(stored: string | undefined): string {
    if (!stored || !stored.startsWith(ENCRYPTED_API_KEY_PREFIX)) return stored ?? "";
    if (!safeStorage.isEncryptionAvailable()) {
      this.addLog("warn", "无法解密 API Key：本机安全存储不可用", "config");
      return "";
    }
    try {
      const b64 = stored.slice(ENCRYPTED_API_KEY_PREFIX.length);
      const buf = Buffer.from(b64, "base64");
      return safeStorage.decryptString(buf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.addLog("warn", `API Key 解密失败: ${msg}`, "config");
      return "";
    }
  }

  loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, "utf-8");
        const parsed = { ...DEFAULT_APP_CONFIG, ...JSON.parse(raw) } as AppConfig;
        parsed.figmaConnector = {
          ...DEFAULT_APP_CONFIG.figmaConnector,
          ...(parsed.figmaConnector ?? {}),
        };
        if (Array.isArray(parsed.aiProviders)) {
          parsed.aiProviders = parsed.aiProviders.map((p) => ({
            ...p,
            apiKey: this.decryptProviderApiKey(p.apiKey ?? ""),
          }));
        }
        return parsed;
      }
    } catch {
      this.addLog("warn", "配置文件加载失败，使用默认配置", "config");
    }
    return {
      ...DEFAULT_APP_CONFIG,
      aiProviders: DEFAULT_AI_PROVIDERS.map((p) => ({ ...p })),
    };
  }

  saveConfig(): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const toSave: AppConfig = {
      ...this.config,
      aiProviders: this.config.aiProviders.map((p) => {
        if (!p.apiKey) return { ...p, apiKey: "" };
        if (safeStorage.isEncryptionAvailable()) {
          const enc = safeStorage.encryptString(p.apiKey);
          return { ...p, apiKey: `${ENCRYPTED_API_KEY_PREFIX}${enc.toString("base64")}` };
        }
        if (!this.warnedPlaintextApiKey) {
          this.warnedPlaintextApiKey = true;
          this.addLog("warn", "本机未启用安全存储，API Key 以明文保存", "config");
        }
        return { ...p };
      }),
    };
    fs.writeFileSync(this.configPath, JSON.stringify(toSave, null, 2), "utf-8");
  }

  detectMethodologyPath(): void {
    if (this.config.methodologyPath && fs.existsSync(this.config.methodologyPath)) return;

    const candidates = [
      path.join(process.resourcesPath || "", "methodology-core"),
      path.join(__dirname, "..", "methodology-core"),
      path.join(process.resourcesPath || "", "mcp-core"),
      path.join(__dirname, "..", "mcp-core"),
      path.resolve(__dirname, "../../lng-methodology-mcp"),
      path.resolve(__dirname, "../../lng-team-methodology-mcp-0.5.0/package"),
    ];

    for (const base of candidates) {
      const entry = path.join(base, "dist", "index.js");
      if (fs.existsSync(entry)) {
        this.config.methodologyPath = base;
        this.saveConfig();
        this.addLog("info", `方法论路径已自动检测: ${base}`, "config");
        return;
      }
    }

    try {
      const npmRoot = execSync("npm root -g", { encoding: "utf-8" }).trim();
      const globalPkg = path.join(npmRoot, "@lng-team", "methodology-mcp");
      if (fs.existsSync(path.join(globalPkg, "dist", "index.js"))) {
        this.config.methodologyPath = globalPkg;
        this.saveConfig();
        this.addLog("info", `方法论路径已从全局 npm 检测: ${globalPkg}`, "config");
        return;
      }
    } catch {
      /* ignore */
    }

    this.addLog("warn", "未找到方法论路径，请在设置中手动配置", "config");
  }

  private appendPersistentLogLine(line: string): void {
    try {
      const logDir = path.dirname(this.appLogFile);
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      if (
        fs.existsSync(this.appLogFile) &&
        fs.statSync(this.appLogFile).size > AppManager.LOG_ROTATE_BYTES
      ) {
        const oldPath = `${this.appLogFile}.old`;
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        fs.renameSync(this.appLogFile, oldPath);
      }
      fs.appendFileSync(this.appLogFile, line + "\n", "utf-8");
    } catch {
      /* ignore */
    }
  }

  addLog(level: LogLevel, message: string, source: string): void {
    const timestamp = new Date().toISOString();
    this.logs.push({ timestamp, level, message, source });
    if (this.logs.length > 5000) this.logs = this.logs.slice(-3000);
    this.appendPersistentLogLine(
      `[${timestamp}] [${level.toUpperCase()}] [${source}] ${message}`,
    );
  }

  getLogs(): LogEntry[] {
    return this.logs.slice(-500);
  }

  clearLogs(): void {
    this.logs = [];
    try {
      const logDir = path.dirname(this.appLogFile);
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      fs.writeFileSync(this.appLogFile, "", "utf-8");
    } catch {
      /* ignore */
    }
  }

  getConfig(): AppConfig {
    return cloneAppConfig(this.config);
  }

  setConfig(partial: Partial<AppConfig>): AppConfig {
    this.config = cloneAppConfig({ ...this.config, ...partial });
    this.saveConfig();
    this.addLog("info", "配置已更新", "config");
    return cloneAppConfig(this.config);
  }

  getMethodologyFiles(): MethodologyFileInfo[] {
    const dir = path.join(this.config.methodologyPath, "methodology");
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((name) => {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        return { name, path: full, size: st.size };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  readMethodologyFile(filePath: string): string {
    if (!this.config.methodologyPath) return "未配置方法论目录";
    if (!isPathWithinBase(this.config.methodologyPath, filePath)) {
      this.addLog("warn", `拒绝访问方法论路径外文件: ${filePath}`, "editor");
      return "无效的文件路径";
    }
    if (!fs.existsSync(filePath)) return "文件不存在";
    return fs.readFileSync(filePath, "utf-8");
  }

  writeMethodologyFile(filePath: string, content: string): boolean {
    if (!this.config.methodologyPath) {
      this.addLog("error", "未配置方法论目录，无法保存", "editor");
      return false;
    }
    if (!isPathWithinBase(this.config.methodologyPath, filePath)) {
      this.addLog("warn", `拒绝写入方法论路径外文件: ${filePath}`, "editor");
      return false;
    }
    try {
      fs.writeFileSync(filePath, content, "utf-8");
      this.addLog("info", `方法论文件已保存: ${path.basename(filePath)}`, "editor");
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.addLog("error", `保存失败: ${msg}`, "editor");
      return false;
    }
  }

  getActiveProvider(): AiProvider | null {
    const { activeProviderId, aiProviders } = this.config;
    const found =
      aiProviders.find((p) => p.id === activeProviderId && p.enabled && p.apiKey) ?? null;
    if (!found) {
      this.addLog("info", "无匹配的活动 AI 服务商（未启用、未选或未配置 API Key）", "config");
    }
    return found;
  }

  getGenerationHistory(): GenerationRecord[] {
    try {
      if (fs.existsSync(this.genHistoryPath)) {
        const raw = fs.readFileSync(this.genHistoryPath, "utf-8");
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr)) {
          return arr.filter(
            (o): o is GenerationRecord =>
              o &&
              typeof o === "object" &&
              typeof (o as GenerationRecord).id === "string" &&
              typeof (o as GenerationRecord).createdAt === "string",
          );
        }
      }
    } catch {
      this.addLog("warn", "生成历史文件读取失败", "gen-history");
    }
    return [];
  }

  addGenerationRecord(record: GenerationRecord): void {
    const prev = this.getGenerationHistory();
    const next = [record, ...prev.filter((r) => r.id !== record.id)].slice(0, MAX_GEN_HISTORY);
    try {
      const dir = path.dirname(this.genHistoryPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.genHistoryPath, JSON.stringify(next, null, 2), "utf-8");
      this.addLog(
        "info",
        `生成记录已保存: ${record.docType} - ${record.projectName || "未命名"}`,
        "gen-history",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.addLog("warn", `保存生成历史失败: ${msg}`, "gen-history");
    }
  }

  deleteGenerationRecord(id: string): void {
    const list = this.getGenerationHistory();
    const filtered = list.filter((r) => r.id !== id);
    if (filtered.length === list.length) return;
    try {
      const dir = path.dirname(this.genHistoryPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.genHistoryPath, JSON.stringify(filtered, null, 2), "utf-8");
      this.addLog("info", `已删除生成记录: ${id}`, "gen-history");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.addLog("warn", `删除生成记录失败: ${msg}`, "gen-history");
    }
  }

  updateGenerationOutputPath(id: string, outputPath: string): void {
    const list = this.getGenerationHistory();
    const i = list.findIndex((r) => r.id === id);
    if (i < 0) return;
    const updated: GenerationRecord = { ...list[i], outputPath };
    this.addGenerationRecord(updated);
  }

  async parseDocument(filePath: string): Promise<DocumentParseResult> {
    const ext = path.extname(filePath).toLowerCase();
    try {
      if (ext === ".md" || ext === ".txt") {
        return { content: fs.readFileSync(filePath, "utf-8"), type: "markdown" };
      }
      if (ext === ".docx") {
        const mammoth = await import("mammoth");
        const buffer = fs.readFileSync(filePath);
        const { value } = await mammoth.default.extractRawText({ buffer });
        return { content: value, type: "docx" };
      }
      if (ext === ".pdf") {
        const { PDFParse } = await import("pdf-parse");
        const buffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        try {
          const result = await parser.getText();
          return { content: result.text, type: "pdf" };
        } finally {
          await parser.destroy();
        }
      }
      if (ext === ".xlsx" || ext === ".xls") {
        const XLSX = await import("xlsx");
        const wb = XLSX.default.readFile(filePath);
        const parts: string[] = [];
        for (const sheetName of wb.SheetNames) {
          const csv = XLSX.default.utils.sheet_to_csv(wb.Sheets[sheetName]!);
          parts.push(`## Sheet: ${sheetName}\n\n${csv}`);
        }
        return {
          content: parts.join("\n\n---\n\n"),
          type: "xlsx",
        };
      }
      return { content: "不支持的文件格式: " + ext, type: "unknown" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.addLog("error", `文档解析失败: ${msg}`, "parser");
      return { content: `解析失败: ${msg}`, type: "error" };
    }
  }
}
