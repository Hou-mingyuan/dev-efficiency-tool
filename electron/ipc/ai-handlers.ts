import { BrowserWindow, ipcMain } from "electron";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import type { AppManager, AiProvider } from "../app-manager";
import {
  AiService,
  buildPrompt,
  buildUIAnalyzePrompt,
  buildUIImagePrompt,
  type DocType,
} from "../ai-service";
import type { ProjectAnalyzer } from "../project-analyzer";
import type { WrapIPC } from "./types";

export interface RegisterAiHandlersOptions {
  appManager: () => AppManager | null;
  mainWindow: () => BrowserWindow | null;
  currentLocale: () => string;
  aiService: AiService;
  projectAnalyzer: ProjectAnalyzer;
  wrapIPC: WrapIPC;
  assertTrustedOutputDirectory: (outputDir: string) => string;
  assertTrustedOutputPath: (outputDir: string, fileName: string) => string;
  isTrustedPath: (filePath: string) => boolean;
  isKnownHistoryOutputPath: (filePath: string) => boolean;
}

type ImageInput = Array<{ base64: string; mimeType: string }> | undefined;

function stripJsonFence(input: string): string {
  return input
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function parseJsonObject(input: string): Record<string, unknown> | null {
  const cleaned = stripJsonFence(input);
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
}

function sanitizeFileNamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|\s]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "UI设计";
}

function resolveFigmaFileName(template: unknown, projectName: unknown): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const project = sanitizeFileNamePart(String(projectName || "未命名项目"));
  const rawTemplate = String(template || "{projectName}-UI设计-{timestamp}");
  const base = rawTemplate
    .replace(/\{projectName\}/g, project)
    .replace(/\{timestamp\}/g, timestamp);
  const safe = sanitizeFileNamePart(base);
  return safe.toLowerCase().endsWith(".figma.json") ? safe : `${safe}.figma.json`;
}

function fallbackFigmaJson(projectName: unknown, analyzedPrompt: string): Record<string, unknown> {
  const title = String(projectName || "UI Design");
  const lines = analyzedPrompt
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-#*\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
  return {
    schemaVersion: "dev-efficiency-tool.figma-json.v1",
    file: {
      name: title,
      description: "由开发效率提升工具生成，可由后续 Figma 插件导入创建画布。",
    },
    pages: [
      {
        name: title,
        frames: [
          {
            name: title,
            width: 1440,
            height: 1024,
            layoutMode: "VERTICAL",
            padding: 32,
            gap: 16,
            children: lines.length
              ? lines.map((text, index) => ({
                type: index === 0 ? "heading" : "text",
                name: index === 0 ? "页面标题" : `文本 ${index}`,
                text,
              }))
              : [{ type: "text", name: "设计说明", text: analyzedPrompt }],
          },
        ],
      },
    ],
  };
}

