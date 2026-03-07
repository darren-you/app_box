# AGENTS

## General Rules

- 使用中文回复。
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
