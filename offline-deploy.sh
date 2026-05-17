#!/usr/bin/env bash
set -euo pipefail

# --------------------------------------------------------
# 离线一键部署脚本（服务器单条命令执行）
# --------------------------------------------------------
# 功能：
# - 解压本地上传包到临时目录
# - 备份当前版本
# - 原子切换到新版本
# - 安装依赖并构建
# - 启动/重载 PM2
# - 测试并重载 Nginx
# - 健康检查失败自动回滚
#
# 用法：
#   chmod +x offline-deploy.sh
#   ./offline-deploy.sh /opt/www/verdaccio-markplace-20260517020500.tar.gz
#
# 可选环境变量：
#   APP_DIR=/opt/www/verdaccio-markplace
#   API_APP_NAME=verdaccio-markplace-api
#   API_PORT=3000
#   VERDACCIO_URL=http://127.0.0.1:4873
#   PM2_ECOSYSTEM_FILE=ecosystem.config.cjs
#   HEALTH_ENDPOINT=http://127.0.0.1:3000/api/v1/health
#   KEEP_BACKUPS=5
#   RUN_NGINX_RELOAD=true
#   PNPM_VERSION=10.7.0

APP_DIR="${APP_DIR:-/opt/www/verdaccio-markplace}"
API_APP_NAME="${API_APP_NAME:-verdaccio-markplace-api}"
API_PORT="${API_PORT:-3000}"
VERDACCIO_URL="${VERDACCIO_URL:-http://127.0.0.1:4873}"
PM2_ECOSYSTEM_FILE="${PM2_ECOSYSTEM_FILE:-ecosystem.config.cjs}"
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-http://127.0.0.1:${API_PORT}/api/v1/health}"
KEEP_BACKUPS="${KEEP_BACKUPS:-5}"
RUN_NGINX_RELOAD="${RUN_NGINX_RELOAD:-true}"
PNPM_VERSION="${PNPM_VERSION:-10.7.0}"

PACKAGE_FILE="${1:-}"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
PARENT_DIR="$(dirname "$APP_DIR")"
APP_NAME="$(basename "$APP_DIR")"
NEW_DIR="${PARENT_DIR}/${APP_NAME}_new_${TIMESTAMP}"
BACKUP_DIR="${PARENT_DIR}/${APP_NAME}_backup_${TIMESTAMP}"

SWITCHED=0
ROLLBACK_DONE=0

log() {
  echo "[offline-deploy] $*"
}

fail() {
  echo "[offline-deploy][ERROR] $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令：$1"
}

wait_for_health() {
  local max_retry=20
  local sleep_seconds=2
  local i=1
  while [[ $i -le $max_retry ]]; do
    if curl -fsS "$HEALTH_ENDPOINT" >/dev/null 2>&1; then
      return 0
    fi
    log "健康检查未通过，重试中 (${i}/${max_retry})..."
    sleep "$sleep_seconds"
    i=$((i + 1))
  done
  return 1
}

cleanup_old_backups() {
  local pattern="${PARENT_DIR}/${APP_NAME}_backup_*"
  # shellcheck disable=SC2012
  ls -1dt ${pattern} 2>/dev/null | awk "NR>${KEEP_BACKUPS}" | while read -r old_backup; do
    [[ -n "$old_backup" ]] || continue
    log "清理旧备份：$old_backup"
    rm -rf "$old_backup"
  done
}

rollback_on_error() {
  local exit_code=$?
  if [[ $exit_code -eq 0 ]]; then
    return 0
  fi

  log "检测到部署失败，开始回滚..."
  if [[ "$SWITCHED" -eq 1 && -d "$BACKUP_DIR" ]]; then
    rm -rf "$APP_DIR"
    mv "$BACKUP_DIR" "$APP_DIR"
    ROLLBACK_DONE=1
    log "目录已回滚到备份版本。"

    if [[ -f "$APP_DIR/$PM2_ECOSYSTEM_FILE" ]]; then
      pm2 startOrReload "$APP_DIR/$PM2_ECOSYSTEM_FILE" --only "$API_APP_NAME" --update-env || true
      pm2 save || true
    fi

    if [[ "$RUN_NGINX_RELOAD" == "true" ]]; then
      nginx -t && systemctl reload nginx || true
    fi
  fi

  rm -rf "$NEW_DIR"
  if [[ "$ROLLBACK_DONE" -eq 1 ]]; then
    fail "部署失败，已自动回滚。请检查日志后重试。"
  fi
  fail "部署失败，未发生目录切换，无需回滚。"
}

