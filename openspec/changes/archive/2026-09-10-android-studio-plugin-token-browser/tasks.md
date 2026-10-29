## 1. Keycloak: клиент для нативных/IDE-клиентов

- [x] 1.1 Добавить публичного клиента `dsbuilder-studio-plugin` в `backend-kt/identity-gateway/keycloak/dsbuilder-realm.json`: `publicClient=true`, `standardFlowEnabled=true`, `directAccessGrantsEnabled=false`, обязательный PKCE (`pkce.code.challenge.method=S256`), `redirectUris` для loopback (`http://127.0.0.1:*`)
- [x] 1.2 Добавить тот же protocol mapper `oidc-audience-mapper` (`included.client.audience=dsbuilder-api`), что и у клиента `dsbuilder-api`, к новому клиенту
- [x] 1.3 Расширить `backend-kt/identity-gateway/keycloak/bootstrap-production-keycloak.sh` вторым идемпотентным блоком (create-or-update по образцу существующего блока `dsbuilder-api`): публичный клиент `dsbuilder-studio-plugin` (`publicClient=true`, `standardFlowEnabled=true`, `directAccessGrantsEnabled=false`, `redirectUris=["http://127.0.0.1:*"]`, PKCE `S256`) вместе с его собственным `oidc-audience-mapper` (`included.client.audience=dsbuilder-api`). `dsbuilder-realm.prod.json` не трогается — прод-клиенты заводятся этим скриптом через Keycloak Admin API, а не realm-импортом (там нет даже `dsbuilder-api`)
- [x] 1.4 Поднять локальный контур (`./setup-local.sh`) и вручную проверить только на нём (не на staging/prod): authorization code + PKCE через `dsbuilder-studio-plugin` выпускает access token с `aud=dsbuilder-api`, и запрос к защищённому эндпоинту gateway с этим токеном проходит `KeycloakJwtVerifier`
- [x] 1.5 Проверка: `cd backend-kt/identity-gateway && ./gradlew build`
- [x] 1.6 Изменения в `bootstrap-production-keycloak.sh` (1.3) на этом этапе не запускаются против реального прод-Keycloak — скрипт проверяется чтением/статически (та же idempotent create-or-update структура, что и у существующего блока `dsbuilder-api`); фактическое исполнение произойдёт при следующем прод-деплое стека, вне рамок этого изменения

## 2. core-auth: пользовательская OAuth-сессия

- [x] 2.1 Добавить в `core-auth` доменную модель пользовательской OAuth-сессии (access token в памяти, ссылка на refresh token) как второй тип credential рядом с `ApiKeyResolver`
- [x] 2.2 Добавить утилиту генерации PKCE `code_verifier`/`code_challenge` (S256) в `core-auth`
- [x] 2.3 Добавить port-интерфейс обмена токенов (`authorization_code` и `refresh_token` grants к `/auth/token`) в `core-auth` (`TokenExchangeClient`) и его Ktor-реализацию в `core-network` (`KtorTokenExchangeClient`) — по образцу существующего разделения `AuthenticatedHttpClient`/`KtorAuthenticatedHttpClient`, а не пакетами `application`/`data`, которых на уровне `core-*` модулей нет (это деление применяется только внутри `feature-*` модулей)
- [x] 2.4 Добавить тесты на генерацию PKCE-пары и на разбор ответа обмена токенов (fake порта, без реального HTTP)

## 3. core-network: поддержка Bearer-авторизации

- [x] 3.1 Расширить `KtorAuthenticatedHttpClient`/его фабрику поддержкой источника credential "пользовательская OAuth-сессия", устанавливающего заголовок `Authorization: Bearer <access-token>` (новый sealed `AuthenticatedHttpCredential` — `ProjectKey`/`Bearer`; существующая `AuthenticatedHttpClientFactory.create(apiUrl, apiKey)`, которой пользуются 16 файлов в `feature-*`/`cli`, не менялась — она осталась тонкой обёрткой над `ProjectKey`)
- [x] 3.2 Добавить тесты, подтверждающие: поведение `ProjectKey`-авторизации не изменилось; `Bearer`-заголовок формируется корректно для пользовательской сессии

## 4. frontend-kt: новый тип модуля для IDE-плагина

