import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  buildUIAnalyzePrompt,
  buildUIImagePrompt,
} from "../ai-service";

describe("document prompt builder", () => {
  it("uses custom prompts and includes project context and references", () => {
    const prompt = buildPrompt(
      "design",
      "订单系统",
      "实现订单列表、筛选和详情页",
      "参考文档：列表支持导出",
      { design: "自定义详设系统提示词" },
      "项目分析：Vue 3 + Ant Design Vue",
    );

    expect(prompt.system).toContain("自定义详设系统提示词");
    expect(prompt.system).toContain("项目分析上下文");
    expect(prompt.user).toContain("订单系统");
    expect(prompt.user).toContain("Vue 3 + Ant Design Vue");
    expect(prompt.user).toContain("实现订单列表、筛选和详情页");
    expect(prompt.user).toContain("参考文档：列表支持导出");
  });
});

describe("UI two-step prompt builders", () => {
  it("builds an analysis prompt with project context, references, images and module scope", () => {
    const prompt = buildUIAnalyzePrompt({
      projectName: "订单系统",
      userContent: "需要订单列表和订单详情页面",
      referenceContent: "参考需求：订单可筛选、可导出",
      projectContext: "组件库：Ant Design",
      imageCount: 2,
      isModuleScope: true,
    });

    expect(prompt.system).toContain("UI/UX 需求分析师");
    expect(prompt.user).toContain("订单系统");
    expect(prompt.user).toContain("订单列表和订单详情页面");
    expect(prompt.user).toContain("参考需求：订单可筛选、可导出");
    expect(prompt.user).toContain("组件库：Ant Design");
    expect(prompt.user).toContain("模块级别");
    expect(prompt.user).toContain("已附带 2 张参考图片");
  });

  it("builds an image prompt from the analyzed UI prompt without losing references", () => {
    const prompt = buildUIImagePrompt({
      projectName: "订单系统",
      analyzedPrompt: "页面清单：订单列表页、订单详情页",
      referenceContent: "参考交互：行操作包含查看详情",
      projectContext: "主题色：#1677ff",
      imageCount: 1,
      imageMode: "quality",
    });

    expect(prompt.system).toContain("前端 UI 设计与开发专家");
    expect(prompt.user).toContain("订单系统");
    expect(prompt.user).toContain("页面清单：订单列表页、订单详情页");
    expect(prompt.user).toContain("参考交互：行操作包含查看详情");
    expect(prompt.user).toContain("主题色：#1677ff");
    expect(prompt.user).toContain("已附带 1 张参考图片");
    expect(prompt.user).toContain("高保真模式");
    expect(prompt.user).toContain("不得超过 5 个");
    expect(prompt.user).toContain("PAGE_START");
  });

  it("builds a fast image prompt with a strict small page limit", () => {
    const prompt = buildUIImagePrompt({
      projectName: "订单系统",
      analyzedPrompt: "页面清单：订单列表页、订单详情页、订单新增弹窗",
      imageMode: "fast",
    });

    expect(prompt.user).toContain("快速预览模式");
    expect(prompt.user).toContain("只生成 1-2 个最核心页面");
    expect(prompt.user).toContain("总页面数不得超过 2 个");
  });
});
