import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AiProvider } from "./mcp-manager";

/** ESM replacement for `__dirname` (this module’s directory) */
export const ESM_DIRNAME = path.dirname(fileURLToPath(import.meta.url));

export type DocType = "prd" | "requirements" | "ui" | "design";

export interface PromptTemplate {
  system: string;
  userPrefix: string;
}

export const PROMPTS: Record<DocType, PromptTemplate> = {
  prd: {
    system: `你是一位资深产品经理，擅长编写产品需求文档(PRD)。请根据用户提供的项目描述和上下文信息，生成一份完整、专业、充分详尽的 PRD 文档。

用户的需求可能是整个项目级别的，也可能是系统中某个模块级别的。如果是模块级别，请在概述中说明该模块在整体系统中的定位、与其他模块的关系边界。

核心要求——写清楚"做什么"和"不做什么"：
- 对每个功能需求，明确描述：做什么（In Scope）、不做什么（Out of Scope）、待定/需进一步确认的部分
- 描述边界行为：异常输入、极端场景（空数据/超大数据/并发/权限不足/网络中断等）时的期望表现
- 标注功能完善程度：MVP 版本包含什么、后续迭代包含什么
- 业务规则必须穷举所有分支场景，不能留模糊地带

文档结构：
1. 项目/模块概述 - 背景、目标、范围（Scope & Out-of-Scope）；若为模块级别，说明其在系统中的位置
2. 用户画像 - 目标用户、角色分类、各角色的核心诉求
3. 功能需求清单
   - 按模块分组，每个功能点包含：功能描述、优先级(P0/P1/P2)、In Scope / Out of Scope、待定项
   - 对每个功能点描述正常流程和异常/边界流程
4. 非功能需求 - 性能指标（量化）、安全要求、兼容性、可用性
5. 业务规则与约束
   - 每条规则覆盖所有分支：正常分支、异常分支、边界条件
   - 列出前置条件和后置条件
6. 数据需求 - 关键数据模型、数据生命周期、数据量预估
7. 用户交互与界面概要 - 关键页面流转、状态流转图
8. 里程碑与迭代计划 - MVP 范围、后续迭代范围
9. 风险评估 - 技术风险、业务风险及缓解措施
10. 待确认事项清单 - 所有需要进一步沟通确认的开放性问题
11. 验收标准 - 每个功能模块的验收条件，正向验收和反向验收

输出格式：Markdown，内容必须专业详尽、无遗漏，可直接作为开发输入。对于每个功能，宁可多写不可少写。`,
    userPrefix: `请根据以下项目/模块信息，生成一份尽可能充分详尽的 PRD 文档。注意：每个功能都要写清楚做什么、不做什么、边界行为、待确认事项。

`,
  },
  requirements: {
    system: `你是一位资深需求分析师，擅长将产品需求细化为极其详尽的功能需求文档。请根据用户提供的 PRD 或项目描述，生成结构化的需求文档。

用户的需求可能是整个项目级别的，也可能是系统中某个模块级别的。如果是模块级别，请在需求概述中说明该模块所属的系统、与上下游模块的依赖关系、数据交互方式、共用接口等。

核心要求——穷举式需求描述：
- 每个功能需求必须覆盖：正常流程、异常流程、边界行为
- 明确列出 In Scope（本期做）和 Out of Scope（本期不做但未来可能做）
- 对于未完善/待确认的部分，单独标注为"TBD"并说明原因
- 用户故事必须包含验收条件（AC），且 AC 要覆盖正向和反向场景
- 业务流程要列出所有分支，包括：成功路径、失败路径、超时路径、并发冲突路径
- 接口需求要说明调用失败时的降级/重试策略

文档结构：
1. 需求概述 - 业务背景与目标；若为模块级别，说明所属系统和上下游关系
2. 范围定义
   - In Scope：本期需求覆盖的功能
   - Out of Scope：明确不做的功能及原因
   - TBD 事项：需要进一步确认的问题
3. 用户故事
   - 采用"作为[角色]，我希望[功能]，以便[价值]"格式
   - 每个故事附带 AC（Acceptance Criteria），同时包含正向和反向验收
4. 功能清单
   - 按模块分组，每个功能点包含：描述、优先级(P0/P1/P2)、正常行为、边界行为、异常行为
5. 业务流程
   - 主流程（Happy Path）
   - 异常分支流程（异常输入、权限不足、数据不存在、超时等）
   - 并发/竞态场景处理
6. 接口需求 - 系统间/模块间交互需求、数据交互、接口依赖、失败降级策略
7. 数据字典 - 关键实体与字段说明、字段约束（长度/格式/必填/默认值）
8. 约束条件 - 技术约束、业务约束、法规约束
9. 非功能需求 - 性能（量化指标）、安全、兼容性、可用性、可维护性
10. 验收条件汇总 - 按模块汇总所有验收条件，区分正向验收和反向验收
11. 待确认事项清单 - 所有 TBD 问题的汇总

输出格式：Markdown，需求描述精确无歧义，每个功能点必须覆盖正常/异常/边界，可直接指导开发。`,
    userPrefix: `请根据以下信息，生成一份极其充分详尽的需求文档。注意：每个功能点都要覆盖正常流程、异常流程、边界行为，并明确 In Scope / Out of Scope。

`,
  },
  ui: {
    system: `你是一位资深 UI/UX 设计师，擅长根据需求文档输出极其详尽的 UI 设计规范和页面设计方案。请根据用户提供的需求信息，生成 UI 设计文档。

用户的需求可能是整个项目级别的，也可能是系统中某个模块级别的。如果是模块级别，请保持与系统整体的导航风格、设计语言、组件库规范一致，确保模块页面能无缝融入现有系统。

核心要求——逐页面穷举式设计：
- 每个页面的每个状态（初始态、空态、加载中、已加载、错误态、无权限态）都要描述
- 每个交互都要说明：触发条件、视觉反馈、成功结果、失败处理
- 列表页面：说明空列表、单条数据、大量数据（分页）、筛选无结果等不同状态的展示
- 表单页面：说明每个字段的输入提示、校验规则、校验失败提示、联动逻辑
- 弹窗/抽屉：打开/关闭的触发条件、内部交互、确认/取消行为

文档结构：
1. 设计原则 - 视觉风格、配色方案、间距规范；若为模块级别，说明与系统整体设计语言的一致性
2. 页面清单 - 所有页面列表与层级关系、页面之间的跳转关系
3. 页面设计详情 - 每个页面包含：
   - 页面名称与用途
   - 布局描述(header/sidebar/content/footer)
   - 页面状态：初始态、空态、数据态、加载态、错误态
   - 组件列表(表格、表单、按钮等)，每个组件的属性/状态
   - 交互说明(点击、悬停、加载、拖拽等)，包含成功和失败的反馈
   - 数据展示说明(字段格式化、枚举映射、时间格式等)
4. 导航设计 - 全局/模块导航结构、面包屑规则、与系统整体导航的集成方式
5. 表单设计 - 表单字段、每个字段的：类型、placeholder、校验规则、错误提示、联动条件
6. 列表/表格设计 - 列定义、筛选项、排序规则、分页参数、批量操作、行操作按钮及权限控制
7. 弹窗/抽屉设计 - 触发条件、弹窗内容、提交/取消行为、二次确认逻辑
8. 消息与反馈 - 操作成功/失败/加载的提示方式(Toast/Message/Modal)
9. 响应式适配 - 不同屏幕尺寸适配方案
10. 组件规范 - 通用组件使用约定，复用系统已有组件库
11. 边界与异常设计 - 网络断开、接口超时、权限不足、数据冲突等场景的 UI 表现

输出格式：Markdown，描述清晰具体到每个状态、每个交互，开发人员可直接还原为前端代码。`,
    userPrefix: `请根据以下需求信息，生成一份极其充分详尽的 UI 设计文档。注意：每个页面都要覆盖所有状态（空态、数据态、加载态、错误态），每个交互都要说明成功和失败的处理。

`,
  },
  design: {
    system: `你是一位资深系统架构师，擅长编写极其详尽的开发设计文档。请根据用户提供的需求和 UI 设计信息，生成一份完整的详细开发设计文档。

用户的需求可能是整个项目级别的，也可能是系统中某个模块级别的。如果是模块级别，请明确与现有代码的集成点、复用现有基础设施（认证/鉴权/日志/配置中心等）、对现有数据库的影响（新增/修改表、迁移脚本等）。

核心要求——可直接编码的精度：
- 每个 API 接口必须给出完整的请求和响应示例（含异常响应）
- 数据库设计要包含建表 SQL/迁移脚本，字段约束要完整
- 业务逻辑必须穷举所有分支：正常流程、异常流程、边界条件、并发处理
- 明确标注哪些功能本期实现（In Scope）、哪些不实现（Out of Scope）
- 对于还没有完善的设计点，标注为 TBD 并说明风险
- 异常处理必须覆盖：参数校验失败、业务规则冲突、外部服务不可用、数据不一致、超时、并发竞态

文档结构：
1. 技术方案概述 - 技术选型（含版本号）、架构说明；若为模块级别，明确与现有系统的集成点
2. 范围定义 - In Scope / Out of Scope / TBD 事项
3. 模块设计 - 模块划分与职责、模块间依赖关系图、复用现有基础设施
4. 数据库设计
   - 表结构（字段名、类型、约束、默认值、注释）
   - 索引设计（含唯一索引、组合索引的使用场景说明）
   - 关联关系、外键策略
   - 若为增量模块：迁移脚本、对现有数据的影响
5. API 接口设计
   - 每个接口：URL、Method、请求参数（含校验规则）、成功响应、失败响应示例
   - 接口鉴权方式、限流策略
6. 业务逻辑设计
   - 核心流程（含流程图/伪代码）
   - 异常分支处理（含每种异常的触发条件和处理方式）
   - 并发/竞态处理策略（乐观锁/悲观锁/幂等性）
7. 状态管理 - 关键状态机定义、状态转换规则、非法状态转换的拒绝策略
8. 权限设计 - 角色与权限矩阵、菜单/按钮/数据级权限、复用已有权限体系
9. 前端组件设计 - 组件树、Props/Emits/Store、复用已有组件
10. 异常处理与容错
    - 按层级分类：参数校验层、业务逻辑层、数据访问层、外部调用层
    - 每种异常的错误码、提示信息、日志级别
11. 缓存设计 - 缓存策略、Key 规则、过期策略、缓存击穿/穿透/雪崩防护
12. 测试方案 - 单元测试覆盖范围、集成测试场景（含边界和异常场景）
13. 部署方案 - 部署架构、配置项清单、灰度/回滚策略
14. 开发任务拆分 - 按依赖关系排序的任务列表，每个任务含预估工时和验收标准
15. 风险与待确认事项 - 技术风险、设计决策的 Trade-off、TBD 问题

输出格式：Markdown，精确到可直接编码的粒度。每个接口、每条业务规则、每个异常场景都不能遗漏。`,
    userPrefix: `请根据以下需求和设计信息，生成一份极其充分详尽的详细开发设计文档。注意：每个接口要给出完整的请求/响应示例，每条业务规则要覆盖所有分支，每个异常场景都要有处理方案。

`,
  },
};

