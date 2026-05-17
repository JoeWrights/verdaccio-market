#!/usr/bin/env bash
set -euo pipefail

# ----------------------------------------------------------------
# Verdaccio 一键安装脚本
# ----------------------------------------------------------------
# 功能：
# - 检查并安装 verdaccio（pnpm -g）
# - 生成 /opt/verdaccio/config.yaml
# - 初始化 storage/plugins/htpasswd 目录与文件
# - 通过 PM2 启动或重载 verdaccio
# - 进行健康检查（/-/ping）
#
# 用法：
#   chmod +x install-verdaccio.sh
#   ./install-verdaccio.sh
#
# 可选环境变量：
#   VERDACCIO_VERSION=5
#   VERDACCIO_BASE_DIR=/opt/verdaccio
#   VERDACCIO_PORT=4873
#   VERDACCIO_HOST=127.0.0.1
#   PM2_APP_NAME=verdaccio
#   ENABLE_NPMJS_UPLINK=true
#   HEALTHCHECK_RETRIES=20
#   HEALTHCHECK_INTERVAL=2

VERDACCIO_VERSION="${VERDACCIO_VERSION:-5}"
VERDACCIO_BASE_DIR="${VERDACCIO_BASE_DIR:-/opt/verdaccio}"
VERDACCIO_PORT="${VERDACCIO_PORT:-4873}"
VERDACCIO_HOST="${VERDACCIO_HOST:-127.0.0.1}"
PM2_APP_NAME="${PM2_APP_NAME:-verdaccio}"
ENABLE_NPMJS_UPLINK="${ENABLE_NPMJS_UPLINK:-true}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-20}"
HEALTHCHECK_INTERVAL="${HEALTHCHECK_INTERVAL:-2}"

VERDACCIO_STORAGE_DIR="${VERDACCIO_BASE_DIR}/storage"
VERDACCIO_PLUGINS_DIR="${VERDACCIO_BASE_DIR}/plugins"
VERDACCIO_HTPASSWD_FILE="${VERDACCIO_BASE_DIR}/htpasswd"
VERDACCIO_CONFIG_FILE="${VERDACCIO_BASE_DIR}/config.yaml"
HEALTHCHECK_URL="http://${VERDACCIO_HOST}:${VERDACCIO_PORT}/-/ping"
VERDACCIO_BIN=""

log() {
  echo "[install-verdaccio] $*"
}

fail() {
  echo "[install-verdaccio][ERROR] $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令：$1"
}

ensure_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    fail "请使用 root 运行（例如：sudo ./install-verdaccio.sh）"
  fi
}

install_verdaccio() {
  require_cmd pnpm
  if command -v verdaccio >/dev/null 2>&1; then
    log "检测到已有 verdaccio，执行升级到 v${VERDACCIO_VERSION}.x ..."
  else
    log "安装 verdaccio v${VERDACCIO_VERSION}.x ..."
  fi
  pnpm add -g "verdaccio@${VERDACCIO_VERSION}"
}

resolve_verdaccio_bin() {
  if command -v verdaccio >/dev/null 2>&1; then
    VERDACCIO_BIN="$(command -v verdaccio)"
    return 0
  fi

  local pnpm_global_bin=""
  pnpm_global_bin="$(pnpm bin -g 2>/dev/null || true)"
  if [[ -n "$pnpm_global_bin" && -x "${pnpm_global_bin}/verdaccio" ]]; then
    VERDACCIO_BIN="${pnpm_global_bin}/verdaccio"
    return 0
  fi

  fail "已通过 pnpm 安装 verdaccio，但未找到可执行文件。请检查 PNPM_HOME/PATH 配置。"
}

prepare_dirs() {
  log "初始化 Verdaccio 目录结构..."
  mkdir -p "$VERDACCIO_STORAGE_DIR" "$VERDACCIO_PLUGINS_DIR"
  touch "$VERDACCIO_HTPASSWD_FILE"
}

