## 1. `feature-projects`: новый модуль

- [x] 1.1 Создать модуль `frontend-kt/feature-projects` (convention.feature-module), зарегистрировать в `frontend-kt/settings.gradle.kts`
- [x] 1.2 Определить порт `ProjectsClient` и модель `Project` (id, name, description) в `application`/`domain`
- [x] 1.3 Реализовать `ListProjectsUseCase` поверх `ProjectsClient`
- [x] 1.4 Реализовать `HttpProjectsClient` (`data`) поверх authenticated HTTP client из `core-network`, вызывающий `GET /api/projects`
- [x] 1.5 Добавить `ProjectsApplicationModule.kt` (Koin wiring use case + адаптера)
- [x] 1.6 Тесты: `ListProjectsUseCase` (пустой список — не ошибка), `HttpProjectsClient` (успех, разбор ответа, ошибка)
- [x] 1.7 Настроить `build.gradle.kts`: зависимости `core-network`, `core-auth` (api/implementation по правилу видимости из `frontend-kt/AGENTS.md`)

## 2. `feature-auth`: Authorization Code + PKCE

- [x] 2.1 В `commonMain` `feature-auth` добавить порты `BrowserLauncher` и `RedirectListener` (сигнатуры — как в текущем `plugins/android-studio/auth`)
- [x] 2.2 В `jvmMain` `feature-auth` добавлен `OAuthLoginUseCase` (аналог `LoginController`): PKCE + `state` → `BrowserLauncher.browse` → `RedirectListener.awaitCallback` → `TokenExchangeClient.exchangeAuthorizationCode` → `UserSessionCredentialResolver.applyTokens`, плюс `OAuthLogoutUseCase` (аналог `logout()`); оба блокирующее ожидание оборачивают в `withContext(ioDispatcher)`, как это делал `LoginController`
- [x] 2.3 В `jvmMain` добавлен `RefreshUserSessionUseCase` (аналог `SessionRefresher`) поверх `TokenExchangeClient.refresh` и `UserSessionCredentialResolver`
- [x] 2.4 Добавить `LogoutUrlBuilder` (commonMain, чистый Kotlin без `java.net.URLEncoder`) и `AuthorizeUrlBuilder` (`jvmMain` — принимает `PkcePair`, который сам `jvmMain`-only в `core-auth`); юзкейс логаута (открыть end-session endpoint, очистить локальную сессию) — `jvmMain`
- [x] 2.5 В `jvmMain` `feature-auth` (source set уже существует через `convention.kotlin-multiplatform-module`'s `jvm()` таргет) перенести `LoopbackRedirectListener` (`com.sun.net.httpserver`) как `JvmLoopbackRedirectListener` — JVM-реализацию `RedirectListener`
- [x] 2.6 ~~Добавить `OAuthApplicationModule.kt` (Koin wiring)~~ — пропущено: единственный сегодняшний потребитель (плагин) не использует Koin (`PluginServices` — plain object), а `:cli` не подключает эту ветку (см. Non-Goals в design.md); Koin-модуль без потребителя не добавляется, use case конструируется вручную в `PluginServices` (задача 3.3)
- [x] 2.7 Тесты (перенести/адаптировать из `plugins/android-studio/src/test`): `AuthorizeUrlBuilderTest`, `OAuthLoginUseCaseTest`/`OAuthLogoutUseCaseTest` (переименовано под новые use case), `JvmLoopbackRedirectListenerTest`, плюс новый `RefreshUserSessionUseCaseTest`
- [x] 2.8 `build.gradle.kts` `feature-auth` не потребовал изменений — `jvm()` таргет и зависимости на `core-auth`/`core-network` уже были объявлены; новых внешних зависимостей не добавлено

## 3. Плагин: переиспользование `feature-projects`/`feature-auth`

`feature-theme` в этот список не входит — см. design.md, решение 3: единственный аналог bulk-чтения токенов там читает по одному `tokenId` за раз (N+1 для списка), поэтому `ListDesignSystemsUseCase`/`GetDesignSystemTokensUseCase`/`HttpDesignSystemDataClient` остаются в плагине как есть, без переноса транспорта.

- [x] 3.1 Добавить в `plugins/android-studio/build.gradle.kts` зависимости `feature-projects`, `feature-theme`, `feature-auth` (`core-workspace` не нужен — alias/`.sdds/config.json` не используются)
- [x] 3.2 Удалить `plugins/android-studio/.../projects/HttpProjectsClient.kt`, `Project.kt` (`Project`/`ProjectsClient`/`ListProjectsUseCase`); `PluginServices.listProjects()` — тонкая обёртка над `feature-projects`'s `ListProjectsUseCase` с retry-on-401 через `refreshUserSession` (у `feature-projects` нет своего retry, в отличие от `AuthenticatedApiClient`)
- [x] 3.3 Удалить `plugins/android-studio/.../auth/LoginController.kt` (там же был `SessionRefresher`), `AuthorizeUrlBuilder.kt`, `LogoutUrlBuilder.kt`, `LoopbackRedirectListener.kt`, локальный порт `BrowserLauncher.kt`; `PluginServices.oauthLogin`/`oauthLogout`/`refreshUserSession` собираются из `feature-auth`, `IdeBrowserLauncher` теперь реализует `feature-auth`'s `BrowserLauncher`. `PluginRootScreen` сам держит `LoginUiState` (use case'ы `feature-auth` — простые suspend-функции без своего `StateFlow`, в отличие от старого `LoginController`)
- [x] 3.4 Оставить `PasswordSafeRefreshTokenStore` и `IdeBrowserLauncher` в плагине как IDE-специфичные реализации портов `RefreshTokenStore`/`BrowserLauncher` из `core-auth`/`feature-auth`
- [x] 3.7 Удалены `LoginControllerTest`, `AuthorizeUrlBuilderTest`, `LoopbackRedirectListenerTest`, `HttpProjectsClientTest`, `ListProjectsUseCaseTest`; `HttpDesignSystemDataClientTest` остался, поправлен под `RefreshUserSessionUseCase` вместо удалённого `SessionRefresher`. `:plugins:android-studio:test`/`:detekt` — зелёные

