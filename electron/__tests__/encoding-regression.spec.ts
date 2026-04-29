import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const SCAN_DIRS = ["src", "electron"];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".vue", ".less", ".json"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "dist-electron", "release", ".git"]);

const MOJIBAKE_PATTERNS = [
  /銆/,
  /�/,
  /俙/,
  /筣/,
  /綸/,
  /鏂囨/,
  /涓嶆/,
  /淇濆/,
  /鍥炬/,
  /宸蹭/,
  /鐢ㄦ/,
  /璇峰/,
  /杈撳/,
  /妯″/,
  /绯荤/,
];

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (SCAN_EXTENSIONS.has(path.extname(entry.name))) files.push(fullPath);
  }

  return files;
}

describe("source encoding regression", () => {
  it("does not contain common mojibake fragments in user-facing source files", () => {
    const files = SCAN_DIRS.flatMap((dir) => collectSourceFiles(path.join(ROOT, dir)));
    const offenders: string[] = [];

    for (const file of files) {
      if (path.basename(file) === "encoding-regression.spec.ts") continue;
      const content = fs.readFileSync(file, "utf-8");
      const matched = MOJIBAKE_PATTERNS.filter((pattern) => pattern.test(content));
      if (matched.length) {
        offenders.push(path.relative(ROOT, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
