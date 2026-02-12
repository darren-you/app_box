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

[[ -n "$META_FILE" ]] || die "必须传入 --metadata-file"
export META_FILE
load_meta

require_cmd git
require_cmd ssh

LOCAL_ARCHIVE_PATH="${IMAGE_ARCHIVE_PATH:-}"
[[ -n "$LOCAL_ARCHIVE_PATH" ]] || die "metadata 缺少 IMAGE_ARCHIVE_PATH"
[[ -f "$LOCAL_ARCHIVE_PATH" ]] || die "镜像归档文件不存在: $LOCAL_ARCHIVE_PATH"

ARTIFACT_REPO="${ARTIFACT_GIT_REPO:-}"
ARTIFACT_BRANCH="main"
ARTIFACT_LOCAL_DIR="/tmp/${PROJECT_NAME}-artifact-repo"
COMMIT_NAME="app-box-ci"
COMMIT_EMAIL="app-box-ci@local"

[[ -n "$ARTIFACT_REPO" ]] || die "ARTIFACT_GIT_REPO 不能为空"
[[ "$ARTIFACT_LOCAL_DIR" != "/" ]] || die "本地克隆目录不能为 /"
[[ "$ARTIFACT_LOCAL_DIR" != "." ]] || die "本地克隆目录不能为 ."

BUILD_ENV_VALUE="${BUILD_ENV:-${BUILD_ENV_VALUE:-}}"
validate_build_env "$BUILD_ENV_VALUE"
ENV_SHORT="$(env_short "$BUILD_ENV_VALUE")"
SHORT_SHA="${GIT_SHA:-$(resolve_short_sha)}"
BRANCH_NAME="${BUILD_BRANCH:-$(resolve_branch)}"

DEPLOY_IMAGE_FULL="${DEPLOY_IMAGE:-unknown}"
IMAGE_REPO_NO_TAG="$DEPLOY_IMAGE_FULL"
if [[ "$DEPLOY_IMAGE_FULL" == *:* ]]; then
  IMAGE_REPO_NO_TAG="${DEPLOY_IMAGE_FULL%:*}"
fi
IMAGE_NAME_RAW="${IMAGE_REPO_NO_TAG##*/}"
if [[ -z "$IMAGE_NAME_RAW" || "$IMAGE_NAME_RAW" == "unknown" ]]; then
  IMAGE_NAME_RAW="$PROJECT_NAME"
fi
IMAGE_NAME_SLUG="${IMAGE_NAME_SLUG:-$(sanitize_tag_part "$IMAGE_NAME_RAW")}"

if [[ "$BUILD_ENV_VALUE" == "production" ]]; then
  CONTAINER_NAME="$PROD_CONTAINER_NAME"
  HOST_PORT="$PROD_HOST_PORT"
  CONTAINER_IP="$PROD_CONTAINER_IP"
  ENV_FILE_PATH="$PROD_ENV_FILE"
  LOG_PATH="$PROD_LOG_PATH"
else
  CONTAINER_NAME="$DEV_CONTAINER_NAME"
  HOST_PORT="$DEV_HOST_PORT"
  CONTAINER_IP="$DEV_CONTAINER_IP"
  ENV_FILE_PATH="$DEV_ENV_FILE"
  LOG_PATH="$DEV_LOG_PATH"
fi

ARCHIVE_BASENAME="$(basename "$LOCAL_ARCHIVE_PATH")"
TARGET_SUBDIR="${IMAGE_NAME_SLUG}/${ENV_SHORT}"
TARGET_DIR_ABS="${ARTIFACT_LOCAL_DIR%/}/${TARGET_SUBDIR}"
TARGET_REL_PATH="${TARGET_SUBDIR}/${ARCHIVE_BASENAME}"
TARGET_ABS_PATH="${TARGET_DIR_ABS}/${ARCHIVE_BASENAME}"

