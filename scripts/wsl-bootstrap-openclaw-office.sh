#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-}"
OPENCLAW_VERSION="${OPENCLAW_VERSION:-2026.3.28}"
OPENCLAW_GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
OPENCLAW_OFFICE_PORT="${OPENCLAW_OFFICE_PORT:-5180}"
OPENCLAW_SKIP_OFFICE_START="${OPENCLAW_SKIP_OFFICE_START:-0}"
RUNTIME_DIR=""
GATEWAY_LOG=""
GATEWAY_PID_FILE=""
OFFICE_LOG=""
OFFICE_PID_FILE=""

if [[ -z "$PROJECT_DIR" ]]; then
  echo "缺少项目目录参数。"
  exit 1
fi

RUNTIME_DIR="$PROJECT_DIR/.runtime"
GATEWAY_LOG="$RUNTIME_DIR/openclaw-gateway.log"
GATEWAY_PID_FILE="$RUNTIME_DIR/openclaw-gateway.pid"
OFFICE_LOG="$RUNTIME_DIR/openclaw-office.log"
OFFICE_PID_FILE="$RUNTIME_DIR/openclaw-office.pid"

mkdir -p "$RUNTIME_DIR"

step() {
  printf "\n[%s] %s\n" "$1" "$2"
}

can_sudo_without_prompt() {
  command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1
}

