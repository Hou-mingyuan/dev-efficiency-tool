import { BrowserWindow, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";
import type { AppManager } from "../app-manager";
import type { WrapIPC } from "./types";

export interface RegisterDocumentSaveHandlersOptions {
  appManager: () => AppManager | null;
  currentLocale: () => string;
  wrapIPC: WrapIPC;
  assertTrustedOutputPath: (outputDir: string, fileName: string) => string;
}

const ALLOWED_SAVE_FORMATS = new Set(["md", "txt", "docx", "pdf", "png", "jpeg", "jpg", "gif", "svg", "html"]);

const documentCss = `
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 14px; line-height: 1.8; padding: 20px 40px; color: #1a1a1a; }
  h1 { font-size: 24px; border-bottom: 2px solid #1890ff; padding-bottom: 8px; }
  h2 { font-size: 20px; border-bottom: 1px solid #e8e8e8; padding-bottom: 6px; }
  h3 { font-size: 16px; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
  pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: transparent; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  th, td { border: 1px solid #e8e8e8; padding: 8px 12px; text-align: left; }
  th { background: #fafafa; font-weight: 600; }
  blockquote { border-left: 4px solid #1890ff; margin: 1em 0; padding: 8px 16px; color: #666; background: #f0f7ff; }
`;

const imageCss = `
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 14px; line-height: 1.8; padding: 40px; color: #1a1a1a; background: #fff; margin: 0; }
  h1 { font-size: 24px; border-bottom: 2px solid #1890ff; padding-bottom: 8px; }
  h2 { font-size: 20px; border-bottom: 1px solid #e8e8e8; padding-bottom: 6px; }
  h3 { font-size: 16px; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
  pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: transparent; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  th, td { border: 1px solid #e8e8e8; padding: 8px 12px; text-align: left; }
  th { background: #fafafa; font-weight: 600; }
  blockquote { border-left: 4px solid #1890ff; margin: 1em 0; padding: 8px 16px; color: #666; background: #f0f7ff; }
  img { max-width: 100%; height: auto; }
`;

function createHtmlDocument(body: string, css = documentCss): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;
}

async function renderMarkdownToImage(marked: Marked, content: string, filePath: string, format: string): Promise<void> {
  const htmlBody = await marked.parse(content);
  const htmlDoc = createHtmlDocument(htmlBody, imageCss);
  const imgWin = new BrowserWindow({ show: false, width: 1200, height: 800 });
  try {
    await imgWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlDoc)}`);
    await new Promise((r) => setTimeout(r, 500));
    const contentHeight = await imgWin.webContents.executeJavaScript("document.body.scrollHeight");
    imgWin.setSize(1200, Math.min(contentHeight + 40, 16000));
    await new Promise((r) => setTimeout(r, 300));
    const capturedImg = await imgWin.webContents.capturePage();
    if (format === "png") {
      fs.writeFileSync(filePath, capturedImg.toPNG());
    } else {
      fs.writeFileSync(filePath, capturedImg.toJPEG(90));
    }
  } finally {
    if (!imgWin.isDestroyed()) imgWin.close();
  }
}

async function renderMarkdownToGif(marked: Marked, content: string, filePath: string): Promise<void> {
  const { GifWriter } = await import("omggif");
  const htmlBody = await marked.parse(content);
  const gifHtml = createHtmlDocument(htmlBody, imageCss);
  const viewW = 800;
  const viewH = 600;
  const gifWin = new BrowserWindow({ show: false, width: viewW, height: viewH });
  try {
    await gifWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(gifHtml)}`);
    await new Promise((r) => setTimeout(r, 600));
    const totalH = await gifWin.webContents.executeJavaScript("document.body.scrollHeight") as number;
    const scrollStep = Math.floor(viewH * 0.7);
    const positions = [0];
    let sy = scrollStep;
    while (sy < totalH - viewH) { positions.push(sy); sy += scrollStep; }
    if (totalH > viewH) positions.push(totalH - viewH);
    const frames: Buffer[] = [];
    for (const pos of positions) {
      await gifWin.webContents.executeJavaScript(`window.scrollTo(0, ${pos})`);
      await new Promise((r) => setTimeout(r, 200));
      const img = await gifWin.webContents.capturePage();
      frames.push(img.toBitmap());
    }
    const size = (await gifWin.webContents.capturePage()).getSize();
    const w = size.width;
    const h = size.height;
    const palette: number[] = [];
    for (let r = 0; r < 6; r++)
      for (let g = 0; g < 6; g++)
        for (let b = 0; b < 6; b++)
          palette.push((r * 51) | ((g * 51) << 8) | ((b * 51) << 16));
    while (palette.length < 256) {
      const gray = Math.round((palette.length - 216) * (255 / 39));
      palette.push(gray | (gray << 8) | (gray << 16));
    }
    function nearestIdx(r: number, g: number, b: number): number {
      const ri = Math.round(r / 51);
      const gi = Math.round(g / 51);
      const bi = Math.round(b / 51);
      return ri * 36 + gi * 6 + bi;
    }
    const outBuf = Buffer.alloc(w * h * frames.length * 2 + 65536);
    const gw = new GifWriter(outBuf, w, h, { loop: 0, palette });
    for (const rgba of frames) {
      const indexed = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const off = i * 4;
        indexed[i] = nearestIdx(rgba[off], rgba[off + 1], rgba[off + 2]);
      }
      gw.addFrame(0, 0, w, h, indexed, { delay: 150, dispose: 0 });
    }
    const finalGif = Buffer.from(outBuf.buffer, 0, gw.end());
    fs.writeFileSync(filePath, finalGif);
  } finally {
    if (!gifWin.isDestroyed()) gifWin.close();
  }
}

