## Why

Разработчики, которые уже подключили опубликованную дизайн-систему DS Builder (например, `io.github.salute-developers:sdds-serv-compose`) в своё Android-приложение, сейчас не имеют способа посмотреть актуальные токены дизайн-системы (цвета, типографику, spacing и т.д.), не выходя из Android Studio — приходится идти в веб-интерфейс DS Builder или спрашивать у команды дизайн-системы. Это создаёт трение и ошибки при ручном переносе значений токенов в код. Сейчас подходящий момент для этого изменения: `frontend-kt` только что был перестроен (ADR-0004, ADR-0005) — бизнес-логика CLI вынесена в общие `core-*`/`feature-*` модули именно для того, чтобы ими могли пользоваться будущие клиенты, отличные от CLI, и IDE-плагин — первый такой клиент.

## What Changes

- Новый модуль плагина для Android Studio / IntelliJ IDEA — `frontend-kt/plugins/android-studio`. Новый тип модуля в `frontend-kt` (plain JVM + IntelliJ Platform Gradle Plugin, не Kotlin Multiplatform), требует нового Gradle convention plugin в `frontend-kt/build-system/conventions`.
- Новый интерактивный флоу авторизации пользователя — OAuth Authorization Code + PKCE с loopback-редиректом на локальный порт плагина. Это первая реализация «авторизации пользователя», которую ADR-0005 предусмотрел, но сознательно не специфицировал.
- Новый Keycloak-клиент `dsbuilder-studio-plugin`: локально — запись в `backend-kt/identity-gateway/keycloak/dsbuilder-realm.json`; в проде — второй idempotent create-or-update блок в `backend-kt/identity-gateway/keycloak/bootstrap-production-keycloak.sh` (клиенты в проде заводятся этим скриптом через Keycloak Admin API, а не realm-импортом). Клиент: `publicClient=true`, `standardFlowEnabled=true`, `directAccessGrantsEnabled=false`, обязательный PKCE (`S256`), redirect URI для loopback (`http://127.0.0.1:*`), с тем же audience-мэппером (`aud=dsbuilder-api`), что и у `dsbuilder-api`, — без этого gateway отклонит токен.
- `core-auth` получает второй, параллельный способ получения учётных данных — пользовательская OAuth-сессия (access + refresh JWT в `PasswordSafe`), в дополнение к существующему `ApiKeyResolver` (project access key). `core-network` получает поддержку `Authorization: Bearer <jwt>` в дополнение к текущему `Authorization: ProjectKey <key>`.
- UI плагина: tool window `SDDS` с содержимым на Compose Desktop (`ComposePanel`), оформленным средствами `sdds-serv-compose` (Maven Central) — экран логина (idle/loading/error) и read-only браузер токенов (выбор проекта → дизайн-системы/версии/платформы → список токенов, сгруппированный по типу, с превью значения).
- Используются уже существующие и уже публично проксируемые через identity-gateway эндпоинты: `GET /api/projects`, `GET /api/projects/{id}/ds/tokens`, `GET /api/projects/{id}/ds/token-values`. При реализации обнаружилось, что `GET /ds/tokens` и `GET /ds/token-values` в `db-service` не были скоуплены по дизайн-системе проекта (в отличие от уже скоупленного `GET /ds/design-systems`) — любой авторизованный actor видел токены всех дизайн-систем. Это исправлено (см. Impact) — единственное фактическое изменение бэкенда в этом change.
- Явно **не входит** в это изменение: генерация кода, запись файлов в проект пользователя, создание `.sdds` в проекте потребителя, просмотр компонентов (только токены), сверка отображаемых значений с версией библиотеки, реально подключённой в проекте пользователя.

## Capabilities

### New Capabilities
- `ide-plugin-token-browser`: Android Studio / IntelliJ IDEA плагин DS Builder — структура модуля, tool window, Compose UI и read-only просмотр токенов дизайн-системы для потребителей.

### Modified Capabilities
- `identity-authentication`: добавляется OAuth Authorization Code + PKCE флоу с loopback-редиректом для нативных/IDE-клиентов и отдельный Keycloak-клиент `dsbuilder-studio-plugin`.
- `frontend-core-modules`: `core-auth` и `core-network` получают второй, параллельный путь авторизации (интерактивная пользовательская OAuth-сессия) для клиентов, отличных от CLI, в дополнение к существующему project-key флоу.

## Impact

- `backend-kt/identity-gateway/keycloak/dsbuilder-realm.json` (локальный realm-импорт) и `backend-kt/identity-gateway/keycloak/bootstrap-production-keycloak.sh` (прод, idempotent create-or-update через Keycloak Admin API) — новый клиент `dsbuilder-studio-plugin`.
- `frontend-kt/core-auth` — новый resolver пользовательской OAuth-сессии, хранение refresh-токена через `PasswordSafe`.
- `frontend-kt/core-network` — поддержка `Bearer`-авторизации в `KtorAuthenticatedHttpClient` наравне с `ProjectKey`.
- `frontend-kt/settings.gradle.kts` — новый модуль `:plugins:android-studio`.
- `frontend-kt/build-system/conventions` — новый convention plugin для модулей на IntelliJ Platform Gradle Plugin.
- Новая внешняя зависимость `io.github.salute-developers:sdds-serv-compose` (Maven Central) — только в новом модуле плагина.
- `js/services/db-service/src/routes/api/tokens.ts` и `token-values.ts` — `GET /` теперь фильтруется по scope дизайн-системы проекта (`designSystemScopeFilter`, по образцу уже существующего использования в `design-systems.ts`); маршруты, схема БД и OpenAPI-контракт не меняются, только runtime-поведение чтения. `backend-kt/projects-service` не затрагивается.