wait_for_http() {
  local url="$1"
  local retries="$2"
  local delay="$3"
  local i
  for ((i = 0; i < retries; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

ensure_systemd() {
  if [[ "$(ps -p 1 -o comm= 2>/dev/null || true)" == "systemd" ]]; then
    return 0
  fi

  step "wsl" "检测到当前 WSL 未启用 systemd，尝试自动修复"
  if ! command -v sudo >/dev/null 2>&1; then
    echo "当前 WSL 环境缺少 sudo，无法自动启用 systemd。"
    echo "请先在 WSL 中安装 sudo 并重新运行。"
    exit 1
  fi

  printf "[boot]\nsystemd=true\n" | sudo tee /etc/wsl.conf >/dev/null
  echo "已写入 /etc/wsl.conf。请在 Windows 中执行 wsl --shutdown 后重新双击启动。"
  exit 1
}

ensure_node() {
  local current_version=""
  local major=0
  local minor=0

  if command -v node >/dev/null 2>&1; then
    current_version="$(node -v 2>/dev/null | sed 's/^v//' || true)"
    major="${current_version%%.*}"
    local rest="${current_version#*.}"
    minor="${rest%%.*}"

    if [[ "$major" =~ ^[0-9]+$ ]] && [[ "$minor" =~ ^[0-9]+$ ]]; then
      if (( major > 22 )) || (( major == 22 && minor >= 14 )); then
        return 0
      fi
    fi
  fi

  if ! can_sudo_without_prompt; then
    echo "当前 WSL 用户无法无密码提权安装 Node.js。"
    echo "请通过 Windows 启动器运行，或先在 WSL 中配置 sudo -n 可用后重试。"
    exit 1
  fi

  step "node" "升级 Node.js 到 22.14+"
  sudo -n apt-get update
  sudo -n apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -n -E bash -
  sudo -n apt-get install -y nodejs

  current_version="$(node -v 2>/dev/null | sed 's/^v//' || true)"
  major="${current_version%%.*}"
  local upgraded_rest="${current_version#*.}"
  minor="${upgraded_rest%%.*}"
  if ! [[ "$major" =~ ^[0-9]+$ ]] || ! [[ "$minor" =~ ^[0-9]+$ ]] || (( major < 22 )) || (( major == 22 && minor < 14 )); then
    echo "Node.js 升级失败，当前版本为：${current_version:-unknown}"
    exit 1
  fi
}

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi

  step "pnpm" "启用 Corepack 并安装 pnpm"
  corepack enable
  corepack prepare pnpm@10.26.1 --activate
}

install_openclaw() {
  local current_version=""

  if command -v openclaw >/dev/null 2>&1; then
    current_version="$(openclaw --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true)"
  fi

  if [[ "$current_version" == "$OPENCLAW_VERSION" ]]; then
    return 0
  fi

  step "openclaw" "安装 OpenClaw ${OPENCLAW_VERSION}"
  if ! npm install -g "openclaw@${OPENCLAW_VERSION}"; then
    if ! can_sudo_without_prompt; then
      echo "当前 WSL 用户无权全局安装 OpenClaw。"
      echo "请通过 Windows 启动器运行，或先在 WSL 中配置 sudo -n 可用后重试。"
      exit 1
    fi
    sudo -n env SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g "openclaw@${OPENCLAW_VERSION}"
  fi

  current_version="$(openclaw --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true)"
  if [[ "$current_version" != "$OPENCLAW_VERSION" ]]; then
    echo "OpenClaw 安装失败，当前版本为：${current_version:-unknown}"
    exit 1
  fi
}

ensure_openclaw_config() {
  local config_path="${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
  local generated_token=""

  if [[ -f "$config_path" ]]; then
    return 0
  fi

  step "openclaw" "自动初始化 OpenClaw 配置"
  generated_token="$(node -e "console.log(require('node:crypto').randomUUID().replace(/-/g, ''))")"
  openclaw onboard \
    --non-interactive \
    --accept-risk \
    --flow manual \
    --mode local \
    --auth-choice skip \
    --gateway-auth token \
    --gateway-token "$generated_token" \
    --skip-channels \
    --skip-search \
    --skip-skills \
    --skip-ui \
    --skip-health \
    --no-install-daemon \
    --json >/dev/null

  if [[ ! -f "$config_path" ]]; then
    echo "OpenClaw 初始化失败，未生成配置文件。"
    exit 1
  fi
}

configure_gateway() {
  step "gateway" "写入 Control UI 所需配置"
  openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true
  openclaw config set gateway.controlUi.allowInsecureAuth true
}

start_gateway_service() {
  local status_output=""

  step "gateway" "安装并启动 Gateway 服务"
  openclaw gateway install || true
  openclaw gateway restart || true
  status_output="$(openclaw gateway status 2>&1 || true)"

  if printf "%s" "$status_output" | grep -qi "Runtime:[[:space:]]*running"; then
    return 0
  fi

  if [[ -f "$GATEWAY_PID_FILE" ]]; then
    local old_pid
    old_pid="$(cat "$GATEWAY_PID_FILE" 2>/dev/null || true)"
    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
      kill "$old_pid" 2>/dev/null || true
      sleep 1
    fi
  fi

  nohup openclaw gateway --port "$OPENCLAW_GATEWAY_PORT" >"$GATEWAY_LOG" 2>&1 &
  echo "$!" >"$GATEWAY_PID_FILE"
}

wait_for_gateway() {
  local retries=60
  local i
  for ((i = 0; i < retries; i++)); do
    if openclaw gateway status 2>&1 | grep -qi "Runtime:[[:space:]]*running"; then
      return 0
    fi
    sleep 2
  done

  echo "Gateway 启动失败，请检查日志：$GATEWAY_LOG"
  openclaw gateway status || true
  exit 1
}

install_office_dependencies() {
  step "office" "安装前端依赖"
  cd "$PROJECT_DIR"
  CI=1 pnpm install --force
}

needs_build() {
  if [[ ! -f "$PROJECT_DIR/dist/index.html" ]]; then
    return 0
  fi

  if [[ "$PROJECT_DIR/package.json" -nt "$PROJECT_DIR/dist/index.html" ]]; then
    return 0
  fi

  if [[ "$PROJECT_DIR/pnpm-lock.yaml" -nt "$PROJECT_DIR/dist/index.html" ]]; then
    return 0
  fi

  if find "$PROJECT_DIR/src" "$PROJECT_DIR/public" -type f -newer "$PROJECT_DIR/dist/index.html" | grep -q .; then
    return 0
  fi

  return 1
}

build_office_if_needed() {
  if ! needs_build; then
    return 0
  fi

  step "office" "构建 OpenClaw Office 生产版本"
  cd "$PROJECT_DIR"
  pnpm build
}

stop_existing_office() {
  if [[ ! -f "$OFFICE_PID_FILE" ]]; then
    return 0
  fi

  local old_pid
  old_pid="$(cat "$OFFICE_PID_FILE" 2>/dev/null || true)"
  if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
    kill "$old_pid" 2>/dev/null || true
    sleep 1
  fi
}

start_office() {
  step "office" "启动 OpenClaw Office"
  stop_existing_office
  cd "$PROJECT_DIR"
  nohup node ./bin/openclaw-office.js \
    --host 0.0.0.0 \
    --port "$OPENCLAW_OFFICE_PORT" \
    --gateway "ws://127.0.0.1:${OPENCLAW_GATEWAY_PORT}" \
    >"$OFFICE_LOG" 2>&1 &
  echo "$!" >"$OFFICE_PID_FILE"
}

print_gateway_summary() {
  printf "\n部署完成。\n"
  printf "OpenClaw 版本: %s\n" "$OPENCLAW_VERSION"
  printf "Gateway: ws://127.0.0.1:%s\n" "$OPENCLAW_GATEWAY_PORT"
  printf "Gateway 日志: %s\n" "$GATEWAY_LOG"
}

print_summary() {
  print_gateway_summary
  printf "Office: http://127.0.0.1:%s\n" "$OPENCLAW_OFFICE_PORT"
  printf "Office 日志: %s\n" "$OFFICE_LOG"
}

ensure_systemd
ensure_node
ensure_pnpm
install_openclaw
ensure_openclaw_config
configure_gateway
start_gateway_service
wait_for_gateway
install_office_dependencies
build_office_if_needed

if [[ "$OPENCLAW_SKIP_OFFICE_START" == "1" ]]; then
  print_gateway_summary
  exit 0
fi

start_office

if ! wait_for_http "http://127.0.0.1:${OPENCLAW_OFFICE_PORT}" 60 2; then
  echo "OpenClaw Office 启动失败，请检查日志：$OFFICE_LOG"
  exit 1
fi

print_summary