export const UI_IMAGE_PROMPT: PromptTemplate = {
  system: `你是一位顶尖的前端 UI 设计与开发专家。你的任务是根据用户的需求描述以及参考资料（参考图片、参考文档、参考项目代码），为每一个功能点/页面/交互场景分别生成独立的、高保真的 HTML+CSS 代码。

核心原则：
1. **多页面拆分**：仔细分析需求，将其中涉及的每个功能页面、交互状态、弹窗、表单等都拆分为独立的 HTML 块
2. **参考优先**：如果提供了参考项目代码或参考文档，必须深入分析其中的设计风格、配色方案、组件样式、布局模式，让生成的 UI 与现有系统风格保持一致
3. **精细还原**：每个页面必须包含完整的细节——表头、表格数据示例、按钮状态、表单验证提示、面包屑导航、分页器等

多页面输出格式（严格遵守）：
每个页面用分隔标记包裹，格式如下：
<!-- PAGE_START: 页面名称 -->
<完整的 HTML+CSS 代码>
<!-- PAGE_END -->

示例：
<!-- PAGE_START: 订单列表页 -->
<div>...</div>
<!-- PAGE_END -->
<!-- PAGE_START: 订单详情页 -->
<div>...</div>
<!-- PAGE_END -->
<!-- PAGE_START: 新增订单弹窗 -->
<div>...</div>
<!-- PAGE_END -->

HTML 代码要求：
1. 每个 PAGE 块必须是完整可渲染的 HTML（包含内联或 <style> 标签的 CSS）
2. 不要使用外部 CSS 框架（如 Bootstrap、Tailwind），所有样式内联或用 <style> 标签
3. 使用 flexbox 或 grid 实现布局
4. 图标用 Unicode 符号或 SVG 内联替代
5. 中文字体使用 "Microsoft YaHei", "PingFang SC", sans-serif
6. 代码中不要包含 \`\`\` 标记
7. 不要输出任何 markdown 或解释文字，只输出 PAGE_START/PAGE_END 标记和 HTML 代码
8. 表格类页面请填充 3-5 行示例数据
9. 弹窗/模态框以打开状态展示
10. 体现真实的交互状态（悬停、选中、禁用等）`,
  userPrefix: `请根据以下需求描述和参考资料，为每个功能点/页面/交互分别生成高保真的 HTML+CSS 代码。

注意：必须拆分为多个独立页面，用 <!-- PAGE_START: 名称 --> 和 <!-- PAGE_END --> 包裹每个页面。

`,
};

