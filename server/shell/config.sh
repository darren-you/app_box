#!/usr/bin/env bash
# shellcheck shell=bash

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

# =========================
# 项目配置（复制到其他工程时优先改这里）
# =========================
PROJECT_NAME="app-box-server"
DOCKER_REGISTRY="docker.io"
DOCKER_IMAGE_NAME="darrenyou/app-box-server"
DOCKERFILE_PATH="$SERVER_DIR/Dockerfile"
DOCKER_BUILD_CONTEXT="$SERVER_DIR"
LOCAL_IMAGE_REPO="$DOCKER_IMAGE_NAME"
# 本地构建基础镜像源（不要带 http/https）
BASE_IMAGE_REGISTRY="mirror.ccs.tencentyun.com"
# 本地构建基础镜像多源候选（按顺序重试）
BASE_IMAGE_REGISTRY_CANDIDATES="mirror.ccs.tencentyun.com,docker.1panel.live,dockerproxy.com,registry.docker-cn.com,docker.io"

# 构建控制
# BUILD_ENV 是唯一外部参数：production/development
BUILD_ENV="${BUILD_ENV:-}"
IMAGE_TAG=""
PUSH_LATEST="true"
LOCAL_ARCHIVE_DIR="/tmp"

# 构建产物上传（Git 仓库）
ARTIFACT_GIT_REPO="git@github.com:darren-you/docker_images.git"

# 远程部署（服务器已配置 GitHub SSH Key，可直接 git pull）
DEPLOY_HOST="124.221.158.155"
DEPLOY_PORT="22"
DEPLOY_USER="ubuntu"
DEPLOY_SSH_PASSWORD="shlite@01"   # 为空则走 ssh key 或 ssh-agent
DEPLOY_SSH_KEY_PATH=""            # 例如 /root/.ssh/id_rsa
DEPLOY_SSH_OPTIONS="-o StrictHostKeyChecking=no"

# 远程执行容器参数
REMOTE_ARTIFACT_REPO_DIR="/deploy/docker_images"
REMOTE_DOCKER_NETWORK="1panel-network"
REMOTE_CONTAINER_PORT="8090"
REMOTE_DOCKER_USE_SUDO="true"

PROD_CONTAINER_NAME="app-box-server"
PROD_HOST_PORT="8090"
PROD_CONTAINER_IP=""
PROD_ENV_FILE="/opt/app-box-server/.env.production"
PROD_LOG_PATH=""

DEV_CONTAINER_NAME="app-box-server-dev"
DEV_HOST_PORT="8091"
DEV_CONTAINER_IP=""
DEV_ENV_FILE="/opt/app-box-server/.env.development"
DEV_LOG_PATH=""

# 通知
WECHAT_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=21d2abfd-ecd1-4680-9348-064039611c30"
NOTIFY_ENABLED="true"
