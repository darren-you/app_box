# appbox_server

`appbox` 后台管理网关服务，负责聚合多应用后台管理接口；管理端访问口令校验由 nginx `/gate` 负责，`appbox_server` 本身不再承担登录或 JWT 鉴权。

## 已实现能力

- 星烁管理接口透传（在 YAML 中启用 `provider.stellar.enabled: true` 后生效）：
  - `GET /api/v1/admin/users`
  - `GET /api/v1/admin/users/:id/planets`
  - `PUT /api/v1/admin/users/:id`
  - `DELETE /api/v1/admin/users/:id`
  - `GET /api/v1/admin/configs`
  - `PUT /api/v1/admin/configs/:key`
  - `DELETE /api/v1/admin/configs/:key`
- TinyText 用户管理透传（在 YAML 中启用 `provider.tinytext.enabled: true` 后生效）：
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

1. 修改本地配置文件：

```bash
vim config/config.yaml
```

2. 启动：

```bash
go run ./cmd/server
```

## 访问控制

- 线上访问控制由 nginx `/gate` 完成。
- 前端进入 `https://appbox.xdarren.com/` 前，会先经过 `/gate/` 输入访问口令。
- `appbox_server` 仅负责 `/api/v1/admin/*` 的 provider 聚合与上游转发。

## 打包与部署（deploy_shell）

项目根目录通过 git submodule 引入了 `deploy_shell`，后端部署配置位于 `template_server/deploy_config.sh`。

首次拉取仓库后先初始化子模块：

```bash
git submodule update --init --recursive
```

生产环境部署：

```bash
cd template_server
BuildBranch=origin/master BuildEnv=prod \
bash ../deploy_shell/deploy_server/remote_deploy_pipeline.sh --config "$(pwd)/deploy_config.sh"
```

开发环境部署：

```bash
cd template_server
BuildBranch=origin/develop BuildEnv=test \
bash ../deploy_shell/deploy_server/remote_deploy_pipeline.sh --config "$(pwd)/deploy_config.sh"
```

## 配置加载

- 服务运行时固定读取 `config/config.yaml`
- 本地开发直接维护 `config/config.yaml`
- CICD 构建时：
  - `BuildEnv=test` 使用 `config/config.dev.yaml`
  - `BuildEnv=prod` 使用 `config/config.prod.yaml`
- 构建阶段会将目标环境 YAML 复制为镜像内最终生效的 `config/config.yaml`
- 业务配置统一由 YAML 管理

## 与 appbox_web 对接

将 `appbox_web` 的 `VITE_API_BASE_URL` 配置为：

```text
http://localhost:8090/api/v1
```

## Stellar provider 配置

若要打通星烁管理能力，`appbox_server` 所在环境的 YAML 需至少配置：

```yaml
provider:
  stellar:
    enabled: true
    name: stellar
    base_url: http://stellar:8000/api/v1
    gateway_header: X-Gateway-Key
    gateway_key: replace-with-a-shared-gateway-key
```

`provider.stellar.gateway_key` 必须与星烁服务里的 `gateway.admin_key` 一致，`/api/v1/admin/*` 只允许通过该服务间鉴权方式访问。

## TinyText provider 配置

若要真正打通 TinyText 的“用户管理”，`appbox_server` 所在环境的 YAML 需至少配置：

```yaml
provider:
  tinytext:
    enabled: true
    name: tinytext
    base_url: http://127.0.0.1:8080/api/v1
    gateway_header: X-Gateway-Key
    gateway_key: replace-with-a-shared-gateway-key
```

其中 `provider.tinytext.gateway_key` 必须与 TinyText 服务里的 `gateway_auth.key` 一致。

## 多 app 扩展

当前已抽象 provider 注册中心（`internal/service/provider.go`），后续新增 app 时可新增一个 provider 并注册到路由层，无需改前端主流程。

## 与上游 app 的鉴权约定

`appbox_server` 调用上游 app 的管理接口时，统一使用网关密钥请求头（默认 `X-Gateway-Key`）。业务服务不得依赖旧的管理员登录模式作为 AppBox 管理接口入口。
