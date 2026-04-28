import { describe, expect, it } from "vitest";
import { extractQualityImageTargets, resolveDirectImageTargets } from "../ui-image-targets";

describe("ui image targets", () => {
  it("uses a single overview target in fast mode", () => {
    const targets = resolveDirectImageTargets("## 用户列表页\n## 用户详情页", "权限系统", "fast");

    expect(targets).toHaveLength(1);
    expect(targets[0].name).toBe("权限系统");
    expect(targets[0].prompt).toContain("快速预览图");
  });

  it("extracts multiple page and modal targets in quality mode", () => {
    const targets = resolveDirectImageTargets([
      "## 页面清单",
      "### 1. 用户列表页",
      "- 用户详情抽屉：展示用户基本信息、角色和操作日志",
      "2. 新增用户弹窗：包含账号、姓名、角色字段",
      "### 设计原则",
    ].join("\n"), "权限系统", "quality");

    expect(targets.map((target) => target.name)).toEqual([
      "用户列表页",
      "用户详情抽屉",
      "新增用户弹窗",
    ]);
    expect(targets[0].prompt).toContain("本次只生成「用户列表页」");
  });

  it("deduplicates repeated targets", () => {
    const targets = extractQualityImageTargets([
      "### 订单列表页",
      "- 订单列表页：展示查询和表格",
      "1. 订单列表页：分页列表",
    ].join("\n"), "订单系统");

    expect(targets.map((target) => target.name)).toEqual(["订单列表页"]);
  });

  it("falls back to project name when no target can be extracted", () => {
    const targets = extractQualityImageTargets("请生成现代化后台风格，蓝色主色。", "风险管理");

    expect(targets).toHaveLength(1);
    expect(targets[0].name).toBe("风险管理");
  });
});
