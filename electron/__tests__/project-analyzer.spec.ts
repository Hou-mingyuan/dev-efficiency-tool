import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectAnalyzer } from "../project-analyzer";

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
});

describe("ProjectAnalyzer", () => {
  it("detects project structure, tech stack, styles and prompt context", () => {
    const projectDir = makeTempDir("project");
    const cacheDir = makeTempDir("cache");

    fs.mkdirSync(path.join(projectDir, "src", "styles"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "package.json"),
      JSON.stringify({
        dependencies: {
          vue: "^3.5.0",
          "ant-design-vue": "^4.2.0",
          pinia: "^2.1.0",
        },
        devDependencies: {
          vite: "^6.0.0",
          typescript: "^5.8.0",
        },
      }),
      "utf-8",
    );
    fs.writeFileSync(path.join(projectDir, "src", "App.vue"), "<template><main /></template>", "utf-8");
    fs.writeFileSync(
      path.join(projectDir, "src", "styles", "variables.less"),
      ":root { --brand-color: #1677ff; }\n.page { display: flex; font-family: Inter, sans-serif; }",
      "utf-8",
    );

    const analyzer = new ProjectAnalyzer(cacheDir);
    const result = analyzer.analyze(projectDir);

    expect(result.structure.totalFiles).toBeGreaterThanOrEqual(3);
    expect(result.structure.tree).toContain("package.json");
    expect(result.techStack.frameworks).toEqual(expect.arrayContaining(["Vue 3", "Ant Design", "Pinia"]));
    expect(result.techStack.buildTools).toEqual(expect.arrayContaining(["Vite", "TypeScript"]));
    expect(result.styleAnalysis.componentLibrary).toBe("Ant Design");
    expect(result.styleAnalysis.cssVariables["--brand-color"]).toBe("#1677ff");
    expect(result.styleAnalysis.layoutPatterns).toContain("Flexbox");
    expect(analyzer.isCacheValid(projectDir)).toBe(true);

    const promptContext = analyzer.formatForPrompt(result, "ui");
    expect(promptContext).toContain("项目分析上下文");
    expect(promptContext).toContain("样式风格分析");
    expect(promptContext).toContain("#1677ff");
  });
});
