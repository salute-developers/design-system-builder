## Context

`frontend-kt` построен по слоистому графу `core-*` → `feature-*` → клиентские приложения (`:cli`, `:mcp-node`, `:plugins:android-studio`), описанному в `frontend-kt/AGENTS.md`. Правило: `feature-*` — единственное место переиспользуемой бизнес-логики пользовательских возможностей; клиенты (`:cli`, `:mcp-node`, IDE-плагины) должны собираться поверх `feature-*`, а не дублировать её.

Плагин Android Studio (архивированный change `2026-09-10-android-studio-plugin-token-browser`) был первой итерацией и подключил только нижний слой (`core-domain`/`core-network`/`core-auth`/`core-application`), реализовав read-only проекты/дизайн-системы/токены и OAuth PKCE-авторизацию локально в `plugins/android-studio`. На момент этого change обнаружено:

- `GET /api/projects` (список проектов пользователя) — pre-context операция, которой сегодня не пользуется ни CLI, ни MCP (оба резолвят ровно один `ProjectContext` через `.sdds/config.json` или explicit link) — соответствующей `feature-*`-возможности просто не существует.
- `feature-theme`'s `TokenReadUseCases.values` читает значения одного токена за раз (`GET /api/projects/{id}/ds/tokens/{tokenId}/values`) — этот REST-контракт спроектирован под MCP-сценарий "агент уже знает `tokenId`" (см. `openspec/specs/design-system-model-api/spec.md`), а не под bulk-отображение списка. Плагину нужен один запрос на всю дизайн-систему (`GET /api/projects/{id}/ds/token-values`, как сейчас) — перенос на `TokenReadUseCases.values` создал бы N+1 запросов на каждый рендер списка токенов. Это обнаружилось только при реализации (см. решение 3) — изначально предполагалось, что `TokenReadUseCases` полностью покрывает и эту часть.
- `core-auth` уже содержит `PkceGenerator`, `TokenExchangeClient`, `UserSessionCredentialResolver`, `RefreshTokenStore` — по комментарию в коде специально для сценария IDE-плагина — но оркестрация флоу (`LoginController`, `AuthorizeUrlBuilder`, `LogoutUrlBuilder`, `LoopbackRedirectListener`) реализована только в плагине и использует JVM-only API (`com.sun.net.httpserver`, `java.net.URLEncoder`), то есть не `commonMain`-совместима как есть.
- `token_values.tenantId` существует в схеме и в `TokenValuesReadCommand`/MCP `token_values_get`, но плагин его никогда не читает — `GetDesignSystemTokensUseCase` молча схлопывает значения по `tokenId` без учёта tenant.
- Compose-ссылка на токен (`SddsServTheme.colors.textDefaultAccent`) уже известна генератору темы и сохраняется documentation-service как `themeReference` в CodeBinding `kind=token`; но `publications/active` требует точный `version`, которого плагин не знает.

## Goals / Non-Goals

**Goals:**
- Перенести дублирующуюся бизнес-логику плагина в переиспользуемый `feature-*` слой там, где паттерн доступа совпадает: список проектов (`feature-projects`, новый модуль), OAuth PKCE-логин (`feature-auth`, новый юзкейс).
- Добавить выбор tenant при просмотре токенов, когда у дизайн-системы их больше одного.
- Добавить копирование в буфер обмена code-ссылки на токен для платформы Android, основанное на CodeBinding опубликованной документации.

**Non-Goals:**
- Запуск или хостинг MCP-сервера из плагина — явно не делается в этом change.
- Перенос чтения токенов/значений дизайн-системы на `feature-theme`'s `TokenReadUseCases` — REST-контракт `values` per-token, не bulk; создал бы N+1 запросов (см. решение 3). Плагин сохраняет собственный bulk-клиент.
- Эвристики построения ссылки по имени токена: без опубликованного CodeBinding действие показывает «Нет ссылки».
- macOS (Kotlin/Native) реализация портов `BrowserLauncher`/`RedirectListener` для `:cli` — остаются нереализованными для этого таргета; ничего не блокирует, так как единственный сегодняшний потребитель OAuth PKCE — плагин (JVM-only).

## Decisions