write_config() {
  log "生成配置文件：$VERDACCIO_CONFIG_FILE"

  if [[ "$ENABLE_NPMJS_UPLINK" == "true" ]]; then
    cat >"$VERDACCIO_CONFIG_FILE" <<EOF
storage: ${VERDACCIO_STORAGE_DIR}
plugins: ${VERDACCIO_PLUGINS_DIR}

auth:
  htpasswd:
    file: ${VERDACCIO_HTPASSWD_FILE}
    max_users: 1000

uplinks:
  npmjs:
    url: https://registry.npmjs.org/

packages:
  '@*/*':
    access: \$all
    publish: \$authenticated
    unpublish: \$authenticated
    proxy: npmjs
  '**':
    access: \$all
    publish: \$authenticated
    unpublish: \$authenticated
    proxy: npmjs

middlewares:
  audit:
    enabled: true

log:
  - { type: stdout, format: pretty, level: http }

listen: ${VERDACCIO_HOST}:${VERDACCIO_PORT}
EOF
  else
    cat >"$VERDACCIO_CONFIG_FILE" <<EOF
storage: ${VERDACCIO_STORAGE_DIR}
plugins: ${VERDACCIO_PLUGINS_DIR}

auth:
  htpasswd:
    file: ${VERDACCIO_HTPASSWD_FILE}
    max_users: 1000

packages:
  '@*/*':
    access: \$all
    publish: \$authenticated
    unpublish: \$authenticated
  '**':
    access: \$all
    publish: \$authenticated
    unpublish: \$authenticated

middlewares:
  audit:
    enabled: true

log:
  - { type: stdout, format: pretty, level: http }

listen: ${VERDACCIO_HOST}:${VERDACCIO_PORT}
EOF
  fi
}

start_with_pm2() {
  require_cmd pm2
  [[ -n "$VERDACCIO_BIN" ]] || fail "VERDACCIO_BIN 未初始化"

  log "通过 PM2 启动/重载 Verdaccio..."
  if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
  fi

  pm2 start "$VERDACCIO_BIN" --name "$PM2_APP_NAME" -- -c "$VERDACCIO_CONFIG_FILE"
  pm2 save
}

wait_for_health() {
  local i=1
  while [[ "$i" -le "$HEALTHCHECK_RETRIES" ]]; do
    if curl -fsS "$HEALTHCHECK_URL" >/dev/null 2>&1; then
      return 0
    fi
    log "健康检查未通过，重试中 (${i}/${HEALTHCHECK_RETRIES})..."
    sleep "$HEALTHCHECK_INTERVAL"
    i=$((i + 1))
  done
  return 1
}

print_summary() {
  log "安装完成。"
  echo "----------------------------------------"
  echo "verdaccio version : $("$VERDACCIO_BIN" --version)"
  echo "pm2 app name      : ${PM2_APP_NAME}"
  echo "config file       : ${VERDACCIO_CONFIG_FILE}"
  echo "storage dir       : ${VERDACCIO_STORAGE_DIR}"
  echo "listen            : ${VERDACCIO_HOST}:${VERDACCIO_PORT}"
  echo "health check      : ${HEALTHCHECK_URL}"
  echo "----------------------------------------"
  pm2 status "$PM2_APP_NAME" || true
}

main() {
  ensure_root
  require_cmd curl
  require_cmd pnpm

  install_verdaccio
  resolve_verdaccio_bin
  prepare_dirs
  write_config
  start_with_pm2

  log "执行健康检查：$HEALTHCHECK_URL"
  wait_for_health || fail "Verdaccio 启动失败，请查看日志：pm2 logs ${PM2_APP_NAME} --lines 200"

  print_summary
  log "下一步：将 API 环境变量 VERDACCIO_URL 设置为 http://${VERDACCIO_HOST}:${VERDACCIO_PORT}"
}

main "$@"