export function registerDocumentSaveHandlers(options: RegisterDocumentSaveHandlersOptions): void {
  const { appManager, currentLocale, wrapIPC, assertTrustedOutputPath } = options;

  ipcMain.handle("ai:saveDocument", wrapIPC(async (_e: any, req: any) => {
    const format = String(req.format || "md").toLowerCase();
    if (!ALLOWED_SAVE_FORMATS.has(format)) {
      throw new Error(currentLocale() === "zh" ? "不支持的保存格式" : "Unsupported save format");
    }
    const filePath = assertTrustedOutputPath(req.outputDir, req.fileName);
    const outputDir = path.dirname(filePath);
    fs.existsSync(outputDir) || fs.mkdirSync(outputDir, { recursive: true });
    const marked = new Marked();

    if (format === "docx") {
      const htmlBody = await marked.parse(req.content);
      const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${htmlBody}</body></html>`;
      const HTMLtoDOCX = (await import("html-to-docx")).default;
      const docxBuf = await HTMLtoDOCX(htmlDoc, null, {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      });
      fs.writeFileSync(filePath, Buffer.from(docxBuf as ArrayBuffer));
    } else if (format === "pdf") {
      const htmlBody = await marked.parse(req.content);
      const htmlDoc = createHtmlDocument(htmlBody);
      const pdfWin = new BrowserWindow({ show: false, width: 800, height: 600 });
      try {
        await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlDoc)}`);
        const pdfData = await pdfWin.webContents.printToPDF({
          printBackground: true,
          margins: { marginType: "default" },
        });
        fs.writeFileSync(filePath, pdfData);
      } finally {
        if (!pdfWin.isDestroyed()) pdfWin.close();
      }
    } else if (format === "png" || format === "jpeg" || format === "jpg") {
      await renderMarkdownToImage(marked, req.content, filePath, format);
    } else if (format === "gif") {
      await renderMarkdownToGif(marked, req.content, filePath);
    } else if (format === "svg") {
      const htmlBody = await marked.parse(req.content);
      const svgDoc = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="960" height="auto" viewBox="0 0 960 800">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif; font-size: 14px; line-height: 1.8; padding: 32px; color: #1a1a1a;">
      ${htmlBody}
    </div>
  </foreignObject>
</svg>`;
      fs.writeFileSync(filePath, svgDoc, "utf-8");
    } else if (format === "html") {
      const htmlBody = await marked.parse(req.content);
      const htmlDoc = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${req.fileName?.replace(/\.html$/, "") || "UI Design"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 15px; line-height: 1.8; color: #1a1a1a; background: #f8f9fa; }
    .container { max-width: 960px; margin: 0 auto; padding: 40px 32px; background: #fff; min-height: 100vh; box-shadow: 0 0 20px rgba(0,0,0,0.05); }
    h1 { font-size: 28px; border-bottom: 3px solid #1890ff; padding-bottom: 12px; margin-bottom: 24px; }
    h2 { font-size: 22px; border-bottom: 1px solid #e8e8e8; padding-bottom: 8px; margin: 32px 0 16px; }
    h3 { font-size: 18px; margin: 24px 0 12px; }
    p { margin: 0.8em 0; }
    code { background: #f0f2f5; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: "JetBrains Mono", "Fira Code", monospace; }
    pre { background: #282c34; color: #abb2bf; padding: 20px; border-radius: 8px; overflow-x: auto; margin: 1em 0; }
    pre code { background: transparent; padding: 0; color: inherit; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; }
    th, td { border: 1px solid #e8e8e8; padding: 10px 14px; text-align: left; }
    th { background: #fafafa; font-weight: 600; }
    blockquote { border-left: 4px solid #1890ff; margin: 1em 0; padding: 12px 20px; color: #555; background: #f0f7ff; border-radius: 0 6px 6px 0; }
    ul, ol { padding-left: 2em; margin: 0.5em 0; }
    li { margin: 0.3em 0; }
    img { max-width: 100%; height: auto; border-radius: 6px; }
    a { color: #1890ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    hr { border: none; border-top: 1px solid #e8e8e8; margin: 24px 0; }
  </style>
</head>
<body><div class="container">${htmlBody}</div></body>
</html>`;
      fs.writeFileSync(filePath, htmlDoc, "utf-8");
    } else {
      fs.writeFileSync(filePath, req.content, "utf-8");
    }

    if (req.historyRecordId) appManager()?.updateGenerationOutputPath(req.historyRecordId, filePath);
    appManager()?.addLog(
      "info",
      `文档已保存: ${req.fileName} (${format})`,
      "ai-save",
    );
    return filePath;
  }));
}
