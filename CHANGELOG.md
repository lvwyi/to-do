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