### 1. `feature-projects` как новый модуль, а не метод в `core-application`

`core-application` сегодня содержит только порты разрешения контекста/credentials/URL и их адаптеры поверх `core-workspace`/`core-network` — ни одного REST-клиента к конкретному backend-ресурсу там нет. Список проектов пользователя (`GET /api/projects`) концептуально ближе к пользовательской возможности («какие проекты мне доступны») и не требует уже разрешённого `ProjectContext` — это ровно то, чем занимаются существующие `feature-*` модули, только на шаг раньше в жизненном цикле. Альтернатива (метод в `core-application`) потребовала бы, чтобы этот "чистый портов" модуль начал содержать конкретный Ktor-адаптер — нарушение его сегодняшнего характера и границы `api`/`implementation`, описанной в `frontend-kt/AGENTS.md`.

`feature-projects` зависит только от `core-network` и `core-auth` (credential resolution для account-scoped запроса, не project-scoped) — по правилу "не тянуть `core-*`, который не используется".

Отличие от `feature-status`/`feature-theme`: там порт (`ProjectAccessVerifier`, `TokenReadRemoteSource`) и его HTTP-адаптер — `internal`, а use case конструируется с `internal constructor`, потому что единственный сегодняшний потребитель — Koin-граф `:cli` (`get<XxxUseCase>()` видит `internal` тип внутри своего же модуля). У `feature-projects` единственный сегодняшний потребитель — `:plugins:android-studio`'s `PluginServices`, plain object без DI-контейнера: он не может собрать use case, чей конструктор принимает `internal`-порт. Поэтому `ProjectsClient`/`HttpProjectsClient` — `public` (это ровно тот случай, когда порт "реально пересекает границу модуля", см. правило видимости в `frontend-kt/AGENTS.md`), а `core-auth`/`core-network` — `api`, а не `implementation`, в `build.gradle.kts`.

### 2. OAuth PKCE — новый юзкейс в `feature-auth`, а не отдельный модуль

`feature-auth` уже владеет жизненным циклом пользовательской сессии (`LoginUseCase`/`AuthStatusUseCase`/`LogoutUseCase` для username/password через Direct Access Grant). Authorization Code + PKCE — второй способ получить тот же `UserOAuthTokens`/`UserSessionCredentialResolver`-based credential, не новая ответственность модуля. Все низкоуровневые примитивы уже в `core-auth`; в `feature-auth` добавляются:

- `commonMain`: порты `BrowserLauncher` (открыть URL в системном браузере) и `RedirectListener` (дождаться OAuth redirect на loopback), а также `LogoutUrlBuilder` — эти типы сами по себе платформенно нейтральны.
- `jvmMain`: use case-оркестратор (аналог `LoginController`), юзкейс тихого refresh (аналог `SessionRefresher`), `AuthorizeUrlBuilder` и JVM-реализация `RedirectListener` (`com.sun.net.httpserver`-based). Всё это — в `jvmMain`, а не `commonMain`, потому что транзитивно зависит от `core-auth`'s `PkceGenerator`/`PkcePair`, которые уже сами объявлены `jvmMain`-only в `core-auth` ("единственный сегодняшний потребитель PKCE — JVM-плагин"; обнаружено при реализации, не было явно в исходном design — изначально предполагалось, что в `commonMain` возможно вынести больше). Это общий `jvmMain`, доступный `:cli`'s JVM-таргету и плагину. `IdeBrowserLauncher` (обёртка над `BrowserUtil`) остаётся в плагине — это IntelliJ Platform-специфичный адаптер, не часть переиспользуемого слоя.

Альтернатива — оставить эту оркестрацию в плагине — была бы проще сейчас, но противоречит ADR-0004 (переиспользуемость будущими клиентами, включая другие IDE-плагины и `:desktop`) и оставила бы `core-auth`'s специально подготовленные порты недоиспользованными.

### 3. Токены дизайн-системы остаются на собственном bulk-клиенте плагина

