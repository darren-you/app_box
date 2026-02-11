#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/config.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

if [[ $# -gt 1 ]]; then
  die "仅支持一个参数 BUILD_ENV，示例: bash shell/deploy.sh production"
fi
if [[ $# -eq 1 ]]; then
  BUILD_ENV="$1"
fi
validate_build_env "${BUILD_ENV:-}"
export BUILD_ENV

META_FILE="${META_FILE:-$(mktemp "/tmp/${PROJECT_NAME}.deploy.XXXXXX")}"
KEEP_META_FILE="${KEEP_META_FILE:-false}"
export META_FILE

: > "$META_FILE"

if ! is_true "$KEEP_META_FILE"; then
  trap 'rm -f "$META_FILE"' EXIT
fi

log_info "开始执行部署流水线"
log_info "BUILD_ENV: $BUILD_ENV"
log_info "元数据文件: $META_FILE"

BUILD_STATUS="success"
BUILD_ERROR=""
if ! "$SCRIPT_DIR/docker_build_push.sh" --metadata-file "$META_FILE"; then
  BUILD_STATUS="failed"
  BUILD_ERROR="docker build/package 执行失败"
fi

BUILD_NOTIFY_CMD=("$SCRIPT_DIR/send_notification.sh" --stage build --status "$BUILD_STATUS" --metadata-file "$META_FILE")
if [[ -n "$BUILD_ERROR" ]]; then
  BUILD_NOTIFY_CMD+=(--error "$BUILD_ERROR")
fi
if ! "${BUILD_NOTIFY_CMD[@]}"; then
  log_warn "构建通知发送失败（不影响主流程）"
fi

if [[ "$BUILD_STATUS" != "success" ]]; then
  die "构建失败，终止部署"
fi

DEPLOY_STATUS="success"
DEPLOY_ERROR=""
if ! "$SCRIPT_DIR/remote_deploy.sh" --metadata-file "$META_FILE"; then
  DEPLOY_STATUS="failed"
  DEPLOY_ERROR="远程部署执行失败"
fi

DEPLOY_NOTIFY_CMD=("$SCRIPT_DIR/send_notification.sh" --stage deploy --status "$DEPLOY_STATUS" --metadata-file "$META_FILE")
if [[ -n "$DEPLOY_ERROR" ]]; then
  DEPLOY_NOTIFY_CMD+=(--error "$DEPLOY_ERROR")
fi
if ! "${DEPLOY_NOTIFY_CMD[@]}"; then
  log_warn "部署通知发送失败（不影响主流程）"
fi

if [[ "$DEPLOY_STATUS" != "success" ]]; then
  die "部署失败"
fi

log_info "流水线执行成功"
