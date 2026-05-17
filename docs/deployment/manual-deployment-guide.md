# Verdaccio Markplace 手工部署文档（非脚本版）

本文档提供不依赖项目内脚本的部署方式，适合首次上云、排障、或需要逐步控制每个环节的场景。

默认目标环境：

- 服务器：`116.196.89.88`
- 系统：CentOS/RHEL（兼容思路同样适用于 Ubuntu）
- 项目目录：`/opt/www/verdaccio-markplace`
- 前端访问：`http://116.196.89.88`
- API：`http://116.196.89.88/api/v1`
- Verdaccio：`http://127.0.0.1:4873`

---

## 环节 1：服务器基础环境准备

### 1.1 安装基础工具

```bash
yum -y update || dnf -y upgrade
yum -y install git curl nginx firewalld gcc gcc-c++ make || dnf -y install git curl nginx firewalld gcc gcc-c++ make
```

### 1.2 安装 Node.js 20

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum -y install nodejs || dnf -y install nodejs
node -v
npm -v
```

### 1.3 启用 pnpm

```bash
corepack enable
corepack prepare pnpm@10.7.0 --activate
pnpm -v
```

### 1.4 安装 PM2

```bash
npm i -g pm2
pm2 -v
pm2 startup systemd -u root --hp /root
pm2 save
```

### 1.5 配置防火墙与 Nginx 服务

```bash
systemctl enable firewalld --now
firewall-cmd --permanent --add-port=22/tcp
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload

systemctl enable nginx --now
nginx -t
```

---

## 环节 2：部署 Verdaccio（私服依赖）

### 2.1 使用 pnpm 全局安装 Verdaccio

如果报 `ERR_PNPM_NO_GLOBAL_BIN_DIR`，先初始化：

```bash
export PNPM_HOME="/root/.local/share/pnpm"
mkdir -p "$PNPM_HOME"
export PATH="$PNPM_HOME:$PATH"
pnpm config set global-bin-dir "$PNPM_HOME"
```

安装：

```bash
pnpm add -g verdaccio@6
verdaccio --version
```

### 2.2 创建 Verdaccio 配置

```bash
mkdir -p /opt/verdaccio/storage /opt/verdaccio/plugins
touch /opt/verdaccio/htpasswd
```

```bash
cat > /opt/verdaccio/config.yaml <<'EOF'
storage: /opt/verdaccio/storage
plugins: /opt/verdaccio/plugins

auth:
  htpasswd:
    file: /opt/verdaccio/htpasswd
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

listen: 127.0.0.1:4873
EOF
```

### 2.3 使用 PM2 启动 Verdaccio

```bash
pm2 start verdaccio --name verdaccio -- -c /opt/verdaccio/config.yaml
pm2 save
pm2 status
curl -i http://127.0.0.1:4873/-/ping
```

---

## 环节 3：部署项目代码（离线包方式）

> 推荐此方式，避免服务器访问 GitHub 不稳定问题。

### 3.1 本地打包并上传

在本地项目根目录执行：

```bash
cd /Users/JoeWright/workspace/npm-markplace/verdaccio-markplace
PKG="verdaccio-markplace-$(date +%Y%m%d%H%M%S).tar.gz"
tar -czf "$PKG" \
  --exclude=".git" \
  --exclude=".turbo" \
  --exclude=".deploy" \
  --exclude="**/node_modules" \
  --exclude="**/dist" \
  .
