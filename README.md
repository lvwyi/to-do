# Todo App — AI 智能待办事项管理

一款现代化的 React + TypeScript 待办事项应用，支持 AI 智能任务拆解（Dify 平台）、分类管理和本地持久化存储。

## 功能特性

- 📝 创建、编辑、删除待办事项
- 🤖 AI 智能拆解：输入一个复杂任务，自动拆分为可执行的子任务（Dify 工作流驱动）
- 📂 自定义分类（工作/个人/健康/学习/购物）
- 🔍 筛选与排序
- 💾 localStorage 自动持久化
- ⚡ 错误边界保护，防止白屏崩溃

## 快速开始

```bash
npm install
npm run dev
```

## 配置

### 开发环境

复制 `.env.local` 并填入你的 Dify API Key：

```bash
# .env.local
VITE_AI_PROXY_URL=/api
DIFY_API_KEY=app-your-api-key-here
DIFY_BASE_URL=https://api.dify.ai   # SaaS 版默认地址，自部署请替换
```

获取 Dify API Key：登录 [Dify 控制台](https://cloud.dify.ai) → 选择应用 → API 密钥

### 生产部署

- **Docker**: 通过 `docker run -e DIFY_API_KEY=xxx -e DIFY_BASE_URL=xxx` 注入运行时环境变量
- **Tauri (桌面版)**: GitHub Actions workflow 从仓库 secrets 读取 `DIFY_API_KEY` 和 `DIFY_BASE_URL`
- **Cloudflare Worker**: 在 Wrangler 配置或 Cloudflare 控制台设置 `DIFY_API_KEY` 和 `DIFY_BASE_URL`
