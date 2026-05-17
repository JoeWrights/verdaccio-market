# Verdaccio Markplace Docker 部署方案

本文档提供一套 Docker 化部署方案，适合将当前项目部署到云服务器。

默认服务器：

- 公网 IP：`116.196.89.88`
- 项目目录：`/opt/www/verdaccio-markplace`
- Docker 前端入口：`http://116.196.89.88/verdaccio/`
- Docker API 入口：`http://116.196.89.88/verdaccio/api/v1`
- Docker Verdaccio npm registry 入口：`http://116.196.89.88/verdaccio/registry/`

> 说明：这里刻意给 Docker 部署统一加 `/verdaccio` 前缀，避免占用服务器现有的根路径 `/`、`/api/`、`/registry/`。

---

## 1. 总体架构

推荐使用 4 个容器：

- `nginx`：统一公网入口，负责 `/verdaccio/`、`/verdaccio/api/`、`/verdaccio/registry/` 转发
- `web`：构建并托管 React/Rsbuild 前端静态资源
- `api`：NestJS BFF 服务，访问 Verdaccio
- `verdaccio`：npm 私服，持久化包数据与账号信息

容器访问关系：

```text
用户浏览器
   |
   v
公网 80/443
   |
   v
nginx
   |-- /verdaccio/             -> web:80
   |-- /verdaccio/api/         -> api:3000
   |-- /verdaccio/registry/    -> verdaccio:4873

api
   |
   v
verdaccio:4873
```

---

## 2. 服务器安装 Docker

### 2.1 CentOS/RHEL/Rocky/Alma

```bash
yum -y install yum-utils device-mapper-persistent-data lvm2 || dnf -y install yum-utils device-mapper-persistent-data lvm2
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
yum -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin || dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker --now
docker version
docker compose version
```

### 2.2 Ubuntu/Debian

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker --now
docker version
docker compose version
```

---

## 3. 项目目录规划

服务器目录建议：

```text
/opt/www/verdaccio-markplace
  ├── apps/
  ├── packages/
  ├── docker/
  │   ├── nginx.conf
  │   └── verdaccio/
  │       └── config.yaml
  ├── Dockerfile.api
  ├── Dockerfile.web
  ├── docker-compose.yml
  ├── package.json
  ├── pnpm-lock.yaml
  └── pnpm-workspace.yaml
```

---

## 4. 新增 Docker 文件

### 4.1 `.dockerignore`

在项目根目录创建：

```dockerignore
.git
.turbo
.deploy
node_modules
**/node_modules
**/dist
*.tar.gz
.DS_Store
```

### 4.2 `Dockerfile.api`

在项目根目录创建：

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY . .
RUN pnpm --filter @verdaccio-market/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/apps/api/dist ./apps/api/dist
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
```

### 4.3 `Dockerfile.web`

在项目根目录创建：

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
ARG PUBLIC_BASE_PATH=/verdaccio/
ARG PUBLIC_API_BASE_URL=/verdaccio/api/v1
ENV PUBLIC_BASE_PATH=${PUBLIC_BASE_PATH}
ENV PUBLIC_API_BASE_URL=${PUBLIC_API_BASE_URL}
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @verdaccio-market/web build

FROM nginx:1.27-alpine
COPY docker/web-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 4.4 前端子路径配置（必须）

由于 Docker 部署统一挂载到 `/verdaccio/`，前端也必须知道自己的基础路径和 API 地址。否则页面虽然能打开，但浏览器仍会请求根路径 `/api/v1`，从而占用旧部署的 API 地址。

本仓库已将前端改为支持以下环境变量：

`apps/web/src/api/client.ts`：

```ts
export const apiClient = axios.create({
  baseURL: import.meta.env.PUBLIC_API_BASE_URL ?? "/api/v1",
  timeout: 8000,
  withCredentials: true
});
```

`apps/web/src/main.tsx` 和 `apps/web/src/index.tsx` 中的 `createBrowserRouter` 增加 `basename`：

```ts
const router = createBrowserRouter(
  [
    // 原有路由配置
  ],
  {
    basename: import.meta.env.PUBLIC_BASE_PATH ?? "/"
  }
);
```

`apps/web/rsbuild.config.ts` 增加静态资源前缀：

```ts
export default defineConfig({
  plugins: [pluginReact()],
  output: {
    assetPrefix: process.env.PUBLIC_BASE_PATH ?? "/"
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});
```

上面的 `Dockerfile.web` 已经在构建阶段注入了这两个变量，关键配置如下：

```dockerfile
ARG PUBLIC_BASE_PATH=/verdaccio/
ARG PUBLIC_API_BASE_URL=/verdaccio/api/v1
ENV PUBLIC_BASE_PATH=${PUBLIC_BASE_PATH}
ENV PUBLIC_API_BASE_URL=${PUBLIC_API_BASE_URL}
RUN pnpm --filter @verdaccio-market/web build
```

### 4.5 `docker/web-nginx.conf`

