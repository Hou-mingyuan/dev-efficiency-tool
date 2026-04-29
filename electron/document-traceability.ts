export type TraceableDocType = "prd" | "requirements" | "ui" | "design";

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

export interface DocumentValidationResult {
  valid: boolean;
  missing: string[];
}

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

function addMissingMatrixLocalIds(missing: string[], label: string, outputContent: string, localPattern: RegExp, matrixHeading: RegExp): void {
  const localIds = extractIds(outputContent, localPattern);
  if (!localIds.length) return;
  const matrix = findSection(outputContent, matrixHeading);
  const missed = localIds.filter((id) => !matrix.includes(id));
  if (missed.length) {
    missing.push(`${label}未进入追踪矩阵：${missed.slice(0, 12).join("、")}${missed.length > 12 ? "…" : ""}`);
  }
}

function hasAny(content: string, patterns: Array<string | RegExp>): boolean {
  return patterns.some((pattern) => typeof pattern === "string" ? content.includes(pattern) : pattern.test(content));
}

export function validatePrdVisualFormat(content: string): DocumentValidationResult {
  const missing: string[] = [];
  const mermaidBlocks = content.match(/```mermaid\s*[\s\S]*?```/gi) ?? [];
  const mermaidContent = mermaidBlocks.join("\n\n");

  if (!/\bPRD-F-\d{3,}\b/.test(content)) missing.push("PRD 功能编号 PRD-F-001");
  if (mermaidBlocks.length < 3) missing.push("至少 3 个 Mermaid 图代码块");
  if (!/(?:^|\n)\s*(flowchart|graph)\b/i.test(mermaidContent)) missing.push("业务流程图或页面结构图需要使用 flowchart/graph");
  if (!/(?:^|\n)\s*stateDiagram-v2\b/i.test(mermaidContent)) missing.push("状态流转图需要使用 stateDiagram-v2");
  if (!/\bBF-\d{2,}\b/.test(content)) missing.push("业务流程节点编号 BF-01");
  if (!/\bPS-\d{2,}\b/.test(content)) missing.push("页面结构节点编号 PS-01");
  if (!/\bST-\d{2,}\b/.test(content)) missing.push("状态流转节点编号 ST-01");
  if (!content.includes("图文对照表")) missing.push("图文对照表");
  if (!content.includes("图节点编号")) missing.push("图节点编号表头");
  if (!content.includes("对应正文位置")) missing.push("对应正文位置表头");
  if (!/验收\/边界关注点|验收.*边界|边界.*验收/.test(content)) missing.push("验收/边界关注点表头");
  if (!content.includes("未入图说明")) missing.push("未入图说明小节");
  if (!content.includes("待确认图节点")) missing.push("待确认图节点小节");

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
  addMissingMatrixLocalIds(missing, "REQ 编号", content, /\bREQ-\d{3,}\b/g, /需求追踪矩阵|追踪矩阵/);
  addMissingMatrixLocalIds(missing, "用户故事编号", content, /\bUS-\d{3,}\b/g, /需求追踪矩阵|追踪矩阵/);
  addMissingMatrixLocalIds(missing, "验收条件编号", content, /\bAC-\d{3,}\b/g, /需求追踪矩阵|追踪矩阵/);

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
  addMissingMatrixLocalIds(missing, "页面编号", content, /\bUI-P\d{2,}\b/g, /UI 需求追踪矩阵|需求追踪矩阵/);
  addMissingMatrixLocalIds(missing, "状态编号", content, /\bUI-S\d{2,}\b/g, /UI 需求追踪矩阵|需求追踪矩阵/);
  addMissingMatrixLocalIds(missing, "组件编号", content, /\bUI-C\d{2,}\b/g, /UI 需求追踪矩阵|需求追踪矩阵/);
  addMissingMatrixLocalIds(missing, "交互编号", content, /\bUI-I\d{2,}\b/g, /UI 需求追踪矩阵|需求追踪矩阵/);

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
  addMissingMatrixLocalIds(missing, "API 编号", content, /\bAPI-\d{3,}\b/g, /设计追踪矩阵|追踪矩阵/);
  addMissingMatrixLocalIds(missing, "数据库编号", content, /\bDB-\d{3,}\b/g, /设计追踪矩阵|追踪矩阵/);
  addMissingMatrixLocalIds(missing, "测试编号", content, /\bTEST-\d{3,}\b/g, /设计追踪矩阵|追踪矩阵/);
  addMissingMatrixLocalIds(missing, "开发任务编号", content, /\bTASK-\d{3,}\b/g, /设计追踪矩阵|追踪矩阵/);

  return { valid: missing.length === 0, missing };
}

export function validateGeneratedDocumentFormat(docType: TraceableDocType, content: string, sourceContent?: string): DocumentValidationResult {
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

export function buildDocumentRepairPrompt(docType: TraceableDocType, content: string, missing: string[], sourceContent?: string): { system: string; user: string } {
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

export function buildDocumentSemanticAuditPrompt(docType: TraceableDocType, content: string, sourceContent: string): { system: string; user: string } {
  const label = docType === "prd"
    ? "PRD"
    : docType === "requirements"
      ? "需求文档"
      : docType === "ui"
        ? "UI 设计文档"
        : "详细设计文档";

  return {
    system: [
      `你是严格的${label}跨文档一致性审校器。`,
      "你的任务是对比上游来源内容和生成结果，找出语义遗漏、编号断链、范围偏差、异常/边界遗漏。",
      "只输出 Markdown 审校报告，不要改写原文，不要输出无关解释。",
      "如果没有发现问题，也必须输出“未发现明显遗漏”。",
    ].join("\n"),
    user: [
      "请审校以下生成结果是否完整承接上游来源内容。",
      "",
      "审校输出结构：",
      "## 自动一致性审校报告",
      "- 编号继承：列出断链或未承接编号；没有则写“未发现明显遗漏”。",
      "- 业务语义：列出上游有但下游缺失或表达偏差的内容；没有则写“未发现明显遗漏”。",
      "- 边界/异常：列出缺失的异常、边界、权限、失败场景；没有则写“未发现明显遗漏”。",
      "- 建议补充：给出可以直接追加到文档的简短建议；没有则写“无”。",
      "",
      "上游来源内容：",
      sourceContent.slice(0, 20000),
      "",
      "生成结果：",
      content.slice(0, 30000),
    ].join("\n"),
  };
}
