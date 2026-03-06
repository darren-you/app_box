#!/usr/bin/env bash
# shellcheck shell=bash

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="${WEB_DIR:-$PROJECT_ROOT}"
# 为复用 common.sh 的 Git 信息函数，保持变量名兼容
SERVER_DIR="$WEB_DIR"

PROJECT_NAME="appbox_web"

# web名称（浏览器Tab中显示的名称）
WEB_NAME="AppBox"

# npm 构建配置
NPM_INSTALL_CMD="npm ci"
NPM_BUILD_CMD="npm run build"
DIST_DIR="$WEB_DIR/dist"
DIST_ZIP_PATH="$WEB_DIR/dist.zip"

# 远端部署
DEPLOY_HOST="124.221.158.155"
DEPLOY_PORT="22"
DEPLOY_USER="ubuntu"
DEPLOY_SSH_PASSWORD="shlite@01"
DEPLOY_SSH_KEY_PATH=""
DEPLOY_SSH_OPTIONS="-o StrictHostKeyChecking=no"

REMOTE_DEPLOY_BASE_DIR="/deploy"
REMOTE_DEPLOY_PROJECT_DIR="${REMOTE_DEPLOY_BASE_DIR%/}/${PROJECT_NAME}"
REMOTE_USE_SUDO="true"
REMOTE_OWNER="www-data"
REMOTE_GROUP="www-data"
REMOTE_MODE="0755"

# 通知
WECHAT_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=21d2abfd-ecd1-4680-9348-064039611c30"
NOTIFY_ENABLED="true"
