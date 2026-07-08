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

# 复制自定义配置（覆盖默认站点）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