resolve_web_repo_url() {
  local repo="$1"
  if [[ "$repo" =~ ^git@github\.com:(.+)\.git$ ]]; then
    printf 'https://github.com/%s' "${BASH_REMATCH[1]}"
    return 0
  fi
  if [[ "$repo" =~ ^https://github\.com/(.+)\.git$ ]]; then
    printf 'https://github.com/%s' "${BASH_REMATCH[1]}"
    return 0
  fi
  if [[ "$repo" =~ ^https://github\.com/(.+)$ ]]; then
    local path="${BASH_REMATCH[1]%/}"
    printf 'https://github.com/%s' "$path"
    return 0
  fi
  printf ''
}

ARTIFACT_WEB_URL=""
WEB_REPO_URL="$(resolve_web_repo_url "$ARTIFACT_REPO")"
if [[ -n "$WEB_REPO_URL" ]]; then
  ARTIFACT_WEB_URL="${WEB_REPO_URL}/tree/${ARTIFACT_BRANCH}/${TARGET_SUBDIR}"
fi

log_info "开始上传构建产物到 Git 仓库"
log_info "仓库: $ARTIFACT_REPO"
log_info "分支: $ARTIFACT_BRANCH"
log_info "本地产物: $LOCAL_ARCHIVE_PATH"
log_info "仓库路径: $TARGET_REL_PATH"

rm -rf "$ARTIFACT_LOCAL_DIR"
if ! git clone "$ARTIFACT_REPO" "$ARTIFACT_LOCAL_DIR"; then
  die "克隆仓库失败，请检查仓库地址和 SSH 权限"
fi

git -C "$ARTIFACT_LOCAL_DIR" config user.name "$COMMIT_NAME"
git -C "$ARTIFACT_LOCAL_DIR" config user.email "$COMMIT_EMAIL"
git -C "$ARTIFACT_LOCAL_DIR" fetch origin --prune >/dev/null 2>&1 || true

if git -C "$ARTIFACT_LOCAL_DIR" show-ref --verify --quiet "refs/remotes/origin/$ARTIFACT_BRANCH"; then
  git -C "$ARTIFACT_LOCAL_DIR" checkout -B "$ARTIFACT_BRANCH" "origin/$ARTIFACT_BRANCH" >/dev/null
else
  git -C "$ARTIFACT_LOCAL_DIR" checkout -B "$ARTIFACT_BRANCH" >/dev/null
fi

mkdir -p "$TARGET_DIR_ABS"
cp -f "$LOCAL_ARCHIVE_PATH" "$TARGET_ABS_PATH"
# 每个环境目录只保留最新一个构建产物
find "$TARGET_DIR_ABS" -mindepth 1 -maxdepth 1 ! -name "$ARCHIVE_BASENAME" -exec rm -rf {} +

git -C "$ARTIFACT_LOCAL_DIR" add "$TARGET_SUBDIR"

if git -C "$ARTIFACT_LOCAL_DIR" diff --cached --quiet; then
  log_warn "产物内容无变化，跳过提交与推送"
else
  git -C "$ARTIFACT_LOCAL_DIR" commit \
    -m "chore(artifact): ${PROJECT_NAME} ${BUILD_ENV_VALUE} ${SHORT_SHA}" \
    -m "image: ${DEPLOY_IMAGE_FULL}" \
    -m "source-branch: ${BRANCH_NAME}" \
    -m "source-sha: ${SHORT_SHA}" \
    -m "artifact: ${TARGET_REL_PATH}"

  if ! git -C "$ARTIFACT_LOCAL_DIR" push origin "$ARTIFACT_BRANCH"; then
    die "推送产物到 Git 仓库失败，请检查权限或分支保护策略"
  fi
fi

SSH_BASE=(ssh -p "$DEPLOY_PORT" -o ConnectTimeout=10)
if [[ -n "$DEPLOY_SSH_KEY_PATH" ]]; then
  SSH_BASE+=(-i "$DEPLOY_SSH_KEY_PATH")
fi

KEEPALIVE_OPTS=(-o ServerAliveInterval=30 -o ServerAliveCountMax=6)
SSH_BASE+=("${KEEPALIVE_OPTS[@]}")

if [[ -n "$DEPLOY_SSH_OPTIONS" ]]; then
  # shellcheck disable=SC2206
  EXTRA_OPTS=($DEPLOY_SSH_OPTIONS)
  SSH_BASE+=("${EXTRA_OPTS[@]}")
fi

TARGET_HOST="${DEPLOY_USER}@${DEPLOY_HOST}"
SSH_BASE+=("$TARGET_HOST")

if [[ -n "${DEPLOY_SSH_PASSWORD:-}" ]]; then
  if command -v sshpass >/dev/null 2>&1; then
    SSH_CMD=(sshpass -p "$DEPLOY_SSH_PASSWORD" "${SSH_BASE[@]}")
  else
    if [[ -t 0 && -t 1 ]]; then
      log_warn "未安装 sshpass，将使用 ssh 交互输入密码。"
      SSH_CMD=("${SSH_BASE[@]}")
    else
      die "未检测到命令: sshpass。请安装 sshpass，或改用 DEPLOY_SSH_KEY_PATH 配置免密登录。"
    fi
  fi
else
  SSH_CMD=("${SSH_BASE[@]}")
fi

ssh_exec_with_retry() {
  local remote_cmd="$1"
  local max_try=5
  local i
  for i in $(seq 1 "$max_try"); do
    if "${SSH_CMD[@]}" "$remote_cmd"; then
      return 0
    fi
    if [[ "$i" -lt "$max_try" ]]; then
      log_warn "远端命令执行失败，10秒后重试 (${i}/${max_try})..."
      sleep 10
    fi
  done
  return 1
}

REMOTE_ARGS="$(printf "%q " \
  "$ARTIFACT_REPO" \
  "$ARTIFACT_BRANCH" \
  "$REMOTE_ARTIFACT_REPO_DIR" \
  "$TARGET_REL_PATH" \
  "$DEPLOY_IMAGE_FULL" \
  "$CONTAINER_NAME" \
  "$HOST_PORT" \
  "$REMOTE_CONTAINER_PORT" \
  "$REMOTE_DOCKER_NETWORK" \
  "$CONTAINER_IP" \
  "$ENV_FILE_PATH" \
  "$LOG_PATH" \
  "$REMOTE_DOCKER_USE_SUDO")"

run_remote_deploy_script() {
  local max_try=3
  local i
  for i in $(seq 1 "$max_try"); do
    if "${SSH_CMD[@]}" "bash -s -- ${REMOTE_ARGS}" <<'REMOTE_SCRIPT'
set -euo pipefail

ARTIFACT_REPO="$1"
ARTIFACT_BRANCH="$2"
REMOTE_ARTIFACT_REPO_DIR="$3"
TARGET_REL_PATH="$4"
IMAGE_FULL="$5"
CONTAINER_NAME="$6"
HOST_PORT="$7"
CONTAINER_PORT="$8"
NETWORK_NAME="$9"
CONTAINER_IP="${10:-}"
ENV_FILE_PATH="${11:-}"
LOG_PATH="${12:-}"
REMOTE_DOCKER_USE_SUDO="${13:-false}"

USE_SUDO_LOWER="$(printf '%s' "$REMOTE_DOCKER_USE_SUDO" | tr '[:upper:]' '[:lower:]')"
docker_cmd() {
  if [[ "$USE_SUDO_LOWER" == "true" || "$USE_SUDO_LOWER" == "1" || "$USE_SUDO_LOWER" == "yes" ]]; then
    sudo -n docker "$@"
  else
    docker "$@"
  fi
}

git_cmd() {
  GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new" git "$@"
}

if [[ -d "$REMOTE_ARTIFACT_REPO_DIR/.git" ]]; then
  git_cmd -C "$REMOTE_ARTIFACT_REPO_DIR" fetch origin --prune
else
  git_cmd -C "$REMOTE_ARTIFACT_REPO_DIR" init >/dev/null
  git_cmd -C "$REMOTE_ARTIFACT_REPO_DIR" remote remove origin >/dev/null 2>&1 || true
  git_cmd -C "$REMOTE_ARTIFACT_REPO_DIR" remote add origin "$ARTIFACT_REPO"
  git_cmd -C "$REMOTE_ARTIFACT_REPO_DIR" fetch origin --prune
fi

if git_cmd -C "$REMOTE_ARTIFACT_REPO_DIR" show-ref --verify --quiet "refs/remotes/origin/$ARTIFACT_BRANCH"; then
  git_cmd -C "$REMOTE_ARTIFACT_REPO_DIR" checkout -B "$ARTIFACT_BRANCH" "origin/$ARTIFACT_BRANCH" >/dev/null
else
  git_cmd -C "$REMOTE_ARTIFACT_REPO_DIR" checkout -B "$ARTIFACT_BRANCH" >/dev/null
fi
git_cmd -C "$REMOTE_ARTIFACT_REPO_DIR" reset --hard "origin/$ARTIFACT_BRANCH" >/dev/null 2>&1 || true
git_cmd -C "$REMOTE_ARTIFACT_REPO_DIR" clean -fd >/dev/null 2>&1 || true

ARCHIVE_PATH="$REMOTE_ARTIFACT_REPO_DIR/$TARGET_REL_PATH"
if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "未找到制品文件: $ARCHIVE_PATH"
  exit 1
fi

docker_cmd load -i "$ARCHIVE_PATH"

if ! docker_cmd image inspect "$IMAGE_FULL" >/dev/null 2>&1; then
  echo "docker load 完成，但未找到镜像标签: $IMAGE_FULL"
  exit 1
fi

docker_cmd stop "$CONTAINER_NAME" 2>/dev/null || true
docker_cmd rm "$CONTAINER_NAME" 2>/dev/null || true

DOCKER_RUN_ARGS=(-d --name "$CONTAINER_NAME" --restart unless-stopped -p "${HOST_PORT}:${CONTAINER_PORT}")
if [[ -n "$NETWORK_NAME" ]]; then
  DOCKER_RUN_ARGS+=(--network "$NETWORK_NAME")
fi
if [[ -n "$CONTAINER_IP" ]]; then
  DOCKER_RUN_ARGS+=(--ip "$CONTAINER_IP")
fi
if [[ -n "$ENV_FILE_PATH" && -f "$ENV_FILE_PATH" ]]; then
  DOCKER_RUN_ARGS+=(--env-file "$ENV_FILE_PATH")
fi
if [[ -n "$LOG_PATH" ]]; then
  mkdir -p "$LOG_PATH"
  DOCKER_RUN_ARGS+=(-v "${LOG_PATH}:/app/logs")
fi
DOCKER_RUN_ARGS+=("$IMAGE_FULL")

docker_cmd run "${DOCKER_RUN_ARGS[@]}" >/dev/null

STATUS=""
ELAPSED=0
MAX_WAIT=20
INTERVAL=2
while (( ELAPSED < MAX_WAIT )); do
  STATUS="$(docker_cmd inspect -f '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo unknown)"
  if [[ "$STATUS" == "running" ]]; then
    break
  fi
  if [[ "$STATUS" == "exited" || "$STATUS" == "dead" ]]; then
    echo "容器启动失败，状态: $STATUS"
    docker_cmd logs --tail 80 "$CONTAINER_NAME" || true
    exit 1
  fi
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

if [[ "$STATUS" != "running" ]]; then
  echo "容器未在 ${MAX_WAIT}s 内进入 running 状态，当前: $STATUS"
  docker_cmd logs --tail 80 "$CONTAINER_NAME" || true
  exit 1
fi

RESTART_COUNT_BEFORE="$(docker_cmd inspect -f '{{.RestartCount}}' "$CONTAINER_NAME" 2>/dev/null || echo -1)"
sleep 8
STATUS_AFTER="$(docker_cmd inspect -f '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo unknown)"
RESTART_COUNT_AFTER="$(docker_cmd inspect -f '{{.RestartCount}}' "$CONTAINER_NAME" 2>/dev/null || echo -1)"

if [[ "$STATUS_AFTER" != "running" ]]; then
  echo "容器未通过稳定性检查，当前状态: $STATUS_AFTER"
  docker_cmd logs --tail 80 "$CONTAINER_NAME" || true
  exit 1
fi

if [[ "$RESTART_COUNT_BEFORE" =~ ^[0-9]+$ && "$RESTART_COUNT_AFTER" =~ ^[0-9]+$ ]]; then
  if (( RESTART_COUNT_AFTER > RESTART_COUNT_BEFORE )); then
    echo "容器在稳定性窗口内发生重启: ${RESTART_COUNT_BEFORE} -> ${RESTART_COUNT_AFTER}"
    docker_cmd logs --tail 80 "$CONTAINER_NAME" || true
    exit 1
  fi
fi

docker_cmd image prune -f
REMOTE_SCRIPT
    then
      return 0
    fi

    if [[ "$i" -lt "$max_try" ]]; then
      log_warn "远端部署命令失败，10秒后重试 (${i}/${max_try})..."
      sleep 10
    fi
  done
  return 1
}

log_info "开始远程部署: ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PORT}"
log_info "容器: $CONTAINER_NAME"
log_info "镜像: ${DEPLOY_IMAGE_FULL}"
log_info "端口映射: ${HOST_PORT}:${REMOTE_CONTAINER_PORT}"
log_info "远端制品仓库目录: $REMOTE_ARTIFACT_REPO_DIR"
log_info "制品来源: ${ARTIFACT_REPO}@${ARTIFACT_BRANCH}:${TARGET_REL_PATH}"

if ! run_remote_deploy_script; then
  die "远端部署命令执行失败"
fi

write_meta DEPLOY_TIME "$(now_time)"
write_meta DEPLOY_TARGET "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PORT}"
write_meta DEPLOY_CONTAINER "$CONTAINER_NAME"
write_meta DEPLOY_PORT_MAPPING "${HOST_PORT}:${REMOTE_CONTAINER_PORT}"
write_meta DEPLOY_NETWORK "$REMOTE_DOCKER_NETWORK"
write_meta DEPLOY_ARCHIVE_REMOTE "repo:${ARTIFACT_REPO}@${ARTIFACT_BRANCH}:${TARGET_REL_PATH} ; server:${REMOTE_ARTIFACT_REPO_DIR}/${TARGET_REL_PATH}"
write_meta DEPLOY_ARTIFACT_WEB_URL "$ARTIFACT_WEB_URL"

log_info "构建产物上传完成: $TARGET_REL_PATH"
log_info "远程部署完成: $CONTAINER_NAME"
