# Todo App — AI 智能待办事项管理

一款现代化的 React + TypeScript 待办事项应用，支持 AI 智能任务拆解（Dify Cloud）和会议纪要智能解析。

## 功能特性

- 📝 创建、编辑、删除待办事项
- ✨ AI 智能拆解：输入一个模糊任务，自动拆分为可执行子任务
- 🤖 会议智能助手：粘贴会议纪要，AI 提取标题、决议、任务和时间
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

# 智能拆解工作流 API Key
DIFY_API_KEY_BREAKDOWN=app-your-api-key-here
# 会议助手工作流 API Key
DIFY_API_KEY_MEETING=app-your-api-key-here
DIFY_BASE_URL=https://api.dify.ai
```

获取 Dify API Key：登录 [Dify Cloud](https://cloud.dify.ai) → 选择应用 → API 密钥

### Docker 部署

```bash
docker pull ghcr.io/YOUR_USERNAME/todo-app:latest
docker run -d -p 80:80 \
  -e DIFY_API_KEY_BREAKDOWN="app-your-key" \
  -e DIFY_API_KEY_MEETING="app-your-key" \
  -e DIFY_BASE_URL="https://api.dify.ai" \
  --name todo-app \
  ghcr.io/YOUR_USERNAME/todo-app:latest
```

容器内同时运行 Nginx（前端静态文件 :80）和 Node.js 代理（AI 请求转发 :3000）。

### Tauri（桌面版）

GitHub Actions workflow 从仓库 secrets 读取 `DIFY_API_KEY_BREAKDOWN` 和 `DIFY_API_KEY_MEETING`。

### Cloudflare Worker

在 Wrangler 配置或 Cloudflare 控制台设置 `DIFY_API_KEY_BREAKDOWN`、`DIFY_API_KEY_MEETING` 和 `DIFY_BASE_URL`。
