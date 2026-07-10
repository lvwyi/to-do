# 更新日志

## v1.2 — 会议智能助手集成 & Dify 工作流修复

**日期：** 2026-07-06

### ✨ 新增功能

| 组件 | 变更 |
|------|------|
| `src/utils/meetingParser.ts` | 新建纯前端会议文本解析器，无需调用外部 API |
| `src/components/MeetingPanel.tsx` | 新建会议面板，支持粘贴文稿 → 自动提取待办 + 截止日期 |
| `src/types.ts` | 新增 `MainView` 类型定义 |
| `CLAUDE.md` | 项目文档归档 |

### 🔧 代码变更

| 文件 | 说明 |
|------|------|
| `src/App.tsx` | 引入 MeetingPanel，新增视图切换（Ctrl+Shift+M） |
| `src/components/Topbar.tsx` | 增加 🤖 切换按钮，接入 `currentView` prop |
| `src/css/layout.css` | 新增 view-tabs、meeting-toggle-btn 样式 |
| `src/css/components.css` | 新增 meeting-panel 全套样式及暗色模式适配 |
| `src/css/global.css` | 新增移动端响应式规则 |
| `nginx.conf` | 移除重复的 `gzip_types text/html`，消除 nginx 警告 |

### 🐛 Bug 修复

| 问题 | 描述 |
|------|------|
| **Dify context 注入失效** | 9 个 LLM 节点 `context.enabled` 错误设为 true 且 prompt 缺少 `{{#...#}}` 引用，导致模型收不到输入数据；已全部修正为 `false` 并补回上下文引用 |
| **Dify 重复边** | 删除 1 条由 `variable-aggregator` 导致的冗余连线 |
| **Dify 多余函数** | "拼接完整纪要" 代码节点存在多余的 `main({arg1, arg2})` stub 函数，已清理 |
| **Dify 输出变量错误** | 输出节点的 `global_reply` 改为标准 `text` 变量 |
| **Dify 类型不匹配** | `join_user` / `absent_user` 从 `string` 改为 `array`，匹配下游去重逻辑 |

### 📦 Docker 部署

| 项目 | 镜像 | 端口 |
|------|------|------|
| todo-app | `todo-app:latest` | `http://localhost:3000` |

```bash
docker restart todo-app          # 重启容器
docker build -t todo-app . && docker restart todo-app  # 重新构建
```

### 🔗 GitHub 推送

```
commit ccb2142 feat: 集成会议智能助手
commit 4054579 fix: remove duplicate text/html from gzip_types
```

---

## v1.3 — AI 智能拆解迁移至 Dify 平台 & 安全加固

**日期：** 2026-07-10

### ✨ 核心变更

| 组件 | 变更 |
|------|------|
| `src/utils/aiApi.ts` | 重写：删除 DashScope 直连，改用 Dify `/v1/chat-messages` 端点 |
| `src/components/AddTodoInput.tsx` | 简化：移除内联 system prompt（已固化在 Dify 工作流中），删除 `model` 参数 |
| `plugins/ai-proxy-plugin.ts` | 修改：从死代码激活为 Vite 开发代理，目标端点改为 Dify |
| `vite.config.ts` | 新增：集成 aiProxyPlugin（仅开发环境启用） |
| `proxy-server.js` | 重写：Node.js 代理改为 Dify 格式，清理未使用的 dotenv 依赖 |
| `cloudflare-worker/src/index.ts` | 重写：Cloudflare Worker 改为 Dify 格式 |
| `src-tauri/src/main.rs` | 重写：移除硬编码 API Key，改用环境变量 `DIFY_API_KEY`，请求改为 Dify 格式 |

### 🔒 安全修复

| 问题 | 解决方案 |
|------|----------|
| Tauri Rust 源码中硬编码 DashScope API Key | 替换为 `std::env::var("DIFY_API_KEY")` 读取，密钥不再暴露在二进制文件中 |
| 所有代理层统一迁移到 Dify | 不再直接暴露任何第三方 LLM 供应商凭证 |

### 🔧 架构升级

| 变更 | 说明 |
|------|------|
| AI 供应商迁移 | DashScope (`dashscope.aliyuncs.com`) → Dify (`api.dify.ai/v1/chat-messages`) |
| 模型升级 | `qwen-plus` → `qwen3.6-plus`（由 Dify 工作流配置管理） |
| 请求格式统一 | Web/Tauri/Proxy → `{ query }` → Dify `{ query, conversation_id, inputs, response_mode: 'blocking' }` |
| 环境变量命名 | `DASHSCOPE_API_KEY` → `DIFY_API_KEY` + `DIFY_BASE_URL` |

### 📝 文档与环境变量

| 文件 | 变更 |
|------|------|
| `.env.local` | 新变量名模板 |
| `.env.production.example` | 新增运行时环境变量说明 |
| `cloudflare-worker/.env.example` / `.dev.vars.example` | 更新为新变量名 |
| `.github/workflows/tauri.yml` | 添加 `DIFY_API_KEY` / `DIFY_BASE_URL` 从 secrets 注入 |
| `README.md` | 更新 API Key 获取指引 |

### 🔗 GitHub 推送

```
feat: 迁移 AI 智能拆解到 Dify 平台，移除硬编码 API Key
```
