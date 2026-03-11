#!/usr/bin/env bash
# shellcheck shell=bash

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="appbox_web"
DEPLOY_SERVER_PROFILE="host_124_221_158_155"
# shellcheck disable=SC1091
source "$PROJECT_ROOT/../deploy_shell/shared/load_deploy_profile.sh"
apply_deploy_profile_defaults "$DEPLOY_SERVER_PROFILE" "web"

# web名称（浏览器Tab中显示的名称）
WEB_NAME="AppBox"

# 通知
WECHAT_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=21d2abfd-ecd1-4680-9348-064039611c30"
NOTIFY_ENABLED="true"
