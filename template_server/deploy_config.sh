#!/usr/bin/env bash
# shellcheck shell=bash

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="appbox_server"
DOCKER_IMAGE_NAME="darrenyou/appbox_server"
REMOTE_CONTAINER_PORT="8090"
DEPLOY_SERVER_PROFILE="host_124_221_158_155"
# shellcheck disable=SC1091
source "$PROJECT_ROOT/../deploy_shell/shared/load_deploy_profile.sh"
apply_deploy_profile_defaults "$DEPLOY_SERVER_PROFILE" "server"

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