## 4. Выбор tenant

- [x] 4.1 `ListDesignSystemTenantsUseCase`/`HttpDesignSystemTenantsClient` в `feature-theme` (design-system-scoped `.../design-systems/{dsId}/tenants`, сервер фильтрует); в плагине только вызов через `PluginServices.listTenants` (перенесено из плагина после ревью архитектуры, см. design.md 4a)
- [x] 4.2 Добавить шаг `Step.PickTenant` в `MainScreen` (между дизайн-системой и платформой): автоматический выбор при одном tenant, пикер при нескольких (тот же паттерн `replaceCurrent`, что у единственного проекта/дизайн-системы)
- [x] 4.3 Добавлены `tenantId` в `TokenValueDto`/`TokenValue` и параметр `tenantId` в `GetDesignSystemTokensUseCase.execute()`; значения фильтруются по нему вместо прежнего `firstOrNull` без учёта tenant
- [x] 4.4 Тесты: `HttpDesignSystemTenantsClientTest` (путь, разбор, 401/битое тело) в `feature-theme`; `GetDesignSystemTokensUseCaseTest.excludesValueForAnotherTenant` в плагине. Зелёные

## 5. Копирование code-ссылки на токен (CodeBinding)

- [x] 5.1 Backend: `publications/active` в documentation-service принимает запрос без `version` (последняя по `publishedAt`): маршрут, `PublicationReadRepository`/`ExposedPublicationReadRepository`, тест `missingVersionResolvesLatestActivePublication`, delta-спека `documentation-publication-reading`; `:feature-publication:build` зелёный, контур пересобран (`start-local.sh --detach`, перезапуск gateway)
- [x] 5.2 `feature-theme`: `GetTokenCodeReferenceUseCase` (subject-кандидаты `tokens.<режим>.<имя>`, `tokens.<имя>`, платформа по умолчанию `compose`), порт `TokenCodeReferenceClient`, `HttpTokenCodeReferenceClient` (`publications/active` → `bindings?kind=token&subject=…&limit=1` → `platformPayload.themeReference`); `NotAvailable` при 404/пустом биндинге/`null`
- [x] 5.3 Плагин: `PluginServices.tokenCodeReference` (с retry на 401), действие «Копировать код» в `TokenRow` — запрос по нажатию, статусы на кнопке (загрузка/скопировано/нет ссылки/ошибка), только на Android; `ClipboardCopier` остаётся платформенным адаптером
- [x] 5.4 Удалены alias-подход и локальный конфиг: `ResolveTenantAliasUseCase`, `ThemeCodeReferenceBuilder`, `ReadOnlyJvmWorkspaceFileSystem`, `projectBasePath` в UI, зависимость плагина на `core-workspace`
- [x] 5.5 Тесты: `HttpTokenCodeReferenceClientTest` (по режиму, fallback на subject без режима, нет публикации/биндинга, `themeReference = null`, 401) и `GetTokenCodeReferenceUseCaseTest` (порядок subject, платформа, без сессии) в `feature-theme`
- [x] 5.6 Локально проверено на реальных данных: опубликован `sdds_serv` (theme-info из plasma-android), биндинги отдают `SddsServTheme.colors.textDefaultAccent`, `…spacing.spacing4x`, `…typography.displayLNormal`, `…shadows.downSoftS`

## 6. Верификация

- [x] 6.1 `cd frontend-kt && ./gradlew build --continue` — единственное падение во всём composite build: `:core-network:compileTestKotlinJs` (`KtorTokenExchangeClientTest.kt` использует `runBlocking` на JS-таргете, где его нет) — **до этой сессии существовавшая поломка**, подтверждено `git status`/`git log` (последний коммит по файлу — `ee8d7a7`, до начала работы над этим change; `core-network` в этой сессии не менялся). Вне периметра этого change, не исправлялось. Всё остальное, включая `feature-projects`, `feature-auth`, `:plugins:android-studio`, `:cli` — зелёное
- [x] 6.2 `spotlessApply` понадобился один раз (порядок импортов в `AuthenticatedApiClient.kt`); после — `detekt`/`spotlessCheck` зелёные для всех затронутых модулей
- [x] 6.3 `:cli:jvmTest` — зелёный, composition root `:cli` не сломан переносом `feature-auth`/`feature-projects`
- [x] 6.4 Ручная проверка в Android Studio выполнена пользователем на локальном контуре (в т.ч. фризы списка цветов устранены переходом на LazyColumn): логин через браузер, список проектов, дизайн-систем, tenant picker на дизайн-системе с несколькими tenant, копирование code-ссылки для токена на платформе Android (`SddsServTheme.colors.textDefaultAccent`), статус «Нет ссылки» для токена без биндинга/`fontFamily`. Запуск: `DSBUILDER_API_URL=http://localhost:8080 ./gradlew :plugins:android-studio:runIde`
