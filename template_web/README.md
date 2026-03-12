# appbox_web

xdarren 多应用后台（Vite + React 18 + TypeScript + CSS Modules）。

## 运行

```bash
cd template_web
npm install
npm run dev
```

前端 API 默认走同域 `/api/v1`。  
如需临时改为其他后端，可设置：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1 npm run dev
```

## 访问口令方式

- 线上通过 nginx `/gate/` 页面校验访问口令。
- 本地开发若未接 nginx，会回退到前端静态 gate 校验。
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
