#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="/etc/systemd/system"
ENV_DIR="/etc/safecompass"
SERVICE_USER="${SERVICE_USER:-u2023202105}"

usage() {
  cat <<'USAGE'
Usage:
  sudo scripts/install_systemd_services.sh install
  sudo scripts/install_systemd_services.sh start
  sudo scripts/install_systemd_services.sh restart
  sudo scripts/install_systemd_services.sh stop
  sudo scripts/install_systemd_services.sh status
  sudo scripts/install_systemd_services.sh uninstall

Environment:
  SERVICE_USER defaults to u2023202105.

Notes:
  install copies unit files into /etc/systemd/system, creates optional
  /etc/safecompass/*.env override files if missing, reloads systemd, and
  enables both services.
USAGE
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "This command must be run as root, for example with sudo." >&2
    exit 1
  fi
}

copy_if_missing() {
  local source="$1"
  local target="$2"
  if [[ ! -f "$target" ]]; then
    install -m 0644 "$source" "$target"
  fi
}

stop_tmux_fallbacks() {
  if ! command -v runuser >/dev/null 2>&1 || ! command -v tmux >/dev/null 2>&1; then
    return
  fi

  runuser -u "$SERVICE_USER" -- tmux kill-session -t safecompass_local 2>/dev/null || true
  runuser -u "$SERVICE_USER" -- tmux kill-session -t llama70b_awq_judge 2>/dev/null || true
}

install_services() {
  require_root
  install -d -m 0755 "$UNIT_DIR" "$ENV_DIR"

  install -m 0644 "$ROOT_DIR/deploy/systemd/safecompass.service" "$UNIT_DIR/safecompass.service"
  install -m 0644 "$ROOT_DIR/deploy/systemd/safecompass-llama.service" "$UNIT_DIR/safecompass-llama.service"
  copy_if_missing "$ROOT_DIR/deploy/systemd/safecompass.env.example" "$ENV_DIR/safecompass.env"
  copy_if_missing "$ROOT_DIR/deploy/systemd/llama.env.example" "$ENV_DIR/llama.env"

  systemctl daemon-reload
  systemctl enable safecompass-llama.service safecompass.service

  echo "Installed systemd units:"
  echo "  $UNIT_DIR/safecompass.service"
  echo "  $UNIT_DIR/safecompass-llama.service"
  echo "Optional environment overrides:"
  echo "  $ENV_DIR/safecompass.env"
  echo "  $ENV_DIR/llama.env"
}

start_services() {
  require_root
  stop_tmux_fallbacks
  systemctl start safecompass-llama.service
  systemctl start safecompass.service
}

stop_services() {
  require_root
  systemctl stop safecompass.service safecompass-llama.service
}

restart_services() {
  require_root
  stop_tmux_fallbacks
  systemctl restart safecompass-llama.service
  systemctl restart safecompass.service
}

status_services() {
  systemctl status safecompass.service safecompass-llama.service --no-pager
}

uninstall_services() {
  require_root
  systemctl disable --now safecompass.service safecompass-llama.service 2>/dev/null || true
  rm -f "$UNIT_DIR/safecompass.service" "$UNIT_DIR/safecompass-llama.service"
  systemctl daemon-reload
  echo "Removed SafeCompass systemd units. Environment files in $ENV_DIR were left in place."
}

case "${1:-}" in
  install)
    install_services
    ;;
  start)
    start_services
    ;;
  stop)
    stop_services
    ;;
  restart)
    restart_services
    ;;
  status)
    status_services
    ;;
  uninstall)
    uninstall_services
    ;;
  -h|--help|help|"")
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
