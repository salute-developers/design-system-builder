## Context

`frontend-kt` содержит общие KMP-модули, но они собираются только для JVM/macOS, `core-network` синхронно оборачивает Ktor
через `runBlocking`, а `:cli` является единственным executable. Авторизация поддерживает только
`Authorization: ProjectKey`, хотя identity gateway уже принимает пользовательский `Authorization: Bearer` и публикует
`/auth/token`/`/auth/logout`. Требуется локальный MCP server без удаленного hosting, доступный как часть CLI и отдельный
Node.js artifact.

## Goals / Non-Goals

**Goals:**

- Один MCP contract и server core для JVM/macOS CLI и Node.js executable.
- Переиспользование существующих use cases вместо вызова CLI как subprocess.
- Общая для CLI/MCP авторизация с project key и rotating user session.
- Общий context/API URL resolution.
- Проверяемый read-only вертикальный срез MCP через stdio.

**Non-Goals:**

- Remote MCP hosting, HTTP/SSE transport и OAuth между MCP client и MCP server.
- Browser Authorization Code + PKCE, device flow и platform keychain/credential manager.
- Реализация всех предметных tools из ADR-0004.
- Новая локальная RBAC/permission model в CLI или MCP.
- Изменения backend API, Keycloak realm и persistent database.

## Decisions

### 1. Один server core и два launcher

`:mcp-server-core` содержит MCP SDK integration, tools, schemas, lifecycle и mapping прикладных результатов. `:mcp-node`
собирается в Kotlin/JS executable `dsbuilder-mcp`. `:cli` зависит от того же server core и запускает его командой
`dsbuilder mcp serve`. Ни один launcher не запускает другой executable.

Альтернатива с CLI, запускающим Node subprocess, отклонена: она делает основной CLI зависимым от Node и усложняет
lifecycle/diagnostics. Отдельные реализации server logic отклонены из-за риска расхождения tools и ошибок.

### 2. Официальный MCP Kotlin SDK 0.10.0

Используется `io.modelcontextprotocol:kotlin-sdk-server:0.10.0`, изолированный внутри `:mcp-server-core`. Выбранная версия
Kotlin должна быть совместима с SDK metadata и проверяться для JVM, JS, macOS arm64 и macOS x64. Начиная с `0.11.0`, SDK
перешел на Kotlin `2.3.10` и удалил macOS x64 target, поэтому новые версии не выбираются без отдельного обновления
toolchain.

### 3. Только stdio в MVP

MCP client (Codex, Claude, IDE) запускает локальный MCP server как subprocess и общается через stdin/stdout. Server не
слушает порт и нигде не хостится. Stdout содержит только MCP protocol messages; process logs идут в stderr. EOF stdin,
`SIGINT` и `SIGTERM` закрывают session и runtime resources.

### 4. JS targets и suspend boundary

Reusable `core-*`, требуемые `feature-*` и `:mcp-server-core` получают JVM/macOS/JS targets через отдельный Node-library
convention. `:cli` не получает JS target; `:mcp-node` является JS executable. HTTP, token operations и зависимые use cases
становятся `suspend`; `runBlocking` допускается только в JVM/Native entrypoint, но не в shared network/application code.

### 5. Один ContextResolver и ApiUrlResolver

CLI и MCP передают runtime input в общий `ContextResolver` и не реализуют собственную цепочку источников. На первом этапе
реальным источником остается поиск ближайшего `.sdds/config.json`; будущие источники из ADR-0005 подключаются как
`ContextSource`. `--workspace`, если передан, задает только starting directory общего поиска.

API URL разрешается одинаково: `--api-url`, `DSBUILDER_API_URL`, code default. Тот же base URL используется для API и
захардкоженных gateway auth paths.

### 6. Общий credential priority без смены actor

CLI и MCP сначала разрешают project key из project credential reference/runtime environment, затем user session для
resolved API URL. Fallback выполняется только при отсутствии project key. `401`/`403` найденного project key возвращается
как ошибка этого actor и не приводит к пользовательскому Bearer retry.

Backend/gateway является единственным владельцем RBAC и scopes. Клиенты не вычисляют роль и не скрывают backend tools.
Локальные файловые операции ограничиваются workspace как технической filesystem boundary, а не RBAC.

### 7. Login/password через тот же gateway

`dsbuilder` и `dsbuilder-mcp` предоставляют `auth login|status|logout`. `login` интерактивно читает password без echo и
отправляет Direct Access Grant в `POST <apiUrl>/auth/token`; password не разрешен в argv, не сохраняется и не доступен MCP
tools. Refresh использует тот же endpoint, logout — `POST <apiUrl>/auth/logout`. OIDC discovery/issuer config не вводятся.
Передача password разрешена только по HTTPS, кроме loopback HTTP для local development.

### 8. File-based rotating session

User session хранится в `~/.sdds/sessions/<backend-url-hash>.json` и содержит только `schemaVersion`, нормализованный
`apiUrl`, `username`, `refreshToken`, `refreshExpiresAt`, `updatedAt`. Access token живет в памяти; password, ID token, роли
и context не сохраняются. POSIX directory/file permissions — `0700`/`0600`.

Refresh token обязательно ротируется. Межпроцессная блокировка охватывает `reread -> refresh -> atomic save`; ожидающий
процесс перечитывает сохраненную session. Авария после получения rotated token до atomic save требует нового login —
безопасность не ослабляется повторным использованием старого token.

Platform keychain отклонен для MVP из-за разных macOS/Windows/Linux API, отсутствия Secret Service в headless Linux и
сложности Node native dependencies. `CredentialStore` остается портом, поэтому storage можно заменить позже.

### 9. Refresh и HTTP error policy

Access token обновляется до истечения с clock skew. `401` пользовательского запроса вызывает максимум один forced refresh
и один retry. Повторный `401`/`invalid_grant` удаляет session и возвращает `AUTH_REQUIRED`; `403` возвращает `FORBIDDEN`
без refresh; transport failure сохраняет session. MCP запускается без credentials и отвечает на `initialize`/`tools/list`,
а credential разрешается лениво при `tools/call`.

### 10. Первый MCP contract

MVP регистрирует `design_system_get_context` и `project_get_status`. MCP presentation DTO отделены от use-case и CLI DTO.
Protocol errors используются для неизвестного tool/невалидного запроса; предметные ошибки возвращаются как
`CallToolResult(isError=true)` со стабильными `code`, `message`, `details`. Raw credentials, stack traces и абсолютные пути
не возвращаются.

### 11. Общие contract tests

Server core тестируется in-memory transport. Собранные `dsbuilder-mcp serve` и `dsbuilder mcp serve` проходят одинаковый
subprocess stdio suite: `initialize -> tools/list -> tools/call -> shutdown`. Отдельно проверяются stdout purity,
credential priority, rotating refresh, session locking и error mapping.
