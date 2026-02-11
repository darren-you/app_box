# app_box/server 网关架构设计

## 1. 目标与定位

`app_box/server` 是多应用后台管理网关，职责是：

- 对管理前端提供统一 API 入口与统一认证
- 将管理请求按 app/provider 路由到对应 `app_server`
- 屏蔽各 `app_server` 的差异（地址、鉴权头、错误格式）

它不是业务主服务，不直接持有各 app 的业务数据。

## 2. 分层结构

当前代码分层如下：

- 启动与装配层：`/Users/darrenyou/VscodeProjects/app_box/server/cmd/server/main.go`
- 路由层：`/Users/darrenyou/VscodeProjects/app_box/server/internal/api/router/router.go`
- 处理器层：`/Users/darrenyou/VscodeProjects/app_box/server/internal/api/handler`
- 认证中间件：`/Users/darrenyou/VscodeProjects/app_box/server/internal/api/middleware/auth_middleware.go`
- provider 抽象与注册中心：`/Users/darrenyou/VscodeProjects/app_box/server/internal/service/provider.go`
- provider 实现（示例：stellar）：`/Users/darrenyou/VscodeProjects/app_box/server/internal/service/stellar_provider.go`
- DTO 与响应协议：`/Users/darrenyou/VscodeProjects/app_box/server/internal/dto`
- 配置层：`/Users/darrenyou/VscodeProjects/app_box/server/internal/config/config.go`

### 2.1 总体架构图

```mermaid
flowchart LR
    A["管理前端 (app_box/web)"] -->|"HTTPS + JWT"| B["app_box/server"]
    B -->|"按 X-App-Key 或 app 参数路由"| C["ProviderRegistry"]
    C --> D["stellarProvider"]
    C --> E["fooProvider (示例)"]
    D -->|"X-Gateway-Key"| F["stellar-go /api/v1/admin/*"]
    E -->|"X-Gateway-Key"| G["foo-app-server /api/v1/admin/*"]
```

### 2.2 网关内部组件关系

```mermaid
flowchart TB
    A["Router"] --> B["Auth Middleware (JWT)"]
    B --> C["Admin Provider Handler"]
    C --> D["ProviderRegistry.Resolve()"]
    D --> E["AdminProvider Interface"]
    E --> F["Stellar Provider Impl"]
    F --> G["Upstream app_server"]
```

## 3. 核心设计

### 3.1 统一入口与鉴权

- 管理员登录由网关负责：`POST /api/v1/auth/admin/login`
- 网关签发 JWT，后续管理接口统一走 JWT 鉴权
- 管理员信息接口：`GET /api/v1/admin/auth/me`

这保证了前端只对接一套登录体系，不依赖具体 `app_server`。

### 3.2 Provider 路由机制

网关内部定义统一接口 `AdminProvider`，每个 app 实现一套 provider：

- `ListUsers`
- `ListUserPlanets`
- `UpdateUser`
- `DeleteUser`
- `ListConfigs`
- `UpsertConfig`
- `DeleteConfig`

请求路由规则：

1. 优先读取请求头 `X-App-Key`
2. 若无则读取 query `app`
3. 都没有则使用 `DEFAULT_APP_PROVIDER`

这样可以在同一套 API 下支持多 app 切换。

### 3.3 与 app_server 的调用模型

网关到 `app_server` 走服务间调用：

- 网关发起 HTTP 请求
- 携带服务鉴权头（示例：`X-Gateway-Key`）
- 解析 `app_server` 统一响应结构并回传给前端

这层由 provider 承担，路由与 handler 不感知上游细节。

### 3.4 统一错误语义

- 上游返回 4xx/5xx 或业务非 200 时，封装为 `UpstreamError`
- handler 根据 `UpstreamError.StatusCode` 原样映射或降级为 `502`
- 前端感知为统一 `code/msg` 结构

## 4. 请求链路

### 4.1 登录链路

1. 前端调用 `/api/v1/auth/admin/login`
2. 网关校验密码并签发 JWT
3. 前端保存 token

### 4.2 管理操作链路（跨 app）

1. 前端调用 `/api/v1/admin/*` 并携带 JWT
2. 网关鉴权后解析 provider key
3. `ProviderRegistry` 解析具体 provider
4. provider 调用目标 `app_server`（带网关密钥）
5. 网关返回统一响应

### 4.3 管理请求交互时序图（以查询用户为例）

```mermaid
sequenceDiagram
    participant U as "Admin User"
    participant W as "app_box/web"
    participant G as "app_box/server"
    participant R as "ProviderRegistry"
    participant P as "stellarProvider"
    participant S as "stellar-go"

    U->>W: "进入用户管理页"
    W->>G: "GET /api/v1/admin/users (Authorization, X-App-Key=stellar)"
    G->>G: "JWT 鉴权 + 角色校验"
    G->>R: "Resolve('stellar')"
    R-->>G: "返回 stellarProvider"
    G->>P: "ListUsers(page,pageSize,keyword)"
    P->>S: "GET /api/v1/admin/users (X-Gateway-Key)"
    S-->>P: "{code,msg,data}"
    P-->>G: "标准化数据或 UpstreamError"
    G-->>W: "统一响应结构"
    W-->>U: "渲染用户列表"
```

## 5. 当前已接入 provider

- `stellar`（星烁）

配置项：

- `STELLAR_PROVIDER_NAME`
- `STELLAR_API_BASE_URL`
- `STELLAR_GATEWAY_HEADER`
- `STELLAR_GATEWAY_KEY`
- `STELLAR_TIMEOUT`

参考：`/Users/darrenyou/VscodeProjects/app_box/server/.env.example`

## 6. 扩展策略

新增一个 app 时，不改前端主流程，只需：

1. 新增 provider 配置项
2. 实现新的 `AdminProvider`
3. 在 `main.go` 注册 provider
4. 在文档中补充 provider key 与运维配置

## 7. 安全边界

- 前端到网关：JWT（管理员身份）
- 网关到 app_server：服务间密钥（`X-Gateway-Key`）
- 网关是唯一对前端开放的管理入口，`app_server` 管理接口应限制仅网关访问
