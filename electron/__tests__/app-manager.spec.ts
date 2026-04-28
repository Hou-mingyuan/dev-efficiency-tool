import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(`encrypted:${value}`, "utf-8")),
    decryptString: vi.fn((value: Buffer) => value.toString("utf-8").replace(/^encrypted:/, "")),
  },
}));

const { pdfDestroyMock, pdfGetTextMock } = vi.hoisted(() => ({
  pdfDestroyMock: vi.fn(async () => undefined),
  pdfGetTextMock: vi.fn(async () => ({ text: "PDF 提取文本", total: 1, pages: [{ num: 1, text: "PDF 提取文本" }] })),
}));

vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: pdfGetTextMock,
    destroy: pdfDestroyMock,
  })),
}));

const tempRoots: string[] = [];

function makeTempDir(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `methodology-${name}-`));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  vi.clearAllMocks();
});

describe("isPathWithinBase", () => {
  it("allows the base path itself and descendants", async () => {
    const { isPathWithinBase } = await import("../app-manager");
    const base = path.join("D:", "workspace", "project");

    expect(isPathWithinBase(base, base)).toBe(true);
    expect(isPathWithinBase(base, path.join(base, "src", "index.ts"))).toBe(true);
  });

  it("rejects sibling paths and traversal outside the base path", async () => {
    const { isPathWithinBase } = await import("../app-manager");
    const base = path.join("D:", "workspace", "project");

    expect(isPathWithinBase(base, path.join("D:", "workspace", "project-other", "index.ts"))).toBe(false);
    expect(isPathWithinBase(base, path.join(base, "..", "secret.txt"))).toBe(false);
  });
});

describe("AppManager config persistence", () => {
  it("encrypts API keys on disk and decrypts them when loading config", async () => {
    const { AppManager, DEFAULT_AI_PROVIDERS, ENCRYPTED_API_KEY_PREFIX } = await import("../app-manager");
    const appDataDir = makeTempDir("app-manager");
    const provider = {
      ...DEFAULT_AI_PROVIDERS[0],
      apiKey: "sk-test-secret",
      enabled: true,
    };

    const manager = new AppManager({ appDataDir, detectMethodologyPath: false });
    manager.setConfig({
      activeProviderId: provider.id,
      aiProviders: [provider],
      outputPath: path.join(appDataDir, "output"),
    });

    const saved = JSON.parse(fs.readFileSync(path.join(appDataDir, "config.json"), "utf-8"));
    expect(saved.aiProviders[0].apiKey).toMatch(new RegExp(`^${ENCRYPTED_API_KEY_PREFIX}`));
    expect(saved.aiProviders[0].apiKey).not.toContain("sk-test-secret");

    const reloaded = new AppManager({ appDataDir, detectMethodologyPath: false });
    expect(reloaded.getConfig().aiProviders[0].apiKey).toBe("sk-test-secret");
    expect(reloaded.getConfig().outputPath).toBe(path.join(appDataDir, "output"));
  });

  it("does not expose mutable internal config references", async () => {
    const { AppManager, DEFAULT_AI_PROVIDERS } = await import("../app-manager");
    const appDataDir = makeTempDir("app-manager");
    const provider = {
      ...DEFAULT_AI_PROVIDERS[0],
      apiKey: "sk-original",
      enabled: true,
    };
    const projects = [{
      id: "p1",
      name: "项目一",
      projectPath: path.join(appDataDir, "project"),
      outputPath: path.join(appDataDir, "output"),
      methodologyPath: path.join(appDataDir, "methodology"),
    }];

    const manager = new AppManager({ appDataDir, detectMethodologyPath: false });
    const saved = manager.setConfig({
      aiProviders: [provider],
      customPrompts: { prd: "original prompt" },
      projects,
    });

    saved.aiProviders[0].apiKey = "mutated-return";
    saved.customPrompts.prd = "mutated prompt";
    saved.projects[0].name = "被外部修改";

    const fromGetter = manager.getConfig();
    fromGetter.aiProviders[0].apiKey = "mutated-getter";
    fromGetter.customPrompts.prd = "mutated getter prompt";
    fromGetter.projects[0].name = "再次修改";

    const current = manager.getConfig();
    expect(current.aiProviders[0].apiKey).toBe("sk-original");
    expect(current.customPrompts.prd).toBe("original prompt");
    expect(current.projects[0].name).toBe("项目一");

    provider.apiKey = "mutated-input";
    projects[0].name = "输入对象被修改";

    const afterInputMutation = manager.getConfig();
    expect(afterInputMutation.aiProviders[0].apiKey).toBe("sk-original");
    expect(afterInputMutation.projects[0].name).toBe("项目一");
  });
});

describe("AppManager logs", () => {
  it("clears both memory logs and the persistent log file", async () => {
    const { AppManager } = await import("../app-manager");
    const appDataDir = makeTempDir("app-manager");
    const manager = new AppManager({ appDataDir, detectMethodologyPath: false });

    manager.addLog("error", "测试错误", "test");
    expect(manager.getLogs()).toHaveLength(1);
    expect(fs.readFileSync(path.join(appDataDir, "app.log"), "utf-8")).toContain("测试错误");

    manager.clearLogs();

    expect(manager.getLogs()).toHaveLength(0);
    expect(fs.readFileSync(path.join(appDataDir, "app.log"), "utf-8")).toBe("");
  });
});

describe("AppManager document parsing", () => {
  it("extracts PDF text and releases the parser", async () => {
    const { AppManager } = await import("../app-manager");
    const appDataDir = makeTempDir("app-manager");
    const docsDir = makeTempDir("docs");
    const pdfPath = path.join(docsDir, "sample.pdf");
    fs.writeFileSync(pdfPath, Buffer.from("%PDF-1.4\n", "utf-8"));

    const manager = new AppManager({ appDataDir, detectMethodologyPath: false });
    const result = await manager.parseDocument(pdfPath);

    expect(result).toEqual({ content: "PDF 提取文本", type: "pdf" });
    expect(pdfGetTextMock).toHaveBeenCalledTimes(1);
    expect(pdfDestroyMock).toHaveBeenCalledTimes(1);
  });
});
