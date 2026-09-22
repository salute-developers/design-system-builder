## Why

`frontend-kt` уже выделил общие `core-*` и `feature-*` модули, но агенты по-прежнему могут обращаться к DS Builder только
через человеко-ориентированные CLI-команды. Согласно ADR-0004 нужен локальный MCP server с типизированными инструментами,
который переиспользует те же use cases, контекст, авторизацию и REST-клиенты без shell-обертки над CLI. Одновременно
текущий frontend поддерживает только project key: для интерактивных CLI/MCP-сценариев требуется общая пользовательская
access/refresh session через уже существующие auth endpoint identity gateway.

## What Changes

- Добавляются KMP-модуль `:mcp-server-core` с MCP tools/runtime и Kotlin/JS executable-модуль `:mcp-node` для отдельной
  поставки `dsbuilder-mcp` через npm.
- `:cli` получает in-process launcher `dsbuilder mcp serve`; он использует тот же `:mcp-server-core` и не запускает Node.js
  subprocess.
- Фиксируется `io.modelcontextprotocol:kotlin-sdk-server:0.10.0`; версия Kotlin выбирается по совместимости с SDK и
  проверяется для JVM, JS, macOS arm64 и macOS x64.
- Общие `core-*`, необходимые `feature-*` и `:mcp-server-core` получают Node.js-compatible JS target; `:cli` сохраняет
  JVM/macOS targets, а `:mcp-node` является JS executable.
- Общие HTTP-контракты и сетевые use cases переводятся на `suspend`; `runBlocking` удаляется из `core-network`.
- Добавляются `:feature-auth`, команды `auth login|status|logout` в `dsbuilder` и `dsbuilder-mcp`, file-based user session,
  обязательная ротация refresh token, межпроцессная блокировка и атомарная запись.
- CLI и MCP используют общий `ApiUrlResolver`, общий `ContextResolver` и единый приоритет credentials: project key, затем
  user session. Невалидный project key не вызывает fallback на другого actor.
- MVP MCP работает только через stdio и предоставляет `design_system_get_context` и `project_get_status`.
- CLI/MCP не вычисляют RBAC и не скрывают backend tools по локальным ролям: доступ определяет DS Builder API.

## Capabilities

### New Capabilities

- `frontend-client-authentication`: login/password через gateway, хранение и ротация user session, общий выбор project key
  или Bearer credential для CLI и MCP.
- `frontend-mcp-server`: локальный stdio MCP server, общий server core, Node.js и CLI launcher, начальный набор tools и
  структурированная диагностика.

### Modified Capabilities

- `frontend-cli`: добавляются `auth login|status|logout` и `mcp serve`, а сетевой execution становится coroutine-based.
- `frontend-core-modules`: добавляется `feature-auth`, расширяются `core-auth`/`core-network`/`core-application`, а
  `:mcp-server-core` и `:mcp-node` включаются как новые consumers общего слоя.
- `kotlin-multiplatform-conventions`: добавляется convention для reusable KMP libraries с Node.js target без навязывания
  JS target приложению `:cli`.

## Impact

- **frontend-kt**: новые модули `feature-auth`, `mcp-server-core`, `mcp-node`; изменения `core-auth`, `core-network`,
  `core-workspace`, `core-application`, `feature-status`, `cli`, build-system conventions, version catalog и settings.
- **API**: используются существующие `POST <apiUrl>/auth/token`, `POST <apiUrl>/auth/logout` и project-scoped API;
  backend endpoints не добавляются и не меняются.
- **Persistence**: база данных не меняется; локально появляется `~/.sdds/sessions/<backend-url-hash>.json` и lock-файл.
- **Dependencies**: добавляется `io.modelcontextprotocol:kotlin-sdk-server:0.10.0`; Node launcher использует встроенные
  Node.js API и не требует отдельной filesystem/env/stdio npm-библиотеки.
- **backend-kt**: код и конфигурация gateway/Keycloak не меняются; используются уже включенные Direct Access Grant,
  refresh и logout.
- **js**: существующие приложения/сервисы не меняются; npm-пакет MCP собирается из `frontend-kt/mcp-node`.
