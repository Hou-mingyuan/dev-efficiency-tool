import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AiProvider } from "./app-manager";
import { OpenAICompatibleImageProvider } from "./ai-providers/openai-compatible-image-provider";
import type { GeneratedImage, ImageGenerationOptions } from "./ai-providers/types";
import { testAiConnection } from "./ai-connection-test";
import { buildAnthropicUserContent, buildOpenAIUserContent } from "./ai-message-content";
import { listAvailableModels } from "./ai-model-list";
import { throwProviderResponseError } from "./ai-response-errors";
import { getModelOutputKind, isImageGenerationModel } from "./model-capabilities";

/** ESM replacement for `__dirname` (this module’s directory) */
export const ESM_DIRNAME = path.dirname(fileURLToPath(import.meta.url));

export type DocType = "prd" | "requirements" | "ui" | "design";

export interface PromptTemplate {
  system: string;
  userPrefix: string;
}

export const STRICT_REFERENCE_ADHERENCE_RULE = [
  "硬性参考约束：",
  "- 如果提供了参考项目分析、参考项目代码、参考文档或参考图片，它们是生成内容的最高优先级约束。",
  "- 输出必须严格遵守参考项目的项目风格、目录结构、技术体系、样式规范、组件框架、命名习惯和交互模式。",
  "- 不得擅自替换框架、组件库、数据库、状态管理、路由结构、接口风格或视觉样式；没有证据的内容必须标注为待确认。",
  "- 如果用户需求与参考资料冲突，必须优先保持参考项目/参考文档一致，并把冲突列为待确认事项。",
].join("\n");

export const PRD_VISUAL_OUTPUT_RULE = [
  "PRD 的所有核心功能必须使用稳定追踪编号，例如 PRD-F-001、PRD-F-002；后续需求、UI、详设会继承这些编号。",
  "PRD 必须采用“正文说明 → Mermaid 图 → 图文对照表”的图文绑定格式，确保图和文本能逐项对上。",
  "必须至少包含以下三类 Mermaid 图：",
  "1. 业务流程图：使用 flowchart 或 graph 描述用户、系统、关键业务节点和异常分支。",
  "2. 页面结构图：使用 flowchart 或 graph 描述页面、模块、弹窗、列表、详情、表单之间的结构关系。",
  "3. 状态流转图：使用 stateDiagram-v2 描述核心对象状态、触发动作和终态。",
  "每一张 Mermaid 图必须放在独立的 ```mermaid 代码块中。",
  "每一张图的节点名称必须带稳定编号，例如 BF-01、BF-02、PS-01、ST-01；正文说明中必须引用这些编号。",
  "每一张图后必须紧跟“图文对照表”，表格至少包含：图节点编号、节点含义、对应正文位置、验收/边界关注点。",
  "每一张图文对照表后必须包含“未入图说明”和“待确认图节点”两个小节；没有对应内容时必须写“无”。",
  "如果某个正文功能点没有进入图中，必须在“未入图说明”中列出；如果某个图节点没有正文依据，必须在“待确认图节点”中标注。",
].join("\n");

export const REQUIREMENTS_TRACEABILITY_RULE = [
  "需求文档必须采用可追踪编号体系，确保每条需求都能回溯到 PRD。",
  "每个功能需求必须包含稳定编号，例如 REQ-001、REQ-002；如果输入中出现 PRD-F-001 等编号，必须在需求中引用对应来源。",
  "每个用户故事必须包含稳定编号，例如 US-001，并写明对应 REQ 编号。",
  "每条验收条件必须包含稳定编号，例如 AC-001，并写明对应 REQ/US 编号。",
  "必须包含“需求追踪矩阵”，表格至少包含：PRD 编号/来源、REQ 编号、用户故事编号、验收条件编号、状态。",
  "每个 REQ 必须覆盖正常流程、异常流程、边界行为、In Scope、Out of Scope、TBD/待确认事项。",
].join("\n");

