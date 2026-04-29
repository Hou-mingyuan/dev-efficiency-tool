import { describe, expect, it } from "vitest";
import {
  buildDirectUIImagePrompt,
  buildDocumentRepairPrompt,
  buildPrompt,
  buildPrdVisualRepairPrompt,
  buildUIAnalyzePrompt,
  buildUIImagePrompt,
  DESIGN_TRACEABILITY_RULE,
  PRD_VISUAL_OUTPUT_RULE,
  REQUIREMENTS_TRACEABILITY_RULE,
  STRICT_REFERENCE_ADHERENCE_RULE,
  UI_TRACEABILITY_RULE,
  validateGeneratedDocumentFormat,
  validatePrdVisualFormat,
} from "../ai-service";

describe("document prompt builder", () => {
  it("uses custom prompts and includes project context and references without module-only hard constraints", () => {
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
    expect(prompt.system).not.toContain(STRICT_REFERENCE_ADHERENCE_RULE);
    expect(prompt.user).toContain("订单系统");
    expect(prompt.user).not.toContain("必须严格遵守参考项目");
    expect(prompt.user).toContain("Vue 3 + Ant Design Vue");
    expect(prompt.user).toContain("实现订单列表、筛选和详情页");
    expect(prompt.user).toContain("参考文档：列表支持导出");
  });

  it("adds strict reference adherence only for module-level documents", () => {
    const prompt = buildPrompt(
      "design",
      "订单模块",
      "实现订单列表、筛选和详情页",
      "参考文档：列表支持导出",
      { design: "自定义详设系统提示词" },
      "项目分析：Vue 3 + Ant Design Vue",
      true,
    );

    expect(prompt.system).toContain(STRICT_REFERENCE_ADHERENCE_RULE);
    expect(prompt.user).toContain("必须严格遵守参考项目");
    expect(prompt.user).toContain("项目风格");
    expect(prompt.user).toContain("组件框架");
  });

  it("adds Mermaid visual output requirements for PRD documents", () => {
    const prompt = buildPrompt(
      "prd",
      "风控系统",
      "生成年度风险评估 PRD",
      "",
    );

    expect(prompt.system).toContain(PRD_VISUAL_OUTPUT_RULE);
    expect(prompt.user).toContain("PRD 图示输出要求");
    expect(prompt.user).toContain("业务流程图");
    expect(prompt.user).toContain("页面结构图");
    expect(prompt.user).toContain("状态流转图");
    expect(prompt.user).toContain("```mermaid");
    expect(prompt.user).toContain("正文说明 → Mermaid 图 → 图文对照表");
    expect(prompt.user).toContain("BF-01");
    expect(prompt.user).toContain("图节点编号");
    expect(prompt.user).toContain("对应正文位置");
  });

  it("adds traceability requirements for requirements, UI and design documents", () => {
    const requirementsPrompt = buildPrompt("requirements", "订单系统", "基于 PRD 生成需求", "");
    const uiPrompt = buildPrompt("ui", "订单系统", "基于需求生成 UI", "");
    const designPrompt = buildPrompt("design", "订单系统", "基于 UI 生成详设", "");

    expect(requirementsPrompt.system).toContain(REQUIREMENTS_TRACEABILITY_RULE);
    expect(requirementsPrompt.user).toContain("REQ-001");
    expect(requirementsPrompt.user).toContain("需求追踪矩阵");
    expect(uiPrompt.system).toContain(UI_TRACEABILITY_RULE);
    expect(uiPrompt.user).toContain("UI-P01");
    expect(uiPrompt.user).toContain("UI 需求追踪矩阵");
    expect(designPrompt.system).toContain(DESIGN_TRACEABILITY_RULE);
    expect(designPrompt.user).toContain("API-001");
    expect(designPrompt.user).toContain("设计追踪矩阵");
  });

  it("validates PRD visual text-to-diagram binding format", () => {
    const invalid = validatePrdVisualFormat("## PRD\n\n只有文字，没有图。");
    expect(invalid.valid).toBe(false);
    expect(invalid.missing).toContain("至少 3 个 Mermaid 图代码块");

    const valid = validatePrdVisualFormat(`
## 功能需求清单
PRD-F-001 支持用户提交申请。

## 业务流程说明
BF-01 用户提交，BF-02 系统审核。

\`\`\`mermaid
flowchart TD
  BF01["BF-01 用户提交"] --> BF02["BF-02 系统审核"]
\`\`\`

### 图文对照表
| 图节点编号 | 节点含义 | 对应正文位置 | 验收/边界关注点 |
|---|---|---|---|
| BF-01 | 用户提交 | 业务流程说明 | 校验必填 |

### 未入图说明
无

### 待确认图节点
无

## 页面结构说明
PS-01 列表页，PS-02 详情页。

\`\`\`mermaid
graph LR
  PS01["PS-01 列表页"] --> PS02["PS-02 详情页"]
\`\`\`

### 图文对照表
| 图节点编号 | 节点含义 | 对应正文位置 | 验收/边界关注点 |
|---|---|---|---|
| PS-01 | 列表页 | 页面结构说明 | 空态和分页 |

### 未入图说明
无

### 待确认图节点
无

## 状态流转说明
ST-01 草稿，ST-02 已提交。

\`\`\`mermaid
stateDiagram-v2
  ST01: ST-01 草稿
  ST02: ST-02 已提交
  ST01 --> ST02
\`\`\`

### 图文对照表
| 图节点编号 | 节点含义 | 对应正文位置 | 验收/边界关注点 |
|---|---|---|---|
| ST-01 | 草稿 | 状态流转说明 | 可编辑 |

### 未入图说明
无

### 待确认图节点
无
`);
    expect(valid.valid).toBe(true);
  });

  it("builds a PRD visual repair prompt with missing items", () => {
    const prompt = buildPrdVisualRepairPrompt("## 原始 PRD", ["图文对照表"], "PRD-F-001 上游功能");

    expect(prompt.system).toContain("严格的 PRD 图文格式审校器");
    expect(prompt.system).toContain(PRD_VISUAL_OUTPUT_RULE);
    expect(prompt.user).toContain("缺失项：图文对照表");
    expect(prompt.user).toContain("上游来源内容");
    expect(prompt.user).toContain("PRD-F-001 上游功能");
    expect(prompt.user).toContain("## 原始 PRD");
  });

  it("validates all generated document formats", () => {
    expect(validateGeneratedDocumentFormat("requirements", `
## 需求追踪矩阵
| PRD 编号/来源 | REQ 编号 | 用户故事编号 | 验收条件编号 | 状态 |
|---|---|---|---|---|
| PRD-F-001 | REQ-001 | US-001 | AC-001 | 已覆盖 |

## REQ-001 功能需求
In Scope：本期支持创建订单。
Out of Scope：暂不支持批量导入。
TBD/待确认事项：审批规则待确认。
正常流程：用户提交订单。
异常流程：库存不足时提示失败。
边界行为：重复提交时保持幂等。
`).valid).toBe(true);

    expect(validateGeneratedDocumentFormat("ui", `
## UI 需求追踪矩阵
| REQ 编号 | 页面编号 | 状态编号 | 组件编号 | 交互编号 | 验收关注点 |
|---|---|---|---|---|---|
| REQ-001 | UI-P01 | UI-S01 | UI-C01 | UI-I01 | 空态、加载态、错误态可见 |

## 页面清单
UI-P01 订单列表页。
UI-S01 空态；UI-S02 加载态；UI-S03 错误态。
组件列表：UI-C01 筛选表单。
交互说明：UI-I01 点击查询。
`).valid).toBe(true);

    expect(validateGeneratedDocumentFormat("design", `
## 设计追踪矩阵
| REQ 编号 | UI 编号 | API 编号 | DB 编号 | TEST 编号 | 开发任务编号 |
|---|---|---|---|---|---|
| REQ-001 | UI-P01 | API-001 | DB-001 | TEST-001 | TASK-001 |

## API 接口设计
API-001 创建订单。
## 数据库设计
DB-001 order 表结构。
## 业务逻辑
覆盖正常与异常分支。
## 异常处理
参数错误返回错误码。
## 权限设计
需要订单创建权限。
## 测试方案
TEST-001 覆盖创建订单。
## 开发任务拆分
TASK-001 实现接口。
`).valid).toBe(true);
  });

  it("requires generated documents to inherit upstream trace ids", () => {
    const requirements = validateGeneratedDocumentFormat("requirements", `
## 需求追踪矩阵
| PRD 编号/来源 | REQ 编号 | 用户故事编号 | 验收条件编号 | 状态 |
|---|---|---|---|---|
| PRD-F-001 | REQ-001 | US-001 | AC-001 | 已覆盖 |
In Scope：本期支持创建订单。
Out of Scope：暂不支持批量导入。
TBD/待确认事项：审批规则待确认。
正常流程：用户提交订单。
异常流程：库存不足时提示失败。
边界行为：重复提交时保持幂等。
`, "上游 PRD：PRD-F-001 创建订单；PRD-F-002 审批订单。");

    expect(requirements.valid).toBe(false);
    expect(requirements.missing.join("、")).toContain("PRD-F-002");

    const ui = validateGeneratedDocumentFormat("ui", `
## UI 需求追踪矩阵
| REQ 编号 | 页面编号 | 状态编号 | 组件编号 | 交互编号 | 验收关注点 |
|---|---|---|---|---|---|
| REQ-001 | UI-P01 | UI-S01 | UI-C01 | UI-I01 | 空态、加载态、错误态可见 |
## 页面清单
UI-P01 订单列表页。
UI-S01 空态；UI-S02 加载态；UI-S03 错误态。
组件列表：UI-C01 筛选表单。
交互说明：UI-I01 点击查询。
`, "上游需求：REQ-001 查询订单；REQ-002 创建订单。");

    expect(ui.valid).toBe(false);
    expect(ui.missing.join("、")).toContain("REQ-002");

    const design = validateGeneratedDocumentFormat("design", `
## 设计追踪矩阵
| REQ 编号 | UI 编号 | API 编号 | DB 编号 | TEST 编号 | 开发任务编号 |
|---|---|---|---|---|---|
| REQ-001 | UI-P01 | API-001 | DB-001 | TEST-001 | TASK-001 |
## API 接口设计
API-001 创建订单。
## 数据库设计
DB-001 order 表结构。
## 业务逻辑
覆盖正常与异常分支。
## 异常处理
参数错误返回错误码。
## 权限设计
需要订单创建权限。
## 测试方案
TEST-001 覆盖创建订单。
## 开发任务拆分
TASK-001 实现接口。
`, "上游文档：REQ-001 查询订单；REQ-002 创建订单；UI-P01 列表页；UI-P02 详情页。");

    expect(design.valid).toBe(false);
    expect(design.missing.join("、")).toContain("REQ-002");
    expect(design.missing.join("、")).toContain("UI-P02");
  });

  it("requires inherited upstream ids to appear in trace matrices", () => {
    const requirements = validateGeneratedDocumentFormat("requirements", `
## 需求追踪矩阵
| PRD 编号/来源 | REQ 编号 | 用户故事编号 | 验收条件编号 | 状态 |
|---|---|---|---|---|
| PRD-F-001 | REQ-001 | US-001 | AC-001 | 已覆盖 |

## 补充说明
PRD-F-002 也被正文提到，但没有进入矩阵。
In Scope：本期支持创建订单。
Out of Scope：暂不支持批量导入。
TBD/待确认事项：审批规则待确认。
正常流程：用户提交订单。
异常流程：库存不足时提示失败。
边界行为：重复提交时保持幂等。
`, "上游 PRD：PRD-F-001 创建订单；PRD-F-002 审批订单。");

    expect(requirements.valid).toBe(false);
    expect(requirements.missing.join("、")).toContain("PRD 编号未进入追踪矩阵");
    expect(requirements.missing.join("、")).toContain("PRD-F-002");

    const ui = validateGeneratedDocumentFormat("ui", `
## UI 需求追踪矩阵
| REQ 编号 | 页面编号 | 状态编号 | 组件编号 | 交互编号 | 验收关注点 |
|---|---|---|---|---|---|
| REQ-001 | UI-P01 | UI-S01 | UI-C01 | UI-I01 | 空态、加载态、错误态可见 |

## 页面清单
REQ-002 在正文提到但没有进入矩阵。
UI-P01 订单列表页。
UI-S01 空态；UI-S02 加载态；UI-S03 错误态。
组件列表：UI-C01 筛选表单。
交互说明：UI-I01 点击查询。
`, "上游需求：REQ-001 查询订单；REQ-002 创建订单。");

    expect(ui.valid).toBe(false);
    expect(ui.missing.join("、")).toContain("REQ 编号未进入追踪矩阵");
    expect(ui.missing.join("、")).toContain("REQ-002");

    const design = validateGeneratedDocumentFormat("design", `
## 设计追踪矩阵
| REQ 编号 | UI 编号 | API 编号 | DB 编号 | TEST 编号 | 开发任务编号 |
|---|---|---|---|---|---|
| REQ-001 | UI-P01 | API-001 | DB-001 | TEST-001 | TASK-001 |

## API 接口设计
API-001 创建订单，REQ-002 和 UI-P02 在正文里被提到但没有进入矩阵。
## 数据库设计
DB-001 order 表结构。
## 业务逻辑
覆盖正常与异常分支。
## 异常处理
参数错误返回错误码。
## 权限设计
需要订单创建权限。
## 测试方案
TEST-001 覆盖创建订单。
## 开发任务拆分
TASK-001 实现接口。
`, "上游文档：REQ-001 查询订单；REQ-002 创建订单；UI-P01 列表页；UI-P02 详情页。");

    expect(design.valid).toBe(false);
    expect(design.missing.join("、")).toContain("REQ 编号未进入追踪矩阵");
    expect(design.missing.join("、")).toContain("UI 编号未进入追踪矩阵");
    expect(design.missing.join("、")).toContain("REQ-002");
    expect(design.missing.join("、")).toContain("UI-P02");
  });

  it("builds generic document repair prompts", () => {
    const prompt = buildDocumentRepairPrompt("requirements", "## 原始需求", ["需求追踪矩阵"], "PRD-F-002 审批订单");

    expect(prompt.system).toContain("需求文档结构审校器");
    expect(prompt.system).toContain(REQUIREMENTS_TRACEABILITY_RULE);
    expect(prompt.user).toContain("缺失项：需求追踪矩阵");
    expect(prompt.user).toContain("上游来源内容");
    expect(prompt.user).toContain("PRD-F-002 审批订单");
    expect(prompt.user).toContain("## 原始需求");
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
    expect(prompt.system).toContain(STRICT_REFERENCE_ADHERENCE_RULE);
    expect(prompt.user).toContain("订单系统");
    expect(prompt.user).toContain("必须严格遵守参考项目");
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
      isModuleScope: true,
    });

    expect(prompt.system).toContain("前端 UI 设计与开发专家");
    expect(prompt.system).toContain(STRICT_REFERENCE_ADHERENCE_RULE);
    expect(prompt.user).toContain("订单系统");
    expect(prompt.user).toContain("必须严格遵守参考项目");
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

    expect(prompt.system).not.toContain(STRICT_REFERENCE_ADHERENCE_RULE);
    expect(prompt.user).not.toContain("必须严格遵守参考项目");
    expect(prompt.user).toContain("快速预览模式");
    expect(prompt.user).toContain("只生成 1-2 个最核心页面");
    expect(prompt.user).toContain("总页面数不得超过 2 个");
  });

  it("builds a direct image prompt with strict reference adherence", () => {
    const prompt = buildDirectUIImagePrompt({
      projectName: "订单系统",
      analyzedPrompt: "页面清单：订单列表页",
      referenceContent: "参考视觉：沿用 Ant Design 表格和蓝色主按钮",
      projectContext: "组件库：Ant Design Vue；目录结构：src/views",
      imageCount: 1,
      imageMode: "quality",
      isModuleScope: true,
    });

    expect(prompt).toContain(STRICT_REFERENCE_ADHERENCE_RULE);
    expect(prompt).toContain("必须严格遵守参考项目");
    expect(prompt).toContain("参考视觉：沿用 Ant Design 表格和蓝色主按钮");
    expect(prompt).toContain("组件库：Ant Design Vue");
    expect(prompt).toContain("已提供 1 张参考图片");
  });

  it("does not add strict reference adherence to project-level direct image prompts", () => {
    const prompt = buildDirectUIImagePrompt({
      projectName: "订单系统",
      analyzedPrompt: "页面清单：订单列表页",
      referenceContent: "参考视觉：沿用 Ant Design 表格和蓝色主按钮",
      projectContext: "组件库：Ant Design Vue",
      imageMode: "quality",
    });

    expect(prompt).not.toContain(STRICT_REFERENCE_ADHERENCE_RULE);
    expect(prompt).not.toContain("必须严格遵守参考项目");
    expect(prompt).toContain("参考视觉：沿用 Ant Design 表格和蓝色主按钮");
  });
});