- [x] 4.1 Добавить Gradle convention plugin `convention.intellij-platform-module` в `frontend-kt/build-system/conventions` (обёртка над IntelliJ Platform Gradle Plugin, таргет `androidStudio(...)`). Требует Java 17 (jvmTarget поднят до 17 только в этом конвеншене — остальные держат 1.8)
- [x] 4.2 Зарегистрировать модуль `:plugins:android-studio` в `frontend-kt/settings.gradle.kts` (плюс settings-плагин `org.jetbrains.intellij.platform.settings` и `intellijPlatform { defaultRepositories() }` в `dependencyResolutionManagement`)
- [x] 4.3 Подключить в `:plugins:android-studio` зависимости `project(":core-domain")`, `project(":core-network")`, `project(":core-auth")`, `project(":core-application")` и `io.github.salute-developers:sdds-serv-compose` из Maven Central. Уточнение по факту: реально опубликованная последняя версия — `0.43.0`, не `0.44.0` (тот номер был незарелиженным bump в рабочем дереве `plasma-android`, легаси-поиск `search.maven.org` первоначально не находил пакет вообще — реальный индекс `repo1.maven.org/.../maven-metadata.xml` подтвердил `0.43.0` как `release`)
- [x] 4.4 Spike: пустой модуль собирается и запускается (`buildPlugin`) — выполнено headless, без реально установленной Android Studio: IntelliJ Platform Gradle Plugin сам скачивает нужный IDE-дистрибутив через `intellijPlatform { defaultRepositories() }`. Два реальных открытых вопроса закрыты эмпирически:
  - **Версия IntelliJ Platform Gradle Plugin**: актуальная `2.18.1` конфликтует — её транзитивный `kotlin-stdlib:2.4.0` не совместим с Kotlin `2.2.0`, которым собираются precompiled script plugins в `build-system/conventions` (`Module was compiled with an incompatible version of Kotlin`). `2.11.0` (та же, что использовал прежний прототип `sdds-studio-plugin`) собирает пустой модуль чисто, но в группе 5 обнаружилось, что она несовместима с `org.jetbrains.kotlin.plugin.compose` — `IntelliJPlatformBasePlugin` падает с `NoClassDefFoundError: org/jetbrains/kotlin/gradle/tasks/KotlinCompile` при апдейте плагина. Итоговая рабочая версия — `2.17.0`: не конфликтует по Kotlin-метаданным и корректно работает с compose-compiler плагином.
  - **Версия Android Studio**: `androidStudio("2024.3.2.15")` (сборка `243.*`) подтверждена рабочей. Изначальная попытка `261.x`/`2026.1.2.10` (по мотивам манифеста старого прототипа) не резолвилась ни на `dl.google.com`, ни в остальных `defaultRepositories()` — конкретный маппинг build-number → version string для 261 не подтверждён, пока используется заведомо рабочая более ранняя версия; выбор целевого билда для реального релиза — отдельная задача, не блокирует эту версию.
  `runIde` (реальный GUI-запуск IDE) не выполнялся в этой headless-среде без дисплея — `buildPlugin` подтверждает то же самое (валидный `plugin.xml`, корректная сборка distributable), `runIde` стоит проверить на машине с дисплеем перед реальным релизом.
- [x] 4.5 Проверка: `cd frontend-kt && ./gradlew build` (полный билд, включая `:plugins:android-studio`, `:cli` и все `feature-*` — зелёный, без регрессий)

## 5. Плагин: авторизация пользователя

