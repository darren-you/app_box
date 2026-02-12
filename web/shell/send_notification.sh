#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/config.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

STAGE=""
STATUS=""
ERROR_MSG=""
META_FILE="${META_FILE:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stage)
      STAGE="$2"
      shift 2
      ;;
    --status)
      STATUS="$2"
      shift 2
      ;;
    --error)
      ERROR_MSG="$2"
      shift 2
      ;;
    --metadata-file)
      META_FILE="$2"
      shift 2
      ;;
    *)
      die "未知参数: $1"
      ;;
  esac
done

[[ -n "$STAGE" ]] || die "请通过 --stage 指定阶段(build/deploy)"
[[ -n "$STATUS" ]] || die "请通过 --status 指定状态(success/failed)"

if ! is_true "$NOTIFY_ENABLED"; then
  log_info "NOTIFY_ENABLED=false，跳过通知"
  exit 0
fi

if is_placeholder "$WECHAT_WEBHOOK_URL"; then
  log_info "未配置 WECHAT_WEBHOOK_URL，跳过通知"
  exit 0
fi

require_cmd curl

if [[ -n "$META_FILE" && -f "$META_FILE" ]]; then
  export META_FILE
  load_meta
fi

PROJECT_NAME="${PROJECT_NAME:-app-box-web}"
BUILD_BRANCH="${BUILD_BRANCH:-$(resolve_branch)}"
GIT_SHA="${GIT_SHA:-$(resolve_short_sha)}"
COMMIT_MSG="${COMMIT_MSG:-$(resolve_commit_msg)}"
BUILD_ENV="${BUILD_ENV:-unknown}"
BUILD_TIME="${BUILD_TIME:-$(now_time)}"
DEPLOY_TIME="${DEPLOY_TIME:-$(now_time)}"
ARTIFACT_LOCAL_PATH="${ARTIFACT_LOCAL_PATH:-$DIST_ZIP_PATH}"
DEPLOY_TARGET="${DEPLOY_TARGET:-${DEPLOY_USER:-unknown}@${DEPLOY_HOST:-unknown}:${DEPLOY_PORT:-22}}"
DEPLOY_ARTIFACT_REMOTE="${DEPLOY_ARTIFACT_REMOTE:-unknown}"
DEPLOY_REMOTE_OWNER="${DEPLOY_REMOTE_OWNER:-${REMOTE_OWNER}:${REMOTE_GROUP}}"
DEPLOY_REMOTE_MODE="${DEPLOY_REMOTE_MODE:-$REMOTE_MODE}"

if [[ "$STATUS" == "success" ]]; then
  STATUS_TEXT="成功"
  STATUS_ICON="✅"
else
  STATUS_TEXT="失败"
  STATUS_ICON="❌"
fi

if [[ "$STAGE" == "build" ]]; then
  CONTENT="$(cat <<EOF2
**${STATUS_ICON} 前端构建${STATUS_TEXT}**
🕒 时间：$BUILD_TIME
📦 项目：$PROJECT_NAME
🌿 分支：$BUILD_BRANCH
📝 提交信息：$COMMIT_MSG
🌐 环境：$BUILD_ENV
📁 构建产物：$ARTIFACT_LOCAL_PATH
EOF2
)"
else
  CONTENT="$(cat <<EOF2
**${STATUS_ICON} 前端部署${STATUS_TEXT}**
🕒 时间：$DEPLOY_TIME
📦 项目：$PROJECT_NAME
🌿 分支：$BUILD_BRANCH
📝 提交信息：$COMMIT_MSG
🎯 目标机器：$DEPLOY_TARGET
📁 远端产物：$DEPLOY_ARTIFACT_REMOTE
👤 属主属组：$DEPLOY_REMOTE_OWNER
🔐 权限：$DEPLOY_REMOTE_MODE
EOF2
)"
fi

if [[ -n "$ERROR_MSG" ]]; then
  CONTENT+=$'\n'"❗ 错误信息：$ERROR_MSG"
fi

PAYLOAD_CONTENT="$(json_escape "$CONTENT")"

curl -fsS -X POST "$WECHAT_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{\"msgtype\":\"markdown\",\"markdown\":{\"content\":\"$PAYLOAD_CONTENT\"}}" >/dev/null

log_info "通知发送成功: stage=$STAGE, status=$STATUS"
