# shell 部署脚本说明

本目录把 `build -> deploy -> notification` 拆成可复用脚本，Jenkins 只需要执行 `deploy.sh`。
当前流程为：本地构建镜像并导出 tar -> 上传到服务器 -> 远程 `docker load` 后重启容器。
固定参数（SSH、Webhook、远程路径）统一写死在 `config.sh`。

## 脚本清单

- `config.sh`：项目配置与默认值（复制到新项目时优先改这个文件）
- `common.sh`：公共函数
- `docker_build_push.sh`：构建并推送 Docker 镜像
- `remote_deploy.sh`：SSH 登录服务器拉取镜像并重启容器
- `send_notification.sh`：发送企业微信通知
- `deploy.sh`：总控脚本（Jenkins Build Steps 只调用它）

## Jenkins 使用方式

1. 先在 `config.sh` 填好固定配置：
   - `DEPLOY_HOST`
   - `DEPLOY_PORT`
   - `DEPLOY_USER`
   - `DEPLOY_SSH_PASSWORD` 或 `DEPLOY_SSH_KEY_PATH`
   - `WECHAT_WEBHOOK_URL`
   - `REMOTE_DEPLOY_DIR`（例如 `/deploy/docker-container`）
2. Jenkins Build Steps 只传一个参数 `BUILD_ENV`：

```bash
bash shell/deploy.sh production
```

或：

```bash
bash shell/deploy.sh development
```

## 本地调试

仅构建并打包：

```bash
BUILD_ENV=production bash shell/docker_build_push.sh
```

仅部署（依赖已有 metadata）：

```bash
META_FILE=/tmp/app.meta bash shell/remote_deploy.sh --metadata-file /tmp/app.meta
```

完整流程：

```bash
bash shell/deploy.sh production
```
