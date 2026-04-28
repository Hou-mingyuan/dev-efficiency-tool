import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".svn", ".hg", "dist", "build", "out",
  ".next", ".nuxt", ".output", "__pycache__", ".cache", ".turbo",
  "coverage", ".idea", ".vscode", ".cursor", "release", "vendor",
  "target", "bin", "obj", ".gradle", ".dart_tool",
]);

const STYLE_EXTENSIONS = new Set([
  ".css", ".less", ".scss", ".sass", ".styl", ".stylus",
]);

const CONFIG_FILES = new Set([
  "package.json", "tsconfig.json", "vite.config.ts", "vite.config.js",
  "webpack.config.js", "webpack.config.ts", "next.config.js", "next.config.ts",
  "nuxt.config.ts", "nuxt.config.js", "vue.config.js",
  ".eslintrc.json", ".eslintrc.js", "tailwind.config.js", "tailwind.config.ts",
  "pom.xml", "build.gradle", "Cargo.toml", "go.mod", "requirements.txt",
  "pyproject.toml", "Gemfile", "Dockerfile", "docker-compose.yml",
  "angular.json", ".env.example",
]);

const MAX_TREE_DEPTH = 5;
const MAX_STYLE_FILE_SIZE = 100 * 1024;
const MAX_CONFIG_FILE_SIZE = 50 * 1024;

export interface ProjectAnalysisResult {
  projectPath: string;
  analyzedAt: string;
  fileFingerprint: string;
  structure: {
    tree: string;
    totalFiles: number;
    totalDirs: number;
    filesByExtension: Record<string, number>;
  };
  techStack: {
    languages: string[];
    frameworks: string[];
    buildTools: string[];
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  configSummary: Record<string, string>;
  styleAnalysis: {
    cssVariables: Record<string, string>;
    fontFamilies: string[];
    colorPalette: string[];
    componentLibrary: string | null;
    layoutPatterns: string[];
    themeConfig: string | null;
  };
  moduleStructure: string[];
  apiEndpoints: string[];
}

export interface ProjectCacheInfo {
  projectPath: string;
  analyzedAt: string;
  expired: boolean;
  cacheFile: string;
  sizeBytes: number;
}

function hashPath(p: string): string {
  return crypto.createHash("md5").update(p.toLowerCase()).digest("hex").slice(0, 16);
}

function computeFingerprint(projectPath: string): string {
  const hash = crypto.createHash("sha256");
  const entries: string[] = [];

  function walk(dir: string, depth: number) {
    if (depth > 2) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (IGNORE_DIRS.has(item.name)) continue;
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          walk(full, depth + 1);
        } else if (item.isFile()) {
          try {
            const st = fs.statSync(full);
            entries.push(`${full}:${st.size}:${st.mtimeMs}`);
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  }

  walk(projectPath, 0);
  entries.sort();
  for (const e of entries) hash.update(e);
  return hash.digest("hex").slice(0, 24);
}

function buildTree(dir: string, prefix: string, depth: number): { text: string; files: number; dirs: number } {
  if (depth > MAX_TREE_DEPTH) return { text: `${prefix}...\n`, files: 0, dirs: 0 };

  let text = "";
  let files = 0;
  let dirs = 0;
  let items: fs.Dirent[];

  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { text, files, dirs };
  }

  items.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const filtered = items.filter((i) => !IGNORE_DIRS.has(i.name) && !i.name.startsWith("."));

  for (let i = 0; i < filtered.length; i++) {
    const item = filtered[i];
    const isLast = i === filtered.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = prefix + (isLast ? "    " : "│   ");

    if (item.isDirectory()) {
      dirs++;
      text += `${prefix}${connector}${item.name}/\n`;
      const sub = buildTree(path.join(dir, item.name), childPrefix, depth + 1);
      text += sub.text;
      files += sub.files;
      dirs += sub.dirs;
    } else {
      files++;
      text += `${prefix}${connector}${item.name}\n`;
    }
  }

  return { text, files, dirs };
}

function countFilesByExtension(dir: string, result: Record<string, number>, depth: number): void {
  if (depth > MAX_TREE_DEPTH) return;
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (IGNORE_DIRS.has(item.name)) continue;
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        countFilesByExtension(full, result, depth + 1);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase() || "(no ext)";
        result[ext] = (result[ext] || 0) + 1;
      }
    }
  } catch { /* skip */ }
}

