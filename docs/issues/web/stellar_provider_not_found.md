# 星烁菜单报错 provider_not_found 的排查记录

## 现象

在只启用部分 provider 的环境中，进入后台后点击“星烁”菜单，请求返回：

```text
provider not found: stellar
```

## 原因

`appbox_server` 只有在 `STELLAR_ENABLED=true` 时才会注册 `stellar` provider。

但 `appbox_web` 之前把侧边栏菜单写死为：

- `tinytext`
- `stellar`

这样在服务端未启用 `stellar` 的环境里，前端仍会发送 `X-App-Key: stellar`，最终被网关返回 `provider not found: stellar`。

## 处理

前端改为登录后先调用 `GET /api/v1/admin/providers`，再按服务端实际返回的 provider 渲染菜单与默认选中项。

## 结论

这是前端静态菜单与服务端动态 provider 注册状态不一致导致的问题。后续新增 provider 时，前端菜单必须以 `/admin/providers` 为准，不能再写死可用应用列表。
