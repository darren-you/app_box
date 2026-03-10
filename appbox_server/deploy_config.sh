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
IMAGE_NAME_SLUG="$PROJECT_NAME"
# 基础镜像默认值由 deploy_shell/deploy_server/base_image_defaults.sh 统一维护。

# 国内镜像源快速切换与失败重试配置
REGISTRY_PRECHECK_ENABLED="true"
REGISTRY_PULL_TIMEOUT_SECONDS="20"
REGISTRY_PULL_RETRY_COUNT="2"
REGISTRY_BUILD_TIMEOUT_SECONDS="0"
REGISTRY_BUILD_RETRY_COUNT="1"
REGISTRY_RETRY_SLEEP_SECONDS="2"

# 构建控制（Jenkins 参数使用 BuildEnv=test/prod）
IMAGE_TAG=""
PUSH_LATEST="true"
LOCAL_ARCHIVE_DIR="/tmp"
DOCKER_READY_TIMEOUT="30"

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

# 远端部署超时（秒）
REMOTE_GIT_FETCH_TIMEOUT_SECONDS="120"
REMOTE_DOCKER_LOAD_TIMEOUT_SECONDS="10"

# 容器启动后稳定性观察窗口（秒）
REMOTE_CONTAINER_STABILITY_SECONDS="5"

PROD_CONTAINER_NAME="appbox_server"
PROD_HOST_PORT="8090"
PROD_CONTAINER_IP=""
# 启用 provider 时，远端 env-file 需要补齐服务间鉴权配置：
# Stellar:
# STELLAR_ENABLED=true
# STELLAR_API_BASE_URL=http://stellar:8000/api/v1
# STELLAR_GATEWAY_KEY=<shared_gateway_key>
# TinyText:
# TINYTEXT_ENABLED=true
# TINYTEXT_API_BASE_URL=<tinytext_api_base_url>
# TINYTEXT_GATEWAY_KEY=<shared_gateway_key>
PROD_ENV_FILE="/opt/appbox_server/.env.production"
PROD_LOG_PATH=""

TEST_CONTAINER_NAME="appbox_server_dev"
TEST_HOST_PORT="8091"
TEST_CONTAINER_IP=""
# 开发/测试环境联调 TinyText 时，同样需要补齐 TINYTEXT_* 变量
TEST_ENV_FILE="/opt/appbox_server/.env.development"
TEST_LOG_PATH=""

# 通知
WECHAT_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=21d2abfd-ecd1-4680-9348-064039611c30"
NOTIFY_ENABLED="true"
JENKINS_BUILD_URL_BASE=""
