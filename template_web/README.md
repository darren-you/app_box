# appbox_web

xdarren 多应用后台（Vite + React 18 + TypeScript + CSS Modules）。

## 运行

```bash
cd template_web
npm install
npm run dev
```

开发模式下：

- 页面标题未注入 `VITE_WEB_NAME` 时，默认显示为 `AppBox`。
- 后端默认不在本地直接运行。
- 前端 dev/prod 默认直连 `https://appbox.xdarren.com/api/v1`，不再依赖本地 Vite API 代理。
- 如果浏览器尚未通过线上 Gate，开发页会引导打开 `https://appbox.xdarren.com/gate/` 完成口令校验；校验完成后刷新当前本地页面即可。

前端 API 默认走已部署的线上域名。  
如需切换到其他已部署环境，可设置：

```bash
VITE_API_BASE_URL=https://<api-domain>/api/v1 npm run dev
```

说明：

- 本地联调不要再通过 `BMS_PROXY_TARGET`、`localhost` 或本地启动 `appbox_server` 兜底。
- 若目标环境本身需要其他鉴权方式，应由目标环境自身放行跨域与访问控制。

## 访问口令方式

- 线上通过 nginx `/gate/` 页面校验访问口令。
- 本地开发默认使用线上 Gate，不再依赖本地静态 gate 或本地代理伪造 cookie。
- 密码：`pass_the_appbox_admin`
- 登录入口：`/gate/`
- 网关登录接口：`POST /gate/api/login`

## 打包与部署（deploy_shell）

项目根目录通过 git submodule 引入了 `deploy_shell`，前端部署配置位于 `template_web/deploy_config.sh`。

首次拉取仓库后先初始化子模块：

```bash
git submodule update --init --recursive
```

执行部署（固定 production 构建）：

```bash
cd template_web
bash ../deploy_shell/deploy_web/remote_deploy_pipeline.sh --config "$(pwd)/deploy_config.sh"
```

## 菜单结构

左侧菜单：
- 星烁
- TinyText
- 退出登录（固定在最底部）

右侧操作区：
- 选择 `星烁` 时，顶部功能标签为：
  - 用户管理
  - 配置管理
- 选择 `TinyText` 时：
  - 仅显示用户管理
  - 展示微信注册/登录用户的基础信息、脱敏 OpenID/UnionID 与最后登录时间
