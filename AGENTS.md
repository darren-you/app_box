# AGENTS

## General Rules

- 使用中文回复。
- 使用中文撰写文档。
- 生成commit时使用中文。
- 工程文档统一放在项目根目录的 `docs` 目录中。
- `docs` 目录结构必须固定为：`docs/api`、`docs/features/app`、`docs/features/server`、`docs/features/web`、`docs/issues/app`、`docs/issues/server`、`docs/issues/web`。
- API 文档只能放在 `docs/api`；feature 文档只能放在 `docs/features/*`；issues 文档只能放在 `docs/issues/*`。
- 即使某个目录暂时没有文档，也必须保留该目录结构，必要时使用占位文件维持目录存在。
- 遇到问题或开始排查前，先检索 `docs/issues` 中是否已经记录了类似问题及对应解决方案。

## Documentation Naming

- 项目中的普通文档文件（如 `.md`、`.markdown`、`.txt`）统一使用英文小写单词加下划线命名。
- 普通文档文件名禁止使用中文、空格、连字符或全大写形式。
- `README.md` 作为特殊文档保留默认命名，不纳入普通文档命名规则。
- 文档命名示例：`project_analysis_report.md`、`font_subset_extraction_guide.md`。

## Web Static Assets

- Web 站点级静态资源统一放在 `<web_dir>/public/assets`。
- favicon、logo、icon 等图标资源统一放在 `<web_dir>/public/assets/icons`，`index.html`、`site.webmanifest` 和页面代码统一使用该目录下的绝对路径引用。
- 需要通过绝对路径直接访问的普通图片素材统一放在 `<web_dir>/public/assets/images`。
- 仅在资源需要被前端代码 `import` 并参与打包时，才放在 `<web_dir>/src/assets`；不要把 favicon 或共享 icon 放在 `src/assets`。

## Deployment And Verification

- 当用户明确要求“部署、上线、修复线上配置并验证”时，Agent 可以直接在本地调用 `deploy_shell` 中的脚本，不必先等待 Jenkins。
- 优先执行完整流水线；只有在明确知道只是远端环境变量或容器现场问题时，才直接 SSH 登录服务器处理。
- 执行部署后，必须补做线上验证，至少覆盖首页、健康检查和本次变更涉及的关键接口或页面。
- `AGENTS.md` 中禁止写入某个具体项目专属的域名、服务器 IP、账号密码、固定容器名、固定部署目录等硬编码信息。
- 所有部署命令、验证地址、SSH 目标都必须优先从当前项目实际存在的 `deploy_config.sh`、项目目录结构和线上返回结果中动态读取，不要把某个项目的现场信息写成通用规则。
- `deploy_shell/jenkins_mac_mini_ssh_defaults.sh` 中维护的是 Jenkins 打包机 Mac mini 的共享 SSH 默认配置。

通用调用方式：

```bash
PROJECT_ROOT=/absolute/path/to/project

# Web
bash "$PROJECT_ROOT/deploy_shell/deploy_web/remote_deploy_pipeline.sh" \
  --config "$PROJECT_ROOT/<web_dir>/deploy_config.sh"

# Server
BuildBranch=origin/master BuildEnv=prod \
bash "$PROJECT_ROOT/deploy_shell/deploy_server/remote_deploy_pipeline.sh" \
  --config "$PROJECT_ROOT/<server_dir>/deploy_config.sh"
```

可选分步调用：

```bash
bash "$PROJECT_ROOT/deploy_shell/deploy_web/npm_build_package.sh" \
  --config "$PROJECT_ROOT/<web_dir>/deploy_config.sh"

BuildBranch=origin/master BuildEnv=prod \
bash "$PROJECT_ROOT/deploy_shell/deploy_server/docker_build_push.sh" \
  --config "$PROJECT_ROOT/<server_dir>/deploy_config.sh"
```

通用验证方式：

```bash
curl -I https://<web-domain>/
curl -i https://<api-domain>/api/v1/health
```

## Server SSH

- 当需要排查线上容器、端口映射、远端环境变量、nginx 转发或日志问题时，Agent 可以直接 SSH 登录宿主机处理。
- SSH 目标必须优先从当前项目 `deploy_config.sh` 中读取，例如：
  - `DEPLOY_HOST`
  - `DEPLOY_PORT`
  - `DEPLOY_USER`
  - `DEPLOY_SSH_PASSWORD`
  - `DEPLOY_SSH_KEY_PATH`
- 若项目存在多个部署目标，也必须先识别当前用户要求操作的是哪一个环境，再连接对应机器。

登录示例：

```bash
sshpass -p '<password>' ssh -o StrictHostKeyChecking=no -p <port> <user>@<host>
```

排查时优先先读当前项目配置，再决定是否连接服务器，不要预设以下信息：

- 远端环境文件路径
- 远端部署目录
- 容器名
- Docker 网络名
- 对外域名

重要注意事项：

- 修改远端 `.env.prod` / `.env.test` 后，不能只执行 `docker restart`。
- `docker restart` 不会重新加载 `docker run --env-file` 指定的环境文件。
- 远端环境变量变更要生效，必须重新创建容器，或直接重新执行后端部署脚本。
