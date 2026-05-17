#!/usr/bin/env bash
set -euo pipefail

# ----------------------------------------------------------------
# 本地一键发布脚本：打包 + 上传 + 远程触发 offline-deploy.sh
# ----------------------------------------------------------------
# 用法：
#   chmod +x pack-and-upload.sh
#   ./pack-and-upload.sh
#
# 可选环境变量：
#   SERVER_HOST=116.196.89.88
#   SERVER_USER=root
#   SERVER_PORT=22
#   REMOTE_BASE_DIR=/opt/www
#   APP_DIR=/opt/www/verdaccio-markplace
#   REMOTE_SCRIPT=/opt/www/verdaccio-markplace/offline-deploy.sh
#   KEEP_PACKAGE_LOCAL=true
#   EXCLUDES_FILE=.deploy-excludes
#
# 说明：
# - 该脚本应在项目根目录执行（与 package.json 同级）
# - 服务器需已具备：node/pnpm/pm2/nginx，且已存在 offline-deploy.sh

SERVER_HOST="${SERVER_HOST:-116.196.89.88}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PORT="${SERVER_PORT:-22}"
REMOTE_BASE_DIR="${REMOTE_BASE_DIR:-/opt/www/verdaccio-marketplace}"
APP_DIR="${APP_DIR:-/opt/www/verdaccio-markplace}"
REMOTE_SCRIPT="${REMOTE_SCRIPT:-/opt/www/verdaccio-markplace/offline-deploy.sh}"
KEEP_PACKAGE_LOCAL="${KEEP_PACKAGE_LOCAL:-true}"
EXCLUDES_FILE="${EXCLUDES_FILE:-.deploy-excludes}"

PROJECT_DIR="$(pwd)"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
PACKAGE_NAME="verdaccio-markplace-${TIMESTAMP}.tar.gz"
PACKAGE_PATH="${PROJECT_DIR}/${PACKAGE_NAME}"
REMOTE_PACKAGE_PATH="${REMOTE_BASE_DIR}/${PACKAGE_NAME}"

log() {
  echo "[pack-upload] $*"
}

fail() {
  echo "[pack-upload][ERROR] $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令：$1"
}

check_project_root() {
  [[ -f "${PROJECT_DIR}/package.json" ]] || fail "当前目录不是项目根目录：未找到 package.json"
  [[ -f "${PROJECT_DIR}/offline-deploy.sh" ]] || fail "未找到 offline-deploy.sh，请先生成该脚本"
}

build_tar_excludes() {
  if [[ -f "${PROJECT_DIR}/${EXCLUDES_FILE}" ]]; then
    echo "--exclude-from=${PROJECT_DIR}/${EXCLUDES_FILE}"
    return 0
  fi

  # 默认排除项，避免上传无关大文件
  cat <<'EOF'
--exclude=.git
--exclude=.turbo
--exclude=.deploy
--exclude=.DS_Store
--exclude=*/node_modules
--exclude=*/dist
EOF
}

package_project() {
  log "开始打包：${PACKAGE_NAME}"

  # shellcheck disable=SC2207
  local excludes=($(build_tar_excludes))
  tar -czf "$PACKAGE_PATH" "${excludes[@]}" .

  [[ -f "$PACKAGE_PATH" ]] || fail "打包失败：未生成 ${PACKAGE_PATH}"
  log "打包完成：${PACKAGE_PATH}"
}

upload_package() {
  log "上传离线包到服务器：${SERVER_USER}@${SERVER_HOST}:${REMOTE_BASE_DIR}"
  ssh -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_HOST}" "mkdir -p \"${REMOTE_BASE_DIR}\""
  scp -P "$SERVER_PORT" "$PACKAGE_PATH" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PACKAGE_PATH}"
}

trigger_remote_deploy() {
  log "远程触发离线部署脚本..."
  ssh -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_HOST}" \
    "chmod +x \"${REMOTE_SCRIPT}\" && APP_DIR=\"${APP_DIR}\" \"${REMOTE_SCRIPT}\" \"${REMOTE_PACKAGE_PATH}\""
}

cleanup_local_package() {
  if [[ "$KEEP_PACKAGE_LOCAL" == "true" ]]; then
    log "保留本地离线包：${PACKAGE_PATH}"
    return 0
  fi
  rm -f "$PACKAGE_PATH"
  log "已删除本地离线包：${PACKAGE_PATH}"
}

main() {
  require_cmd tar
  require_cmd ssh
  require_cmd scp

  check_project_root
  package_project
  upload_package
  trigger_remote_deploy
  cleanup_local_package

  log "发布完成。"
  log "服务器验收建议：curl -i http://${SERVER_HOST}/api/v1/health"
}

main "$@"