- [x] 5.1 Реализовать loopback HTTP-listener на `127.0.0.1:{эфемерный порт}` для приёма OAuth redirect (`code`, `state`) — `LoopbackRedirectListener`/`RedirectListener` (интерфейс выделен для тестируемости `LoginController` без реального сокета)
- [x] 5.2 Реализовать построение authorize URL (`/realms/dsbuilder/protocol/openid-connect/auth`, `code_challenge`, `state`) и открытие системного браузера — `AuthorizeUrlBuilder`, `BrowserLauncher`/`IdeBrowserLauncher` (`BrowserUtil.browse`)
- [x] 5.3 Реализовать `LoginUiState` (Idle/Loading/Error) и use case входа, использующий OAuth-резолвер из `core-auth` — `LoginController` (PKCE + state + loopback + обмен токенов, оркестрация через `StateFlow<LoginUiState>`)
- [x] 5.4 Реализовать хранение refresh token через `PasswordSafe` (data-адаптер), access token — только в памяти — `PasswordSafeRefreshTokenStore`
- [x] 5.5 Реализовать тихое обновление access token по `401` через `grant_type=refresh_token`, со сбросом сессии при неудаче — `SessionRefresher`
- [x] 5.6 Реализовать `LoginScreen` (Compose): idle/loading/error состояния, кнопка "Войти в DS Builder" без полей логина/пароля, корректное поведение в узком/низком tool window (Column + verticalScroll). Keyboard-доступность и фактическое поведение в узком/низком tool window не проверялись рантаймом (headless-среда без дисплея, `runIde` не выполнялся) — полагается на стандартную focus/click-семантику `Button` из `uikit-compose`; стоит подтвердить визуально на машине с Android Studio перед релизом
- [x] 5.7 Тесты: переходы `LoginUiState`, валидация `state` при получении redirect, обработка отменённого/ошибочного flow — `LoginControllerTest` (5 сценариев), `AuthorizeUrlBuilderTest`, `LoopbackRedirectListenerTest` (реальный HTTP round-trip на ephemeral-порту)

## 6. Плагин: tool window и тема

- [x] 6.1 Реализовать `plugin.xml`: id, name, vendor, `depends: com.intellij.modules.platform`, диапазон `since-build`/`until-build`, регистрация tool window `SDDS` (правый докинг). `since-build`/`until-build` патчатся автоматически из `intellijPlatform.pluginConfiguration.ideaVersion` в build.gradle.kts (задачa `patchPluginXml`), не хардкожены в самом XML
- [x] 6.2 Реализовать `SddsToolWindowFactory`, встраивающий `ComposePanel` в содержимое tool window — плюс `PluginServices` (композиционный корень: `HttpClient(CIO)`, `KtorTokenExchangeClient`, `UserSessionCredentialResolver`, `LoginController`), чтобы tool window показывал реальный `LoginScreen` из группы 5, а не заглушку
- [x] 6.3 Реализовать мост темы IDE → `SddsServTheme` (bright IDE → `lightSddsServColors()`, non-bright → `darkSddsServColors()`) — `StudioTheme`/`studioColors` (чистая функция, не завязана на Compose/IntelliJ рантайм)
- [x] 6.4 Тесты моста темы для обоих состояний IDE (bright/non-bright) — `StudioThemeTest`

## 7. Плагин: просмотр проектов, дизайн-систем и токенов