export function buildPrompt(
  docType: DocType,
  projectName: string,
  userContent: string,
  referenceContent: string,
  customPrompts?: Record<string, string> | null,
  projectContext?: string,
): { system: string; user: string } {
  const tmpl = PROMPTS[docType];
  let system = customPrompts?.[docType]?.trim() || tmpl.system;

  if (projectContext) {
    system += `\n\n请结合以下项目分析上下文来生成更贴合项目实际情况的文档。如果项目分析中包含了技术栈、框架、模块结构等信息，请在文档中充分利用这些信息。`;
  }

  let user = tmpl.userPrefix;
  if (projectName) {
    user += `**项目/模块名称：** ${projectName}\n\n`;
  }
  if (projectContext) {
    user += `${projectContext}\n\n---\n\n`;
  }
  user += userContent;
  if (referenceContent) {
    user += `\n\n---\n**参考文档内容：**\n\n${referenceContent}`;
  }
  return { system, user };
}

export class AiService {
  private static readonly KNOWN_MODELS: Record<string, string[]> = {
    openai: [
      "gpt-5.5", "gpt-5.5-pro",
      "gpt-5.4", "gpt-5.4-pro", "gpt-5.4-mini", "gpt-5.4-nano",
      "gpt-5.2", "gpt-5.1", "gpt-5", "gpt-5-mini",
      "gpt-4.1", "gpt-4.1-mini",
      "gpt-4o", "gpt-4o-mini",
      "o3", "o3-mini", "o3-pro",
    ],
    anthropic: [
      "claude-opus-4-7",
      "claude-sonnet-4-6", "claude-haiku-4-5",
      "claude-opus-4-6", "claude-sonnet-4-5", "claude-opus-4-5",
      "claude-opus-4-1",
    ],
    deepseek: [
      "deepseek-v4-pro", "deepseek-v4-flash",
      "deepseek-chat", "deepseek-reasoner",
    ],
    qwen: [
      "qwen3.6-max-preview", "qwen3.6-plus", "qwen3.6-flash",
      "qwen3-max", "qwen3.5-plus", "qwen3.5-flash",
      "qwen-plus", "qwen-turbo", "qwen-long",
    ],
    zhipu: [
      "glm-5.1", "glm-5", "glm-5-turbo", "glm-5v-turbo",
      "glm-4.7", "glm-4.7-flash",
      "glm-4.6",
    ],
    moonshot: [
      "kimi-k2.6", "kimi-k2.5",
      "kimi-k2-0905",
      "moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k",
    ],
    doubao: [
      "doubao-seed-2.0-pro", "doubao-seed-2.0-code",
      "doubao-seed-2.0-lite", "doubao-seed-2.0-mini",
      "doubao-pro-v1", "doubao-pro-128k", "doubao-lite-128k",
    ],
  };