scp "$PKG" root@116.196.89.88:/opt/www/
```

### 3.2 服务器解包部署

```bash
ssh root@116.196.89.88
cd /opt/www
mkdir -p /opt/www/verdaccio-markplace
tar -xzf /opt/www/verdaccio-markplace-*.tar.gz -C /opt/www/verdaccio-markplace --strip-components=0
```

> 若存在旧版本目录，建议先备份：

```bash
mv /opt/www/verdaccio-markplace /opt/www/verdaccio-markplace_backup_$(date +%Y%m%d%H%M%S)
mkdir -p /opt/www/verdaccio-markplace
```

---

## 环节 4：配置 API 环境变量与构建

### 4.1 创建 API 生产环境变量

```bash
mkdir -p /opt/www/verdaccio-markplace/apps/api
cat > /opt/www/verdaccio-markplace/apps/api/.env.production <<'EOF'
PORT=3000
VERDACCIO_URL=http://127.0.0.1:4873
EOF
```

### 4.2 安装依赖与构建

```bash
cd /opt/www/verdaccio-markplace
pnpm install --frozen-lockfile
pnpm build
```

检查产物：

```bash
ls -la /opt/www/verdaccio-markplace/apps/api/dist/main.js
ls -la /opt/www/verdaccio-markplace/apps/web/dist
```

---

## 环节 5：启动 API 服务（PM2）

创建 PM2 配置：

```bash
cat > /opt/www/verdaccio-markplace/ecosystem.config.cjs <<'EOF'
module.exports = {
  apps: [
    {
      name: "verdaccio-markplace-api",
      cwd: "/opt/www/verdaccio-markplace",
      script: "apps/api/dist/main.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        VERDACCIO_URL: "http://127.0.0.1:4873"
      }
    }
  ]
};
EOF
```

启动：

```bash
cd /opt/www/verdaccio-markplace
pm2 start ecosystem.config.cjs --only verdaccio-markplace-api --update-env
pm2 save
pm2 status
```

---

## 环节 6：配置 Nginx（前端 + API + Verdaccio）

创建 `/etc/nginx/conf.d/verdaccio-markplace.conf`：

```nginx
server {
    listen 80;
    server_name 116.196.89.88;

    root /opt/www/verdaccio-markplace/apps/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /registry/ {
        proxy_pass http://127.0.0.1:4873/;
        proxy_http_version 1.1;
        client_max_body_size 200m;
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

生效配置：

```bash
nginx -t
systemctl reload nginx
```

---

## 环节 7：验收检查

```bash
curl -i http://127.0.0.1:4873/-/ping
curl -i http://127.0.0.1:3000/api/v1/health
curl -i http://116.196.89.88/api/v1/health
curl -I http://116.196.89.88
curl -i http://116.196.89.88/registry/-/ping
pm2 status
```

预期访问地址：

- 前端首页：`http://116.196.89.88`
- API：`http://116.196.89.88/api/v1/health`
- Verdaccio 代理：`http://116.196.89.88/registry/-/ping`

---

## 环节 8：本地 npm 连接 Verdaccio

```bash
npm set registry http://116.196.89.88/registry/
npm adduser --registry http://116.196.89.88/registry/ --auth-type=legacy
npm whoami --registry http://116.196.89.88/registry/
npm publish --registry http://116.196.89.88/registry/
```

---

## 环节 9：手工发布流程（后续版本）

1. 本地重新打包并上传
2. 服务器解包到新目录
3. 执行 `pnpm install --frozen-lockfile && pnpm build`
4. `pm2 restart verdaccio-markplace-api --update-env`
5. `nginx -t && systemctl reload nginx`
6. 健康检查

---

## 环节 10：手工回滚流程

1. 保留至少一个旧版本目录，例如：
   - `/opt/www/verdaccio-markplace_backup_20260517xxxxxx`
2. 停止/切换当前目录：

```bash
mv /opt/www/verdaccio-markplace /opt/www/verdaccio-markplace_bad_$(date +%Y%m%d%H%M%S)
mv /opt/www/verdaccio-markplace_backup_20260517xxxxxx /opt/www/verdaccio-markplace
```

3. 重启服务：

```bash
cd /opt/www/verdaccio-markplace
pm2 restart verdaccio-markplace-api --update-env
nginx -t && systemctl reload nginx
```

---

## 环节 11：常见故障排查

### 11.1 访问首页是 Nginx 默认欢迎页

- `conf.d/verdaccio-markplace.conf` 未生效或配置错误
- 前端 `apps/web/dist` 不存在
- `nginx -t` 未通过

### 11.2 API 健康检查失败

```bash
pm2 logs verdaccio-markplace-api --lines 200
curl -i http://127.0.0.1:3000/api/v1/health
```

### 11.3 Verdaccio 不可用

```bash
pm2 logs verdaccio --lines 200
curl -i http://127.0.0.1:4873/-/ping
```

### 11.4 SSH 首次连接失败（host key）

首次连接需要输入 `yes`，不是 `no`：

```bash
ssh root@116.196.89.88
```