export function registerAiHandlers(options: RegisterAiHandlersOptions): void {
  const {
    appManager,
    mainWindow,
    currentLocale,
    aiService,
    projectAnalyzer,
    wrapIPC,
    assertTrustedOutputDirectory,
    assertTrustedOutputPath,
    isTrustedPath,
    isKnownHistoryOutputPath,
  } = options;

  let currentAbortController: AbortController | null = null;

  const resolveProvider = (providerId?: string): AiProvider | null => {
    const providers = appManager()?.getConfig().aiProviders ?? [];
    let provider: AiProvider | null = null;
    if (providerId) {
      const custom = providers.find((p: any) => p.id === providerId && p.apiKey);
      if (custom) provider = custom;
    }
    return provider
      ?? appManager()?.getActiveProvider()
      ?? providers.find((p: any) => p.apiKey) as AiProvider | undefined
      ?? null;
  };

  ipcMain.handle("ai:stopGenerate", wrapIPC(async () => {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
  }));

  ipcMain.handle("ai:generate", wrapIPC(async (event: any, req: any) => {
    const provider = resolveProvider(req.providerId);
    if (!provider) {
      throw new Error(currentLocale() === "zh"
        ? "未配置可用的 AI 服务商。请前往「配置管理 → AI 模型配置」启用并设置 API Key。"
        : "No AI provider configured. Go to Settings → AI Providers to enable and set an API Key.");
    }

    const customPrompts = appManager()?.getConfig().customPrompts;

    let projectContext = "";
    const analyzeProjectPath = req.projectPath || appManager()?.getConfig().projectPath;
    if (analyzeProjectPath && fs.existsSync(analyzeProjectPath)) {
      try {
        const analysis = projectAnalyzer.getOrAnalyze(analyzeProjectPath);
        projectContext = projectAnalyzer.formatForPrompt(analysis, req.docType);
      } catch (e) {
        appManager()?.addLog("warn", `项目分析失败: ${(e instanceof Error ? e : new Error(String(e))).message}`, "project-analyzer");
      }
    }

    const { system, user } = buildPrompt(
      req.docType as DocType,
      req.projectName,
      req.userContent,
      req.referenceContent,
      customPrompts,
      projectContext,
    );
    const win = BrowserWindow.fromWebContents(event.sender) ?? mainWindow();

    const images = req.images as ImageInput;

    const abortController = new AbortController();
    currentAbortController = abortController;

    let result: string;
    try {
      result = await aiService.generateStream(provider, system, user, (chunk: string) => {
        if (win && !win.isDestroyed()) win.webContents.send("ai:chunk", chunk);
      }, images, abortController.signal);
    } catch (streamErr: unknown) {
      if (abortController.signal.aborted) throw new Error(currentLocale() === "zh" ? "已停止生成" : "Generation stopped");
      result = await aiService.generate(provider, system, user, images, abortController.signal);
    } finally {
      if (currentAbortController === abortController) currentAbortController = null;
    }

    const recordId = randomUUID();
    const record = {
      id: recordId,
      docType: req.docType,
      projectName: req.projectName?.trim() || "",
      createdAt: new Date().toISOString(),
      preview: result.slice(0, 200),
    };
    appManager()?.addGenerationRecord(record);
    appManager()?.addLog(
      "info",
      `AI 生成完成: ${req.docType} (${provider.name})`,
      "ai-gen",
    );
    if (win && !win.isDestroyed()) win.webContents.send("ai:done", result, recordId);
    return result;
  }));

  ipcMain.handle("ai:analyzeUIPrompt", wrapIPC(async (_event: any, req: any) => {
    const provider = resolveProvider(req.providerId);
    if (!provider) throw new Error(currentLocale() === "zh" ? "未配置可用的 AI 服务商。" : "No AI provider configured.");

    const images = req.images as ImageInput;

    let projectContext = "";
    const analyzeProjectPath = req.projectPath || appManager()?.getConfig().projectPath;
    if (analyzeProjectPath && fs.existsSync(analyzeProjectPath)) {
      try {
        const analysis = projectAnalyzer.getOrAnalyze(analyzeProjectPath);
        projectContext = projectAnalyzer.formatForPrompt(analysis, "ui");
      } catch (e) {
        appManager()?.addLog("warn", `UI 提示词分析项目失败: ${(e instanceof Error ? e : new Error(String(e))).message}`, "ai-ui-analyze");
      }
    }

    const { system, user } = buildUIAnalyzePrompt({
      projectName: req.projectName,
      userContent: req.userContent,
      referenceContent: req.referenceContent,
      projectContext,
      imageCount: images?.length ?? 0,
      isModuleScope: Boolean(req.isModuleScope),
    });

    const abortController = new AbortController();
    currentAbortController = abortController;
    try {
      const analyzedPrompt = await aiService.generate(provider, system, user, images, abortController.signal);
      appManager()?.addLog("info", `UI 提示词分析完成: ${provider.name}`, "ai-ui-analyze");
      return { analyzedPrompt };
    } finally {
      if (currentAbortController === abortController) currentAbortController = null;
    }
  }));

  ipcMain.handle("ai:generateUIImage", wrapIPC(async (event: any, req: any) => {
    const provider = resolveProvider(req.providerId);
    if (!provider) throw new Error(currentLocale() === "zh" ? "未配置可用的 AI 服务商。" : "No AI provider configured.");

    const images = req.images as ImageInput;
    const imageMode = req.imageMode === "quality" ? "quality" : "fast";
    appManager()?.addLog(
      "info",
      `UI 出图开始: provider=${provider.name ?? provider.id}, model=${provider.model || "default"}, mode=${imageMode}, images=${images?.length ?? 0}`,
      "ai-gen-ui",
    );

    let projectContext = "";

    const analyzeProjectPath = req.projectPath || appManager()?.getConfig().projectPath;
    if (imageMode === "quality" && analyzeProjectPath && fs.existsSync(analyzeProjectPath)) {
      try {
        const analysis = projectAnalyzer.getOrAnalyze(analyzeProjectPath);
        projectContext = projectAnalyzer.formatForPrompt(analysis, "ui");
      } catch (e) {
        appManager()?.addLog("warn", `UI 出图项目分析失败: ${(e instanceof Error ? e : new Error(String(e))).message}`, "ai-gen-ui");
      }
    }

    const analyzedPrompt = String(req.analyzedPrompt || req.userContent || "").trim();
    if (!analyzedPrompt) {
      throw new Error(currentLocale() === "zh" ? "未提供 UI 出图提示词" : "No UI image prompt provided");
    }
    const { system: systemPrompt, user: userPrompt } = buildUIImagePrompt({
      projectName: req.projectName,
      analyzedPrompt,
      referenceContent: imageMode === "quality" ? req.referenceContent : undefined,
      projectContext,
      imageCount: images?.length ?? 0,
      imageMode,
    });

    const win = BrowserWindow.fromWebContents(event.sender) ?? mainWindow();
    const sendProgress = (stage: string, current: number, total: number, msg: string) => {
      try { win?.webContents.send("ai:imageProgress", { stage, current, total, message: msg }); } catch { /* ignore */ }
    };

    const abortController = new AbortController();
    currentAbortController = abortController;

    sendProgress("generating", 0, 0, currentLocale() === "zh" ? "AI 正在生成 UI 代码..." : "AI is generating UI code...");

    let chunkCount = 0;
    let htmlResult: string;
    try {
      htmlResult = await aiService.generateStream(provider, systemPrompt, userPrompt, () => {
        chunkCount++;
        if (chunkCount % 10 === 0) {
          sendProgress(
            "generating",
            chunkCount,
            0,
            currentLocale() === "zh"
              ? `AI 正在生成 UI 代码，已接收 ${chunkCount} 段内容...`
              : `AI is generating UI code, received ${chunkCount} chunks...`,
          );
        }
      }, images, abortController.signal);
    } catch (streamErr: unknown) {
      if (abortController.signal.aborted) throw new Error(currentLocale() === "zh" ? "已停止生成" : "Generation stopped");
      appManager()?.addLog(
        "warn",
        `UI 出图流式生成失败，已降级为普通生成: ${(streamErr instanceof Error ? streamErr : new Error(String(streamErr))).message}`,
        "ai-gen-ui",
      );
      htmlResult = await aiService.generate(provider, systemPrompt, userPrompt, images, abortController.signal);
    } finally {
      if (currentAbortController === abortController) currentAbortController = null;
    }

    sendProgress("parsing", 0, 0, "正在解析 HTML 页面...");

    htmlResult = htmlResult.replace(/^```html?\s*/i, "").replace(/```\s*$/, "").trim();
    if (!htmlResult) {
      throw new Error(currentLocale() === "zh" ? "AI 未返回可渲染的 HTML 内容" : "AI did not return renderable HTML content");
    }

    const pageRegex = /<!--\s*PAGE_START:\s*(.+?)\s*-->([\s\S]*?)<!--\s*PAGE_END\s*-->/gi;
    const pages: Array<{ name: string; html: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = pageRegex.exec(htmlResult)) !== null) {
      const name = match[1].trim();
      const html = match[2].replace(/^```html?\s*/i, "").replace(/```\s*$/, "").trim();
      if (html) pages.push({ name, html });
    }
    if (!pages.length) {
      pages.push({ name: "UI Design", html: htmlResult });
    }
    appManager()?.addLog("info", `UI 出图解析完成: pages=${pages.length}, htmlLength=${htmlResult.length}`, "ai-gen-ui");

    sendProgress("rendering", 0, pages.length, `共 ${pages.length} 个页面，准备渲染...`);

    const outputDir = assertTrustedOutputDirectory(req.outputDir || appManager()?.getConfig().outputPath || "");
    fs.existsSync(outputDir) || fs.mkdirSync(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const imgFormat = req.imageFormat === "jpeg" ? "jpeg" : "png";
    const savedFiles: string[] = [];
    const pageResults: Array<{ name: string; imagePath: string; htmlPath: string }> = [];
    const wrapHtml = (body: string) =>
      `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: -apple-system, "Microsoft YaHei", "PingFang SC", sans-serif; background: #fff; }</style>
</head><body>${body}</body></html>`;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      sendProgress("rendering", i + 1, pages.length, `正在渲染: ${page.name} (${i + 1}/${pages.length})`);
      const suffix = pages.length > 1 ? `-${i + 1}` : "";
      const safeName = page.name.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40);
      const imgFileName = `ui-${safeName}${suffix}-${timestamp}.${imgFormat}`;
      const imgFilePath = assertTrustedOutputPath(outputDir, imgFileName);
      const fullHtml = wrapHtml(page.html);

      const renderWin = new BrowserWindow({ show: false, width: 1280, height: 800 });
      try {
        await renderWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
        await new Promise((r) => setTimeout(r, 800));
        const contentH = await renderWin.webContents.executeJavaScript("document.body.scrollHeight") as number;
        renderWin.setSize(1280, Math.min(contentH + 40, 16000));
        await new Promise((r) => setTimeout(r, 400));
        const captured = await renderWin.webContents.capturePage();
        if (imgFormat === "jpeg") {
          fs.writeFileSync(imgFilePath, captured.toJPEG(92));
        } else {
          fs.writeFileSync(imgFilePath, captured.toPNG());
        }
      } catch (renderErr: unknown) {
        appManager()?.addLog(
          "error",
          `UI 页面渲染失败: page=${page.name}, file=${imgFileName}, error=${(renderErr instanceof Error ? renderErr : new Error(String(renderErr))).message}`,
          "ai-gen-ui",
        );
        throw renderErr;
      } finally {
        if (!renderWin.isDestroyed()) renderWin.close();
      }
      savedFiles.push(imgFilePath);

      const htmlFileName = `ui-${safeName}${suffix}-${timestamp}.html`;
      const htmlFilePath = assertTrustedOutputPath(outputDir, htmlFileName);
      fs.writeFileSync(htmlFilePath, fullHtml, "utf-8");
      savedFiles.push(htmlFilePath);

      pageResults.push({ name: page.name, imagePath: imgFilePath, htmlPath: htmlFilePath });
      try { win?.webContents.send("ai:pageReady", { name: page.name, imagePath: imgFilePath, htmlPath: htmlFilePath, index: i, total: pages.length }); } catch { /* ignore */ }
    }

    sendProgress("done", pages.length, pages.length, `全部完成，共 ${pages.length} 个页面`);

    const recordId = randomUUID();
    appManager()?.addGenerationRecord({
      id: recordId,
      docType: "ui",
      projectName: req.projectName?.trim() || "",
      createdAt: new Date().toISOString(),
      preview: `[UI 图片 x${pages.length}] ${pages.map((p) => p.name).join(", ")}`,
      outputPath: savedFiles[0],
    });
    appManager()?.addLog("info", `UI 图片已生成 ${pages.length} 张: ${savedFiles.filter((f) => f.endsWith(`.${imgFormat}`)).join(", ")}`, "ai-gen-ui");
    return { htmlResult, savedFiles, recordId, pages: pageResults };
  }));

  ipcMain.handle("ai:generateFigmaFile", wrapIPC(async (_event: any, req: any) => {
    const provider = resolveProvider(req.providerId);
    if (!provider) throw new Error(currentLocale() === "zh" ? "未配置可用的 AI 服务商。" : "No AI provider configured.");

    const analyzedPrompt = String(req.analyzedPrompt || "").trim();
    if (!analyzedPrompt) {
      throw new Error(currentLocale() === "zh" ? "未提供 Figma 生成提示词" : "No Figma generation prompt provided");
    }
    const outputDir = assertTrustedOutputDirectory(req.outputDir || appManager()?.getConfig().outputPath || "");
    fs.existsSync(outputDir) || fs.mkdirSync(outputDir, { recursive: true });
    const fileName = resolveFigmaFileName(req.fileNameTemplate, req.projectName);
    const filePath = assertTrustedOutputPath(outputDir, fileName);

    appManager()?.addLog(
      "info",
      `Figma 连接器文件生成开始: provider=${provider.name ?? provider.id}, file=${fileName}`,
      "ai-figma",
    );

    const system = [
      "你是 Figma 插件数据生成器。",
      "请只输出严格 JSON，不要输出 Markdown 代码块。",
      "该 JSON 会被桌面应用保存为 .figma.json，后续由 Figma 插件导入创建设计画布。",
      "JSON 顶层必须包含 schemaVersion、file、pages。",
      "pages[].frames[].children 支持 type: heading, text, button, input, card, list, table, imagePlaceholder。",
      "尽量保留页面层级、自动布局、间距、颜色、字号、圆角等设计信息。",
    ].join("\n");
    const user = [
      `项目名称：${req.projectName || "未命名项目"}`,
      req.projectPath ? `参考项目路径：${req.projectPath}` : "",
      req.referenceContent ? `参考内容：\n${req.referenceContent}` : "",
      `UI 生成提示词：\n${analyzedPrompt}`,
    ].filter(Boolean).join("\n\n");

    const abortController = new AbortController();
    currentAbortController = abortController;
    let figmaJson: Record<string, unknown>;
    try {
      const raw = await aiService.generate(provider, system, user, undefined, abortController.signal);
      figmaJson = parseJsonObject(raw) ?? fallbackFigmaJson(req.projectName, analyzedPrompt);
    } finally {
      if (currentAbortController === abortController) currentAbortController = null;
    }

    figmaJson = {
      ...figmaJson,
      schemaVersion: String(figmaJson.schemaVersion || "dev-efficiency-tool.figma-json.v1"),
      generatedBy: "dev-efficiency-tool",
      generatedAt: new Date().toISOString(),
      importHint: "请使用配套 Figma 插件导入此 JSON。未配置插件时，可先将该文件作为连接器中间产物保存。",
    };

    fs.writeFileSync(filePath, JSON.stringify(figmaJson, null, 2), "utf-8");

    const recordId = randomUUID();
    appManager()?.addGenerationRecord({
      id: recordId,
      docType: "ui",
      projectName: req.projectName?.trim() || "",
      createdAt: new Date().toISOString(),
      preview: `[Figma JSON] ${fileName}`,
      outputPath: filePath,
    });
    appManager()?.addLog("info", `Figma 连接器文件已生成: ${filePath}`, "ai-figma");
    return { filePath, fileName, recordId, figmaJson };
  }));

  ipcMain.handle("ai:checkFilesExist", wrapIPC(async (_e: any, paths: string[]) => {
    const result: Record<string, boolean> = {};
    for (const p of paths || []) {
      if (typeof p !== "string" || !p) {
        continue;
      }
      result[p] = isTrustedPath(p) || isKnownHistoryOutputPath(p) ? fs.existsSync(p) : false;
    }
    return result;
  }));

  ipcMain.handle("ai:renderHtmlToImage", wrapIPC(async (_e: any, req: any) => {
    const { htmlCode, outputDir, fileName, format } = req as {
      htmlCode: string;
      outputDir: string;
      fileName: string;
      format: "png" | "jpeg" | "gif";
    };
    if (!["png", "jpeg", "gif"].includes(format)) {
      throw new Error(currentLocale() === "zh" ? "不支持的图片格式" : "Unsupported image format");
    }
    const safeOutputDir = assertTrustedOutputDirectory(outputDir);
    fs.existsSync(safeOutputDir) || fs.mkdirSync(safeOutputDir, { recursive: true });
    const filePath = assertTrustedOutputPath(safeOutputDir, fileName);
    const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif; background: #fff; }
</style></head><body>${htmlCode}</body></html>`;
    const renderWin = new BrowserWindow({ show: false, width: 1280, height: 800 });
    try {
      await renderWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlDoc)}`);
      await new Promise((r) => setTimeout(r, 800));
      const ch = await renderWin.webContents.executeJavaScript("document.body.scrollHeight") as number;
      renderWin.setSize(1280, Math.min(ch + 40, 16000));
      await new Promise((r) => setTimeout(r, 400));

      if (format === "gif") {
        const { GifWriter } = await import("omggif");
        const viewH = 720;
        renderWin.setSize(1280, viewH);
        await new Promise((r) => setTimeout(r, 200));
        const totalH = await renderWin.webContents.executeJavaScript("document.body.scrollHeight") as number;
        const step = Math.floor(viewH * 0.7);
        const positions = [0];
        let sy = step;
        while (sy < totalH - viewH) { positions.push(sy); sy += step; }
        if (totalH > viewH) positions.push(totalH - viewH);
        const bitmaps: Buffer[] = [];
        for (const pos of positions) {
          await renderWin.webContents.executeJavaScript(`window.scrollTo(0, ${pos})`);
          await new Promise((r) => setTimeout(r, 200));
          const img = await renderWin.webContents.capturePage();
          bitmaps.push(img.toBitmap());
        }
        const sz = (await renderWin.webContents.capturePage()).getSize();
        const w = sz.width;
        const h = sz.height;
        const palette: number[] = [];
        for (let r = 0; r < 6; r++)
          for (let g = 0; g < 6; g++)
            for (let b = 0; b < 6; b++)
              palette.push((r * 51) | ((g * 51) << 8) | ((b * 51) << 16));
        while (palette.length < 256) {
          const gray = Math.round((palette.length - 216) * (255 / 39));
          palette.push(gray | (gray << 8) | (gray << 16));
        }
        function nearIdx(r: number, g: number, b: number) {
          return Math.round(r / 51) * 36 + Math.round(g / 51) * 6 + Math.round(b / 51);
        }
        const outBuf = Buffer.alloc(w * h * bitmaps.length * 2 + 65536);
        const gw = new GifWriter(outBuf, w, h, { loop: 0, palette });
        for (const rgba of bitmaps) {
          const indexed = new Uint8Array(w * h);
          for (let i = 0; i < w * h; i++) {
            const off = i * 4;
            indexed[i] = nearIdx(rgba[off], rgba[off + 1], rgba[off + 2]);
          }
          gw.addFrame(0, 0, w, h, indexed, { delay: 150, dispose: 0 });
        }
        fs.writeFileSync(filePath, Buffer.from(outBuf.buffer, 0, gw.end()));
      } else {
        const captured = await renderWin.webContents.capturePage();
        if (format === "jpeg") {
          fs.writeFileSync(filePath, captured.toJPEG(92));
        } else {
          fs.writeFileSync(filePath, captured.toPNG());
        }
      }
    } catch (renderErr: unknown) {
      appManager()?.addLog(
        "error",
        `HTML 转图片失败: file=${fileName}, format=${format}, error=${(renderErr instanceof Error ? renderErr : new Error(String(renderErr))).message}`,
        "ai-render",
      );
      throw renderErr;
    } finally {
      if (!renderWin.isDestroyed()) renderWin.close();
    }
    appManager()?.addLog("info", `UI 图片已生成: ${fileName}`, "ai-render");
    return filePath;
  }));

  ipcMain.handle(
    "ai:testConnection",
    wrapIPC(async (_e: any, provider: any) => {
      const r = await aiService.testConnection(provider);
      appManager()?.addLog(
        "info",
        `AI 连接测试完成: ${provider?.name ?? provider?.id ?? "unknown"}`,
        "ai-test",
      );
      return r;
    }),
  );
  ipcMain.handle(
    "ai:listModels",
    wrapIPC(async (_e: any, provider: any) => {
      const r = await aiService.listModels(provider);
      appManager()?.addLog(
        "info",
        `AI 模型列表已拉取: ${provider?.name ?? provider?.id ?? "unknown"}`,
        "ai-models",
      );
      return r;
    }),
  );
}