Исходный план — переиспользовать `feature-theme`'s `TokenReadUseCases` вместо `ListDesignSystemsUseCase`/`GetDesignSystemTokensUseCase`/`HttpDesignSystemDataClient`, резолвя контекст через explicit-link ветку `ContextResolver` (`dsbuilder://projects/{id}/design-systems/{id}`), минуя `.sdds/config.json`. При реализации выяснилось: `TokenReadUseCases.values` читает значения ровно одного токена (`tokenId` — обязательный параметр команды), потому что backend-контракт, который он вызывает, специально спроектирован под MCP-сценарий "агент уже знает ID токена" (`openspec/specs/design-system-model-api/spec.md`, requirement "Project-scoped token read API"). У плагина токен заранее неизвестен — ему нужен весь каталог токенов дизайн-системы одним запросом, чтобы отрисовать прокручиваемый список с вкладками и поиском. Прямой перенос means вызывать `values()` по одному разу на каждый токен — при дизайн-системе на несколько сотен токенов это N+1 HTTP-запросов вместо одного, регрессия производительности и UX, а не рефакторинг.

Рассматривались три варианта: (1) оставить `ListDesignSystemsUseCase`/`GetDesignSystemTokensUseCase`/`HttpDesignSystemDataClient` в плагине без изменений; (2) добавить в `feature-theme` новый bulk-юзкейс/расширить backend-контракт под оба паттерна доступа; (3) частичный перенос — `TokenReadUseCases.list()` (design-system-scoped, один запрос, нормально ложится) переиспользовать, `values()` оставить bulk-локальным. Вариант (2) избыточен ради этого change — плагину не нужна новая переиспользуемая MCP-способность, а изменение публичного контракта `feature-theme` и/или backend-роута — отдельная по объёму работа. Вариант (3) не даёт регрессии производительности (общее число HTTP-запросов не меняется, список токенов даже становится точнее — design-system-scoped вместо project-wide + клиентская фильтрация), но вносит неоднородность: два параллельных способа читать данные дизайн-системы в одном модуле (`ContextResolver`/`RuntimeRequest`/`JsonElement`-конверт для списка против `AuthenticatedApiClient`/сырого массива для значений). Выбран вариант (1): `ListDesignSystemsUseCase`/`GetDesignSystemTokensUseCase`/`HttpDesignSystemDataClient` остаются в плагине без изменений в части транспорта — это не дублирование переиспользуемой возможности (её для bulk-доступа просто не существует), а оправданно другой паттерн доступа к тому же backend. Единственная доработка — научить `GetDesignSystemTokensUseCase` фильтровать по `tenantId` (решение 4).

### 4. Tenant picker: клиентская эвристика "один tenant = дефолт"

Backend не хранит флаг "дефолтный tenant". Плагин запрашивает `GET /api/tenants`, фильтрует по `designSystemId` на клиенте и показывает шаг выбора tenant только когда результат содержит больше одного элемента — иначе выбирает единственный автоматически (тот же паттерн, что уже описан в `ide-plugin-token-browser` для единственного проекта/дизайн-системы). Выбранный `tenantId` передаётся в `GetDesignSystemTokensUseCase` (плагиновский bulk-клиент, решение 3), устраняя сегодняшнее молчаливое схлопывание значений по нескольким tenant; для этого `HttpDesignSystemDataClient`/`TokenValueDto` должны начать разбирать поле `tenantId` из ответа `/api/token-values`, которое сегодня не читается вовсе.

### 4a. Tenant и code-ссылка живут в `feature-theme`

Изначально `ListTenantsUseCase` и логика code-ссылки были написаны в плагине; ревью на соответствие clean architecture показало, что это бизнес-логика в клиентском приложении (AGENTS.md: клиент только компонует `feature-*`). Они перенесены в `feature-theme`: `ListDesignSystemTenantsUseCase` (design-system-scoped `GET /api/projects/{id}/ds/design-systems/{dsId}/tenants` вместо общего `GET /api/tenants` — сервер сам фильтрует), порт/адаптер публичные (плагин без Koin), Koin-регистраций нет. В плагине остались платформенные адаптеры (`ClipboardCopier`) и компоновка в `PluginServices`; UI получает use case параметром. Retry на `401` — общий `retryOnceAfterRefresh` в `PluginServices`. Code-ссылка: см. решение 5.

