# shell 部署脚本说明（web）

本目录将前端发布拆分为 `build -> deploy -> notification` 三段，Jenkins 只需要执行 `deploy.sh`。
流程：`npm install/build` -> 生成 `dist.zip` -> 通过 `rsync + ssh` 上传到服务器 `/deploy/项目名`（先删后传）-> 设置 `www-data:www-data` + `0755` -> 发送通知。

## 脚本清单

- `config.sh`：项目配置与默认值
- `common.sh`：公共函数
- `npm_build_package.sh`：执行 npm 构建并打包 `dist.zip`
- `remote_deploy.sh`：通过 rsync 上传到远端并设置权限
- `send_notification.sh`：发送企业微信通知
- `deploy.sh`：总控脚本（Jenkins Build Steps 只调用它）

## Jenkins 使用方式

1. 先在 `config.sh` 配置固定参数：
   - `DEPLOY_HOST`、`DEPLOY_PORT`、`DEPLOY_USER`
   - `DEPLOY_SSH_PASSWORD` 或 `DEPLOY_SSH_KEY_PATH`
   - `REMOTE_DEPLOY_BASE_DIR`、`REMOTE_OWNER`、`REMOTE_GROUP`、`REMOTE_MODE`
   - `WECHAT_WEBHOOK_URL`
2. Jenkins 执行：

```bash
bash web/shell/deploy.sh production
```

或：

```bash
bash web/shell/deploy.sh development
```

## 本地调试

仅构建打包：

```bash
BUILD_ENV=production bash web/shell/npm_build_package.sh
```

仅执行上传（依赖已有 metadata）：

```bash
META_FILE=/tmp/app-box-web.meta bash web/shell/remote_deploy.sh --metadata-file /tmp/app-box-web.meta
```

完整流程：

```bash
bash web/shell/deploy.sh production
```