- [x] 7.1 **Обнаружено при реализации**: `GET /ds/tokens` и `GET /ds/token-values` в `db-service` не были скоуплены по дизайн-системе проекта (в отличие от уже скоупленного `GET /ds/design-systems`) — любой актор видел токены всех дизайн-систем. Исправлено: `designSystemScopeFilter` применён к обоим `GET /` через `inArray`-подзапросы (`js/services/db-service/src/routes/api/tokens.ts`, `token-values.ts`). `GET /:id` и мутации сознательно не тронуты — вне вызовов плагина, отдельный pre-existing gap
- [x] 7.2 Тесты скоупинга (`tokens-scope.test.ts`, vitest + реальный Postgres): с `X-Project-Id` виден только свой проект, `system-admin` видит всё, без заголовка фильтр не применяется (сохранённое поведение для internal/admin вызовов). `npm run build` и `npx vitest run` в `db-service` — зелёные (54/54)
- [x] 7.3 Реализовать use case и port получения списка проектов (`GET /api/projects`) через `core-network` — `ProjectsClient`/`ListProjectsUseCase`/`HttpProjectsClient`. Общая часть (`AuthenticatedApiClient`) переиспользуется группой 7.4: Bearer-запрос через `core-network` + одна тихая попытка `SessionRefresher.refresh()` на `401` (замыкает недоделанный кусок группы 5). Заодно `AuthenticatedHttpResult.Failure` в `core-network` получил `statusCode: Int`, чтобы отличать `401` от прочих отказов не строковым разбором `message` (обновлён и существующий тест на этот тип)
- [x] 7.4 Реализовать use case и port получения токенов и значений токенов выбранного проекта/дизайн-системы/версии/платформы (`GET /api/projects/{projectId}/ds/tokens`, `GET /api/projects/{projectId}/ds/token-values`) — `DesignSystemDataClient`/`HttpDesignSystemDataClient`/`GetDesignSystemTokensUseCase` (плюс `ListDesignSystemsUseCase` для `GET /api/projects/{projectId}/ds/design-systems`, нужного для пикера). Склейка tokens+token-values по `tokenId`+`platform` — на клиенте, REST их не соединяет
- [x] 7.5 Реализовать `ProjectPicker`/`DesignSystemPicker`/`PlatformPicker` composables — единый `PickerList` (вертикальный список, не dropdown: надёжнее в узком/низком tool window), платформа подсказывается порядком (`ANDROID` первым), но не выбирается автоматически
- [x] 7.6 Реализовать `TokenList` composable — группировка по типу токена, превью по типу: `COLOR` — цветной swatch (best-effort разбор `#RRGGBB`/`#AARRGGBB` из raw JSON-значения, иначе просто текст), остальные типы — raw-значение текстом (единой предметной модели `value` jsonb под каждый тип сегодня нет)
- [x] 7.7 Реализовать явный empty state для пользователя без доступных проектов — `EmptyProjectsState`
- [x] 7.8 Убедиться, что ни один код плагина не создаёт `.sdds` и не пишет файлы в открытый проект — проверено: модуль не зависит от `core-workspace` (единственный источник файловых портов), grep по `write*/File(...)/.sdds` в `src/main` не находит ничего, кроме случайных совпадений с `SddsServTheme`
- [x] 7.9 Тесты use case'ов получения проектов и токенов (fakes портов) и мапперов ответа API в доменные модели — `ListProjectsUseCaseTest`, `ListDesignSystemsUseCaseTest`, `GetDesignSystemTokensUseCaseTest` (join-логика), `HttpProjectsClientTest`, `HttpDesignSystemDataClientTest` (MockEngine, JSON→domain маппинг, enum-парсинг)

## 8. Итоговая проверка

Все проверки, требующие живого бэкенда (auth, REST, сквозной прогон), выполняются исключительно на локальном контуре (`./setup-local.sh` из корня репозитория), а не на staging/prod-окружении. Gradle-проверки (8.1-8.2) статические и локального контура не требуют.

- [x] 8.1 `cd frontend-kt && ./gradlew build` (339 задач, включая `:core-auth`, `:core-network`, `:plugins:android-studio`, detekt и spotless через конвеншены) — зелёный
- [x] 8.2 `cd backend-kt/identity-gateway && ./gradlew build` — зелёный
- [x] 8.3 Поднят локальный контур (`./setup-local.sh`). Тестовый проект создан через реальный `POST /api/projects` от имени `user@example.com` (OAuth-сессия, тот же PKCE-флоу, что и у плагина) — создатель проекта автоматически становится owner, отдельно добавлять участником не потребовалось. У проекта не было собственной дизайн-системы — виден "base" (`projectId: null`), с реальными сидовыми токенами (1335 штук, все 7 типов)
- [x] 8.4 Сквозной прогон **данных** выполнен напрямую через REST теми же запросами, что делает код плагина (`GET /api/projects`, `.../ds/design-systems`, `.../ds/tokens`, `.../ds/token-values`). Это нашло и закрыло два реальных бага, которые не ловились fixture-тестами с "удобными" данными:
  - `Json` по умолчанию не игнорирует лишние поля (`ignoreUnknownKeys=false`) — реальные ответы backend'а (`status`, `ownerUserId`, `createdAt`, …) валили разбор на первом же вызове. Добавлен общий `ApiJson` (`ignoreUnknownKeys=true`) в `HttpProjectsClient`/`HttpDesignSystemDataClient`
  - `token_values.value` (jsonb) реально приходит как массив с одним элементом (`["#F5F5F5F5"]`), а не голым примитивом — `parseHexColor` никогда не сработал бы. `HttpDesignSystemDataClient` теперь разворачивает одноэлементный `JsonArray` перед тем как отдавать `rawValue`
  - Пустое состояние подтверждено реальными данными: `user2@example.com` (тот же seed) видит `GET /api/projects` → `[]`
  - Все 7 значений `type` токена и все 3 значения `platform` из реальных данных совпали с `TokenType`/`TokenPlatform` без исключений
  - После фиксов — полный прогон юнит/интеграционных тестов зелёный (группа 8.1)
