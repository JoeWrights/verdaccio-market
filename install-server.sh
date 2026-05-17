#!/usr/bin/env bash
set -euo pipefail

# --------------------------------------
# 从 0 到 1 初始化服务器基础环境
# --------------------------------------
# 覆盖内容：
# - 系统更新（apt / dnf / yum）
# - 安装基础依赖（git/curl/nginx/firewall 等）
# - 安装 Node.js 20 LTS（NodeSource）
# - 启用 corepack 并安装 pnpm@10.7.0
# - 全局安装 PM2 并配置开机自启
# - Debian 系：配置 UFW（22/80/443）
# - RHEL/CentOS 系：配置 firewalld（22/80/443）
# - 启用 nginx 服务
#
# 用法（推荐 root 执行）：
#   chmod +x install-server.sh
#   ./install-server.sh
#
# 可选环境变量：
#   NODE_MAJOR=20
#   PNPM_VERSION=10.7.0
#   ENABLE_FIREWALL=true
#   SSH_PORT=22
#   ENABLE_FULL_UPGRADE=true
#   PM2_STARTUP_USER=root
#   PM2_STARTUP_HOME=/root

NODE_MAJOR="${NODE_MAJOR:-20}"
PNPM_VERSION="${PNPM_VERSION:-10.7.0}"
ENABLE_FIREWALL="${ENABLE_FIREWALL:-true}"
SSH_PORT="${SSH_PORT:-22}"
ENABLE_FULL_UPGRADE="${ENABLE_FULL_UPGRADE:-true}"
PM2_STARTUP_USER="${PM2_STARTUP_USER:-root}"
PM2_STARTUP_HOME="${PM2_STARTUP_HOME:-/root}"

OS_ID=""
OS_ID_LIKE=""
PKG_MANAGER=""
FIREWALL_KIND=""

log() {
  echo "[install-server] $*"
}

fail() {
  echo "[install-server][ERROR] $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令：$1"
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    fail "请使用 root 运行（例如：sudo ./install-server.sh）"
  fi
}

detect_os_and_pkg_manager() {
  if [[ ! -f /etc/os-release ]]; then
    fail "无法识别系统，未找到 /etc/os-release"
  fi

  # shellcheck disable=SC1091
  source /etc/os-release
  OS_ID="${ID:-}"
  OS_ID_LIKE="${ID_LIKE:-}"

  if command -v apt-get >/dev/null 2>&1; then
    PKG_MANAGER="apt"
    FIREWALL_KIND="ufw"
  elif command -v dnf >/dev/null 2>&1; then
    PKG_MANAGER="dnf"
    FIREWALL_KIND="firewalld"
  elif command -v yum >/dev/null 2>&1; then
    PKG_MANAGER="yum"
    FIREWALL_KIND="firewalld"
  else
    fail "未检测到支持的包管理器（apt-get/dnf/yum）"
  fi

  log "系统识别：ID=${OS_ID:-unknown}, ID_LIKE=${OS_ID_LIKE:-unknown}, PKG_MANAGER=$PKG_MANAGER"
}

update_upgrade_system() {
  case "$PKG_MANAGER" in
    apt)
      log "更新 apt 索引..."
      apt-get update
      if [[ "$ENABLE_FULL_UPGRADE" == "true" ]]; then
        log "升级系统软件包..."
        DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
      fi
      ;;
    dnf)
      if [[ "$ENABLE_FULL_UPGRADE" == "true" ]]; then
        log "升级系统软件包（dnf upgrade）..."
        dnf -y upgrade
      else
        log "刷新 dnf 缓存..."
        dnf -y makecache
      fi
      ;;
    yum)
      if [[ "$ENABLE_FULL_UPGRADE" == "true" ]]; then
        log "升级系统软件包（yum update）..."
        yum -y update
      else
        log "刷新 yum 缓存..."
        yum -y makecache
      fi
      ;;
    *)
      fail "未知包管理器：$PKG_MANAGER"
      ;;
  esac
}