function detectTechStack(projectPath: string): ProjectAnalysisResult["techStack"] {
  const languages: Set<string> = new Set();
  const frameworks: Set<string> = new Set();
  const buildTools: Set<string> = new Set();
  let deps: Record<string, string> = {};
  let devDeps: Record<string, string> = {};

  const pkgPath = path.join(projectPath, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      deps = pkg.dependencies ?? {};
      devDeps = pkg.devDependencies ?? {};
      languages.add("JavaScript/TypeScript");

      const allDeps = { ...deps, ...devDeps };
      if (allDeps.vue) frameworks.add("Vue " + (allDeps.vue.replace(/[^0-9.]/g, "").split(".")[0] || "3"));
      if (allDeps.react) frameworks.add("React");
      if (allDeps.next) frameworks.add("Next.js");
      if (allDeps.nuxt) frameworks.add("Nuxt");
      if (allDeps.angular || allDeps["@angular/core"]) frameworks.add("Angular");
      if (allDeps.svelte) frameworks.add("Svelte");
      if (allDeps.express) frameworks.add("Express");
      if (allDeps.koa) frameworks.add("Koa");
      if (allDeps.nestjs || allDeps["@nestjs/core"]) frameworks.add("NestJS");
      if (allDeps.electron) frameworks.add("Electron");
      if (allDeps["ant-design-vue"] || allDeps.antd) frameworks.add("Ant Design");
      if (allDeps["element-plus"] || allDeps["element-ui"]) frameworks.add("Element UI");
      if (allDeps["@arco-design/web-vue"]) frameworks.add("Arco Design");
      if (allDeps.tailwindcss) frameworks.add("Tailwind CSS");
      if (allDeps.bootstrap) frameworks.add("Bootstrap");
      if (allDeps.pinia) frameworks.add("Pinia");
      if (allDeps.vuex) frameworks.add("Vuex");

      if (allDeps.vite) buildTools.add("Vite");
      if (allDeps.webpack) buildTools.add("Webpack");
      if (allDeps.rollup) buildTools.add("Rollup");
      if (allDeps.esbuild) buildTools.add("esbuild");
      if (allDeps.typescript) buildTools.add("TypeScript");
      if (allDeps.vitest) buildTools.add("Vitest");
      if (allDeps.jest) buildTools.add("Jest");
    } catch { /* skip */ }
  }

  if (fs.existsSync(path.join(projectPath, "pom.xml"))) languages.add("Java");
  if (fs.existsSync(path.join(projectPath, "build.gradle"))) { languages.add("Java/Kotlin"); buildTools.add("Gradle"); }
  if (fs.existsSync(path.join(projectPath, "Cargo.toml"))) languages.add("Rust");
  if (fs.existsSync(path.join(projectPath, "go.mod"))) languages.add("Go");
  if (fs.existsSync(path.join(projectPath, "requirements.txt")) || fs.existsSync(path.join(projectPath, "pyproject.toml"))) {
    languages.add("Python");
  }

  return {
    languages: [...languages],
    frameworks: [...frameworks],
    buildTools: [...buildTools],
    dependencies: deps,
    devDependencies: devDeps,
  };
}

function readConfigSummary(projectPath: string): Record<string, string> {
  const summary: Record<string, string> = {};
  for (const name of CONFIG_FILES) {
    const fp = path.join(projectPath, name);
    if (!fs.existsSync(fp)) continue;
    try {
      const st = fs.statSync(fp);
      if (st.size > MAX_CONFIG_FILE_SIZE) {
        summary[name] = `[文件过大: ${Math.round(st.size / 1024)}KB, 已跳过]`;
        continue;
      }
      summary[name] = fs.readFileSync(fp, "utf-8");
    } catch { /* skip */ }
  }
  return summary;
}

