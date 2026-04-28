import { describe, expect, it } from "vitest";
import { buildAnthropicUserContent, buildOpenAIUserContent } from "../ai-message-content";

describe("AI multimodal message content builders", () => {
  const images = [
    { base64: "abc123", mimeType: "image/png" },
    { base64: "def456", mimeType: "image/jpeg" },
  ];

  it("returns plain text when no images are provided", () => {
    expect(buildOpenAIUserContent("hello")).toBe("hello");
    expect(buildAnthropicUserContent("hello")).toBe("hello");
  });

  it("builds OpenAI-compatible image_url parts before the text prompt", () => {
    const content = buildOpenAIUserContent("请分析图片", images);

    expect(content).toEqual([
      { type: "image_url", image_url: { url: "data:image/png;base64,abc123" } },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,def456" } },
      { type: "text", text: "请分析图片" },
    ]);
  });

  it("builds Anthropic image source parts before the text prompt", () => {
    const content = buildAnthropicUserContent("请分析图片", images);

    expect(content).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/png", data: "abc123" } },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "def456" } },
      { type: "text", text: "请分析图片" },
    ]);
  });
});

