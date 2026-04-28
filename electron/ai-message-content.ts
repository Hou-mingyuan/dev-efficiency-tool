export interface AiImageInput {
  base64: string;
  mimeType: string;
}

export type OpenAIUserContent =
  | string
  | Array<{ type: string; text?: string; image_url?: { url: string } }>;

export type AnthropicUserContent =
  | string
  | Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }>;

export function buildOpenAIUserContent(user: string, images?: AiImageInput[]): OpenAIUserContent {
  if (!images?.length) return user;
  const parts: Exclude<OpenAIUserContent, string> = [];
  for (const img of images) {
    parts.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64}` } });
  }
  parts.push({ type: "text", text: user });
  return parts;
}

export function buildAnthropicUserContent(user: string, images?: AiImageInput[]): AnthropicUserContent {
  if (!images?.length) return user;
  const parts: Exclude<AnthropicUserContent, string> = [];
  for (const img of images) {
    parts.push({ type: "image", source: { type: "base64", media_type: img.mimeType, data: img.base64 } });
  }
  parts.push({ type: "text", text: user });
  return parts;
}

