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

require_cmd ssh
require_cmd scp

if [[ "$BUILD_ENV" == "production" ]]; then
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

LOCAL_ARCHIVE_PATH="${IMAGE_ARCHIVE_PATH:-}"
[[ -n "$LOCAL_ARCHIVE_PATH" ]] || die "metadata 缺少 IMAGE_ARCHIVE_PATH"
[[ -f "$LOCAL_ARCHIVE_PATH" ]] || die "镜像归档文件不存在: $LOCAL_ARCHIVE_PATH"

ARCHIVE_BASENAME="$(basename "$LOCAL_ARCHIVE_PATH")"
REMOTE_ARCHIVE_DIR="${REMOTE_DEPLOY_DIR:-/deploy/docker-container}"
REMOTE_ARCHIVE_PATH="${REMOTE_ARCHIVE_DIR%/}/${ARCHIVE_BASENAME}"

SSH_BASE=(ssh -p "$DEPLOY_PORT")
SCP_BASE=(scp -P "$DEPLOY_PORT")

if [[ -n "$DEPLOY_SSH_KEY_PATH" ]]; then
  SSH_BASE+=(-i "$DEPLOY_SSH_KEY_PATH")
  SCP_BASE+=(-i "$DEPLOY_SSH_KEY_PATH")
fi

KEEPALIVE_OPTS=(-o ServerAliveInterval=30 -o ServerAliveCountMax=6)
SSH_BASE+=("${KEEPALIVE_OPTS[@]}")
SCP_BASE+=("${KEEPALIVE_OPTS[@]}")

if [[ -n "$DEPLOY_SSH_OPTIONS" ]]; then
  # shellcheck disable=SC2206
  EXTRA_OPTS=($DEPLOY_SSH_OPTIONS)
  SSH_BASE+=("${EXTRA_OPTS[@]}")
  SCP_BASE+=("${EXTRA_OPTS[@]}")
fi

TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"
SSH_BASE+=("$TARGET")

if [[ -n "${DEPLOY_SSH_PASSWORD:-}" ]]; then
  if command -v sshpass >/dev/null 2>&1; then
    SSH_CMD=(sshpass -p "$DEPLOY_SSH_PASSWORD" "${SSH_BASE[@]}")
    SCP_CMD=(sshpass -p "$DEPLOY_SSH_PASSWORD" "${SCP_BASE[@]}")
  else
    if [[ -t 0 && -t 1 ]]; then
      log_warn "未安装 sshpass，将使用 ssh/scp 交互输入密码。"
      SSH_CMD=("${SSH_BASE[@]}")
      SCP_CMD=("${SCP_BASE[@]}")
    else
      die "未检测到命令: sshpass。请安装 sshpass，或改用 DEPLOY_SSH_KEY_PATH 配置免密登录。"
    fi
  fi
else
  SSH_CMD=("${SSH_BASE[@]}")
  SCP_CMD=("${SCP_BASE[@]}")
fi

upload_with_retry() {
  local src="$1"
  local dst="$2"
  local max_try=5
  local i

  for i in $(seq 1 "$max_try"); do
    if command -v rsync >/dev/null 2>&1; then
      if [[ -n "${DEPLOY_SSH_PASSWORD:-}" ]] && command -v sshpass >/dev/null 2>&1; then
        if sshpass -p "$DEPLOY_SSH_PASSWORD" rsync -av --partial --append --progress \
          -e "ssh -p $DEPLOY_PORT -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=6" \
          "$src" "$dst"; then
          return 0
        fi
      else
        if rsync -av --partial --append --progress \
          -e "ssh -p $DEPLOY_PORT -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=6" \
          "$src" "$dst"; then
          return 0
        fi
      fi
    fi

    # rsync 不可用或 rsync 失败时，回退 scp
    if "${SCP_CMD[@]}" "$src" "$dst"; then
      return 0
    fi

    if [[ "$i" -lt "$max_try" ]]; then
      log_warn "上传失败，10秒后重试 (${i}/${max_try})..."
      sleep 10
    fi
  done
  return 1
}

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

