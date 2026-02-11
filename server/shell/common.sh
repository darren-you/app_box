#!/usr/bin/env bash
# shellcheck shell=bash

log_info() {
  echo "[INFO] $*"
}

log_warn() {
  echo "[WARN] $*" >&2
}

log_error() {
  echo "[ERROR] $*" >&2
}

die() {
  log_error "$*"
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || die "未检测到命令: $cmd"
}

is_true() {
  local value="${1:-false}"
  value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    1|true|yes|y|on) return 0 ;;
    *) return 1 ;;
  esac
}

is_placeholder() {
  local value="${1:-}"
  [[ -z "$value" || "$value" == your_* ]]
}

resolve_branch() {
  local branch="${BRANCH_NAME:-${GIT_BRANCH:-}}"
  if [[ -z "$branch" ]]; then
    branch="$(git -C "$SERVER_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  fi
  branch="${branch#origin/}"
  branch="${branch#refs/heads/}"
  echo "$branch"
}

sanitize_tag_part() {
  local raw="${1:-unknown}"
  raw="$(echo "$raw" | tr '/:@ ' '-' | tr -cd 'a-zA-Z0-9_.-')"
  if [[ -z "$raw" ]]; then
    raw="unknown"
  fi
  echo "$raw"
}

validate_build_env() {
  local value="${1:-}"
  case "$value" in
    production|development) return 0 ;;
    *)
      die "BUILD_ENV 仅支持 production 或 development，当前: ${value:-<empty>}"
      ;;
  esac
}

env_short() {
  local env_name="${1:-development}"
  if [[ "$env_name" == "production" ]]; then
    echo "prod"
  else
    echo "dev"
  fi
}

now_time() {
  date '+%Y-%m-%d %H:%M:%S'
}

resolve_short_sha() {
  git -C "$SERVER_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

resolve_commit_msg() {
  git -C "$SERVER_DIR" log -1 --pretty=%s 2>/dev/null || echo "No commit message"
}

ensure_meta_file() {
  [[ -n "${META_FILE:-}" ]] || die "META_FILE 未设置"
  touch "$META_FILE"
}

write_meta() {
  local key="$1"
  local value="${2:-}"
  ensure_meta_file
  printf "%s=%q\n" "$key" "$value" >> "$META_FILE"
}

load_meta() {
  ensure_meta_file
  # shellcheck disable=SC1090
  source "$META_FILE"
}

json_escape() {
  local text="${1:-}"
  printf '%s' "$text" | awk '
    BEGIN { first = 1 }
    {
      gsub(/\\/, "\\\\")
      gsub(/"/, "\\\"")
      if (!first) {
        printf "\\n"
      }
      printf "%s", $0
      first = 0
    }
  '
}
