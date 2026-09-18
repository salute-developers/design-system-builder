## ADDED Requirements

### Requirement: Headless MCP context per call

MCP server SHALL запускаться без `.sdds` и `--workspace`, а project-scoped tools SHALL принимать optional `designSystem` URI и разрешать контекст независимо для каждого вызова.

#### Scenario: Headless startup

- **WHEN** MCP server запущен без workspace и без credential
- **THEN** `initialize` и `tools/list` MUST завершиться успешно
- **THEN** project-scoped tool без ссылки MUST вернуть структурированный `CONTEXT_REQUIRED`

#### Scenario: Два чата используют один server

- **WHEN** параллельные вызовы передают ссылки на разные дизайн-системы
- **THEN** каждый вызов MUST использовать только свой resolved context
- **THEN** один вызов MUST NOT менять контекст другого или последующих вызовов

#### Scenario: Агент передаёт ссылку из чата

- **WHEN** MCP client вызывает project-scoped tool с `designSystem` URI
- **THEN** tool MUST передать URI общему context resolver
- **THEN** ответ MUST содержать фактически использованный контекст или явную ошибку его разрешения

### Requirement: MCP контекст и credential не смешиваются

MCP presentation SHALL описывать `designSystem` как выбор ресурса, а авторизацию — как отдельную runtime policy; URI MUST NOT интерпретироваться как API URL или credential.

#### Scenario: Проекция конфигурации компонента использует один runtime

- **WHEN** `component_config_get` запрашивает `token-references` для локального контекста
- **THEN** прикладной сценарий MUST разрешить runtime один раз и использовать его для чтения конфигурации и каталога токенов
- **THEN** MCP MUST передать параметры сценария и сериализовать результат без собственной оркестрации двух чтений

#### Scenario: Неверная ссылка

- **WHEN** tool получает некорректный `designSystem` URI
- **THEN** он MUST вернуть `INVALID_CONTEXT`
- **THEN** он MUST NOT переключаться на локальную `.sdds` или другой actor
