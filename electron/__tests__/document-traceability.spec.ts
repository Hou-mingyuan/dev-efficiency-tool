import { describe, expect, it } from "vitest";
import {
  buildDocumentRepairPrompt,
  buildDocumentSemanticAuditPrompt,
  buildPrdVisualRepairPrompt,
  REQUIREMENTS_TRACEABILITY_RULE,
  validateGeneratedDocumentFormat,
  validatePrdVisualFormat,
} from "../document-traceability";

describe("document traceability validation", () => {
  it("validates PRD visual text-to-diagram binding format", () => {
    const invalid = validatePrdVisualFormat("## PRD\n\n只有文字，没有图。");
    expect(invalid.valid).toBe(false);
    expect(invalid.missing).toContain("PRD 功能编号 PRD-F-001");
    expect(invalid.missing).toContain("至少 3 个 Mermaid 图代码块");
  });

  it("requires upstream ids to be inherited and present in trace matrices", () => {
    const requirements = validateGeneratedDocumentFormat("requirements", `
## 需求追踪矩阵
| PRD 编号/来源 | REQ 编号 | 用户故事编号 | 验收条件编号 | 状态 |
|---|---|---|---|---|
| PRD-F-001 | REQ-001 | US-001 | AC-001 | 已覆盖 |

## REQ-002 补充需求
PRD-F-002 在正文提到但没有进入矩阵。
US-002 和 AC-002 也没有进入矩阵。
In Scope：本期支持创建订单。
Out of Scope：暂不支持批量导入。
TBD/待确认事项：审批规则待确认。
正常流程：用户提交订单。
异常流程：库存不足时提示失败。
边界行为：重复提交时保持幂等。
`, "上游 PRD：PRD-F-001 创建订单；PRD-F-002 审批订单。");

    expect(requirements.valid).toBe(false);
    expect(requirements.missing.join("、")).toContain("PRD 编号未进入追踪矩阵");
    expect(requirements.missing.join("、")).toContain("REQ 编号未进入追踪矩阵");
    expect(requirements.missing.join("、")).toContain("用户故事编号未进入追踪矩阵");
    expect(requirements.missing.join("、")).toContain("验收条件编号未进入追踪矩阵");
  });

  it("builds repair prompts with upstream source content", () => {
    const prdPrompt = buildPrdVisualRepairPrompt("## 原始 PRD", ["图文对照表"], "PRD-F-001 上游功能");
    const reqPrompt = buildDocumentRepairPrompt("requirements", "## 原始需求", ["需求追踪矩阵"], "PRD-F-002 审批订单");

    expect(prdPrompt.user).toContain("上游来源内容");
    expect(prdPrompt.user).toContain("PRD-F-001 上游功能");
    expect(reqPrompt.system).toContain("需求文档结构审校器");
    expect(reqPrompt.system).toContain(REQUIREMENTS_TRACEABILITY_RULE);
    expect(reqPrompt.user).toContain("PRD-F-002 审批订单");
  });

  it("builds semantic audit prompts for cross-document consistency", () => {
    const prompt = buildDocumentSemanticAuditPrompt(
      "design",
      "## 设计追踪矩阵\nREQ-001 API-001",
      "上游需求：REQ-001 创建订单",
    );

    expect(prompt.system).toContain("详细设计文档跨文档一致性审校器");
    expect(prompt.user).toContain("自动一致性审校报告");
    expect(prompt.user).toContain("上游需求：REQ-001 创建订单");
    expect(prompt.user).toContain("## 设计追踪矩阵");
  });
});