export const UI_TRACEABILITY_RULE = [
  "UI 设计文档必须采用可追踪编号体系，确保页面、状态、组件和交互都能回溯到需求。",
  "每个页面必须包含稳定编号，例如 UI-P01、UI-P02，并写明对应 REQ 编号。",
  "每个页面状态必须包含稳定编号，例如 UI-S01、UI-S02；至少覆盖空态、加载态、数据态、错误态、无权限态中适用的状态。",
  "每个关键组件必须包含稳定编号，例如 UI-C01；每个关键交互必须包含稳定编号，例如 UI-I01。",
  "必须包含“UI 需求追踪矩阵”，表格至少包含：REQ 编号、页面编号、状态编号、组件编号、交互编号、验收关注点。",
  "每个页面必须描述布局、组件列表、交互说明、数据展示、异常/边界表现。",
].join("\n");

export const DESIGN_TRACEABILITY_RULE = [
  "详细设计文档必须采用可追踪编号体系，确保接口、数据库、状态机、测试和开发任务都能回溯到需求/UI。",
  "每个 API 必须包含稳定编号，例如 API-001，并写明对应 REQ/UI 编号。",
  "每个数据表或关键数据对象必须包含稳定编号，例如 DB-001，并写明对应 REQ/API 编号。",
  "每个测试场景必须包含稳定编号，例如 TEST-001，并写明对应 REQ/API/UI 编号。",
  "必须包含“设计追踪矩阵”，表格至少包含：REQ 编号、UI 编号、API 编号、DB 编号、TEST 编号、开发任务编号。",
  "必须完整覆盖 API 接口设计、数据库设计、业务逻辑、异常处理、权限设计、测试方案、开发任务拆分。",
].join("\n");

export interface PrdVisualValidationResult {
  valid: boolean;
  missing: string[];
}

export type DocumentValidationResult = PrdVisualValidationResult;

function extractIds(content: string, pattern: RegExp): string[] {
  return Array.from(new Set(Array.from(content.matchAll(pattern), (match) => match[0]))).sort();
}

function addMissingSourceIds(missing: string[], label: string, sourceContent: string | undefined, outputContent: string, pattern: RegExp): void {
  if (!sourceContent) return;
  const sourceIds = extractIds(sourceContent, pattern);
  if (!sourceIds.length) return;
  const missed = sourceIds.filter((id) => !outputContent.includes(id));
  if (missed.length) {
    missing.push(`${label}未继承：${missed.slice(0, 12).join("、")}${missed.length > 12 ? "…" : ""}`);
  }
}

function findSection(content: string, headingPattern: RegExp): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => headingPattern.test(line));
  if (start < 0) return "";
  const collected: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (i > start && /^#{1,3}\s+/.test(lines[i]) && !headingPattern.test(lines[i])) break;
    collected.push(lines[i]);
  }
  return collected.join("\n");
}

function addMissingMatrixSourceIds(missing: string[], label: string, sourceContent: string | undefined, outputContent: string, sourcePattern: RegExp, matrixHeading: RegExp): void {
  if (!sourceContent) return;
  const sourceIds = extractIds(sourceContent, sourcePattern);
  if (!sourceIds.length) return;
  const matrix = findSection(outputContent, matrixHeading);
  const missed = sourceIds.filter((id) => !matrix.includes(id));
  if (missed.length) {
    missing.push(`${label}未进入追踪矩阵：${missed.slice(0, 12).join("、")}${missed.length > 12 ? "…" : ""}`);
  }
}

function hasAny(content: string, patterns: Array<string | RegExp>): boolean {
  return patterns.some((pattern) => typeof pattern === "string" ? content.includes(pattern) : pattern.test(content));
}

