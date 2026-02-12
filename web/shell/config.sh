#!/usr/bin/env bash
# shellcheck shell=bash

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
# 为复用 common.sh 的 Git 信息函数，保持变量名兼容
SERVER_DIR="$WEB_DIR"

# =========================
# 项目配置（复制到其他工程时优先改这里）
# =========================
PROJECT_NAME="app-box-web"

# npm 构建配置
BUILD_ENV="${BUILD_ENV:-}"
NPM_INSTALL_CMD="npm ci"
NPM_BUILD_CMD="npm run build"
DIST_DIR="$WEB_DIR/dist"
DIST_ZIP_PATH="$WEB_DIR/dist.zip"

# 远端部署（rsync + ssh）
DEPLOY_HOST="124.221.158.155"
DEPLOY_PORT="22"
DEPLOY_USER="ubuntu"
DEPLOY_SSH_PASSWORD="shlite@01"   # 为空则走 ssh key 或 ssh-agent
DEPLOY_SSH_KEY_PATH=""            # 例如 /root/.ssh/id_rsa
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