function analyzeStyles(projectPath: string): ProjectAnalysisResult["styleAnalysis"] {
  const cssVariables: Record<string, string> = {};
  const fontFamilies: Set<string> = new Set();
  const colors: Set<string> = new Set();
  const layoutPatterns: Set<string> = new Set();
  let componentLibrary: string | null = null;
  let themeConfig: string | null = null;

  const pkgPath = path.join(projectPath, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps["ant-design-vue"] || allDeps.antd) componentLibrary = "Ant Design";
      else if (allDeps["element-plus"] || allDeps["element-ui"]) componentLibrary = "Element UI/Plus";
      else if (allDeps["@arco-design/web-vue"]) componentLibrary = "Arco Design";
      else if (allDeps["@mui/material"]) componentLibrary = "Material UI";
      else if (allDeps["naive-ui"]) componentLibrary = "Naive UI";
      else if (allDeps["@chakra-ui/react"]) componentLibrary = "Chakra UI";
    } catch { /* skip */ }
  }

  const varPattern = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+)/g;
  const fontPattern = /font-family\s*:\s*([^;]+)/gi;
  const colorHexPattern = /#(?:[0-9a-fA-F]{3,8})\b/g;
  const colorRgbPattern = /(?:rgba?|hsla?)\([^)]+\)/gi;

  function scanStyleFile(fp: string) {
    try {
      const st = fs.statSync(fp);
      if (st.size > MAX_STYLE_FILE_SIZE) return;
      const content = fs.readFileSync(fp, "utf-8");

      let m: RegExpExecArray | null;
      while ((m = varPattern.exec(content)) !== null) {
        cssVariables[`--${m[1]}`] = m[2].trim();
      }

      while ((m = fontPattern.exec(content)) !== null) {
        fontFamilies.add(m[1].trim().replace(/['"]/g, ""));
      }

      const hexMatches = content.match(colorHexPattern);
      if (hexMatches) hexMatches.slice(0, 50).forEach((c) => colors.add(c));
      const rgbMatches = content.match(colorRgbPattern);
      if (rgbMatches) rgbMatches.slice(0, 30).forEach((c) => colors.add(c));

      if (/display\s*:\s*flex/i.test(content)) layoutPatterns.add("Flexbox");
      if (/display\s*:\s*grid/i.test(content)) layoutPatterns.add("CSS Grid");
      if (/position\s*:\s*sticky/i.test(content)) layoutPatterns.add("Sticky positioning");
      if (/@media/i.test(content)) layoutPatterns.add("Media queries (responsive)");
    } catch { /* skip */ }
  }

  function walkStyles(dir: string, depth: number) {
    if (depth > 4) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (IGNORE_DIRS.has(item.name)) continue;
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          walkStyles(full, depth + 1);
        } else if (item.isFile() && STYLE_EXTENSIONS.has(path.extname(item.name).toLowerCase())) {
          scanStyleFile(full);
        }
      }
    } catch { /* skip */ }
  }

  walkStyles(projectPath, 0);

  for (const name of ["tailwind.config.js", "tailwind.config.ts", "theme.ts", "theme.js", "theme.config.ts"]) {
    const fp = path.join(projectPath, name);
    if (fs.existsSync(fp)) {
      try {
        const st = fs.statSync(fp);
        if (st.size <= MAX_CONFIG_FILE_SIZE) {
          themeConfig = fs.readFileSync(fp, "utf-8");
          break;
        }
      } catch { /* skip */ }
    }
  }

  for (const sub of ["src/styles", "src/assets/styles", "src/theme", "styles"]) {
    const themePath = path.join(projectPath, sub);
    if (!fs.existsSync(themePath)) continue;
    for (const name of ["variables.less", "variables.scss", "variables.css", "theme.less", "theme.scss", "theme.css"]) {
      const fp = path.join(themePath, name);
      if (fs.existsSync(fp)) {
        try {
          const st = fs.statSync(fp);
          if (st.size <= MAX_STYLE_FILE_SIZE) {
            themeConfig = (themeConfig ? themeConfig + "\n\n--- " + name + " ---\n" : "") + fs.readFileSync(fp, "utf-8");
          }
        } catch { /* skip */ }
      }
    }
  }

  return {
    cssVariables,
    fontFamilies: [...fontFamilies],
    colorPalette: [...colors].slice(0, 60),
    componentLibrary,
    layoutPatterns: [...layoutPatterns],
    themeConfig,
  };
}

function detectModules(projectPath: string): string[] {
  const modules: string[] = [];
  const srcDir = path.join(projectPath, "src");
  if (!fs.existsSync(srcDir)) return modules;

  for (const sub of ["views", "pages", "modules", "features", "components", "api", "services", "store", "stores"]) {
    const d = path.join(srcDir, sub);
    if (!fs.existsSync(d)) continue;
    try {
      const items = fs.readdirSync(d, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory() && !IGNORE_DIRS.has(item.name)) {
          modules.push(`${sub}/${item.name}`);
        } else if (item.isFile() && !item.name.startsWith(".")) {
          modules.push(`${sub}/${item.name}`);
        }
      }
    } catch { /* skip */ }
  }
  return modules;
}

function detectApiEndpoints(projectPath: string): string[] {
  const endpoints: string[] = [];
  const apiDirs = ["src/api", "src/services", "api", "routes", "src/routes", "controllers", "src/controllers"];

  for (const sub of apiDirs) {
    const d = path.join(projectPath, sub);
    if (!fs.existsSync(d)) continue;
    try {
      const items = fs.readdirSync(d).filter((f) => /\.(ts|js|tsx|jsx)$/.test(f));
      for (const file of items) {
        endpoints.push(`${sub}/${file}`);
      }
    } catch { /* skip */ }
  }
  return endpoints;
}