export function validatePrdVisualFormat(content: string): PrdVisualValidationResult {
  const missing: string[] = [];
  const mermaidBlocks = content.match(/```mermaid\s*[\s\S]*?```/gi) ?? [];
  const mermaidContent = mermaidBlocks.join("\n\n");

  if (!/\bPRD-F-\d{3,}\b/.test(content)) {
    missing.push("PRD 功能编号 PRD-F-001");
  }
  if (mermaidBlocks.length < 3) {
    missing.push("至少 3 个 Mermaid 图代码块");
  }
  if (!/(?:^|\n)\s*(flowchart|graph)\b/i.test(mermaidContent)) {
    missing.push("业务流程图或页面结构图需要使用 flowchart/graph");
  }
  if (!/(?:^|\n)\s*stateDiagram-v2\b/i.test(mermaidContent)) {
    missing.push("状态流转图需要使用 stateDiagram-v2");
  }
  if (!/\bBF-\d{2,}\b/.test(content)) {
    missing.push("业务流程节点编号 BF-01");
  }
  if (!/\bPS-\d{2,}\b/.test(content)) {
    missing.push("页面结构节点编号 PS-01");
  }
  if (!/\bST-\d{2,}\b/.test(content)) {
    missing.push("状态流转节点编号 ST-01");
  }
  if (!content.includes("图文对照表")) {
    missing.push("图文对照表");
  }
  if (!content.includes("图节点编号")) {
    missing.push("图节点编号表头");
  }
  if (!content.includes("对应正文位置")) {
    missing.push("对应正文位置表头");
  }
  if (!/验收\/边界关注点|验收.*边界|边界.*验收/.test(content)) {
    missing.push("验收/边界关注点表头");
  }
  if (!content.includes("未入图说明")) {
    missing.push("未入图说明小节");
  }
  if (!content.includes("待确认图节点")) {
    missing.push("待确认图节点小节");
  }

  return { valid: missing.length === 0, missing };
}

export function validateRequirementsFormat(content: string, sourceContent?: string): DocumentValidationResult {
  const missing: string[] = [];

  if (!/\bREQ-\d{3,}\b/.test(content)) missing.push("需求编号 REQ-001");
  if (!/\bUS-\d{3,}\b/.test(content)) missing.push("用户故事编号 US-001");
  if (!/\bAC-\d{3,}\b/.test(content)) missing.push("验收条件编号 AC-001");
  if (!hasAny(content, ["需求追踪矩阵", "追踪矩阵"])) missing.push("需求追踪矩阵");
  if (!hasAny(content, ["PRD 编号", "PRD编号", "来源"])) missing.push("PRD 编号/来源列");
  if (!hasAny(content, ["In Scope", "范围内"])) missing.push("In Scope");
  if (!hasAny(content, ["Out of Scope", "范围外"])) missing.push("Out of Scope");
  if (!hasAny(content, ["正常流程", "主流程", "Happy Path"])) missing.push("正常流程");
  if (!hasAny(content, ["异常流程", "异常分支", "失败路径"])) missing.push("异常流程");
  if (!hasAny(content, ["边界行为", "边界场景", "边界条件"])) missing.push("边界行为");
  if (!hasAny(content, ["TBD", "待确认"])) missing.push("TBD/待确认事项");
  addMissingSourceIds(missing, "PRD 编号", sourceContent, content, /\bPRD-F-\d{3,}\b/g);
  addMissingMatrixSourceIds(missing, "PRD 编号", sourceContent, content, /\bPRD-F-\d{3,}\b/g, /需求追踪矩阵|追踪矩阵/);

  return { valid: missing.length === 0, missing };
}

export function validateUiDesignFormat(content: string, sourceContent?: string): DocumentValidationResult {
  const missing: string[] = [];

  if (!/\bUI-P\d{2,}\b/.test(content)) missing.push("页面编号 UI-P01");
  if (!/\bUI-S\d{2,}\b/.test(content)) missing.push("状态编号 UI-S01");
  if (!/\bUI-C\d{2,}\b/.test(content)) missing.push("组件编号 UI-C01");
  if (!/\bUI-I\d{2,}\b/.test(content)) missing.push("交互编号 UI-I01");
  if (!hasAny(content, ["UI 需求追踪矩阵", "需求追踪矩阵"])) missing.push("UI 需求追踪矩阵");
  if (!hasAny(content, ["REQ 编号", "REQ编号", /\bREQ-\d{3,}\b/])) missing.push("REQ 对应关系");
  if (!hasAny(content, ["页面清单", "页面列表"])) missing.push("页面清单");
  if (!hasAny(content, ["空态"])) missing.push("空态");
  if (!hasAny(content, ["加载态", "加载中"])) missing.push("加载态");
  if (!hasAny(content, ["错误态", "异常态"])) missing.push("错误态");
  if (!hasAny(content, ["组件列表"])) missing.push("组件列表");
  if (!hasAny(content, ["交互说明"])) missing.push("交互说明");
  addMissingSourceIds(missing, "REQ 编号", sourceContent, content, /\bREQ-\d{3,}\b/g);
  addMissingMatrixSourceIds(missing, "REQ 编号", sourceContent, content, /\bREQ-\d{3,}\b/g, /UI 需求追踪矩阵|需求追踪矩阵/);

  return { valid: missing.length === 0, missing };
}

