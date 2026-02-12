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

require_cmd docker
require_cmd git

wait_for_docker_ready() {
  local timeout="${DOCKER_READY_TIMEOUT:-45}"
  local interval="${DOCKER_READY_INTERVAL:-3}"
  local elapsed=0
  local endpoint=""

  if docker info >/dev/null 2>&1; then
    return 0
  fi

  log_warn "Docker 服务未就绪，开始等待（超时 ${timeout}s）"
  if [[ "$(uname -s)" == "Darwin" ]] && is_true "${DOCKER_AUTO_START_ON_DARWIN:-true}"; then
    if command -v open >/dev/null 2>&1; then
      log_info "尝试启动 Docker Desktop"
      open -ga Docker >/dev/null 2>&1 || true
    fi
  fi

  while (( elapsed < timeout )); do
    sleep "$interval"
    elapsed=$((elapsed + interval))
    if docker info >/dev/null 2>&1; then
      log_info "Docker 服务就绪（等待 ${elapsed}s）"
      return 0
    fi
  done

  endpoint="$(docker context inspect --format '{{(index .Endpoints "docker").Host}}' 2>/dev/null || true)"
  if [[ -z "$endpoint" ]]; then
    endpoint="${DOCKER_HOST:-unix:///var/run/docker.sock}"
  fi
  die "Docker 服务不可用，当前 endpoint: ${endpoint}。请确认 Docker Desktop/daemon 已启动，或在 Jenkins 中设置 DOCKER_HOST=unix:///var/run/docker.sock"
}

wait_for_docker_ready

BRANCH_NAME="$(resolve_branch)"
BRANCH_SAFE="$(sanitize_tag_part "$BRANCH_NAME")"
SHORT_SHA="$(resolve_short_sha)"
COMMIT_MSG="$(resolve_commit_msg)"
BUILD_ENV_VALUE="${BUILD_ENV:-}"
validate_build_env "$BUILD_ENV_VALUE"
ENV_SHORT="$(env_short "$BUILD_ENV_VALUE")"
BUILD_TIME="$(now_time)"
BASE_REGISTRY_VALUE="${BASE_IMAGE_REGISTRY:-mirror.ccs.tencentyun.com}"
BASE_REGISTRY_VALUE="${BASE_REGISTRY_VALUE#http://}"
BASE_REGISTRY_VALUE="${BASE_REGISTRY_VALUE#https://}"
BASE_REGISTRY_VALUE="${BASE_REGISTRY_VALUE%/}"
BASE_CANDIDATES_RAW="${BASE_IMAGE_REGISTRY_CANDIDATES:-$BASE_REGISTRY_VALUE}"

