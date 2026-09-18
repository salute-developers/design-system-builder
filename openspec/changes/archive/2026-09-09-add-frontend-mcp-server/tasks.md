## 1. Build foundation

- [x] 1.1 Добавить `mcp-kotlin = "0.10.0"` и alias `kotlin-sdk-server` в `frontend-kt/gradle/libs.versions.toml`
- [x] 1.2 Создать Node-library convention для reusable KMP-модулей с JVM, macOS arm64/x64 и Node.js JS targets, не добавляя JS target в `:cli`
- [x] 1.3 Применить JS-compatible convention к требуемым `core-*`, `feature-status` и новым shared-модулям
- [x] 1.4 Добавить compile-задачи JVM, JS, macOS arm64/x64 в обязательную проверку shared-модулей

## 2. Suspend network boundary

- [x] 2.1 Перевести `AuthenticatedHttpClient` и его factory/реализации на suspend HTTP operations и удалить `runBlocking` из `core-network`
- [x] 2.2 Перевести network-dependent ports и use cases на suspend contract, сохранив чисто вычислительные операции синхронными
- [x] 2.3 Адаптировать JVM/macOS CLI entrypoint и presentation к coroutine execution без блокировки в shared-коде
- [x] 2.4 Обновить unit/integration тесты затронутых `core-network`, feature-модулей и `:cli`

## 3. Общая модель авторизации

- [x] 3.1 Добавить в `core-auth` модели `BackendCredential`, `UserSession`, auth result/error и порты `CredentialStore`/`TokenClient`
- [x] 3.2 Обобщить authenticated HTTP client для заголовков `ProjectKey` и `Bearer` без раскрытия secret в публичных результатах
- [x] 3.3 Реализовать `CredentialProvider` в `core-application` с приоритетом project key -> user session и запретом fallback после `401`/`403` project key
- [x] 3.4 Реализовать общий `ContextResolver` как цепочку `ContextSource`, сохранив nearest `.sdds` текущим источником
- [x] 3.5 Покрыть credential priority и общий context resolution unit-тестами

## 4. Gateway token client и session storage

- [x] 4.1 Реализовать token client для захардкоженных `POST <apiUrl>/auth/token` и `POST <apiUrl>/auth/logout`
- [x] 4.2 Запретить password auth по plain HTTP кроме `localhost`/`127.0.0.1` и покрыть правило тестами
- [x] 4.3 Реализовать file-based `CredentialStore` в `~/.sdds/sessions/<backend-url-hash>.json` с проверкой `schemaVersion` и точного `apiUrl`
- [x] 4.4 Реализовать POSIX permissions `0700`/`0600`, atomic replace и безопасную работу с lock-файлом на поддерживаемых платформах
- [x] 4.5 Реализовать межпроцессный refresh lock с обязательным reread перед refresh и atomic save rotated token
- [x] 4.6 Реализовать early refresh, single forced retry после user `401`, удаление session после `invalid_grant` и отсутствие refresh после `403`
- [x] 4.7 Покрыть session codec/store, rotation, конкурентный refresh и HTTP error policy тестами без real credentials

## 5. Feature auth и команды

- [x] 5.1 Создать `:feature-auth` с `LoginUseCase`, `AuthStatusUseCase`, `LogoutUseCase` и application/data/di границами
- [x] 5.2 Добавить `dsbuilder auth login` со скрытым password input и запретом password в argv
- [x] 5.3 Добавить `dsbuilder auth status` без вывода token и `dsbuilder auth logout` с revocation/локальным удалением session
- [x] 5.4 Добавить эквивалентные `auth login|status|logout` команды в Node executable presentation
- [x] 5.5 Покрыть auth use cases и обе command presentation реализации тестами

## 6. MCP server core

- [x] 6.1 Создать `:mcp-server-core`, подключить только `kotlin-sdk-server:0.10.0` и не допустить MCP SDK types в `core-*`/`feature-*`
- [x] 6.2 Реализовать server lifecycle/configuration независимо от argv и platform stdin/stdout
- [x] 6.3 Реализовать tool `design_system_get_context` через общий `ContextResolver`
- [x] 6.4 Реализовать tool `project_get_status` через существующий status use case и общий `CredentialProvider`
- [x] 6.5 Реализовать стабильные MCP success/error DTO и mapping `AUTH_REQUIRED`, `PROJECT_KEY_INVALID`, `FORBIDDEN`, `CONTEXT_NOT_FOUND`, `BACKEND_UNAVAILABLE`
- [x] 6.6 Проверить, что server отвечает на `initialize`/`tools/list` без credentials и разрешает credential лениво при `tools/call`
- [x] 6.7 Добавить in-memory MCP contract tests для tools, schemas, protocol/domain errors и отсутствия secrets

## 7. CLI launcher

- [x] 7.1 Добавить `dsbuilder mcp serve` и Koin wiring `:cli` -> `:mcp-server-core`
- [x] 7.2 Реализовать JVM и macOS stdio adapters с stdout только для protocol messages и stderr для process logs
- [x] 7.3 Реализовать graceful shutdown по EOF stdin, `SIGINT` и `SIGTERM` с закрытием HTTP/MCP resources
- [x] 7.4 Добавить CLI launcher subprocess contract test

## 8. Node launcher и npm package

- [x] 8.1 Создать `:mcp-node` как Kotlin/JS Node.js executable с platform adapters для env, filesystem, home directory, HTTP и stdio
- [x] 8.2 Добавить `dsbuilder-mcp serve` с теми же `--api-url`/`--workspace` runtime inputs и resolver semantics, что у CLI launcher
- [x] 8.3 Собрать npm package с `bin/dsbuilder-mcp.js`, shebang, `dist`, `package.json`, README и license
- [x] 8.4 Добавить `npm pack` smoke test установки tarball вне Gradle build directory
- [x] 8.5 Добавить Node launcher subprocess contract test, переиспользующий запросы/ожидания CLI launcher suite

## 9. Документация и verification

- [x] 9.1 Обновить `frontend-kt/AGENTS.md`, `frontend-kt/cli/AGENTS.md`, README/USAGE и модульный граф для `feature-auth`, `mcp-server-core`, `mcp-node`
- [x] 9.2 Проверить одинаковые tool names, schemas, success/error bodies и server version у обоих launcher
- [x] 9.3 Выполнить `cd frontend-kt && ./gradlew build test detekt spotlessCheck`
- [x] 9.4 Выполнить compile-проверки JVM, JS, macOS arm64 и macOS x64 для shared MCP dependency graph
