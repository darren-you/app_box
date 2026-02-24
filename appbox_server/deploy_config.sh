#!/usr/bin/env bash
# shellcheck shell=bash

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="${SERVER_DIR:-$PROJECT_ROOT}"

# 项目配置
PROJECT_NAME="appbox_server"
DOCKER_REGISTRY="docker.io"
DOCKER_IMAGE_NAME="darrenyou/appbox_server"
DOCKERFILE_PATH="$SERVER_DIR/Dockerfile"
DOCKER_BUILD_CONTEXT="$SERVER_DIR"
LOCAL_IMAGE_REPO="$DOCKER_IMAGE_NAME"
BASE_IMAGE_REGISTRY="mirror.ccs.tencentyun.com"
BASE_IMAGE_REGISTRY_CANDIDATES="mirror.ccs.tencentyun.com,docker.1panel.live,dockerproxy.com,registry.docker-cn.com,docker.io"

# 构建控制
BUILD_ENV="${BUILD_ENV:-}"
IMAGE_TAG=""
PUSH_LATEST="true"
LOCAL_ARCHIVE_DIR="/tmp"

# 构建产物上传
ARTIFACT_GIT_REPO="git@github.com:darren-you/docker_images.git"

# 远程部署
DEPLOY_HOST="124.221.158.155"
DEPLOY_PORT="22"
DEPLOY_USER="ubuntu"
DEPLOY_SSH_PASSWORD="shlite@01"
DEPLOY_SSH_KEY_PATH=""
DEPLOY_SSH_OPTIONS="-o StrictHostKeyChecking=no"

REMOTE_ARTIFACT_REPO_DIR="/deploy/docker_images"
REMOTE_DOCKER_NETWORK="1panel-network"
REMOTE_CONTAINER_PORT="8090"
REMOTE_DOCKER_USE_SUDO="true"

PROD_CONTAINER_NAME="appbox_server"
PROD_HOST_PORT="8090"
PROD_CONTAINER_IP=""
PROD_ENV_FILE="/opt/appbox_server/.env.production"
PROD_LOG_PATH=""

DEV_CONTAINER_NAME="appbox_server_dev"
DEV_HOST_PORT="8091"
DEV_CONTAINER_IP=""
DEV_ENV_FILE="/opt/appbox_server/.env.development"
DEV_LOG_PATH=""

# 通知
WECHAT_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=21d2abfd-ecd1-4680-9348-064039611c30"
NOTIFY_ENABLED="true"
