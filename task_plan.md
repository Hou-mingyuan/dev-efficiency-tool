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

## 当前状态

- 全部阶段已完成第一轮修复。
- 当前本地 `npm run build` 已通过。
- 当前本地 `npm run test` 已通过。
- 最新本地提交 `d80abe8 Limit reference adherence hard rule to module scope` 已创建；推送因本机代理 `127.0.0.1` 无法连接 GitHub 暂未成功。
