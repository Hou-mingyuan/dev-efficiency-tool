# 修复进度记录

## 2026-04-28

- 建立任务规划文件。
- 准备先提交并推送当前构建修复。
- P0 已完成：提交并推送 `f5c0626 Fix full TypeScript build`。
- 开始 P1：拆分 Electron 主进程 IPC。
- P1 第一轮 IPC 拆分已完成：新增 `electron/ipc/window-handlers.ts` 和 `electron/ipc/project-handlers.ts`，并从 `electron/main.ts` 移除对应内联 handler。
- P1 路径安全校验已接入：覆盖 `ai:readOutputFile`、`app:readImageAsBase64`、`app:parseDocument`、`app:openExternal`、`ai:saveDocument`，同时收紧 UI 图片渲染输出和文件存在性检查。
- P1 MCP 文档定位已修正：README 不再声明不存在的 `mcp-manager.ts`。
- 验证：`npm run build` 已通过。
- P2 测试已补充：新增 ProjectAnalyzer、AppManager 配置加密、isPathWithinBase 测试，并扩展 buildPrompt 测试。
- P2 大页面已完成第一轮拆分：`GenerateUI.vue` 拆出预览和历史抽屉组件，`Settings.vue` 拆出基础设置、AI 服务商设置和提示词设置组件。
- 验证：`npm run build` 已通过，`npm run test` 已通过。