为了支持 React Router 刷新页面不 404，给 `web` 容器增加一个简单 Nginx 配置：

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

并在 `Dockerfile.web` 最后一阶段复制该配置：

```dockerfile
FROM nginx:1.27-alpine
COPY docker/web-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 4.6 `docker/nginx.conf`

在项目根目录创建 `docker/nginx.conf`：

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 200m;

    # Docker 版前端统一挂到 /verdaccio/，避免占用根路径 /
    location = /verdaccio {
        return 301 /verdaccio/;
    }

    location /verdaccio/ {
        rewrite ^/verdaccio/(.*)$ /$1 break;
        proxy_pass http://web:80;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 外部 /verdaccio/api/* -> 内部 /api/*
    location /verdaccio/api/ {
        rewrite ^/verdaccio/api/(.*)$ /api/$1 break;
        proxy_pass http://api:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 外部 /verdaccio/registry/* -> 内部 Verdaccio /*
    location /verdaccio/registry/ {
        proxy_pass http://verdaccio:4873/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
```

### 4.7 `docker/verdaccio/config.yaml`

在项目根目录创建 `docker/verdaccio/config.yaml`：

```yaml
storage: /verdaccio/storage
plugins: /verdaccio/plugins

web:
  title: Verdaccio Markplace Registry

auth:
  htpasswd:
    file: /verdaccio/conf/htpasswd
    max_users: 1000

uplinks:
  npmjs:
    url: https://registry.npmjs.org/

packages:
  '@*/*':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
    proxy: npmjs
  '**':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
    proxy: npmjs

middlewares:
  audit:
    enabled: true

log:
  - { type: stdout, format: pretty, level: http }

listen: 0.0.0.0:4873
url_prefix: /verdaccio/registry/
```

### 4.8 `docker-compose.yml`

在项目根目录创建：

```yaml
services:
  nginx:
    image: nginx:1.27-alpine
    container_name: verdaccio-markplace-nginx
    restart: unless-stopped
    depends_on:
      - web
      - api
      - verdaccio
    ports:
      - "80:80"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - app-network

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
      args:
        PUBLIC_BASE_PATH: /verdaccio/
        PUBLIC_API_BASE_URL: /verdaccio/api/v1
    container_name: verdaccio-markplace-web
    restart: unless-stopped
    networks:
      - app-network

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    container_name: verdaccio-markplace-api
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: "3000"
      VERDACCIO_URL: http://verdaccio:4873
    depends_on:
      - verdaccio
    networks:
      - app-network

  verdaccio:
    image: verdaccio/verdaccio:6
    container_name: verdaccio-markplace-registry
    restart: unless-stopped
    user: "0"
    volumes:
      - verdaccio-storage:/verdaccio/storage
      - verdaccio-plugins:/verdaccio/plugins
      - ./docker/verdaccio/config.yaml:/verdaccio/conf/config.yaml:ro
      - ./docker/verdaccio/htpasswd:/verdaccio/conf/htpasswd
    networks:
      - app-network

volumes:
  verdaccio-storage:
  verdaccio-plugins:

networks:
  app-network:
    driver: bridge
```

同时创建空的账号文件：

```bash
mkdir -p docker/verdaccio
touch docker/verdaccio/htpasswd
```

---

## 5. 服务器部署流程

### 5.1 上传项目

如果服务器可访问 GitHub：

```bash
mkdir -p /opt/www
cd /opt/www
git clone <你的仓库地址> verdaccio-markplace
cd /opt/www/verdaccio-markplace
```

如果服务器无法访问 GitHub，使用本地打包上传：

```bash
cd /Users/JoeWright/workspace/npm-markplace/verdaccio-markplace
tar -czf verdaccio-markplace-docker.tar.gz \
  --exclude=".git" \
  --exclude="node_modules" \
  --exclude="**/node_modules" \
  --exclude="**/dist" \
  --exclude=".turbo" \
  .
scp verdaccio-markplace-docker.tar.gz root@116.196.89.88:/opt/www/
```

服务器解包：

```bash
mkdir -p /opt/www/verdaccio-markplace
tar -xzf /opt/www/verdaccio-markplace-docker.tar.gz -C /opt/www/verdaccio-markplace
cd /opt/www/verdaccio-markplace
```

### 5.2 启动服务

```bash
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
docker compose logs -f --tail=100
```

---

## 6. 验收

### 6.1 检查容器

```bash
docker compose ps
```

预期看到：

- `verdaccio-markplace-nginx`
- `verdaccio-markplace-web`
- `verdaccio-markplace-api`
- `verdaccio-markplace-registry`

### 6.2 检查访问地址

```bash
curl -I http://116.196.89.88/verdaccio/
curl -i http://116.196.89.88/verdaccio/api/v1/health
curl -i http://116.196.89.88/verdaccio/registry/-/ping
```

浏览器访问：

- 前端首页：`http://116.196.89.88/verdaccio/`
- API 健康检查：`http://116.196.89.88/verdaccio/api/v1/health`
- Verdaccio：`http://116.196.89.88/verdaccio/registry/`