export function validateDesignFormat(content: string, sourceContent?: string): DocumentValidationResult {
  const missing: string[] = [];

  if (!/\bAPI-\d{3,}\b/.test(content)) missing.push("API 编号 API-001");
  if (!/\bDB-\d{3,}\b/.test(content)) missing.push("数据库编号 DB-001");
  if (!/\bTEST-\d{3,}\b/.test(content)) missing.push("测试编号 TEST-001");
  if (!hasAny(content, ["设计追踪矩阵", "追踪矩阵"])) missing.push("设计追踪矩阵");
  if (!hasAny(content, ["REQ 编号", "REQ编号", /\bREQ-\d{3,}\b/])) missing.push("REQ 对应关系");
  if (!hasAny(content, ["UI 编号", "UI编号", /\bUI-P\d{2,}\b/])) missing.push("UI 对应关系");
  if (!hasAny(content, ["API 接口设计", "接口设计"])) missing.push("API 接口设计");
  if (!hasAny(content, ["数据库设计", "表结构"])) missing.push("数据库设计");
  if (!hasAny(content, ["业务逻辑"])) missing.push("业务逻辑设计");
  if (!hasAny(content, ["异常处理"])) missing.push("异常处理");
  if (!hasAny(content, ["权限设计"])) missing.push("权限设计");
  if (!hasAny(content, ["测试方案"])) missing.push("测试方案");
  if (!hasAny(content, ["开发任务拆分", "任务拆分"])) missing.push("开发任务拆分");
  addMissingSourceIds(missing, "REQ 编号", sourceContent, content, /\bREQ-\d{3,}\b/g);
  addMissingSourceIds(missing, "UI 编号", sourceContent, content, /\bUI-P\d{2,}\b/g);
  addMissingMatrixSourceIds(missing, "REQ 编号", sourceContent, content, /\bREQ-\d{3,}\b/g, /设计追踪矩阵|追踪矩阵/);
  addMissingMatrixSourceIds(missing, "UI 编号", sourceContent, content, /\bUI-P\d{2,}\b/g, /设计追踪矩阵|追踪矩阵/);

  return { valid: missing.length === 0, missing };
}

export function validateGeneratedDocumentFormat(docType: DocType, content: string, sourceContent?: string): DocumentValidationResult {
  if (docType === "prd") return validatePrdVisualFormat(content);
  if (docType === "requirements") return validateRequirementsFormat(content, sourceContent);
  if (docType === "ui") return validateUiDesignFormat(content, sourceContent);
  if (docType === "design") return validateDesignFormat(content, sourceContent);
  return { valid: true, missing: [] };
}

export function buildPrdVisualRepairPrompt(content: string, missing: string[], sourceContent?: string): { system: string; user: string } {
  return {
    system: [
      "你是严格的 PRD 图文格式审校器。",
      "你的任务是把已有 PRD 修正为合格 Markdown，不得删减业务信息，不得输出解释。",
      "必须保留原有 PRD 的业务含义，并按硬性格式补齐 Mermaid 图、节点编号、图文对照表、未入图说明和待确认图节点。",
      PRD_VISUAL_OUTPUT_RULE,
      "只输出完整修正版 PRD Markdown。",
    ].join("\n"),
    user: [
      "以下 PRD 未通过图文格式校验，请修正为完整合格版本。",
      "",
      `缺失项：${missing.join("、")}`,
      sourceContent ? "\n上游来源内容（用于继承编号和业务语义，不得忽略）：\n" : "",
      sourceContent || "",
      "",
      "原始 PRD：",
      content,
    ].join("\n"),
  };
}

