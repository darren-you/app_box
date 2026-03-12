# appbox

## 项目定位

`appbox` 是一个多应用后台管理壳工程，当前主要用于统一承载 `stellar` 与 `tinytext` 的管理入口。仓库内同时包含前端工作台、后端 provider 聚合网关、部署脚本子模块以及项目文档。

## 目录结构

- `template_web/`：基于 `React 18 + TypeScript + Vite` 的后台工作台，按 provider 动态展示菜单与页面。
- `template_server/`：基于 `Go + Fiber` 的管理网关，负责聚合并转发上游应用的后台接口。
- `deploy_shell/`：部署脚本子模块，提供 web/server 的构建、发布与通知能力。
- `docs/`：项目文档目录，已沉淀网关架构、上游集成说明与问题记录。

## 当前能力

- 前端支持网关口令校验后的管理工作台访问。
- 后端已抽象 provider 注册中心，当前支持 `stellar` 与 `tinytext`。
- 已实现用户管理、配置管理、provider 列表与健康检查等基础能力。
- 访问控制由 nginx `/gate` 负责，`appbox_server` 仅承担聚合与转发职责。

## 技术栈

- Web：`React 18`、`TypeScript`、`Vite`
- Server：`Go 1.25`、`Fiber`
- 部署：`deploy_shell` 子模块

## 常用入口

首次拉取后建议先初始化子模块：

```bash
git submodule update --init --recursive
```

本地启动前端：

```bash
cd template_web
npm install
npm run dev
```

本地启动后端：

```bash
cd template_server
go run ./cmd/server
```

## 文档索引

- `docs/features/server/gateway_architecture.md`：网关结构说明
- `docs/features/server/app_server_integration_guide.md`：上游服务接入说明
- `docs/issues/web/stellar_provider_not_found.md`：已记录的前端 provider 问题