prepare_pm2_ecosystem_if_missing() {
  if [[ -f "$APP_DIR/$PM2_ECOSYSTEM_FILE" ]]; then
    return 0
  fi

  log "未检测到 $PM2_ECOSYSTEM_FILE，自动生成..."
  cat >"$APP_DIR/$PM2_ECOSYSTEM_FILE" <<EOF
module.exports = {
  apps: [
    {
      name: "${API_APP_NAME}",
      cwd: "${APP_DIR}",
      script: "apps/api/dist/main.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "${API_PORT}",
        VERDACCIO_URL: "${VERDACCIO_URL}"
      }
    }
  ]
};
EOF
}

main() {
  trap rollback_on_error EXIT

  [[ -n "$PACKAGE_FILE" ]] || fail "请传入离线包路径，例如：./offline-deploy.sh /opt/www/xxx.tar.gz"
  [[ -f "$PACKAGE_FILE" ]] || fail "离线包不存在：$PACKAGE_FILE"

  require_cmd tar
  require_cmd mv
  require_cmd rm
  require_cmd mkdir
  require_cmd node
  require_cmd pnpm
  require_cmd pm2
  require_cmd curl
  require_cmd nginx

  mkdir -p "$PARENT_DIR"
  rm -rf "$NEW_DIR"
  mkdir -p "$NEW_DIR"

  log "解压离线包到临时目录：$NEW_DIR"
  tar -xzf "$PACKAGE_FILE" -C "$NEW_DIR"

  if [[ ! -f "$NEW_DIR/package.json" ]]; then
    fail "离线包格式不正确：未找到 package.json（请从项目根目录打包）"
  fi

  if [[ -f "$APP_DIR/apps/api/.env.production" ]]; then
    mkdir -p "$NEW_DIR/apps/api"
    cp "$APP_DIR/apps/api/.env.production" "$NEW_DIR/apps/api/.env.production"
    log "已继承旧版本环境文件：apps/api/.env.production"
  fi

  if [[ -d "$APP_DIR" ]]; then
    log "备份当前版本到：$BACKUP_DIR"
    mv "$APP_DIR" "$BACKUP_DIR"
  fi

  log "切换到新版本目录：$APP_DIR"
  mv "$NEW_DIR" "$APP_DIR"
  SWITCHED=1

  cd "$APP_DIR"

  require_cmd corepack
  corepack enable
  corepack prepare "pnpm@${PNPM_VERSION}" --activate

  log "安装依赖..."
  pnpm install --frozen-lockfile

  log "构建项目..."
  pnpm build

  [[ -f "apps/api/dist/main.js" ]] || fail "后端构建产物不存在：apps/api/dist/main.js"
  [[ -d "apps/web/dist" ]] || fail "前端构建产物不存在：apps/web/dist"

  prepare_pm2_ecosystem_if_missing

  log "启动/重载 PM2..."
  if pm2 describe "$API_APP_NAME" >/dev/null 2>&1; then
    pm2 startOrReload "$PM2_ECOSYSTEM_FILE" --only "$API_APP_NAME" --update-env
  else
    pm2 start "$PM2_ECOSYSTEM_FILE" --only "$API_APP_NAME" --update-env
  fi
  pm2 save

  if [[ "$RUN_NGINX_RELOAD" == "true" ]]; then
    log "测试并重载 Nginx..."
    nginx -t
    systemctl reload nginx
  fi

  log "执行健康检查：$HEALTH_ENDPOINT"
  wait_for_health || fail "健康检查失败，请执行：pm2 logs $API_APP_NAME --lines 200"

  cleanup_old_backups

  log "部署成功。当前版本目录：$APP_DIR"
  log "备份目录：$BACKUP_DIR"
  trap - EXIT
}

main "$@"
