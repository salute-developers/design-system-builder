## Why

Плагин Android Studio (`frontend-kt/plugins/android-studio`) сегодня зависит только от `core-domain`/`core-network`/`core-auth`/`core-application` и вместо переиспользования общего `feature-*` слоя дублирует бизнес-логику локально: свои use case'ы получения проектов/дизайн-систем/токенов, свой REST-клиент поверх `HttpProjectsClient`/`HttpDesignSystemDataClient`, свой парсер значений токена (зеркалящий `TokenValueNormalizer` из `feature-theme`) и весь OAuth Authorization Code + PKCE флоу — хотя низкоуровневые примитивы для него (`PkceGenerator`, `TokenExchangeClient`, `UserSessionCredentialResolver`, `RefreshTokenStore`) уже есть в `core-auth` именно для этого сценария. Это прямо противоречит требованию `ide-plugin-token-browser`, что модуль плагина не должен дублировать то, что уже реализовано в общих модулях, и требованию ADR-0004 о переиспользуемости общего слоя будущими клиентами.

Одновременно нужно расширить сам плагин: показ токенов дизайн-системы с несколькими tenant и копирование в буфер обмена code-ссылки на токен для Compose (`SddsServTheme.colors.textDefaultAccent`) — обе фичи требуют данных (tenant, готовая ссылка из CodeBinding), которых в текущей модели плагина нет.

## What Changes

- Новый модуль `feature-projects`: use case и REST-адаптер для `GET /api/projects` (список проектов пользователя — операция без разрешённого `ProjectContext`, нужна до выбора проекта/дизайн-системы), по образцу остальных `feature-*` модулей.
- `feature-auth` получает второй способ получить credential — Authorization Code + PKCE через системный браузер (use case-оркестратор, аналог существующего `LoginController` плагина) поверх уже существующих в `core-auth` примитивов. Порты `BrowserLauncher`/`RedirectListener` — в `commonMain`; их JVM-реализации (`com.sun.net.httpserver`, `java.net.URLEncoder`) — в `jvmMain` `feature-auth`, общие для `:cli` (JVM-таргет) и плагина.
- Плагин переиспользует общий слой там, где паттерн доступа совпадает:
  - `feature-projects` вместо `ListProjectsUseCase`/`HttpProjectsClient`;
  - новый OAuth-юзкейс `feature-auth` вместо `LoginController`/`AuthorizeUrlBuilder`/`LogoutUrlBuilder`/`LoopbackRedirectListener`; `PasswordSafeRefreshTokenStore` остаётся в плагине как IDE-специфичная реализация порта `RefreshTokenStore` из `core-auth`.
  - `ListDesignSystemsUseCase/`GetDesignSystemTokensUseCase`/`HttpDesignSystemDataClient` **остаются в плагине без изменений**: единственный аналог в `feature-theme` (`TokenReadUseCases.values`) читает значения по одному `tokenId` за раз (per-token REST-контракт под MCP), а плагину нужен один bulk-запрос на всю дизайн-систему — перенос создал бы N+1 запросов вместо одного. Это выяснилось при реализации (см. design.md); дублирования тут нет, это оправданно разные паттерны доступа к одному и тому же backend.
- Просмотр токенов дизайн-системы с несколькими tenant: плагин получает список tenant дизайн-системы (`GET /api/projects/{id}/ds/design-systems/{dsId}/tenants`) и показывает выбор tenant в UI только если их больше одного; значения токенов фильтруются по выбранному `tenantId`.
- Копирование в буфер обмена code-ссылки на токен для Compose (`SddsServTheme.colors.textDefaultAccent`): по нажатию на конкретный токен плагин берёт готовый `themeReference` из CodeBinding (`kind=token`) опубликованной документации дизайн-системы. Действие доступно только на платформе Android. Локальный `.sdds/config.json` и alias не используются. Для этого `publications/active` в documentation-service принимает запрос без `version` (последняя публикация).
- Явно вне периметра этого change: запуск/хостинг MCP-сервера из плагина не делается — MCP остаётся только в `:cli`/`:mcp-node`/`:mcp-server-core`.

## Capabilities

### New Capabilities
- `frontend-projects-listing`: получение списка проектов, доступных авторизованному пользователю (`GET /api/projects`), как переиспользуемая возможность общего клиентского слоя `frontend-kt`, не привязанная к разрешённому `ProjectContext`.

### Modified Capabilities
- `documentation-publication-reading`: `GET /documentation/publications/active` принимает запрос без `version` и возвращает последнюю опубликованную публикацию для (`designSystemId`, `platform`).
- `frontend-core-modules`: модульный граф пополняется `feature-projects`; `feature-auth` получает второй способ авторизации (OAuth PKCE) и порты `BrowserLauncher`/`RedirectListener`; `:plugins:android-studio` добавляет зависимости на `feature-projects`, `feature-auth`.
- `frontend-client-authentication`: `feature-auth` дополняется Authorization Code + PKCE как альтернативным (не заменяющим) способом получить пользовательскую сессию, с хранением refresh token через платформенную реализацию `RefreshTokenStore` вместо файлового `CredentialStore`, используемого текущим `auth login`.
- `ide-plugin-token-browser`: модуль плагина зависит от `feature-projects`/`feature-auth` и не дублирует их логику; собственный bulk-клиент чтения токенов дизайн-системы сознательно сохраняется — переиспользуемого аналога для bulk-доступа в `feature-theme` нет; добавляется выбор tenant при просмотре токенов дизайн-системы; добавляется копирование code-ссылки на токен для платформы Android.

## Impact

- `frontend-kt/settings.gradle.kts`, новый модуль `frontend-kt/feature-projects/`.
- `frontend-kt/feature-auth/` — новый OAuth PKCE юзкейс, порты и `jvmMain` source set.
- `frontend-kt/cli/` — `JvmClientRuntime.kt` получает JVM-реализации `BrowserLauncher`/`RedirectListener`, если `:cli` подключает эту ветку `feature-auth` (иначе — не трогается).
- `frontend-kt/plugins/android-studio/` — удаление локальных `ListProjectsUseCase`, `HttpProjectsClient`, `LoginController`, `AuthorizeUrlBuilder`, `LogoutUrlBuilder`, `LoopbackRedirectListener`; `ListDesignSystemsUseCase`/`GetDesignSystemTokensUseCase`/`HttpDesignSystemDataClient` сохраняются, но получают tenant-фильтрацию; новые зависимости в `build.gradle.kts`; новый tenant picker и действие "скопировать код" в UI (`TokenList.kt`, `MainScreen.kt`, `PluginRootScreen.kt`).
- `backend-kt/documentation-service` (`feature-publication`): `version` в `publications/active` необязателен (маршрут, репозиторий, тест, спека).
- Backend `db-service`: без изменений.