- [x] 8.5 Локальный контур остановлен (`./setup-local.sh --down`)
- [x] 8.6 **Уточнение задним числом**: среда оказалась не headless — у машины есть реальный дисплей, и `./gradlew :plugins:android-studio:runIde` действительно поднимает настоящее окно Android Studio (изолированный sandbox, скачанный IntelliJ Platform Gradle Plugin, а не установленный `/Applications/Android Studio.app`). Запущено по просьбе пользователя, чтобы увидеть UI глазами — и это нашло ещё два реальных бага, которых не было в headless/REST-проверке:
  - Клик по tool window `SDDS` падал с `LibraryLoadException: Cannot find libskiko-macos-arm64.dylib.sha256`. Явные зависимости `org.jetbrains.compose.*:*-desktop` тянут API skiko (`skiko-awt`) транзитивно, но не платформенный native-рантайм — это обычно добавляет `compose.desktop.currentOs` из Gradle-плагина `org.jetbrains.compose`, который здесь сознательно не подключён (см. design.md, конфликт с IntelliJ Platform Gradle Plugin). Добавлены явные `runtimeOnly` на `org.jetbrains.skiko:skiko-awt-runtime-{macos-arm64,macos-x64,windows-x64,linux-x64}:0.9.4.2` (версия сверена через POM `ui-desktop:1.8.2`) — на всех четырёх платформах сразу, а не только под машину, где шла проверка
  - После входа через реальный браузер кнопка логина зависала с ошибкой "Token exchange response could not be parsed." — третий случай того же класса бага, что и в 8.4 (`ignoreUnknownKeys`), на этот раз в `KtorTokenExchangeClient` (`core-network`): реальный ответ `/auth/token` от Keycloak несёт `token_type`, `id_token`, `refresh_expires_in`, `scope`, `session_state`, `not-before-policy` сверх ожидаемых полей. Добавлен `ignoreUnknownKeys=true`, плюс regression-тест с полной формой реального ответа
  - После обоих фиксов: полный визуальный прогон пройден руками пользователя — логин через системный браузер, выбор проекта → `base` → `android`, список цветовых токенов со swatch'ами отрисовался корректно
  - По итогам визуальной проверки пользователь заметил: после успешного входа при перезапуске процесса плагина снова показывался экран логина, хотя refresh token уже сохранён в `PasswordSafe`. `SessionRefresher` (5.5) был реализован, но использовался только для retry на `401`, не при открытии tool window. Добавлена попытка тихого восстановления сессии в `PluginRootScreen` при старте — если сохранённый refresh token есть, пользователь видит короткий `Loading`, а не кнопку "Войти"

## 9. Итерации UX по итогам продолжительного визуального тестирования

Пользователь продолжил гонять реальный `runIde` уже после формального завершения групп 1-8 и нашёл ещё
россыпь настоящих UX-проблем и один пробел в rurime-логике. Каждая правка прогонялась через
`./gradlew :plugins:android-studio:build` (detekt/spotless/тесты) и визуально через пересобранный `runIde`.

- [x] 9.1 Навигация `MainScreen`: добавлены хлебные крошки (`Breadcrumbs`) с возможностью вернуться на
  предыдущий шаг; шаг выбора проекта/дизайн-системы автоматически пропускается (без явного шага в
  хлебных крошках), если доступен только один вариант — раньше единственный проект всё равно нужно
  было явно выбрать кликом
- [x] 9.2 `TokenList`: добавлены вкладки по типу токена (`Tabs`/`TabItem` из `sdds-uikit-compose`,
  `TabsClip.Scroll` — вкладки прокручиваются, если не помещаются) и поиск по имени токена внутри
  вкладки (`TextField`). Тип `FONT_FAMILY` исключён из списка вкладок и данных — значение там просто
  имя шрифта, смотреть не на что. Названия вкладок переведены на русский (Цвета/Градиенты/Типографика/
  Тени/Формы/Размеры)
