import type { AiProvider } from "../app-manager";
import type { GeneratedImage, ImageGenerationOptions, ImageGenerationProvider } from "./types";

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

function compactResponsePreview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 240) || "空响应";
}

function imageApiHtmlFailureMessage(providerName: string, status: number, url: string): string {
  return [
    `${providerName} 图片生成 API 返回了 HTML 错误页 (${status})，不是图片接口需要的 JSON。`,
    `最后请求地址：${url}`,
    "这通常表示当前 Base URL 的中转服务不支持 /images/generations，或上游图片接口暂时不可用。",
    "请换用支持 OpenAI 图片生成接口的 Base URL，或改用文本模型走 HTML 渲染出图。",
  ].join(" ");
}

export class OpenAICompatibleImageProvider implements ImageGenerationProvider {
  async generateImage(provider: AiProvider, prompt: string, options: ImageGenerationOptions = {}): Promise<GeneratedImage> {
    const base = provider.baseUrl.replace(/\/+$/, "");
    const urls = this.buildImageGenerationUrls(base);
    const model = provider.model.trim();
    const imageFormat = options.imageFormat === "jpeg" ? "jpeg" : "png";
    const body: Record<string, unknown> = {
      model,
      prompt,
      n: 1,
    };

    if (/^gpt[-_]?image/i.test(model)) {
      body.size = "auto";
      body.quality = options.imageMode === "quality" ? "high" : "medium";
      body.output_format = imageFormat;
    } else if (/^dall[-_]?e/i.test(model)) {
      body.response_format = "b64_json";
    } else {
      body.output_format = imageFormat;
    }

    const data = await this.postImageGeneration(provider, urls, body, options.signal);
    const item = data.data?.[0];
    if (!item) {
      throw new Error(`${provider.name} 图片生成 API 未返回图片数据`);
    }
    if (item.b64_json) {
      return {
        bytes: Buffer.from(item.b64_json, "base64"),
        mimeType: imageFormat === "jpeg" ? "image/jpeg" : "image/png",
        revisedPrompt: item.revised_prompt,
      };
    }
    if (item.url) {
      const imgRes = await fetch(item.url, { signal: options.signal });
      if (!imgRes.ok) {
        throw new Error(`${provider.name} 图片下载失败 (${imgRes.status})`);
      }
      const contentType = imgRes.headers.get("content-type") || "";
      const bytes = Buffer.from(await imgRes.arrayBuffer());
      return {
        bytes,
        mimeType: contentType.startsWith("image/") ? contentType : imageFormat === "jpeg" ? "image/jpeg" : "image/png",
        revisedPrompt: item.revised_prompt,
      };
    }
    throw new Error(`${provider.name} 图片生成 API 返回格式不受支持`);
  }

  private buildImageGenerationUrls(base: string): string[] {
    if (base.endsWith("/images/generations")) return [base];
    if (base.endsWith("/v1")) return [`${base}/images/generations`];
    return uniqueValues([
      `${base}/images/generations`,
      `${base}/v1/images/generations`,
    ]);
  }

  private async postImageGeneration(
    provider: AiProvider,
    urls: string[],
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<{ data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }> }> {
    let lastNonJson = "";
    let lastUrl = urls[0] ?? provider.baseUrl;
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      lastUrl = url;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text().catch(() => "");
      const looksLikeHtml = /^\s*</.test(text) || contentType.toLowerCase().includes("text/html");
      if (!res.ok) {
        if ((res.status === 404 || res.status === 405 || looksLikeHtml) && i < urls.length - 1) {
          lastNonJson = text;
          continue;
        }
        if (looksLikeHtml) {
          throw new Error(imageApiHtmlFailureMessage(provider.name, res.status, url));
        }
        throw new Error(`${provider.name} 图片生成 API 调用失败 (${res.status}): ${compactResponsePreview(text || res.statusText)}`);
      }
      try {
        return JSON.parse(text) as { data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }> };
      } catch {
        if (looksLikeHtml && i < urls.length - 1) {
          lastNonJson = text;
          continue;
        }
        if (looksLikeHtml) {
          throw new Error(imageApiHtmlFailureMessage(provider.name, res.status, lastUrl));
        }
        throw new Error(
          `${provider.name} 图片生成 API 返回的不是 JSON。请确认 Base URL 是否需要包含 /v1，或该服务是否支持 /images/generations。最后请求地址：${lastUrl}；响应开头：${compactResponsePreview(text)}`,
        );
      }
    }
    throw new Error(
      `${provider.name} 图片生成 API 返回的不是 JSON。已尝试 ${urls.join("、")}。请确认 Base URL 是否需要包含 /v1，或该服务是否支持 /images/generations。响应开头：${compactResponsePreview(lastNonJson)}`,
    );
  }
}