IMAGE_REPO="$LOCAL_IMAGE_REPO"
IMAGE_NAME_SLUG="$(sanitize_tag_part "${IMAGE_REPO##*/}")"
if [[ -n "${IMAGE_TAG:-}" ]]; then
  PRIMARY_TAG="$IMAGE_TAG"
else
  PRIMARY_TAG="${ENV_SHORT}-$(date +%Y%m%d-%H%M%S)-${SHORT_SHA}"
fi
SHA_TAG="${BRANCH_SAFE}-${SHORT_SHA}"
ENV_LATEST_TAG="${ENV_SHORT}-latest"

declare -a TAGS=()
add_tag() {
  local tag="$1"
  local existing
  for existing in "${TAGS[@]-}"; do
    [[ -z "$existing" ]] && continue
    [[ "$existing" == "$tag" ]] && return 0
  done
  TAGS+=("$tag")
}

add_tag "$PRIMARY_TAG"
add_tag "$SHA_TAG"

if is_true "$PUSH_LATEST"; then
  add_tag "$ENV_LATEST_TAG"
  if [[ "$BUILD_ENV_VALUE" == "production" ]]; then
    add_tag "latest"
  fi
fi

log_info "项目: $PROJECT_NAME"
log_info "分支: $BRANCH_NAME"
log_info "构建环境: $BUILD_ENV_VALUE"
log_info "本地镜像仓库: $IMAGE_REPO"
log_info "主标签: $PRIMARY_TAG"
log_info "基础镜像候选源: $BASE_CANDIDATES_RAW"

normalize_registry() {
  local r="$1"
  r="${r#http://}"
  r="${r#https://}"
  r="${r%/}"
  printf '%s' "$r"
}

declare -a BUILD_REGISTRIES=()
add_registry() {
  local registry="$1"
  local existing
  [[ -z "$registry" ]] && return 0
  for existing in "${BUILD_REGISTRIES[@]-}"; do
    [[ "$existing" == "$registry" ]] && return 0
  done
  BUILD_REGISTRIES+=("$registry")
}

IFS=',' read -r -a RAW_REGISTRIES <<<"$BASE_CANDIDATES_RAW"
for raw_registry in "${RAW_REGISTRIES[@]-}"; do
  raw_registry="$(normalize_registry "$raw_registry")"
  add_registry "$raw_registry"
done
add_registry "$BASE_REGISTRY_VALUE"
add_registry "docker.io"

BUILD_OK="false"
BUILD_REGISTRY_USED=""
for registry in "${BUILD_REGISTRIES[@]-}"; do
  [[ -z "$registry" ]] && continue
  log_info "尝试基础镜像源构建: $registry"
  if docker build \
    --platform "linux/amd64" \
    --build-arg "ENV=$BUILD_ENV_VALUE" \
    --build-arg "BASE_IMAGE_REGISTRY=$registry" \
    -f "$DOCKERFILE_PATH" \
    -t "${IMAGE_REPO}:${PRIMARY_TAG}" \
    "$DOCKER_BUILD_CONTEXT"; then
    BUILD_OK="true"
    BUILD_REGISTRY_USED="$registry"
    break
  fi
done

if [[ "$BUILD_OK" != "true" ]]; then
  die "所有基础镜像源构建均失败，请检查网络或更换 BASE_IMAGE_REGISTRY_CANDIDATES"
fi

log_info "构建成功，使用基础镜像源: $BUILD_REGISTRY_USED"

for tag in "${TAGS[@]-}"; do
  [[ -z "$tag" ]] && continue
  if [[ "$tag" != "$PRIMARY_TAG" ]]; then
    docker tag "${IMAGE_REPO}:${PRIMARY_TAG}" "${IMAGE_REPO}:${tag}"
  fi
done

for tag in "${TAGS[@]-}"; do
  [[ -z "$tag" ]] && continue
  log_info "本地镜像已就绪: ${IMAGE_REPO}:${tag}"
done

if is_true "$PUSH_LATEST"; then
  DEPLOY_TAG="$ENV_LATEST_TAG"
else
  DEPLOY_TAG="$PRIMARY_TAG"
fi

DEPLOY_IMAGE="${IMAGE_REPO}:${DEPLOY_TAG}"
ARCHIVE_NAME="${IMAGE_NAME_SLUG}_${ENV_SHORT}_${SHORT_SHA}_$(date +%Y%m%d%H%M%S).tar"
ARCHIVE_PATH="${LOCAL_ARCHIVE_DIR%/}/${ARCHIVE_NAME}"
rm -f "$ARCHIVE_PATH"

log_info "导出镜像到归档文件: $ARCHIVE_PATH"
docker save -o "$ARCHIVE_PATH" "$DEPLOY_IMAGE"

TAGS_CSV="$(IFS=,; echo "${TAGS[*]-}")"
write_meta PROJECT_NAME "$PROJECT_NAME"
write_meta BUILD_BRANCH "$BRANCH_NAME"
write_meta BUILD_ENV "$BUILD_ENV_VALUE"
write_meta ENV_SHORT "$ENV_SHORT"
write_meta BUILD_TIME "$BUILD_TIME"
write_meta GIT_SHA "$SHORT_SHA"
write_meta COMMIT_MSG "$COMMIT_MSG"
write_meta IMAGE_REPO "$IMAGE_REPO"
write_meta IMAGE_NAME_SLUG "$IMAGE_NAME_SLUG"
write_meta IMAGE_TAG_PRIMARY "$PRIMARY_TAG"
write_meta IMAGE_TAGS_CSV "$TAGS_CSV"
write_meta DEPLOY_IMAGE "$DEPLOY_IMAGE"
write_meta IMAGE_ARCHIVE_PATH "$ARCHIVE_PATH"
write_meta IMAGE_ARCHIVE_NAME "$ARCHIVE_NAME"

log_info "构建并打包完成，部署镜像: $DEPLOY_IMAGE"
log_info "镜像归档文件: $ARCHIVE_PATH"
log_info "元数据文件: $META_FILE"