---

## 7. 本地 npm 登录与发布

配置 registry：

```bash
npm set registry http://116.196.89.88/verdaccio/registry/
```

登录：

```bash
npm adduser --registry http://116.196.89.88/verdaccio/registry/ --auth-type=legacy
```

验证：

```bash
npm whoami --registry http://116.196.89.88/verdaccio/registry/
```

发布：

```bash
npm publish --registry http://116.196.89.88/verdaccio/registry/
```

如果只想某个 scope 使用私服：

```bash
npm config set @your-scope:registry http://116.196.89.88/verdaccio/registry/
```

---

## 8. 日常发布流程

代码更新后：

```bash
cd /opt/www/verdaccio-markplace
git pull
docker compose up -d --build
docker compose ps
```

如果是离线上传：

```bash
cd /opt/www/verdaccio-markplace
docker compose up -d --build
```

---

## 9. 回滚方案

### 9.1 Git 方式回滚

```bash
cd /opt/www/verdaccio-markplace
git log --oneline -n 10
git checkout <上一个稳定commit>
docker compose up -d --build
```

恢复到最新分支：

```bash
git checkout main
git pull
docker compose up -d --build
```

### 9.2 离线包方式回滚

保留旧目录备份：

```bash
mv /opt/www/verdaccio-markplace /opt/www/verdaccio-markplace_bad_$(date +%Y%m%d%H%M%S)
mv /opt/www/verdaccio-markplace_backup_20260517xxxxxx /opt/www/verdaccio-markplace
cd /opt/www/verdaccio-markplace
docker compose up -d --build
```

---

## 10. 数据持久化说明

Verdaccio 的数据由 Docker volume 持久化：

- `verdaccio-storage`：npm 包数据
- `verdaccio-plugins`：插件目录
- `docker/verdaccio/htpasswd`：用户账号文件

查看 volume：

```bash
docker volume ls | grep verdaccio
```

备份 Verdaccio 数据：

```bash
mkdir -p /opt/backup
docker run --rm \
  -v verdaccio-markplace_verdaccio-storage:/data \
  -v /opt/backup:/backup \
  alpine \
  tar -czf /backup/verdaccio-storage-$(date +%Y%m%d%H%M%S).tar.gz -C /data .
cp /opt/www/verdaccio-markplace/docker/verdaccio/htpasswd /opt/backup/htpasswd-$(date +%Y%m%d%H%M%S)
```

---

## 11. HTTPS 与域名建议

如果要正式使用 npm login/publish，建议绑定域名并开启 HTTPS，例如：

- 前端：`https://market.example.com/verdaccio/`
- Registry：`https://market.example.com/verdaccio/registry/`

可以在宿主机用 Nginx/Certbot 做 HTTPS，也可以在 Docker Compose 里增加 `certbot` 或使用 `caddy`/`traefik`。

裸 IP 使用 HTTP 可以测试，但不建议长期生产使用。

---

## 12. 常见问题

### 12.1 访问首页是 Nginx 默认页

说明宿主机 Nginx 占用了 80，Docker 的 `nginx` 没有监听成功。

检查：

```bash
docker compose ps
ss -lntp | grep ':80'
```

处理：

```bash
systemctl stop nginx
systemctl disable nginx
docker compose up -d
```

或者让宿主机 Nginx 继续占用 80，再反向代理到 Docker 里的端口，此时需要把 Compose 的 `ports` 改成如 `"8080:80"`。

### 12.2 API 健康检查 degraded

说明 API 连不上 Verdaccio。

检查：

```bash
docker compose logs api --tail=100
docker compose logs verdaccio --tail=100
docker compose exec api wget -qO- http://verdaccio:4873/-/ping
```

确认 `api` 环境变量：

```bash
docker compose exec api printenv | grep VERDACCIO_URL
```

应为：

```text
VERDACCIO_URL=http://verdaccio:4873
```

### 12.3 npm login 失败

确认 registry 地址末尾有 `/`：

```bash
npm adduser --registry http://116.196.89.88/verdaccio/registry/ --auth-type=legacy
```

确认代理可用：

```bash
curl -i http://116.196.89.88/verdaccio/registry/-/ping
```

### 12.4 构建失败

查看构建日志：

```bash
docker compose build --no-cache api
docker compose build --no-cache web
```

常见原因：

- `pnpm-lock.yaml` 未提交或与 `package.json` 不一致
- 服务器访问 npm registry 不稳定
- Dockerfile 中 workspace 包清单复制不完整

---

## 13. 最小命令清单

首次部署：

```bash
cd /opt/www/verdaccio-markplace
mkdir -p docker/verdaccio
touch docker/verdaccio/htpasswd
docker compose up -d --build
docker compose ps
curl -i http://116.196.89.88/verdaccio/api/v1/health
curl -i http://116.196.89.88/verdaccio/registry/-/ping
```

日常更新：

```bash
cd /opt/www/verdaccio-markplace
git pull
docker compose up -d --build
docker compose ps
```