  async listModels(provider: AiProvider): Promise<string[]> {
    if (!provider.apiKey?.trim()) return [];

    const knownList = AiService.KNOWN_MODELS[provider.id];
    if (knownList) return knownList;

    try {
      return await this.listOpenAICompatibleModels(provider);
    } catch {
      return [];
    }
  }

  private async listOpenAICompatibleModels(provider: AiProvider): Promise<string[]> {
    const base = provider.baseUrl.replace(/\/+$/, "");
    const url = `${base}/models`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${provider.apiKey}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    if (!Array.isArray(data.data)) return [];
    return data.data
      .map((m) => m.id ?? "")
      .filter((id) => id.length > 0)
      .sort((a, b) => a.localeCompare(b));
  }

  /**
   * 发送极简请求验证 API Key 与网络；成功则 resolve，失败则 throw
   */
  async testConnection(provider: AiProvider): Promise<void> {
    if (!provider.apiKey?.trim()) throw new Error("未配置 API Key");
    return provider.id === "anthropic"
      ? this.testAnthropic(provider)
      : this.testOpenAICompatible(provider);
  }

  private async testOpenAICompatible(provider: AiProvider): Promise<void> {
    const base = provider.baseUrl.replace(/\/+$/, "");
    const url = base.endsWith("/chat/completions")
      ? base
      : `${base}/chat/completions`;
    if (!provider.model?.trim()) throw new Error("未配置模型名称");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
        temperature: 0,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "Unknown error");
      throw new Error(`${provider.name} API (${res.status}): ${t}`);
    }
  }

  private async testAnthropic(provider: AiProvider): Promise<void> {
    const url = `${provider.baseUrl.replace(/\/+$/, "")}/v1/messages`;
    if (!provider.model?.trim()) throw new Error("未配置模型名称");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "Unknown error");
      throw new Error(`Anthropic API (${res.status}): ${t}`);
    }
  }

  async generate(
    provider: AiProvider,
    system: string,
    user: string,
    images?: Array<{ base64: string; mimeType: string }>,
    signal?: AbortSignal,
  ): Promise<string> {
    if (!provider.apiKey) {
      throw new Error("当前 AI 服务商未配置 API Key，请在「配置管理 → AI 模型配置」中设置");
    }
    return provider.id === "anthropic"
      ? this.callAnthropic(provider, system, user, images, signal)
      : this.callOpenAI(provider, system, user, images, signal);
  }

  async generateStream(
    provider: AiProvider,
    system: string,
    user: string,
    onChunk: (chunk: string) => void,
    images?: Array<{ base64: string; mimeType: string }>,
    signal?: AbortSignal,
  ): Promise<string> {
    if (!provider.apiKey) {
      throw new Error("当前 AI 服务商未配置 API Key，请在「配置管理 → AI 模型配置」中设置");
    }
    return provider.id === "anthropic"
      ? this.callAnthropicStream(provider, system, user, onChunk, images, signal)
      : this.callOpenAIStream(provider, system, user, onChunk, images, signal);
  }

  private buildOpenAIUserContent(
    user: string,
    images?: Array<{ base64: string; mimeType: string }>,
  ): string | Array<{ type: string; text?: string; image_url?: { url: string } }> {
    if (!images?.length) return user;
    const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
    for (const img of images) {
      parts.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64}` } });
    }
    parts.push({ type: "text", text: user });
    return parts;
  }

  private async callOpenAI(
    provider: AiProvider,
    system: string,
    user: string,
    images?: Array<{ base64: string; mimeType: string }>,
    signal?: AbortSignal,
  ): Promise<string> {
    const base = provider.baseUrl.replace(/\/+$/, "");
    const url = base.endsWith("/chat/completions")
      ? base
      : `${base}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: this.buildOpenAIUserContent(user, images) },
        ],
        temperature: 0.7,
        max_tokens: 16384,
      }),
      signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "未知错误");
      throw new Error(`${provider.name} API 调用失败 (${res.status}): ${t}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "生成结果为空";
  }

  private async callOpenAIStream(
    provider: AiProvider,
    system: string,
    user: string,
    onChunk: (chunk: string) => void,
    images?: Array<{ base64: string; mimeType: string }>,
    signal?: AbortSignal,
  ): Promise<string> {
    const base = provider.baseUrl.replace(/\/+$/, "");
    const url = base.endsWith("/chat/completions")
      ? base
      : `${base}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: this.buildOpenAIUserContent(user, images) },
        ],
        temperature: 0.7,
        max_tokens: 16384,
        stream: true,
      }),
      signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "未知错误");
      throw new Error(`${provider.name} API 流式调用失败 (${res.status}): ${t}`);
    }
    if (!res.body) {
      throw new Error(`${provider.name} 响应体不可读，无法流式解析`);
    }

    let full = "";
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let lineBuf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuf += dec.decode(value, { stream: true });
      const lines = lineBuf.split("\n");
      lineBuf = lines.pop() ?? "";
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        const payload = s.slice(5).trim();
        if (payload === "[DONE]") return full;
        let parsed: { choices?: Array<{ delta?: { content?: string } }> };
        try {
          parsed = JSON.parse(payload) as typeof parsed;
        } catch {
          continue;
        }
        const piece = parsed.choices?.[0]?.delta?.content;
        if (typeof piece === "string" && piece.length) {
          full += piece;
          onChunk(piece);
        }
      }
    }
    const tail = lineBuf.trim();
    if (tail.startsWith("data:")) {
      const payload = tail.slice(5).trim();
      if (payload !== "[DONE]") {
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const piece = parsed.choices?.[0]?.delta?.content;
          if (typeof piece === "string" && piece.length) {
            full += piece;
            onChunk(piece);
          }
        } catch {
          /* ignore */
        }
      }
    }
    return full || "生成结果为空";
  }

  private buildAnthropicUserContent(
    user: string,
    images?: Array<{ base64: string; mimeType: string }>,
  ): string | Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> {
    if (!images?.length) return user;
    const parts: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [];
    for (const img of images) {
      parts.push({ type: "image", source: { type: "base64", media_type: img.mimeType, data: img.base64 } });
    }
    parts.push({ type: "text", text: user });
    return parts;
  }

  private async callAnthropic(
    provider: AiProvider,
    system: string,
    user: string,
    images?: Array<{ base64: string; mimeType: string }>,
    signal?: AbortSignal,
  ): Promise<string> {
    const url = `${provider.baseUrl.replace(/\/+$/, "")}/v1/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: provider.model,
        system,
        messages: [{ role: "user", content: this.buildAnthropicUserContent(user, images) }],
        max_tokens: 16384,
      }),
      signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "未知错误");
      throw new Error(`Anthropic API 调用失败 (${res.status}): ${t}`);
    }
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? "生成结果为空";
  }

  private async callAnthropicStream(
    provider: AiProvider,
    system: string,
    user: string,
    onChunk: (chunk: string) => void,
    images?: Array<{ base64: string; mimeType: string }>,
    signal?: AbortSignal,
  ): Promise<string> {
    const url = `${provider.baseUrl.replace(/\/+$/, "")}/v1/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: provider.model,
        system,
        messages: [{ role: "user", content: this.buildAnthropicUserContent(user, images) }],
        max_tokens: 16384,
        stream: true,
      }),
      signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "未知错误");
      throw new Error(`Anthropic API 流式调用失败 (${res.status}): ${t}`);
    }
    if (!res.body) throw new Error("Anthropic 响应体不可读，无法流式解析");

    let full = "";
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let lastEvent = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        let line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line === "") continue;
        if (line.startsWith("event:")) {
          lastEvent = line.slice(6).trim();
          continue;
        }
        if (!line.startsWith("data:")) continue;
        const dataStr = line.slice(5).trimStart();
        try {
          const ev = JSON.parse(dataStr) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (
            (lastEvent === "content_block_delta" || ev.type === "content_block_delta") &&
            ev.delta?.type === "text_delta"
          ) {
            const t = ev.delta.text;
            if (typeof t === "string" && t.length) {
              full += t;
              onChunk(t);
            }
          }
          if (lastEvent === "message_stop" || ev.type === "message_stop") {
            return full || "生成结果为空";
          }
        } catch {
          /* ignore */
        }
      }
    }
    return full || "生成结果为空";
  }
}
