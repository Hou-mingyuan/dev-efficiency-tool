# 修复发现记录

## 已知事实

- 当前项目为 Electron 35 + Vue 3 + Vite 桌面应用。
- `electron/main.ts` 职责过重，是后续重构重点。
- 完整构建曾被 `tsconfig.node.json` project reference 配置阻断。
- 当前已在本地修复并验证 `npm run build` 通过。

## 风险

- 主进程 IPC 能力较宽，路径型接口需要统一边界校验。
- README 中 `mcp-manager.ts` 描述与实际代码不一致。
- P2 页面拆分涉及 Vue 组件边界，需分小步验证。

## 本轮处理结果

- 路径型 IPC 现在优先接受配置目录、用户通过系统选择器选择过的文件/目录，以及生成历史中的输出文件。
- `app:openExternal` 仅允许 `http:`、`https:` 和 `mailto:` 协议，避免从渲染进程直接触发危险协议。
- 拖拽文件直接解析会更严格：如果文件没有经过系统选择器或不在可信目录下，会被主进程拒绝。这是安全边界变化，需要后续如要保留拖拽体验，再设计“拖拽文件授权”专用入口。
- `AppManager` 现在支持测试用数据目录和禁用方法论路径自动探测，默认生产行为不变；这让配置保存和 API Key 加密可以在临时目录中验证。
- `GenerateUI.vue` 和 `Settings.vue` 仍可继续细拆业务逻辑，但第一轮已把最独立的展示/表单块移出，降低了主页面模板体积。
- P3 盘点显示当前最大文件包括 `src/views/GenerateUI.vue`、`src/App.vue`、`electron/ai-service.ts`、`electron/main.ts` 和 `electron/ipc/ai-handlers.ts`。其中 `electron/ai-service.ts` 同时承载提示词构造、模型清单、多模态消息构造和模型调用，适合优先做纯逻辑拆分。
- `electron/ai-service.ts` 的模型清单和多模态消息构造不依赖 Electron 窗口、IPC 或网络，可拆为独立模块并用单元测试覆盖，作为低风险深度优化切口。
- `AiService.listModels` 只需要委托模型列表模块，已知服务商模型清单和远程 `/models` 查询都不需要留在服务类内部；这能让后续 AI 服务层继续向“只负责调用生成接口”收敛。
- `AiService.testConnection` 同样属于服务商健康检查，不属于生成调用核心流程。拆出后，OpenAI 兼容和 Anthropic 的连接测试请求可以独立覆盖，后续如果新增服务商也能更集中维护。
- 用户希望桌面应用首页参考 `https://100t.xiaomimimo.com/` 的暗黑科技感。适合迁移的是黑色背景、低对比代码纹理、超大标题、指标卡、细边框控制台面板和开发者工具氛围；不应复制小米品牌元素和活动文案。
- 动态效果应作为这套风格的一等元素，而不是静态换色。当前欢迎页和仪表盘均已使用 CSS 动画实现代码纹理漂移、扫描光层、脉冲状态点和光晕浮动，后续继续改造其它页面时应复用这一方向，同时避免影响表单可读性和操作稳定性。
- 四个生成页共用 `src/styles/generator.less`，因此生成页科技风改造应优先在共享样式层完成，避免分别修改 PRD、需求、UI 设计、详细设计页面模板而增加串台或功能回归风险。
