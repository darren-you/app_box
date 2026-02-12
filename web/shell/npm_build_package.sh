#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/config.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

META_FILE="${META_FILE:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --metadata-file)
      META_FILE="$2"
      shift 2
      ;;
    *)
      die "未知参数: $1"
      ;;
  esac
done

if [[ -z "$META_FILE" ]]; then
  META_FILE="$(mktemp "/tmp/${PROJECT_NAME}.build.XXXXXX")"
fi
export META_FILE
ensure_meta_file

require_cmd npm
require_cmd git
require_cmd zip

BUILD_ENV_VALUE="${BUILD_ENV:-}"
validate_build_env "$BUILD_ENV_VALUE"
SHORT_SHA="$(resolve_short_sha)"
BRANCH_NAME="$(resolve_branch)"
COMMIT_MSG="$(resolve_commit_msg)"
BUILD_TIME="$(now_time)"

log_info "项目: $PROJECT_NAME"
log_info "分支: $BRANCH_NAME"
log_info "构建环境: $BUILD_ENV_VALUE"
log_info "开始安装依赖: $NPM_INSTALL_CMD"
(
  cd "$WEB_DIR"
  eval "$NPM_INSTALL_CMD"
)

log_info "开始构建: $NPM_BUILD_CMD"
(
  cd "$WEB_DIR"
  eval "$NPM_BUILD_CMD"
)

[[ -d "$DIST_DIR" ]] || die "构建失败：未找到产物目录 $DIST_DIR"

log_info "打包 dist 目录: $DIST_ZIP_PATH"
rm -f "$DIST_ZIP_PATH"
(
  cd "$WEB_DIR"
  zip -qry "$DIST_ZIP_PATH" dist
)
[[ -f "$DIST_ZIP_PATH" ]] || die "打包失败：未生成 dist.zip"

write_meta PROJECT_NAME "$PROJECT_NAME"
write_meta BUILD_ENV "$BUILD_ENV_VALUE"
write_meta BUILD_BRANCH "$BRANCH_NAME"
write_meta GIT_SHA "$SHORT_SHA"
write_meta COMMIT_MSG "$COMMIT_MSG"
write_meta BUILD_TIME "$BUILD_TIME"
write_meta ARTIFACT_LOCAL_PATH "$DIST_ZIP_PATH"
write_meta ARTIFACT_NAME "$(basename "$DIST_ZIP_PATH")"
write_meta REMOTE_PROJECT_DIR "$REMOTE_DEPLOY_PROJECT_DIR"

log_info "构建并打包完成: $DIST_ZIP_PATH"
log_info "元数据文件: $META_FILE"