export function buildDocumentRepairPrompt(docType: DocType, content: string, missing: string[], sourceContent?: string): { system: string; user: string } {
  if (docType === "prd") return buildPrdVisualRepairPrompt(content, missing, sourceContent);

  const rule = docType === "requirements"
    ? REQUIREMENTS_TRACEABILITY_RULE
    : docType === "ui"
      ? UI_TRACEABILITY_RULE
      : DESIGN_TRACEABILITY_RULE;
  const label = docType === "requirements" ? "需求文档" : docType === "ui" ? "UI 设计文档" : "详细设计文档";

  return {
    system: [
      `你是严格的${label}结构审校器。`,
      "你的任务是把已有文档修正为合格 Markdown，不得删减业务信息，不得输出解释。",
      "必须保留原有业务含义，并按硬性格式补齐追踪编号、追踪矩阵、必需章节和缺失项。",
      rule,
      "只输出完整修正版 Markdown。",
    ].join("\n"),
    user: [
      `以下${label}未通过结构校验，请修正为完整合格版本。`,
      "",
      `缺失项：${missing.join("、")}`,
      sourceContent ? "\n上游来源内容（用于继承编号和业务语义，不得忽略）：\n" : "",
      sourceContent || "",
      "",
      `原始${label}：`,
      content,
    ].join("\n"),
  };
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
2. **参考图片/项目风格必须严格还原**（最高优先级）：
   - 如果提供了参考图片，你必须像素级分析图片中的：配色方案（主色、辅色、背景色、文字颜色）、字体大小层级、间距规律、圆角大小、阴影样式、按钮风格、表格样式、导航布局、卡片设计
   - 如果提供了参考项目代码，你必须提取其中使用的 CSS 变量、主题色、组件库风格（如 Ant Design、Element 等），并在生成的 HTML 中复用完全一致的视觉风格
   - **绝对禁止**凭感觉或默认模板生成，必须基于参考资料中的实际样式
   - 布局结构、导航样式、侧边栏风格、头部栏设计必须与参考保持一致
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

export const UI_ANALYZE_PROMPT: PromptTemplate = {
  system: `你是一位专业的 UI/UX 需求分析师。你的任务是将项目文档、需求描述和项目技术分析转换为结构化的 UI 设计提示词，专门供 AI UI 生成器使用。

输出要求：
1. 分析输入的文档/需求，提取所有需要设计的页面、组件和交互
2. 为每个页面/组件生成详细的描述，包括：
   - 页面名称和用途
   - 布局结构（顶部导航、侧边栏、内容区等）
   - 关键 UI 元素（表格、表单、按钮、卡片等）
   - 交互状态（正常、悬停、加载、空状态等）
   - 配色和风格建议（基于项目已有设计语言）
3. 输出格式必须是清晰的中文描述，不要输出代码
4. 如果有参考图片或项目代码风格，要明确指出需要复用的设计元素

输出示例：
---
## 页面清单

### 1. 用户列表页
- 布局：左侧侧边栏导航 + 顶部面包屑 + 主内容区表格
- 表格列：用户名、邮箱、角色、状态、操作
- 操作按钮：编辑、删除、重置密码
- 顶部区域：搜索框 + 筛选器 + "新增用户"按钮
- 分页器：底部居中
...
---`,
  userPrefix: `请分析以下项目信息和需求描述，提取所有需要设计的 UI 页面和组件，并为每个页面生成详细的 UI 设计提示词描述：

`,
};

export interface BuildUIAnalyzePromptOptions {
  projectName?: string;
  userContent?: string;
  referenceContent?: string;
  projectContext?: string;
  imageCount?: number;
  isModuleScope?: boolean;
}

export interface BuildUIImagePromptOptions {
  projectName?: string;
  analyzedPrompt: string;
  referenceContent?: string;
  projectContext?: string;
  imageCount?: number;
  imageMode?: "fast" | "quality";
  isModuleScope?: boolean;
}

export function buildUIAnalyzePrompt(options: BuildUIAnalyzePromptOptions): { system: string; user: string } {
  let user = UI_ANALYZE_PROMPT.userPrefix;

  if (options.projectName?.trim()) {
    user += `**项目/模块名称：** ${options.projectName.trim()}\n\n`;
  }

  if (options.isModuleScope) {
    user += `**${STRICT_REFERENCE_ADHERENCE_RULE}**\n\n`;
    user += "**需求范围：** 模块级别。请明确该模块在整体系统中的位置、上下游关系、导航入口和复用的组件/样式规范。\n\n";
  } else {
    user += "**需求范围：** 项目级别。请按完整项目体验拆分页面、导航和关键流程。\n\n";
  }

  if (options.projectContext?.trim()) {
    user += `**项目技术与样式分析：**\n${options.projectContext.trim()}\n\n---\n\n`;
  }

  if (options.referenceContent?.trim()) {
    user += `**参考文档内容：**\n${options.referenceContent.trim()}\n\n---\n\n`;
  }

  if ((options.imageCount ?? 0) > 0) {
    user += `**参考图片：** 已附带 ${options.imageCount} 张参考图片。请分析图片中的布局结构、字体层级、颜色、间距、圆角、阴影、表格/表单/按钮样式，并把这些约束转写为清晰的 UI 生成提示词。\n\n`;
  }

  user += `**原始需求描述：**\n${options.userContent?.trim() || "请基于参考资料分析需要生成的 UI 页面。"}\n\n`;
  user += "请输出可直接交给 UI 出图模型使用的结构化中文提示词，必须包含页面清单、每个页面的布局、组件、状态、交互、数据示例和视觉风格约束。";

  return {
    system: options.isModuleScope
      ? `${UI_ANALYZE_PROMPT.system}\n\n${STRICT_REFERENCE_ADHERENCE_RULE}`
      : UI_ANALYZE_PROMPT.system,
    user,
  };
}

export function buildUIImagePrompt(options: BuildUIImagePromptOptions): { system: string; user: string } {
  let user = UI_IMAGE_PROMPT.userPrefix;
  const imageMode = options.imageMode === "quality" ? "quality" : "fast";

  if (options.projectName?.trim()) {
    user += `**项目/模块名称：** ${options.projectName.trim()}\n\n`;
  }

  if (options.isModuleScope) {
    user += `**${STRICT_REFERENCE_ADHERENCE_RULE}**\n\n`;
  }

  if (imageMode === "quality") {
    user += "**生成策略：高保真模式。** 在保证输出可控的前提下尽量还原完整页面细节，最多生成 5 个最关键页面/状态。不要无限展开所有弹窗、边缘状态和重复页面。\n\n";
  } else {
    user += "**生成策略：快速预览模式。** 请优先保证速度和首版可见结果，只生成 1-2 个最核心页面/状态；每页保留首屏关键布局、主导航、核心表单/表格/卡片和 2-3 行示例数据；暂不展开所有弹窗、边缘状态和重复页面。\n\n";
  }

  if (options.projectContext?.trim()) {
    user += `**项目技术与样式分析：**\n${options.projectContext.trim()}\n\n---\n\n`;
  }

  if (options.referenceContent?.trim()) {
    user += `**参考文档内容：**\n${options.referenceContent.trim()}\n\n---\n\n`;
  }

  if ((options.imageCount ?? 0) > 0) {
    user += `**重要：已附带 ${options.imageCount} 张参考图片。你必须严格复用图片中的视觉风格，并结合下方已分析提示词生成 HTML/CSS。**\n\n`;
  }

  user += `**已分析生成的 UI 出图提示词：**\n${options.analyzedPrompt.trim()}\n\n`;
  user += imageMode === "quality"
    ? "请严格根据上述提示词生成页面，不要重新解释需求。输出必须使用 <!-- PAGE_START: 页面名称 --> 和 <!-- PAGE_END --> 包裹每个页面，并且总页面数不得超过 5 个。"
    : "请严格根据上述提示词生成页面，不要重新解释需求。输出必须使用 <!-- PAGE_START: 页面名称 --> 和 <!-- PAGE_END --> 包裹每个页面，并且总页面数不得超过 2 个。";

  return {
    system: options.isModuleScope
      ? `${UI_IMAGE_PROMPT.system}\n\n${STRICT_REFERENCE_ADHERENCE_RULE}`
      : UI_IMAGE_PROMPT.system,
    user,
  };
}

export function buildDirectUIImagePrompt(options: BuildUIImagePromptOptions): string {
  const parts = [
    "请直接生成一张高保真的桌面端 Web 产品界面图片，不要输出 HTML、CSS、Markdown 或解释文字。",
    "图片应像真实产品截图：布局完整、层级清晰、文字可读、组件状态自然，避免抽象海报风格。",
    options.isModuleScope ? STRICT_REFERENCE_ADHERENCE_RULE : "",
    options.imageMode === "quality"
      ? "请优先保证视觉质量、细节完整度和可交付效果。"
      : "请优先生成清晰可用的首版预览，聚焦核心页面和首屏内容。",
  ];

  if (options.projectName?.trim()) {
    parts.push(`项目/模块名称：${options.projectName.trim()}`);
  }
  if (options.projectContext?.trim()) {
    parts.push(`项目技术与样式分析：\n${options.projectContext.trim()}`);
  }
  if (options.referenceContent?.trim()) {
    parts.push(`参考文档内容：\n${options.referenceContent.trim()}`);
  }
  if ((options.imageCount ?? 0) > 0) {
    parts.push(`已提供 ${options.imageCount} 张参考图片。请尽量复用参考图中的配色、布局、字号、间距和组件风格。`);
  }
  parts.push(`UI 设计提示词：\n${options.analyzedPrompt.trim()}`);
  return parts.filter(Boolean).join("\n\n");
}

export function buildPrompt(
  docType: DocType,
  projectName: string,
  userContent: string,
  referenceContent: string,
  customPrompts?: Record<string, string> | null,
  projectContext?: string,
  isModuleScope = false,
): { system: string; user: string } {
  const tmpl = PROMPTS[docType];
  let system = customPrompts?.[docType]?.trim() || tmpl.system;
  if (isModuleScope) {
    system += `\n\n${STRICT_REFERENCE_ADHERENCE_RULE}`;
  }
  if (docType === "prd") {
    system += `\n\n${PRD_VISUAL_OUTPUT_RULE}`;
  } else if (docType === "requirements") {
    system += `\n\n${REQUIREMENTS_TRACEABILITY_RULE}`;
  } else if (docType === "ui") {
    system += `\n\n${UI_TRACEABILITY_RULE}`;
  } else if (docType === "design") {
    system += `\n\n${DESIGN_TRACEABILITY_RULE}`;
  }

  if (projectContext) {
    system += `\n\n请结合以下项目分析上下文来生成更贴合项目实际情况的文档。如果项目分析中包含了技术栈、框架、模块结构等信息，请在文档中充分利用这些信息。`;
    system += `\n\n重要约束：项目分析上下文是最高优先级事实来源。不得臆测上下文中没有证据支持的技术栈、数据库、中间件或框架。`;
    system += `如果上下文显示数据库/数据源为 Oracle 或 OB Oracle，请按 Oracle/OB Oracle 语义描述数据字段、SQL、事务和约束；不得写成 MySQL 或 PostgreSQL。`;
    system += `如果上下文没有明确数据库证据，请写“数据库类型待确认”，不要自行补充 MySQL、PostgreSQL 或其他数据库实现细节。`;
  }

  let user = tmpl.userPrefix;
  if (projectName) {
    user += `**项目/模块名称：** ${projectName}\n\n`;
  }
  if (isModuleScope) {
    user += `**${STRICT_REFERENCE_ADHERENCE_RULE}**\n\n`;
  }
  if (docType === "prd") {
    user += `**PRD 图示输出要求：**\n${PRD_VISUAL_OUTPUT_RULE}\n\n`;
  } else if (docType === "requirements") {
    user += `**需求追踪输出要求：**\n${REQUIREMENTS_TRACEABILITY_RULE}\n\n`;
  } else if (docType === "ui") {
    user += `**UI 追踪输出要求：**\n${UI_TRACEABILITY_RULE}\n\n`;
  } else if (docType === "design") {
    user += `**详细设计追踪输出要求：**\n${DESIGN_TRACEABILITY_RULE}\n\n`;
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

const MISSING_API_KEY_MESSAGE = "当前 AI 服务商未配置 API Key，请在「配置管理 → AI 模型配置」中设置";

function assertProviderApiKey(provider: AiProvider): void {
  if (!provider.apiKey) throw new Error(MISSING_API_KEY_MESSAGE);
}

export class AiService {
  private readonly imageProvider = new OpenAICompatibleImageProvider();

  async listModels(provider: AiProvider): Promise<string[]> {
    return listAvailableModels(provider);
  }

  /**
   * 发送极简请求验证 API Key 与网络；成功则 resolve，失败则 throw
   */
  async testConnection(provider: AiProvider): Promise<void> {
    return testAiConnection(provider);
  }

  async generate(
    provider: AiProvider,
    system: string,
    user: string,
    images?: Array<{ base64: string; mimeType: string }>,
    signal?: AbortSignal,
    maxTokens = 16384,
  ): Promise<string> {
    assertProviderApiKey(provider);
    return provider.id === "anthropic"
      ? this.callAnthropic(provider, system, user, images, signal, maxTokens)
      : this.callOpenAI(provider, system, user, images, signal, maxTokens);
  }

  async generateStream(
    provider: AiProvider,
    system: string,
    user: string,
    onChunk: (chunk: string) => void,
    images?: Array<{ base64: string; mimeType: string }>,
    signal?: AbortSignal,
    maxTokens = 16384,
  ): Promise<string> {
    assertProviderApiKey(provider);
    return provider.id === "anthropic"
      ? this.callAnthropicStream(provider, system, user, onChunk, images, signal, maxTokens)
      : this.callOpenAIStream(provider, system, user, onChunk, images, signal, maxTokens);
  }

  getModelOutputKind(provider: AiProvider): "image" | "text" | "unknown" {
    return getModelOutputKind(provider);
  }

  isImageGenerationModel(provider: AiProvider): boolean {
    return isImageGenerationModel(provider);
  }

  async generateImage(provider: AiProvider, prompt: string, options: ImageGenerationOptions = {}): Promise<GeneratedImage> {
    assertProviderApiKey(provider);
    return this.imageProvider.generateImage(provider, prompt, options);
  }

  private async callOpenAI(
    provider: AiProvider,
    system: string,
    user: string,
    images?: Array<{ base64: string; mimeType: string }>,
    signal?: AbortSignal,
    maxTokens = 16384,
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
          { role: "user", content: buildOpenAIUserContent(user, images) },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
      signal,
    });
    if (!res.ok) {
      await throwProviderResponseError(res, `${provider.name} API 调用失败`);
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
    maxTokens = 16384,
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
          { role: "user", content: buildOpenAIUserContent(user, images) },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
        stream: true,
      }),
      signal,
    });
    if (!res.ok) {
      await throwProviderResponseError(res, `${provider.name} API 流式调用失败`);
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

  private async callAnthropic(
    provider: AiProvider,
    system: string,
    user: string,
    images?: Array<{ base64: string; mimeType: string }>,
    signal?: AbortSignal,
    maxTokens = 16384,
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
        messages: [{ role: "user", content: buildAnthropicUserContent(user, images) }],
        max_tokens: maxTokens,
      }),
      signal,
    });
    if (!res.ok) {
      await throwProviderResponseError(res, "Anthropic API 调用失败");
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
    maxTokens = 16384,
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
        messages: [{ role: "user", content: buildAnthropicUserContent(user, images) }],
        max_tokens: maxTokens,
        stream: true,
      }),
      signal,
    });
    if (!res.ok) {
      await throwProviderResponseError(res, "Anthropic API 流式调用失败");
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
