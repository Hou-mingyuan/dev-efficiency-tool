import { describe, expect, it } from "vitest";
import { readResponseErrorText, throwProviderResponseError } from "../ai-response-errors";

describe("AI response error helpers", () => {
  it("reads response text for provider error messages", async () => {
    const res = {
      text: async () => "bad request",
    } as Response;

    await expect(readResponseErrorText(res)).resolves.toBe("bad request");
  });

  it("uses fallback text when response text cannot be read", async () => {
    const res = {
      text: async () => {
        throw new Error("body stream failed");
      },
    } as unknown as Response;

    await expect(readResponseErrorText(res, "fallback")).resolves.toBe("fallback");
  });

  it("throws formatted provider response errors", async () => {
    const res = {
      status: 429,
      text: async () => "rate limited",
    } as Response;

    await expect(throwProviderResponseError(res, "OpenAI API 调用失败")).rejects.toThrow(
      "OpenAI API 调用失败 (429): rate limited",
    );
  });
});