export class ProjectAnalyzer {
  private cacheDirOverride: string | null = null;
  private defaultCacheDir: string;

  constructor(defaultCacheDir: string) {
    this.defaultCacheDir = defaultCacheDir;
  }

  get cacheDir(): string {
    return this.cacheDirOverride || this.defaultCacheDir;
  }

  setCacheDir(dir: string | null): void {
    this.cacheDirOverride = dir && dir.trim() ? dir.trim() : null;
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private cacheFilePath(projectPath: string): string {
    return path.join(this.cacheDir, `project-${hashPath(projectPath)}.json`);
  }

  analyze(projectPath: string): ProjectAnalysisResult {
    if (!fs.existsSync(projectPath)) {
      throw new Error(`项目路径不存在: ${projectPath}`);
    }

    const fingerprint = computeFingerprint(projectPath);
    const treeResult = buildTree(projectPath, "", 0);
    const extCount: Record<string, number> = {};
    countFilesByExtension(projectPath, extCount, 0);
    const techStack = detectTechStack(projectPath);
    const configSummary = readConfigSummary(projectPath);
    const styleAnalysis = analyzeStyles(projectPath);
    const moduleStructure = detectModules(projectPath);
    const apiEndpoints = detectApiEndpoints(projectPath);

    const result: ProjectAnalysisResult = {
      projectPath,
      analyzedAt: new Date().toISOString(),
      fileFingerprint: fingerprint,
      structure: {
        tree: `${path.basename(projectPath)}/\n${treeResult.text}`,
        totalFiles: treeResult.files,
        totalDirs: treeResult.dirs,
        filesByExtension: extCount,
      },
      techStack,
      configSummary,
      styleAnalysis,
      moduleStructure,
      apiEndpoints,
    };

    this.saveCache(projectPath, result);
    return result;
  }

  getCache(projectPath: string): ProjectAnalysisResult | null {
    const fp = this.cacheFilePath(projectPath);
    if (!fs.existsSync(fp)) return null;
    try {
      const raw = fs.readFileSync(fp, "utf-8");
      return JSON.parse(raw) as ProjectAnalysisResult;
    } catch {
      return null;
    }
  }

  isCacheValid(projectPath: string): boolean {
    const cached = this.getCache(projectPath);
    if (!cached) return false;
    const currentFingerprint = computeFingerprint(projectPath);
    return cached.fileFingerprint === currentFingerprint;
  }

  getOrAnalyze(projectPath: string): ProjectAnalysisResult {
    const cached = this.getCache(projectPath);
    if (cached && cached.fileFingerprint === computeFingerprint(projectPath)) {
      return cached;
    }
    return this.analyze(projectPath);
  }

  getCacheInfo(projectPath: string): ProjectCacheInfo | null {
    const fp = this.cacheFilePath(projectPath);
    if (!fs.existsSync(fp)) return null;
    try {
      const st = fs.statSync(fp);
      const cached = this.getCache(projectPath);
      if (!cached) return null;
      const currentFingerprint = computeFingerprint(projectPath);
      return {
        projectPath,
        analyzedAt: cached.analyzedAt,
        expired: cached.fileFingerprint !== currentFingerprint,
        cacheFile: fp,
        sizeBytes: st.size,
      };
    } catch {
      return null;
    }
  }

  clearCache(projectPath: string): boolean {
    const fp = this.cacheFilePath(projectPath);
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
      return true;
    }
    return false;
  }

  clearAllCaches(): number {
    if (!fs.existsSync(this.cacheDir)) return 0;
    let count = 0;
    for (const f of fs.readdirSync(this.cacheDir)) {
      if (f.startsWith("project-") && f.endsWith(".json")) {
        try {
          fs.unlinkSync(path.join(this.cacheDir, f));
          count++;
        } catch { /* skip */ }
      }
    }
    return count;
  }

  private saveCache(projectPath: string, result: ProjectAnalysisResult): void {
    this.ensureCacheDir();
    const fp = this.cacheFilePath(projectPath);
    fs.writeFileSync(fp, JSON.stringify(result, null, 2), "utf-8");
  }