- [x] 9.3 Самодельные Compose-примитивы заменены на настоящие компоненты `sdds-uikit-compose`/`sdds-serv`
  везде, где они реально нашлись: `ListItem` (список токенов и все пикеры вместо hand-rolled
  Row/Column/Text), `Divider`, `Tabs`/`TabItem`, `TextField`. Цветовой swatch токена передаётся через
  `startContent` `ListItem`, а не собирается вручную рядом с текстом — так отступы совпадают с
  остальными строками списка
- [x] 9.4 Добавлен явный переключатель темы токенов (светлая/тёмная) над списком: `TokenMode`
  (`LIGHT`/`DARK`) добавлен в доменную модель, `GetDesignSystemTokensUseCase.execute` теперь принимает
  `mode` и выбирает значение под конкретную тему с фолбэком на mode-агностичное значение (`mode = null`
  в БД, например у `spacing`/`shape`), если под запрошенную тему отдельного значения нет. Тема IDE
  (bright/non-bright) — только подсказка для стартового значения переключателя, не единственный
  источник: у многих пользователей IDE всегда тёмная независимо от темы дизайн-системы, которую нужно
  посмотреть
- [x] 9.5 **Обнаружено при визуальной проверке**: при истечении сессии (сброшенной `SessionRefresher`
  при неудачном тихом обновлении, см. 5.5) экран показывал текст ошибки без пути назад — `MainScreen`
  не имел способа сообщить `PluginRootScreen`, что сессии больше нет. Добавлено отдельное исключение
  `SessionExpiredException` в `AuthenticatedApiClient` (все три случая "нужно перелогиниться" — нет
  токена, неудачный refresh, повторный `401` после refresh), колбэк `onSessionExpired` протянут через
  все шаги `MainScreen`, `PluginRootScreen` реагирует переключением на экран логина; в состоянии ошибки
  теперь показывается кнопка "Войти"
- [x] 9.6 **Обнаружено при визуальной проверке**: кнопка "Выйти" изначально только чистила локальную
  сессию плагина (`sessionResolver.clear()`), но не трогала SSO-cookie Keycloak в системном браузере —
  следующий вход через браузер проходил молча по этой cookie, без формы логина, то есть выход был
  "ненастоящим". Подтверждено прямым `curl` к `/auth/logout` на локальном gateway (302 на
  `post_logout_redirect_uri`, без обязательного `id_token_hint`). Добавлены `LogoutUrlBuilder`
  (end-session URL Keycloak) и `LoginController.logout()` — открывает браузер на end-session endpoint
  через тот же loopback-listener, что и логин, дожидается redirect и только потом чистит локальную
  сессию; локальная сессия чистится в любом случае, даже если браузерный шаг не удался (offline и т.п.)
- [x] 9.7 Добавлена кнопка "Выйти" (`BasicButtonSSecondary`) в правом верхнем углу экрана — до этого в
  плагине не было вообще никакого способа разлогиниться
- [x] 9.8 Полировка отображения: `HttpDesignSystemDataClient`/`TokenRow` показывают "—" для токена, у
  которого строка значения существует, но само поле `value` в БД равно `null` (реальный случай в
  сидовых данных — например `outline.default.accent`), а не пустую строку без подписи
- [x] 9.9 **Известный неразрешённый визуальный нюанс** (осознанно принят, не блокирует): у вкладок типов
  токенов (`TabsClip.Scroll`) остаётся небольшой отступ слева, не совпадающий с остальными элементами
  экрана (хлебные крошки, поле поиска, переключатель темы). Расследовано глубоко — декомпилированы
  реальные `RegularRow`/`clipModifier`/`BaseTabs` из `uikit-compose` (через `cfr`), исключены как причина
  `stretch`/`canStretch`/`stretchForScroll` (формула `canStretch = stretch && clip != Scroll` даёт
  `false` в обоих рядах вкладок) и явные "кнопки-контролы" прокрутки (их в `TabsClip.Scroll` просто нет —
  это специфика только `ShowMore`). Источник отступа не подтверждён окончательно (кандидат —
  `tabIndicator`/порядок применения `style { dimensions {...} } ` override, не проверено эмпирически).
  Решение пользователя: оставить `TabsClip.Scroll` как есть ради поддержки прокрутки при большом числе
  типов токенов, не разменивая её на `TabsClip.None` ради пиксель-идеального выравнивания
