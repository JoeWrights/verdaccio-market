# Verdaccio Markplace 云服务器部署手册

本文档汇总当前项目在云服务器上的完整部署流程，覆盖：

- 服务器初始化（Node/pnpm/PM2/Nginx/防火墙）
- Verdaccio 私服安装与启动
- 前后端离线发布（推荐）
- 在线发布（可选，依赖服务器可访问 GitHub）
- 回滚与常见故障处理

默认示例环境：

- 服务器公网 IP：`116.196.89.88`
- 项目目录：`/opt/www/verdaccio-markplace`
- API 端口：`3000`
- Verdaccio：`127.0.0.1:4873`

---

## 1. 脚本总览

项目根目录已提供以下脚本：

- `install-server.sh`：初始化服务器环境（支持 Ubuntu/Debian、CentOS/RHEL）
- `install-verdaccio.sh`：安装 Verdaccio + 生成配置 + PM2 启动 + 健康检查
- `pack-and-upload.sh`：本地打包 + 上传 + 远程触发离线部署
- `offline-deploy.sh`：服务器离线包部署（解包/备份/切换/构建/重启/回滚）
- `deploy.sh`：在线部署（服务器从 Git 仓库拉取）
- `rollback.sh`：回滚到历史版本

---

## 2. 一次性初始化服务器

在服务器执行：

```bash
chmod +x install-server.sh
./install-server.sh
```

该脚本会完成：

- 安装 Node.js、pnpm、PM2、Nginx
- 配置并启用防火墙（Debian 系走 UFW，RHEL 系走 firewalld）
- 启用系统服务

---

## 3. 安装 Verdaccio（必须）

项目 API 依赖 `VERDACCIO_URL`，所以服务器必须部署 Verdaccio。

执行：

```bash
chmod +x install-verdaccio.sh
./install-verdaccio.sh
```

默认行为：

- 使用 `pnpm -g` 安装 Verdaccio
- 生成配置到 `/opt/verdaccio/config.yaml`
- 监听 `127.0.0.1:4873`
- 用 PM2 启动进程名 `verdaccio`
- 自动健康检查 `/-/ping`

如遇 `ERR_PNPM_NO_GLOBAL_BIN_DIR`，先初始化：

```bash
export PNPM_HOME="/root/.local/share/pnpm"
mkdir -p "$PNPM_HOME"
export PATH="$PNPM_HOME:$PATH"
pnpm config set global-bin-dir "$PNPM_HOME"
```

---

## 4. 配置 Nginx（前端首页 + API 代理）

创建配置文件 `/etc/nginx/conf.d/verdaccio-markplace.conf`：

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
}
```

生效：

```bash
nginx -t && systemctl reload nginx
```

若访问到 Nginx 默认欢迎页，说明该配置未生效或前端构建产物不存在。

---

## 5. 推荐发布方式：离线发布（不依赖服务器访问 GitHub）

### 5.1 本地执行（一条命令）

```bash
chmod +x pack-and-upload.sh
./pack-and-upload.sh
```

该命令会自动：

1. 本地打包项目
2. 上传到服务器 `/opt/www`
3. 远程调用 `offline-deploy.sh` 完成部署

### 5.2 服务器离线部署（核心逻辑）

`offline-deploy.sh` 自动执行：

- 解压到临时目录
- 备份老版本目录
- 切换到新版本目录
- `pnpm install --frozen-lockfile`
- `pnpm build`
- PM2 启动/重载 API
- Nginx 测试并重载
- 健康检查失败自动回滚

---

## 6. 可选发布方式：在线部署（Git 拉取）

当服务器可访问 GitHub 时，可执行：

```bash
REPO_URL=ssh://git@github.com/JoeWrights/verdaccio-market.git ./deploy.sh
```

说明：

- `deploy.sh` 默认 `APP_DIR` 为脚本所在目录
- 目录非空但只有引导脚本时，支持自动初始化仓库

---

## 7. 回滚

在服务器项目目录执行：

```bash
./rollback.sh
```

或指定 commit：

```bash
./rollback.sh <commit_sha>
```

`rollback.sh` 默认 `APP_DIR` 也是脚本所在目录，避免路径误用。

---

## 8. 验收与访问地址

发布后验证：

```bash
curl -i http://127.0.0.1:3000/api/v1/health
curl -i http://116.196.89.88/api/v1/health
curl -I http://116.196.89.88
```

访问地址：

- 前端首页：`http://116.196.89.88`
- 后端健康检查：`http://116.196.89.88/api/v1/health`

---

## 9. 常见问题速查

### 9.1 SSH 首次连接提示 host key

输入 `yes`，不是 `no`：

```bash
ssh root@116.196.89.88
```

或：

```bash
ssh -o StrictHostKeyChecking=accept-new root@116.196.89.88
```

### 9.2 服务器拉 GitHub 报网络错误

改走离线发布（`pack-and-upload.sh` + `offline-deploy.sh`）。

### 9.3 首页显示 Nginx 默认页

检查：

1. `/etc/nginx/conf.d/verdaccio-markplace.conf` 是否存在且正确
2. `/opt/www/verdaccio-markplace/apps/web/dist` 是否存在
3. `nginx -t && systemctl reload nginx` 是否成功

### 9.4 API 健康检查失败

依次检查：

- `pm2 status`
- `pm2 logs verdaccio-markplace-api --lines 200`
- `pm2 logs verdaccio --lines 200`
- `curl -i http://127.0.0.1:4873/-/ping`

---

## 10. 建议的日常发布命令

本地执行：

```bash
./pack-and-upload.sh
```

这是当前环境最稳定的发布路径（不依赖服务器外网访问 GitHub）。
