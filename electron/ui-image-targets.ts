export type UIImageMode = "fast" | "quality";

export interface DirectImageTarget {
  name: string;
  prompt: string;
}

function cleanUITargetName(raw: string): string {
  return raw
    .replace(/^[#*\-\s\d.、)）]+/, "")
    .replace(/\*\*/g, "")
    .replace(/[：:].*$/, "")
    .replace(/[（(].*?[）)]/g, "")
    .trim();
}

function isGenericUITargetName(name: string): boolean {
  if (name.length < 2 || name.length > 48) return true;
  return /^(页面清单|页面列表|设计原则|视觉风格|配色方案|交互说明|组件规范|导航设计|响应式适配|边界与异常|输出要求|示例|说明)$/i.test(name);
}

export function extractQualityImageTargets(analyzedPrompt: string, projectName: unknown): DirectImageTarget[] {
  const candidates: string[] = [];
  const lines = analyzedPrompt.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    const heading = trimmed.match(/^#{2,5}\s*(?:\d+[.、)）]\s*)?(.+)$/);
    if (heading) candidates.push(heading[1]);

    const numbered = trimmed.match(/^(?:[-*]\s*)?(?:\d+[.、)）]\s*)([^：:]{2,60}(?:页|页面|弹窗|抽屉|列表|详情|表单|看板|首页|中心|管理|配置|设置|流程|工作台|仪表盘|面板|模块|功能)[^：:]*)[：:]?/);
    if (numbered) candidates.push(numbered[1]);

    const bullet = trimmed.match(/^[-*]\s*([^：:]{2,60}(?:页|页面|弹窗|抽屉|列表|详情|表单|看板|首页|中心|管理|配置|设置|流程|工作台|仪表盘|面板|模块|功能)[^：:]*)[：:]/);
    if (bullet) candidates.push(bullet[1]);
  }

  const names = Array.from(new Set(candidates.map(cleanUITargetName).filter((name) => !isGenericUITargetName(name))));
  const fallbackName = String(projectName || "UI Design");
  const targetNames = names.length ? names : [fallbackName];
  return targetNames.map((name) => ({
    name,
    prompt: [
      `本次只生成「${name}」这一项对应的完整 UI 图片。`,
      "请聚焦该页面/功能本身，不要把其它页面拼成长图，也不要输出解释文字。",
      "如果该项是弹窗、抽屉或状态页，请以打开状态展示完整上下文。",
      `完整 UI 生成提示词如下：\n${analyzedPrompt}`,
    ].join("\n\n"),
  }));
}

export function resolveDirectImageTargets(
  analyzedPrompt: string,
  projectName: unknown,
  imageMode: UIImageMode,
): DirectImageTarget[] {
  if (imageMode === "quality") return extractQualityImageTargets(analyzedPrompt, projectName);
  return [{
    name: String(projectName || "核心预览"),
    prompt: [
      "本次只生成一张快速预览图，请选择需求中最核心的主页面或主流程首屏。",
      "不要生成多张拼接图，不要输出解释文字。",
      `完整 UI 生成提示词如下：\n${analyzedPrompt}`,
    ].join("\n\n"),
  }];
}
