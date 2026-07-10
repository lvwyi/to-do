# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存层
COPY package.json package-lock.json* npm-shrinkwrap.json* ./
RUN npm ci

# 复制源码并构建
COPY . .
RUN npm run build

# 生产阶段 — 用 nginx 提供静态文件服务
FROM nginx:alpine

# 复制自定义配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 安装 Node.js 运行时（用于 AI 反向代理 — Dify）
RUN apk add --no-cache nodejs tini

# 复制 AI 反代脚本
COPY proxy-server.js /app/proxy-server.js

# 创建日志目录
RUN mkdir -p /var/log/node-proxy

EXPOSE 80 3000

CMD ["tini", "--", "sh", "-c", "node /app/proxy-server.js & nginx -g 'daemon off;'" ]