### 5. Code-ссылка на токен — из CodeBinding опубликованной документации, по нажатию

Исходный план строил ссылку `<alias>Theme.<category>.<tokenName>`, где `alias` брался из локального `.sdds/config.json` (`dsbuilder theme alias set`). От него отказались: он зависит от локального проекта в IDE и ручной настройки, а сама формула оказалась неверной — в имени токена точки (`text.default.accent`), а в теме accessor в camelCase (`textDefaultAccent`).

Ссылку уже знает генератор темы: в артефакте `theme-info` (Compose) у каждого токена есть `themeReference` (`SddsServTheme.colors.textDefaultAccent`, `…gradients…`, `…shadows…`, `…typography…`), а documentation-service сохраняет его в платформенном payload CodeBinding `kind=token` (subject `tokens.<name>`). Плагин запрашивает его **по нажатию на конкретный токен**: `GET /documentation/publications/active?designSystemId&platform=compose` → `GET …/publications/{id}/bindings?kind=token&subject=…&limit=1`. Поиск идёт по точному `subject`, а не по `name` (`name` — подстрока по displayName и возвращает лишнее). У токенов, зависящих от темы, в subject есть режим (`tokens.light.text.default.accent`, `tokens.dark.…`), у остальных нет (`tokens.spacing.4x`) — перебираются `tokens.<режим>.<имя>` и `tokens.<имя>`; у обоих режимов `themeReference` одинаковый. У `fontFamily` `themeReference` — `null`, ссылки нет.

`publications/active` требовал точный `version` (у active pointer ключ — design system, version, platform), а плагин версию не знает. Рассматривались: сделать `version` необязательным на backend (выбрано), выбор версии в плагине (лишний экран и API списка публикаций), жёсткая версия (не для реальных данных). В documentation-service `version` необязателен: без него отдаётся последняя по `publishedAt` active publication для (design system, platform) — это изменение контракта чтения, описано в delta-спеке `documentation-publication-reading`.

Логика живёт в `feature-theme` (`GetTokenCodeReferenceUseCase`, `HttpTokenCodeReferenceClient`, порт публичный по той же причине, что и остальные — плагин без Koin); плагин показывает статус на самой кнопке (загрузка / скопировано / нет ссылки / ошибка). `.sdds/config.json`, `ResolveTenantAliasUseCase`, `WorkspaceFileSystem` и зависимость плагина на `core-workspace` удалены. Действие видно только на Android (публикация — платформы `compose`).

## Risks / Trade-offs

- [`feature-auth`'s новые JVM-only порты в `jvmMain` не имеют macOS-реализации — если `:cli`'s macOS-таргет когда-нибудь подключит эту ветку, сборка не соберётся без отдельной работы.] → Не блокирует этот change (macOS-таргет её не подключает), явно зафиксировано как Non-Goal.
- [Добавление фильтрации по `tenantId` в `GetDesignSystemTokensUseCase` меняет поведение "выбора значения без разбивки по tenant" (сегодня — молчаливое `firstOrNull`) на явную фильтрацию — для дизайн-систем с несколькими tenant результат может отличаться от сегодняшнего.] → Явный tenant picker (решение 4) делает выбор осознанным, а не неявным как раньше; сравнить поведение на дизайн-системе с несколькими tenant до и после в рамках проверки (в dev-сидах `db-service` `sdds_cs`/`sdds_serv` описаны как tenant дизайн-системы SDDS, но по данным пользователя это отдельные дизайн-системы — сиды нужно сверить с реальной моделью).

- [Code-ссылка доступна, только если для дизайн-системы опубликована документация с `THEME_INFO` (Compose).] → Без публикации плагин честно показывает «Нет ссылки», а не подставляет догадку. Локально публикация делается `dsbuilder docs publish` (бандл с `meta/theme-info.json`).
- [Изменение контракта `publications/active`: без `version` возвращается последняя по `publishedAt` публикация.] → Точный `version` по-прежнему работает как раньше; поведение без `version` покрыто тестом маршрута и спекой.

## Open Questions

- Нужно ли кэшировать `publicationId`/найденные ссылки в плагине (сейчас каждый клик — 2–3 запроса) — решим по факту использования.
