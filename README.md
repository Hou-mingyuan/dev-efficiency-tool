# 开发效率提升工具

AI 驱动的软件开发全流程桌面工具，覆盖从产品需求到详细设计的完整开发链路。

## 功能概览

### AI 工作台
- **生成 PRD** — 根据项目描述自动生成产品需求文档，覆盖 In Scope / Out of Scope / 边界行为 / 待确认事项
- **生成需求文档** — 将 PRD 细化为结构化的功能需求，用户故事含正向/反向验收条件
- **生成 UI 设计** — 输出 UI 设计规范文档，或直接生成高保真 HTML+CSS 页面截图（支持多页面拆分）
- **生成详细设计** — 生成可直接编码的详设文档，含完整 API 示例、异常分支、缓存设计等

### 智能特性
- **项目分析缓存** — 自动分析参考项目的技术栈、目录结构、样式风格，缓存结果避免重复分析
- **参考文档 & 参考项目** — 生成时注入参考资料，让 AI 输出更贴合实际项目
- **项目/模块级别** — 支持项目维度和模块维度两种生成模式，模块级别自动补充上下文
- **多格式输出** — Markdown / Word (.docx) / PDF / PNG / JPEG / GIF / SVG / HTML
- **停止生成** — 生成过程中可随时中断

### 其他功能
- **方法论文档** — 管理和查看开发方法论参考资料
- **IDE 管理** — Cursor / VS Code 等 IDE 集成管理
- **文档解析** — 解析 Word、PDF 等文档提取内容
- **健康检查** — 系统运行状态自检
- **日志查看** — 操作日志和 AI 生成记录

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Electron 35 |
| 前端 | Vue 3 + TypeScript |
| 状态管理 | Pinia |
| UI 组件 | Ant Design Vue 4 |
| 样式 | Less |
| 国际化 | Vue I18n (中/英) |
| 路由 | Vue Router 4 |
| 构建 | Vite + vite-plugin-electron |
| AI 服务 | OpenAI / Anthropic / DeepSeek / 通义千问 / 智谱 / Moonshot 等 |

## 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 构建打包
```bash
npm run pack
```

构建产物在 `release/` 目录下：
- `开发效率提升工具 Setup x.x.x.exe` — 安装版 (NSIS)
- `开发效率提升工具-x.x.x-portable.exe` — 免安装版 (Portable)

## 项目结构

```
├── electron/                # Electron 主进程
│   ├── main.ts              # 主进程入口、窗口生命周期与 IPC 注册
│   ├── ipc/                 # 拆分后的 IPC 处理器
│   ├── ai-service.ts        # AI 服务封装（多模型支持）
│   ├── app-manager.ts       # 应用配置、方法论路径与文档解析
│   ├── preload.ts           # 预加载脚本
│   └── project-analyzer.ts  # 项目分析与缓存
├── src/                     # 渲染进程（Vue 3）
│   ├── components/          # 通用组件
│   ├── composables/         # 组合式函数
│   │   └── useAiGenerator.ts  # AI 生成核心逻辑
│   ├── i18n/                # 国际化
│   ├── router/              # 路由配置
│   ├── store/               # Pinia 状态管理
│   ├── styles/              # 全局样式
│   └── views/               # 页面组件
├── public/                  # 静态资源
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## AI 模型配置

在「配置管理」页面添加 AI 服务商：

1. 选择服务商类型（OpenAI / Anthropic / DeepSeek 等）
2. 填写 API Key
3. 选择模型
4. 点击「测试连接」验证
5. 启用并保存

支持同时配置多个服务商，在生成时可切换使用。

## 许可证

私有项目，仅限内部使用。
