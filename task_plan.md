# 桌面应用修复计划

## 目标

按用户指定顺序修复桌面应用当前工程问题，保持每个阶段可验证、可提交、影响可控。

## 阶段

1. P0：提交并推送当前构建修复。✅ 已完成，提交 `f5c0626`。
2. P1：拆分 Electron 主进程 IPC，降低 `electron/main.ts` 维护风险。✅ 已完成第一轮，已拆出窗口控制和项目分析 IPC。
3. P1：补齐路径安全校验，覆盖 `ai:readOutputFile`、`app:readImageAsBase64`、`app:parseDocument`、`app:openExternal`、`ai:saveDocument`。✅ 已完成并通过构建验证。
4. P1：明确 MCP 定位，删除 README 中误导性的 MCP 描述。✅ 已完成。
5. P2：补测试，覆盖 ProjectAnalyzer、buildPrompt、UI prompt builder、isPathWithinBase、配置保存与 API Key 加密。✅ 已完成。
6. P2：拆分大 Vue 页面，优先 `GenerateUI.vue` 和 `Settings.vue`。✅ 已完成第一轮低风险拆分。
7. P3：深度优化桌面应用，继续降低高复杂度文件的维护风险，优先拆分 AI/生成链路中的纯逻辑与可测试模块。🚧 进行中。
8. P3：补齐四类生成文档的全链路追踪编号和硬校验能力，先覆盖 PRD、需求文档、UI 设计、详细设计的结构校验与自动修正。✅ 已完成第一轮。
9. P3：跨文档一致性检查第二轮：从输入、参考文档和项目上下文提取上游编号，要求需求/UI/详设输出继承对应编号。✅ 已完成第一轮。
10. P3：跨文档一致性检查第二轮增强：自动修正时携带上游来源内容，提升编号继承和追踪矩阵补齐准确性。🚧 进行中。
11. P3：跨文档一致性检查第三步：追踪矩阵行级覆盖校验，要求继承的上游编号必须进入对应追踪矩阵。🚧 进行中。
12. P3：追踪矩阵本级编号覆盖校验，要求文档自身生成的 REQ/US/AC/UI/API/DB/TEST/TASK 编号进入对应追踪矩阵。🚧 进行中。
13. P3：抽离文档追踪规则、校验器和修正提示词到独立模块，降低 `electron/ai-service.ts` 复杂度。✅ 已完成。

## 当前状态

- 全部阶段已完成第一轮修复。
- 当前本地 `npm run build` 已通过。
- 当前本地 `npm run test` 已通过。
- 最新本地提交 `d80abe8 Limit reference adherence hard rule to module scope` 已创建；推送因本机代理 `127.0.0.1` 无法连接 GitHub 暂未成功。
