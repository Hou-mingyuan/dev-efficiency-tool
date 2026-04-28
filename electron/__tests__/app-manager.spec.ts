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
});
