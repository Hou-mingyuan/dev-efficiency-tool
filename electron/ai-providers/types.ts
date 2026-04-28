import type { AiProvider } from "../app-manager";

export interface ImageGenerationOptions {
  imageFormat?: "png" | "jpeg";
  imageMode?: "fast" | "quality";
  signal?: AbortSignal;
}

export interface GeneratedImage {
  bytes: Buffer;
  mimeType: string;
  revisedPrompt?: string;
}

export interface ImageGenerationProvider {
  generateImage(provider: AiProvider, prompt: string, options?: ImageGenerationOptions): Promise<GeneratedImage>;
}

export interface TextGenerationInput {
  provider: AiProvider;
  system: string;
  user: string;
  images?: Array<{ base64: string; mimeType: string }>;
  signal?: AbortSignal;
  maxTokens?: number;
}

export interface TextStreamGenerationInput extends TextGenerationInput {
  onChunk: (chunk: string) => void;
}

export interface TextGenerationProvider {
  generate(input: TextGenerationInput): Promise<string>;
  generateStream(input: TextStreamGenerationInput): Promise<string>;
}
