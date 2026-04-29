export async function readResponseErrorText(res: Response, fallback = "未知错误"): Promise<string> {
  return res.text().catch(() => fallback);
}

export async function throwProviderResponseError(
  res: Response,
  messagePrefix: string,
  fallback = "未知错误",
): Promise<never> {
  const text = await readResponseErrorText(res, fallback);
  throw new Error(`${messagePrefix} (${res.status}): ${text}`);
}