log_info "开始远程部署: ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PORT}"
log_info "容器: $CONTAINER_NAME"
log_info "镜像: $DEPLOY_IMAGE"
log_info "端口映射: ${HOST_PORT}:${REMOTE_CONTAINER_PORT}"
log_info "上传归档: $LOCAL_ARCHIVE_PATH -> $REMOTE_ARCHIVE_PATH"

if ! ssh_exec_with_retry "mkdir -p '$REMOTE_ARCHIVE_DIR'"; then
  die "创建远端目录失败: $REMOTE_ARCHIVE_DIR"
fi
if ! upload_with_retry "$LOCAL_ARCHIVE_PATH" "${TARGET}:${REMOTE_ARCHIVE_PATH}"; then
  die "归档上传失败: $LOCAL_ARCHIVE_PATH -> ${TARGET}:${REMOTE_ARCHIVE_PATH}"
fi

REMOTE_ARGS="$(printf "%q " \
  "$DEPLOY_IMAGE" \
  "$CONTAINER_NAME" \
  "$HOST_PORT" \
  "$REMOTE_CONTAINER_PORT" \
  "$REMOTE_DOCKER_NETWORK" \
  "$CONTAINER_IP" \
  "$ENV_FILE_PATH" \
  "$LOG_PATH" \
  "$REMOTE_ARCHIVE_PATH" \
  "$REMOTE_KEEP_ARCHIVE" \
  "$REMOTE_DOCKER_USE_SUDO")"

run_remote_deploy_script() {
  local max_try=3
  local i
  for i in $(seq 1 "$max_try"); do
    if "${SSH_CMD[@]}" "bash -s -- ${REMOTE_ARGS}" <<'REMOTE_SCRIPT'
set -euo pipefail

IMAGE_FULL="$1"
CONTAINER_NAME="$2"
HOST_PORT="$3"
CONTAINER_PORT="$4"
NETWORK_NAME="$5"
CONTAINER_IP="$6"
ENV_FILE_PATH="$7"
LOG_PATH="$8"
REMOTE_ARCHIVE_PATH="$9"
REMOTE_KEEP_ARCHIVE="${10:-false}"
REMOTE_DOCKER_USE_SUDO="${11:-false}"

USE_SUDO_LOWER="$(printf '%s' "$REMOTE_DOCKER_USE_SUDO" | tr '[:upper:]' '[:lower:]')"
docker_cmd() {
  if [[ "$USE_SUDO_LOWER" == "true" || "$USE_SUDO_LOWER" == "1" || "$USE_SUDO_LOWER" == "yes" ]]; then
    sudo docker "$@"
  else
    docker "$@"
  fi
}

docker_cmd load -i "$REMOTE_ARCHIVE_PATH"

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

# 等待容器进入运行态，避免“docker run 成功但服务秒退”被误判为部署成功。
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

# 再等待一小段时间，确认容器未立即重启。
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

KEEP_LOWER="$(printf '%s' "$REMOTE_KEEP_ARCHIVE" | tr '[:upper:]' '[:lower:]')"
if [[ "$KEEP_LOWER" != "true" && "$KEEP_LOWER" != "1" && "$KEEP_LOWER" != "yes" ]]; then
  rm -f "$REMOTE_ARCHIVE_PATH"
fi
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

if ! run_remote_deploy_script; then
  die "远端部署命令执行失败"
fi

write_meta DEPLOY_TIME "$(now_time)"
write_meta DEPLOY_CONTAINER "$CONTAINER_NAME"
write_meta DEPLOY_TARGET "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PORT}"
write_meta DEPLOY_PORT_MAPPING "${HOST_PORT}:${REMOTE_CONTAINER_PORT}"
write_meta DEPLOY_NETWORK "$REMOTE_DOCKER_NETWORK"
write_meta DEPLOY_ARCHIVE_REMOTE "$REMOTE_ARCHIVE_PATH"

log_info "远程部署完成: $CONTAINER_NAME"
