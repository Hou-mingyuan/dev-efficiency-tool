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
- 继续优化 AI 能力层：新增 `electron/model-capabilities.ts`，从 `ai-service.ts` 抽离文本/图像/视觉输入模型能力识别，并补充 `electron/__tests__/model-capabilities.spec.ts`。
- 修复图片生成接口返回 HTML 时的体验：图片接口会尝试 `/images/generations` 与 `/v1/images/generations`，失败时返回中文可读诊断，不再暴露 JSON 解析异常。
- 优化 UI 出图结果预览：生成后的图片现在可在结果预览中点击放大查看。
- 验证：`npx tsc --noEmit --skipLibCheck -p tsconfig.node.json`、`npx vue-tsc --noEmit --skipLibCheck`、`npx vitest run electron/__tests__/model-capabilities.spec.ts` 均已通过。
- 修正图像模型高保真直出策略：快速预览仍生成 1 张核心总览图；高保真会从已分析的 UI 提示词中提取页面/功能项，并逐项调用图像模型生成多张图片。
- 兼容图像模型直出结果没有 HTML 文件的情况，刷新预览和文件路径列表会过滤空路径。
