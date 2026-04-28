export type UIGenMode = "doc" | "image" | "figma";

export interface UIImageProgress {
  requestId?: string;
  stage: string;
  current: number;
  total: number;
  message: string;
}

export interface GeneratedUIPage {
  name: string;
  imagePath: string;
  htmlPath?: string;
}

export interface PageReadyPayload extends GeneratedUIPage {
  requestId?: string;
  index: number;
  total: number;
}

export interface GenerateUIImageResponse {
  htmlResult: string;
  savedFiles: string[];
  recordId: string;
  pages?: GeneratedUIPage[];
  mode?: "html-render" | "direct-image";
}

export function collectGeneratedPageFiles(page: GeneratedUIPage): string[] {
  return [page.imagePath, page.htmlPath].filter((filePath): filePath is string => Boolean(filePath));
}

export function collectGeneratedPagesFiles(pages: GeneratedUIPage[]): string[] {
  return pages.flatMap(collectGeneratedPageFiles);
}
