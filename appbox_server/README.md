# appbox_server

`appbox` 后台管理网关服务，已把原来写在 `stellar-go` 的后台登录能力和多应用管理接口接入能力抽离到这里。

## 已实现能力

- 管理员登录：`POST /api/v1/auth/admin/login`
- 管理员信息：`GET /api/v1/admin/auth/me`
- 星烁管理接口透传（启用 `STELLAR_ENABLED=true` 后生效）：
  - `GET /api/v1/admin/users`
  - `GET /api/v1/admin/users/:id/planets`
  - `PUT /api/v1/admin/users/:id`
  - `DELETE /api/v1/admin/users/:id`
  - `GET /api/v1/admin/configs`
  - `PUT /api/v1/admin/configs/:key`
  - `DELETE /api/v1/admin/configs/:key`
- TinyText 用户管理透传（启用 `TINYTEXT_ENABLED=true` 后生效）：
  - `GET /api/v1/admin/users`
- provider 列表：`GET /api/v1/admin/providers`
- 健康检查：`GET /api/v1/health`

接口响应结构保持与前端一致：

```json
{
  "code": 200,
  "timestamp": 1739251200000,
  "msg": "success",
  "data": {}
}
```

## 运行

1. 复制配置文件并按环境修改：

```bash
cp .env.example .env
```

2. 启动：

```bash
go run ./cmd/server
```

## 打包与部署（deploy_shell）

项目根目录通过 git submodule 引入了 `deploy_shell`，后端部署配置位于 `appbox_server/deploy_config.sh`。

首次拉取仓库后先初始化子模块：

```bash
git submodule update --init --recursive
```

生产环境部署：

```bash
cd appbox_server
BuildBranch=origin/master BUILD_ENV=production \
bash ../deploy_shell/deploy_server/remote_deploy_pipeline.sh --config "$(pwd)/deploy_config.sh"
```

开发环境部署：

```bash
cd appbox_server
BuildBranch=origin/develop BUILD_ENV=development \
bash ../deploy_shell/deploy_server/remote_deploy_pipeline.sh --config "$(pwd)/deploy_config.sh"
```

## 与 appbox_web 对接

将 `appbox_web` 的 `VITE_API_BASE_URL` 配置为：

```text
http://localhost:8090/api/v1
```

## TinyText provider 配置

若要真正打通 TinyText 的“用户管理”，`appbox_server` 所在环境的 `env-file` 需至少包含：

```dotenv
TINYTEXT_ENABLED=true
TINYTEXT_PROVIDER_NAME=tinytext
TINYTEXT_API_BASE_URL=http://127.0.0.1:8080/api/v1
TINYTEXT_GATEWAY_HEADER=X-Gateway-Key
TINYTEXT_GATEWAY_KEY=replace-with-a-shared-gateway-key
```

其中 `TINYTEXT_GATEWAY_KEY` 必须与 TinyText 服务里的 `GATEWAY_AUTH_KEY` 一致。

## 多 app 扩展

当前已抽象 provider 注册中心（`internal/service/provider.go`），后续新增 app 时可新增一个 provider 并注册到路由层，无需改前端主流程。

## 与上游 app 的鉴权约定

`appbox_server` 调用上游 app 的管理接口时，使用网关密钥请求头（默认 `X-Gateway-Key`），不再依赖各 app 自己的管理员登录接口。
