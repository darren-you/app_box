#!/usr/bin/env bash
# shellcheck shell=bash

# =========================================
# 基础配置
# =========================================
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="appbox_server"
DEPLOY_SERVER_PROFILE="host_124_221_158_155"

# =========================================
# 共享部署默认值
# =========================================
# shellcheck disable=SC1091
source "$PROJECT_ROOT/../deploy_shell/shared/load_deploy_profile.sh"
apply_deploy_profile_defaults "$DEPLOY_SERVER_PROFILE" "server"

# =========================================
# 项目特定
# =========================================
REMOTE_CONTAINER_PORT="8090"

# 生产环境
PROD_HOST_PORT="8090"
PROD_CONTAINER_IP=""
# 启用 Provider 时，远端 env-file 需要补齐服务间鉴权配置
PROD_ENV_FILE="/opt/appbox_server/.env.production"
PROD_LOG_PATH=""

# 测试环境
TEST_HOST_PORT="8091"
TEST_CONTAINER_IP=""
# 开发/测试环境联调 TinyText 时，同样需要补齐 TINYTEXT_* 变量
TEST_ENV_FILE="/opt/appbox_server/.env.development"
TEST_LOG_PATH=""

# =========================================
# 通知配置
# =========================================
WECHAT_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=21d2abfd-ecd1-4680-9348-064039611c30"
JENKINS_BUILD_URL_BASE=""