install_base_packages() {
  log "安装基础依赖..."
  case "$PKG_MANAGER" in
    apt)
      DEBIAN_FRONTEND=noninteractive apt-get install -y \
        ca-certificates \
        curl \
        git \
        gnupg \
        lsb-release \
        nginx \
        ufw \
        build-essential
      ;;
    dnf)
      dnf -y install \
        ca-certificates \
        curl \
        git \
        gnupg2 \
        nginx \
        firewalld \
        gcc \
        gcc-c++ \
        make
      ;;
    yum)
      yum -y install \
        ca-certificates \
        curl \
        git \
        gnupg2 \
        nginx \
        firewalld \
        gcc \
        gcc-c++ \
        make
      ;;
    *)
      fail "未知包管理器：$PKG_MANAGER"
      ;;
  esac
}

install_node() {
  if command -v node >/dev/null 2>&1; then
    local current_major
    current_major="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
    if [[ "$current_major" == "$NODE_MAJOR" ]]; then
      log "Node.js 已是 v${NODE_MAJOR}.x，跳过安装。"
      return 0
    fi
  fi

  log "安装 Node.js ${NODE_MAJOR}.x（NodeSource）..."
  if [[ "$PKG_MANAGER" == "apt" ]]; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
  else
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    if [[ "$PKG_MANAGER" == "dnf" ]]; then
      dnf -y install nodejs
    else
      yum -y install nodejs
    fi
  fi
}

setup_pnpm() {
  require_cmd corepack
  log "启用 corepack 并安装 pnpm@${PNPM_VERSION}..."
  corepack enable
  corepack prepare "pnpm@${PNPM_VERSION}" --activate
}

install_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    log "PM2 已安装，执行升级到最新..."
  else
    log "安装 PM2..."
  fi
  npm install -g pm2@latest
}

setup_pm2_startup() {
  require_cmd pm2
  log "配置 PM2 开机自启..."
  pm2 startup systemd -u "$PM2_STARTUP_USER" --hp "$PM2_STARTUP_HOME"
  pm2 save || true
}

setup_nginx() {
  log "启用并启动 Nginx..."
  systemctl enable nginx
  systemctl restart nginx
  nginx -t
}

setup_firewall() {
  if [[ "$ENABLE_FIREWALL" != "true" ]]; then
    log "已跳过防火墙配置（ENABLE_FIREWALL=${ENABLE_FIREWALL}）。"
    return 0
  fi

  if [[ "$FIREWALL_KIND" == "ufw" ]]; then
    require_cmd ufw
    log "配置 UFW 规则..."
    ufw allow "${SSH_PORT}/tcp"
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    return 0
  fi

  require_cmd firewall-cmd
  log "配置 firewalld 规则..."
  systemctl enable firewalld
  systemctl restart firewalld
  firewall-cmd --permanent --add-port="${SSH_PORT}/tcp"
  firewall-cmd --permanent --add-service=http
  firewall-cmd --permanent --add-service=https
  firewall-cmd --reload
}

print_summary() {
  log "安装完成，当前版本："
  echo "----------------------------------------"
  echo "os   : ${OS_ID:-unknown}"
  echo "node : $(node -v)"
  echo "npm  : $(npm -v)"
  echo "pnpm : $(pnpm -v)"
  echo "pm2  : $(pm2 -v)"
  echo "nginx: $(nginx -v 2>&1)"
  echo "----------------------------------------"

  if [[ "$ENABLE_FIREWALL" == "true" ]]; then
    if [[ "$FIREWALL_KIND" == "ufw" ]]; then
      ufw status
    else
      firewall-cmd --list-all
    fi
  fi
}

main() {
  require_root
  detect_os_and_pkg_manager

  update_upgrade_system
  install_base_packages
  install_node
  setup_pnpm
  install_pm2
  setup_pm2_startup
  setup_nginx
  setup_firewall

  print_summary
  log "下一步：把项目代码放到服务器后执行 ./deploy.sh"
}

main "$@"
