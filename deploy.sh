#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# 一键部署脚本（适配当前项目）
# -----------------------------
# 用法：
#   APP_DIR=/opt/www/verdaccio-markplace BRANCH=main ./deploy.sh
#
# 可选环境变量：
#   APP_DIR                项目目录（默认脚本所在目录）
#   BRANCH                 部署分支（默认 main）
#   API_APP_NAME           PM2 应用名（默认 verdaccio-markplace-api）
#   API_PORT               API 端口（默认 3000）
#   VERDACCIO_URL          Verdaccio 地址（默认 http://127.0.0.1:4873）
#   HEALTH_ENDPOINT        健康检查地址（默认 http://127.0.0.1:3000/api/v1/health）
#   PM2_ECOSYSTEM_FILE     PM2 配置路径（默认 ecosystem.config.cjs）
#   REPO_URL               首次部署时可提供仓库地址自动 clone
#   NGINX_TEST_AND_RELOAD  是否测试并重载 nginx（默认 true）

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$SCRIPT_DIR}"
BRANCH="${BRANCH:-main}"
API_APP_NAME="${API_APP_NAME:-verdaccio-markplace-api}"
API_PORT="${API_PORT:-3000}"
VERDACCIO_URL="${VERDACCIO_URL:-http://127.0.0.1:4873}"
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-http://127.0.0.1:${API_PORT}/api/v1/health}"
PM2_ECOSYSTEM_FILE="${PM2_ECOSYSTEM_FILE:-ecosystem.config.cjs}"
REPO_URL="${REPO_URL:-}"
NGINX_TEST_AND_RELOAD="${NGINX_TEST_AND_RELOAD:-true}"

DEPLOY_DIR_NAME=".deploy"
DEPLOY_DIR_PATH=""
CURRENT_COMMIT=""
NEW_COMMIT=""
PREVIOUS_SUCCESSFUL_COMMIT=""

log() {
  echo "[deploy] $*"
}

fail() {
  echo "[deploy][ERROR] $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令：$1"
}

wait_for_health() {
  local max_retry=15
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

init_repo() {
  if [[ -e "$APP_DIR/.git" ]]; then
    log "检测到现有仓库：$APP_DIR"
    return 0
  fi

  [[ -n "$REPO_URL" ]] || fail "未发现 git 仓库，请设置 REPO_URL 后重试。"

  if [[ -d "$APP_DIR" && -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]]; then
    log "目录非空且非 git 仓库，尝试执行引导初始化..."
    (
      cd "$APP_DIR"
      # 仅允许保留部署引导文件，避免误覆盖业务文件。
      shopt -s nullglob dotglob
      local entries=(*)
      local allowed=0
      local item=""
      for item in "${entries[@]}"; do
        case "$item" in
          "deploy.sh"|"rollback.sh"|"install-server.sh"|".deploy")
            ;;
          *)
            allowed=1
            break
            ;;
        esac
      done
      if [[ "$allowed" -eq 1 ]]; then
        fail "目录 $APP_DIR 包含非引导文件，无法安全初始化。请清空目录或使用空目录再执行。"
      fi

      git init
      git remote add origin "$REPO_URL"
      git fetch --depth=1 origin "$BRANCH"
      git checkout -B "$BRANCH" FETCH_HEAD
    )
    return 0
  fi

  mkdir -p "$(dirname "$APP_DIR")"
  log "首次部署，正在克隆仓库..."
  git clone "$REPO_URL" "$APP_DIR"
}

prepare_pm2_ecosystem_if_missing() {
  if [[ -f "$PM2_ECOSYSTEM_FILE" ]]; then
    return 0
  fi

  log "未检测到 $PM2_ECOSYSTEM_FILE，自动生成..."
  cat >"$PM2_ECOSYSTEM_FILE" <<EOF
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
  require_cmd git
  require_cmd pnpm
  require_cmd node
  require_cmd pm2
  require_cmd curl

  init_repo
  cd "$APP_DIR"

  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "目录不是 git 仓库：$APP_DIR"
  if [[ -n "$(git status --porcelain)" ]]; then
    fail "仓库存在未提交变更，请先处理后再部署。"
  fi

  DEPLOY_DIR_PATH="$APP_DIR/$DEPLOY_DIR_NAME"
  mkdir -p "$DEPLOY_DIR_PATH"

  if [[ -f "$DEPLOY_DIR_PATH/last_successful_commit" ]]; then
    PREVIOUS_SUCCESSFUL_COMMIT="$(<"$DEPLOY_DIR_PATH/last_successful_commit")"
  fi

  CURRENT_COMMIT="$(git rev-parse --short HEAD)"
  log "当前提交：$CURRENT_COMMIT"

  log "拉取并切换分支：$BRANCH"
  git fetch --all --prune
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
  NEW_COMMIT="$(git rev-parse --short HEAD)"
  log "目标提交：$NEW_COMMIT"

  log "安装依赖..."
  pnpm install --frozen-lockfile

  log "构建项目..."
  pnpm build

  [[ -f "apps/api/dist/main.js" ]] || fail "后端构建产物不存在：apps/api/dist/main.js"
  [[ -d "apps/web/dist" ]] || fail "前端构建产物不存在：apps/web/dist"

  prepare_pm2_ecosystem_if_missing

  log "发布/重载 PM2 进程..."
  if pm2 describe "$API_APP_NAME" >/dev/null 2>&1; then
    pm2 startOrReload "$PM2_ECOSYSTEM_FILE" --only "$API_APP_NAME" --update-env
  else
    pm2 start "$PM2_ECOSYSTEM_FILE" --only "$API_APP_NAME" --update-env
  fi
  pm2 save

  if [[ "$NGINX_TEST_AND_RELOAD" == "true" ]]; then
    require_cmd nginx
    log "测试并重载 Nginx..."
    nginx -t
    systemctl reload nginx
  fi

  log "执行健康检查：$HEALTH_ENDPOINT"
  wait_for_health || fail "健康检查失败，请执行：pm2 logs $API_APP_NAME --lines 200"

  echo "$CURRENT_COMMIT" >"$DEPLOY_DIR_PATH/previous_commit"
  if [[ -n "$PREVIOUS_SUCCESSFUL_COMMIT" ]]; then
    echo "$PREVIOUS_SUCCESSFUL_COMMIT" >"$DEPLOY_DIR_PATH/previous_successful_commit"
  else
    echo "$CURRENT_COMMIT" >"$DEPLOY_DIR_PATH/previous_successful_commit"
  fi
  echo "$NEW_COMMIT" >"$DEPLOY_DIR_PATH/last_successful_commit"
  date +"%F %T %z" >"$DEPLOY_DIR_PATH/last_deploy_time"

  log "部署成功。"
  log "版本信息：$CURRENT_COMMIT -> $NEW_COMMIT"
}

main "$@"
