# AppBox

xdarren 多应用后台（Vite + React 18 + TypeScript + CSS Modules）。

## 运行

```bash
cd app_box
npm install
npm run dev
```

前端 API 默认请求线上域名：`https://stellar.xdarren.com/api/v1`。  
如需临时改为其他后端，可设置：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1 npm run dev
```

## 管理员登录方式

- 使用固定密码登录（无需账号）。
- 密码：`pass_the_appbox_admin`
- 登录接口：`POST /api/v1/auth/admin/login`

## 菜单结构

左侧菜单：
- nginx配置
- web部署
- 静态资源
- 星烁
- 退出登录（固定在最底部）

右侧操作区：
- 选择工具菜单时，显示对应工具操作面板（当前为占位面板）。
- 选择 `星烁` 时，顶部功能标签为：
  - 用户管理
  - 配置管理
# app_box
