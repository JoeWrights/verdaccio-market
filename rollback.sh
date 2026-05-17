#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# 一键回滚脚本（适配当前项目）
# -----------------------------
# 用法：
#   ./rollback.sh                 # 回滚到上次成功版本前一个版本
#   ./rollback.sh <commit_sha>    # 回滚到指定 commit
#
# 可选环境变量：
#   APP_DIR                项目目录（默认脚本所在目录）
#   BRANCH                 分支（默认 main）
#   API_APP_NAME           PM2 应用名（默认 verdaccio-markplace-api）
#   API_PORT               API 端口（默认 3000）
#   HEALTH_ENDPOINT        健康检查地址（默认 http://127.0.0.1:3000/api/v1/health）
#   PM2_ECOSYSTEM_FILE     PM2 配置路径（默认 ecosystem.config.cjs）
#   NGINX_TEST_AND_RELOAD  是否测试并重载 nginx（默认 true）

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$SCRIPT_DIR}"
BRANCH="${BRANCH:-main}"
API_APP_NAME="${API_APP_NAME:-verdaccio-markplace-api}"
API_PORT="${API_PORT:-3000}"
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-http://127.0.0.1:${API_PORT}/api/v1/health}"
PM2_ECOSYSTEM_FILE="${PM2_ECOSYSTEM_FILE:-ecosystem.config.cjs}"
NGINX_TEST_AND_RELOAD="${NGINX_TEST_AND_RELOAD:-true}"

DEPLOY_DIR_PATH=""
TARGET_COMMIT="${1:-}"

log() {
  echo "[rollback] $*"
}

fail() {
  echo "[rollback][ERROR] $*" >&2
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

resolve_target_commit() {
  if [[ -n "$TARGET_COMMIT" ]]; then
    return 0
  fi

  if [[ -f "$DEPLOY_DIR_PATH/previous_successful_commit" ]]; then
    TARGET_COMMIT="$(<"$DEPLOY_DIR_PATH/previous_successful_commit")"
    return 0
  fi

  if [[ -f "$DEPLOY_DIR_PATH/previous_commit" ]]; then
    TARGET_COMMIT="$(<"$DEPLOY_DIR_PATH/previous_commit")"
    return 0
  fi

  fail "未找到可回滚版本，请手动传入 commit：./rollback.sh <commit_sha>"
}

main() {
  require_cmd git
  require_cmd pnpm
  require_cmd node
  require_cmd pm2
  require_cmd curl

  cd "$APP_DIR"
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "目录不是 git 仓库：$APP_DIR"
  if [[ -n "$(git status --porcelain)" ]]; then
    fail "仓库存在未提交变更，请先处理后再回滚。"
  fi

  DEPLOY_DIR_PATH="$APP_DIR/.deploy"
  mkdir -p "$DEPLOY_DIR_PATH"

  git fetch --all --prune
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"

  resolve_target_commit
  log "准备回滚到：$TARGET_COMMIT"

  git cat-file -e "${TARGET_COMMIT}^{commit}" || fail "指定 commit 不存在：$TARGET_COMMIT"
  git checkout "$TARGET_COMMIT"

  log "安装依赖..."
  pnpm install --frozen-lockfile

  log "构建项目..."
  pnpm build

  [[ -f "apps/api/dist/main.js" ]] || fail "后端构建产物不存在：apps/api/dist/main.js"
  [[ -d "apps/web/dist" ]] || fail "前端构建产物不存在：apps/web/dist"

  [[ -f "$PM2_ECOSYSTEM_FILE" ]] || fail "未找到 PM2 配置：$PM2_ECOSYSTEM_FILE"
  log "重启 PM2 进程..."
  pm2 startOrReload "$PM2_ECOSYSTEM_FILE" --only "$API_APP_NAME" --update-env
  pm2 save

  if [[ "$NGINX_TEST_AND_RELOAD" == "true" ]]; then
    require_cmd nginx
    log "测试并重载 Nginx..."
    nginx -t
    systemctl reload nginx
  fi

  log "执行健康检查：$HEALTH_ENDPOINT"
  wait_for_health || fail "健康检查失败，请执行：pm2 logs $API_APP_NAME --lines 200"

  echo "$TARGET_COMMIT" >"$DEPLOY_DIR_PATH/last_successful_commit"
  date +"%F %T %z" >"$DEPLOY_DIR_PATH/last_rollback_time"

  log "回滚成功，当前版本：$TARGET_COMMIT"
  log "提示：如需恢复到分支最新代码，执行 ./deploy.sh"
}

main "$@"