  formatForPrompt(analysis: ProjectAnalysisResult, docType: string): string {
    const parts: string[] = [];

    parts.push("=== 项目分析上下文 ===\n");

    parts.push(`**项目路径：** ${analysis.projectPath}`);
    parts.push(`**分析时间：** ${analysis.analyzedAt}`);
    parts.push(`**文件统计：** ${analysis.structure.totalFiles} 个文件, ${analysis.structure.totalDirs} 个目录\n`);

    if (analysis.techStack.languages.length) {
      parts.push(`**编程语言：** ${analysis.techStack.languages.join(", ")}`);
    }
    if (analysis.techStack.frameworks.length) {
      parts.push(`**框架/库：** ${analysis.techStack.frameworks.join(", ")}`);
    }
    if (analysis.techStack.buildTools.length) {
      parts.push(`**构建工具：** ${analysis.techStack.buildTools.join(", ")}`);
    }

    parts.push("\n**项目结构：**");
    parts.push("```");
    const treeLines = analysis.structure.tree.split("\n");
    parts.push(treeLines.slice(0, 80).join("\n"));
    if (treeLines.length > 80) parts.push(`... (共 ${treeLines.length} 行)`);
    parts.push("```");

    if (analysis.moduleStructure.length) {
      parts.push("\n**模块/页面结构：**");
      parts.push(analysis.moduleStructure.slice(0, 50).map((m) => `- ${m}`).join("\n"));
      if (analysis.moduleStructure.length > 50) parts.push(`... (共 ${analysis.moduleStructure.length} 个模块)`);
    }

    if (analysis.apiEndpoints.length) {
      parts.push("\n**API/服务文件：**");
      parts.push(analysis.apiEndpoints.slice(0, 30).map((e) => `- ${e}`).join("\n"));
      if (analysis.apiEndpoints.length > 30) parts.push(`... (共 ${analysis.apiEndpoints.length} 个接口文件)`);
    }

    if (docType === "ui" || docType === "design") {
      parts.push("\n**文件类型分布：**");
      const sorted = Object.entries(analysis.structure.filesByExtension)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15);
      parts.push(sorted.map(([ext, count]) => `- ${ext}: ${count} 个`).join("\n"));
    }

    if (docType === "ui") {
      parts.push("\n\n=== 样式风格分析 ===\n");

      if (analysis.styleAnalysis.componentLibrary) {
        parts.push(`**组件库：** ${analysis.styleAnalysis.componentLibrary}`);
      }
      if (analysis.styleAnalysis.fontFamilies.length) {
        parts.push(`**字体：** ${analysis.styleAnalysis.fontFamilies.slice(0, 5).join(" | ")}`);
      }
      if (analysis.styleAnalysis.colorPalette.length) {
        parts.push(`**主要色值：** ${analysis.styleAnalysis.colorPalette.slice(0, 20).join(", ")}`);
      }
      if (analysis.styleAnalysis.layoutPatterns.length) {
        parts.push(`**布局模式：** ${analysis.styleAnalysis.layoutPatterns.join(", ")}`);
      }

      const varEntries = Object.entries(analysis.styleAnalysis.cssVariables);
      if (varEntries.length) {
        parts.push("\n**CSS 变量：**");
        parts.push("```css");
        parts.push(varEntries.slice(0, 30).map(([k, v]) => `${k}: ${v};`).join("\n"));
        if (varEntries.length > 30) parts.push(`/* ... 共 ${varEntries.length} 个变量 */`);
        parts.push("```");
      }

      if (analysis.styleAnalysis.themeConfig) {
        parts.push("\n**主题/样式配置：**");
        parts.push("```");
        const lines = analysis.styleAnalysis.themeConfig.split("\n");
        parts.push(lines.slice(0, 60).join("\n"));
        if (lines.length > 60) parts.push(`... (共 ${lines.length} 行)`);
        parts.push("```");
      }
    }

    if (docType === "design" || docType === "requirements") {
      const depKeys = Object.keys(analysis.techStack.dependencies);
      if (depKeys.length) {
        parts.push("\n**项目依赖：**");
        parts.push(depKeys.slice(0, 30).map((k) => `- ${k}: ${analysis.techStack.dependencies[k]}`).join("\n"));
        if (depKeys.length > 30) parts.push(`... (共 ${depKeys.length} 个依赖)`);
      }
    }

    if (docType === "design") {
      const configKeys = Object.keys(analysis.configSummary);
      if (configKeys.length) {
        parts.push("\n**关键配置文件摘要：**");
        for (const name of configKeys.slice(0, 5)) {
          parts.push(`\n--- ${name} ---`);
          const content = analysis.configSummary[name];
          const lines = content.split("\n");
          parts.push(lines.slice(0, 40).join("\n"));
          if (lines.length > 40) parts.push(`... (共 ${lines.length} 行)`);
        }
      }
    }

    parts.push("\n=== 项目分析上下文结束 ===");
    return parts.join("\n");
  }
}
