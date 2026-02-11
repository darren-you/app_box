# app_box/server

`app_box` 后台管理网关服务，已把原来写在 `stellar-go` 的后台登录能力和星烁管理接口接入能力抽离到这里。

## 已实现能力

- 管理员登录：`POST /api/v1/auth/admin/login`
- 管理员信息：`GET /api/v1/admin/auth/me`
- 星烁管理接口透传（默认 provider=stellar）：
  - `GET /api/v1/admin/users`
  - `GET /api/v1/admin/users/:id/planets`
  - `PUT /api/v1/admin/users/:id`
  - `DELETE /api/v1/admin/users/:id`
  - `GET /api/v1/admin/configs`
  - `PUT /api/v1/admin/configs/:key`
  - `DELETE /api/v1/admin/configs/:key`
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

## 与 app_box/web 对接

将 `app_box/web` 的 `VITE_API_BASE_URL` 配置为：

```text
http://localhost:8090/api/v1
```

## 多 app 扩展

当前已抽象 provider 注册中心（`internal/service/provider.go`），后续新增 app 时可新增一个 provider 并注册到路由层，无需改前端主流程。

## 与 stellar-go 的鉴权约定

`app_box/server` 调用 `stellar-go` 的管理接口时，使用网关密钥请求头（默认 `X-Gateway-Key`），不再依赖 `stellar-go` 的管理员登录接口。
