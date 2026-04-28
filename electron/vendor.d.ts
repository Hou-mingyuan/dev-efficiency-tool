declare module "omggif" {
  export class GifWriter {
    constructor(buf: Uint8Array | Buffer, width: number, height: number, options?: unknown);
    addFrame(
      x: number,
      y: number,
      width: number,
      height: number,
      indexedPixels: Uint8Array,
      options?: unknown,
    ): void;
    end(): number;
  }
}

declare module "html-to-docx" {
  const HTMLtoDOCX: (
    html: string,
    headerHTML?: string | null,
    options?: unknown,
  ) => Promise<ArrayBuffer | Buffer>;
  export default HTMLtoDOCX;
}
