## 1. Safety net перед переносом

- [x] 1.1 Добавить characterization-тесты для `feature/init/application/InitProjectUseCase` и `feature/init/data/LocalProjectConfigWriter` на текущее поведение (успешная инициализация, конфликт существующего конфига, ошибки записи)
- [x] 1.2 Добавить characterization-тесты для `feature/status/application/CheckProjectStatusUseCase` и `feature/status/data/HttpProjectAccessVerifier` на текущее поведение (успешная проверка доступа, 401/403/404 от бэкенда, отсутствие контекста)
- [x] 1.3 Добавить characterization-тесты для `core/credentials/ApiKeyResolver` и `core/credentials/EnvironmentReader` (найденный ключ, отсутствующая env-переменная, `MissingApiKeyException`) — плюс адаптер `RuntimeProjectApiKeyProvider`, у которого не было отдельных тестов
- [x] 1.4 Добавить characterization-тесты для `core/config/ProjectConfigStore` и `core/config/ProjectConfigCodec` сверх того, что уже покрыто `DsBuilderCliTest.kt` — discovery/tenants/palettePath/credential уже были покрыты полностью; добавлен тест для непокрытого адаптера `LocalProjectContextReader`
- [x] 1.5 Добавить characterization-тесты для `core/http/ApiUrlResolver` и `core/http/AuthenticatedHttpClient` сверх того, что уже покрыто `core/http/CliCoreWriteSupportTest.kt` — оба уже покрыты полностью; добавлен тест для непокрытого адаптера `RuntimeProjectApiUrlProvider`
- [x] 1.6 Прогнать `cd frontend-kt && ./gradlew test` и убедиться, что новые тесты проходят на текущей, ещё не перенесённой структуре — `BUILD SUCCESSFUL`, JVM + macOS Arm64

## 2. Модуль core-domain

- [x] 2.1 Создать Gradle-модуль `core-domain`, подключить `convention.kotlin-multiplatform-module`, добавить `include(":core-domain")` в `frontend-kt/settings.gradle.kts`
- [x] 2.2 Перенести `core/domain/ProjectDomain.kt` (`ProjectContext`, `ProjectApiKey`, `ProjectApiUrl`, `ProjectId`, `DesignSystemId`, `CredentialEnvName`, `ProjectAccessCheck`, `ProjectConfigDraft`) в `core-domain`, пересмотреть пакет (без `.cli.` сегмента, новый пакет `com.dsbuilder.frontend.core.domain`)
- [x] 2.3 Применить правило видимости: типы, используемые фичами напрямую, — `public`; остальное — `internal` — все типы уже были `public` (пересекают границу фича↔core), изменений не потребовалось
- [x] 2.4 Обновить импорты во всех местах `:cli`, ссылающихся на перенесённые типы; добавить зависимость `:cli` → `core-domain`
- [x] 2.5 Прогнать `cd frontend-kt && ./gradlew build test detekt spotlessCheck` — `BUILD SUCCESSFUL`

## 3. Модули core-network, core-auth, core-workspace

- [x] 3.1 Создать Gradle-модули `core-network`, `core-auth`, `core-workspace` — **отклонение от плана**: реальные зависимости оказались `core-auth`/`core-workspace` = leaf-модули без зависимостей, `core-network` → `core-auth` (не → `core-domain`), см. обновлённый Decision 1 в `design.md` и `specs/frontend-core-modules/spec.md`. `core.credentials.ApiKeyResolver` дополнительно избавлен от случайной зависимости на `core.config.CredentialReference` (сигнатура `resolve()` теперь принимает `configuredEnvName: String?` вместо `CredentialReference?`)
- [x] 3.2 Перенести `core/http/ApiUrlResolver.kt` и `core/http/AuthenticatedHttpClient.kt` в `core-network` (пакет `com.dsbuilder.frontend.core.network`)
- [x] 3.3 Перенести `core/credentials/ApiKeyResolver.kt` и `core/credentials/EnvironmentReader.kt` в `core-auth` (пакет `com.dsbuilder.frontend.core.auth`)
- [x] 3.4 Перенести `core/config/{CliFileSystem,ProjectConfig,ProjectConfigCodec,ProjectConfigStore}.kt` в `core-workspace` (пакет `com.dsbuilder.frontend.core.workspace`); переименовать `CliFileSystem` → `WorkspaceFileSystem` во всех точках использования (32 файла, включая тестовые фикстуры `InMemoryWorkspaceFileSystem`/`TestWorkspaceFileSystem`)
- [x] 3.5 Применить правило видимости к каждому из трёх модулей — `DEFAULT_API_KEY_ENV` и `API_URL_ENV` были `internal`, стали `public` (пересекают границу модуля); остальное уже было `public`
- [x] 3.6 Перенести тесты, разрезанные из `DsBuilderCliTest.kt`, относящиеся к `core.http`/`core.credentials`/`core.config`, в `commonTest` соответствующих новых модулей; перенести characterization-тесты из шагов 1.3–1.5 — 14 тестов перенесено (9 → core-workspace, 3 → core-auth, 2 → core-network), 1 тест (`apiUrlResolutionUsesArgumentThenEnvThenDefault`) удалён как дубликат уже существующих `resolveReports*Source`-тестов в `CliCoreWriteSupportTest`; счётчик `@Test` сверен (49 исходных = 34 в `DsBuilderCliTest.kt` + 14 перенесённых + 1 задокументированный дубликат)
- [x] 3.7 Обновить импорты во всех местах `:cli`, ссылающихся на перенесённые типы; добавить зависимости `:cli` → `core-network`, `core-auth`, `core-workspace`
- [x] 3.8 Прогнать `cd frontend-kt && ./gradlew build test detekt spotlessCheck` — `BUILD SUCCESSFUL`

## 4. Модуль core-application

- [x] 4.1 Создать Gradle-модуль `core-application`, подключить `convention.kotlin-multiplatform-module`, добавить `include(":core-application")`, добавить зависимости на `core-domain`, `core-network`, `core-auth`, `core-workspace`
- [x] 4.2 Перенести `core/application/ProjectRuntimePorts.kt` (порты `ProjectContextReader`, `ProjectApiKeyProvider`, `ProjectApiUrlProvider` + Result-типы) в `core-application`, снять `internal`, сделать `public`
- [x] 4.3 Перенести `core/data/{LocalProjectContextReader,RuntimeProjectApiKeyProvider,RuntimeProjectApiUrlProvider}.kt` в `core-application` (пакет `com.dsbuilder.frontend.core.application`, остаются `internal` — presentation их не касается, только через порты)
- [x] 4.4 Перенести `core/di/CoreCliModule.kt` в `core-application` как `CoreApplicationModule.kt`; переименовать `CliRuntime` → `ClientRuntime`. Сам `ClientRuntime` (data class) переехал в `core-application`; `expect fun defaultClientRuntime()` и платформенные `actual`-реализации (`WorkspaceFileSystem` для JVM/macOS) остались в `:cli` (composition root для конкретной платформы — по замыслу design.md остаётся ответственностью запускающего приложения, а не общей библиотеки)
- [x] 4.5 Обновить `:cli` composition root: `DsBuilderCli.kt` подключает `coreApplicationModule(runtime)` из `core-application` вместо локального `coreCliModule`
- [x] 4.6 Прогнать `cd frontend-kt && ./gradlew build test detekt spotlessCheck` — `BUILD SUCCESSFUL` (потребовалась правка: `core-workspace`'s `okio` зависимость сменена с `implementation` на `api`, так как `WorkspaceFileSystem.sink()` возвращает `okio.BufferedSink` в публичном API — без `api` тип не резолвился в модулях, которые реализуют интерфейс)

## 5. Модуль feature-init

- [x] 5.1 Создать Gradle-модуль `feature-init`, зависимости — `core-domain`, `core-workspace` (без `core-network`, `core-auth`, `core-application` — фича их не использует)
- [x] 5.2 Перенести `feature/init/{application,data}/*` в `feature-init` (пакет `com.dsbuilder.frontend.feature.init.*`); применить правило видимости (`InitProjectUseCase`, `InitProjectCommand`, `InitProjectResult` — `public`; `LocalProjectConfigWriter` и внутренние порты — `internal`). Обнаружено: Kotlin запрещает `public`-классу с `public`-конструктором принимать `internal`-тип параметра (`ProjectConfigWriter`) — исправлено через `internal constructor` у `InitProjectUseCase` (класс виден снаружи модуля, конструировать его может только код внутри `feature-init`; presentation в `:cli` резолвит готовый экземпляр через Koin, а не строит его сам) — этот паттерн будет повторяться в остальных feature-модулях
- [x] 5.3 Разделить `feature/init/di/InitFeatureModule.kt` на `InitApplicationModule.kt` (едет в `feature-init`) и `InitCliPresentationModule.kt` (остаётся в `:cli`, регистрирует `InitCliCommand` как `CliktCommand`)
- [x] 5.4 Перенести characterization-тесты из шага 1.1 в `commonTest` модуля `feature-init`
- [x] 5.5 Обновить импорты в `:cli/feature/init/presentation`, добавить зависимость `:cli` → `feature-init`
- [x] 5.6 Прогнать `cd frontend-kt && ./gradlew build test detekt spotlessCheck` — `BUILD SUCCESSFUL`

## 6. Модуль feature-status

- [x] 6.1 Создать Gradle-модуль `feature-status`, зависимости — `core-domain`, `core-network`, `core-application` (без `core-workspace` — фича его не использует)
- [x] 6.2 Перенести `feature/status/{application,data}/*` в `feature-status`; применить правило видимости (тот же `internal constructor`-паттерн, что в `feature-init`)
- [x] 6.3 Разделить `feature/status/di/StatusFeatureModule.kt` на `StatusApplicationModule.kt` и `StatusCliPresentationModule.kt`
- [x] 6.4 Перенести characterization-тесты из шага 1.2 в `commonTest` модуля `feature-status`; потребовалась зависимость `ktor.client.mock` в `commonTest` (как и в `core-network`)
- [x] 6.5 Обновить импорты в `:cli/feature/status/presentation`, добавить зависимость `:cli` → `feature-status`
- [x] 6.6 Прогнать `cd frontend-kt && ./gradlew build test detekt spotlessCheck` — `BUILD SUCCESSFUL`

## 7. Модуль feature-theme

- [x] 7.1 Создать Gradle-модуль `feature-theme`, зависимости — `core-domain`, `core-network`, `core-workspace`, `core-application`
- [x] 7.2 Перенести `feature/theme/{domain,application,data}/*` в `feature-theme`; применить правило видимости (use case'ы, `FetchThemesCommand`/`Result`, `SetThemeAliasCommand`, `ThemeAliasListResult`, `ThemeAliasMutationResult` и т.п. — `public` с `internal constructor`; `ThemeWritePlanBuilder`, `TokenValueNormalizer`, `TenantDirectoryNormalizer`, домен (`Tenant`/`Token`/`TokenValue`/`PaletteItem`/`Platform`) — `internal`). Проверено: e2e-тесты theme, остающиеся в `:cli`, строят HTTP-фикстуры сырыми JSON-строками, а не через конструкторы домена — поэтому домен не пересекает границу модуля и мог остаться полностью `internal`
- [x] 7.3 Разделить `feature/theme/di/ThemeFeatureModule.kt` на `ThemeApplicationModule.kt` и `ThemeCliPresentationModule.kt`
- [x] 7.4 Перенести assertions по `feature.theme.domain` из `DsBuilderCliTest.kt` в `commonTest` модуля `feature-theme`; сверить количество `@Test`-функций до/после разрезания — 34 → 29 в `:cli` + 5 в `feature-theme` (только 5 pure domain теста; e2e-тесты theme через `DsBuilderCli.execute()` остались в `:cli`, т.к. тестируют полный composition root, а не одну фичу)
- [x] 7.5 Обновить импорты в `:cli/feature/theme/presentation`, добавить зависимость `:cli` → `feature-theme`
- [x] 7.6 Прогнать `cd frontend-kt && ./gradlew build test detekt spotlessCheck` — `BUILD SUCCESSFUL`

## 8. Модуль feature-docs

- [x] 8.1 Создать Gradle-модуль `feature-docs`, зависимости — `core-domain`, `core-network`, `core-workspace`, `core-application`
- [x] 8.2 Перенести `feature/docs/{domain,application,data}/*` в `feature-docs`; применить правило видимости (`DocsInitUseCase`, `DocsGenerateUseCase`, `DocsPublishUseCase` и их `*Command`/`*Result` — `public` с `internal constructor`; `DocsCodec`, `DocsHttpClient`, `DocsStructureReader`, `DocsFileSystem` — `internal`). Обнаружено: в отличие от `theme`, весь `docs`-домен (`ResolvedDocs`, `Manifest`, `Structure`, `ValidationError`, `DocsValidationEngine` и т.п.) уже был `public` заранее — изменений там не потребовалось
- [x] 8.3 Разделить `feature/docs/di/DocsFeatureModule.kt` на `DocsApplicationModule.kt` и `DocsCliPresentationModule.kt`
- [x] 8.4 Перенести существующие тесты `feature/docs/*` (включая `feature/docs/application/DocsGenerateUseCaseTest.kt`, `feature/docs/domain/DocumentationPlatformTest.kt`) в `commonTest` модуля `feature-docs`
- [x] 8.5 Обновить импорты в `:cli/feature/docs/presentation`, добавить зависимость `:cli` → `feature-docs`
- [x] 8.6 Прогнать `cd frontend-kt && ./gradlew build test detekt spotlessCheck` — `BUILD SUCCESSFUL`

## 9. Модуль feature-components

- [x] 9.1 Создать Gradle-модуль `feature-components`, зависимости — `core-domain`, `core-network`, `core-workspace`, `core-application` (+ `core-auth` и `ktor-client-mock` в `commonTest`, нужны фикстурам)
- [x] 9.2 Перенести `feature/components/{domain,application,data}/*` в `feature-components`; применить правило видимости (`FetchComponentsUseCase`, `PushComponentsUseCase`, их `*Command`/`*Result`, `ComponentSource`, `ComponentDestination`, `FetchSource`, `PushTarget`, `ComponentImportReport`/`ComponentImportRejection` — `public` с `internal constructor` у use case'ов; `ComponentPackageLoader`, `ComponentPackageWritePlanBuilder`, `codec/*` — `internal`)
- [x] 9.3 Разделить `feature/components/di/ComponentsFeatureModule.kt` на `ComponentsApplicationModule.kt` и `ComponentsCliPresentationModule.kt`
- [x] 9.4 Перенести существующие тесты `feature/components/*` (8 файлов unit-тестов + фикстуры `InMemoryWorkspaceFileSystem`/`NativeConfigCorpus`) в `commonTest` модуля `feature-components`; `ComponentsCliCommandTest.kt` (e2e через `DsBuilderCli`) остался в `:cli` — тот же паттерн, что и для theme/docs
- [x] 9.5 Обновить импорты в `:cli/feature/components/presentation`, добавить зависимость `:cli` → `feature-components`
- [x] 9.6 Прогнать `cd frontend-kt && ./gradlew build test detekt spotlessCheck` — `BUILD SUCCESSFUL`, весь проект (11 модулей) зелёный

## 10. :cli становится тонкой оберткой

- [x] 10.1 Удалить из `:cli` опустевшие пакеты `core/*` и `feature/*/{domain,application,data,di}` — подтверждено: `core/*` уже был полностью пуст к этому шагу (файлы разъехались по core-* модулям в шагах 2-4), пустое дерево каталогов удалено; в `:cli` остались только `presentation/`, `feature/*/presentation`, `feature/*/di/*CliPresentationModule.kt`, composition root (`DsBuilderCli.kt`, `ClientRuntime.kt`, `Main.kt`, `Jvm/MacosClientRuntime.kt`)
- [x] 10.2 Проверить итоговый список зависимостей `:cli/build.gradle.kts` — **отклонение от плана**: `core-domain` действительно не нужен напрямую (0 использований в исходниках `:cli`) и удалён; но `core-network`/`core-auth`/`core-workspace` остаются прямыми зависимостями осознанно — `Jvm/MacosClientRuntime.kt` (composition root для конкретной платформы) напрямую реализует `WorkspaceFileSystem`, использует `EnvironmentReader` и `KtorAuthenticatedHttpClientFactory`, это ожидаемо для composition root, а не транзитивный шум
- [x] 10.3 `commonTest/.../DsBuilderCliTest.kt` — **отклонение от плана**: файл не пуст и не удалён. После переноса unit-уровня в core-*/feature-* модули в нём осталось 29 полноценных integration-тестов composition root (`docs publish`/`init`/`status`/`theme` end-to-end через `DsBuilderCli.execute()`, help/version/error handling) — они проверяют именно то, чем `:cli` теперь стал: тонкую сборку модулей. Аналогично `ComponentsCliCommandTest.kt` (11 тестов) остался в `:cli` как composition-root-тест
- [x] 10.4 Прогнать `cd frontend-kt && ./gradlew build test detekt spotlessCheck` для всего проекта целиком — `BUILD SUCCESSFUL`, 11 модулей (`core-domain`, `core-network`, `core-auth`, `core-workspace`, `core-application`, `feature-init`, `feature-status`, `feature-theme`, `feature-docs`, `feature-components`, `cli`)

## 11. Обновление openspec-спек

- [x] 11.1 Убедиться, что `specs/frontend-cli/spec.md` (delta) и `specs/frontend-core-modules/spec.md` (новая капабилити) в этом change соответствуют финальной структуре модулей после шага 10 — сверено с итоговым `frontend-kt/settings.gradle.kts` (11 модулей), дополнен сценарий про прямые зависимости `:cli` на `core-network`/`core-auth`/`core-workspace`
- [x] 11.2 Проверить, что `cli-core`, `cli-themes`, `cli-components` не требуют изменений (поведение CLI-команд не изменилось) — прогнано через `./gradlew :cli:runJvm --args=...`: `--help`, `--version`, `theme --help`, `components --help` — вывод совпадает со сценариями спек, изменений не требуется

## 12. Закрепление архитектуры в AGENTS.md

- [x] 12.1 Создать `frontend-kt/AGENTS.md` — модульный граф (с уточнением реального графа: `core-network` → `core-auth`, а не → `core-domain`, см. Decision 1 в `design.md`), правило направления зависимостей, правило видимости, DI-паттерн `*ApplicationModule`/`*CliPresentationModule`, паттерн `internal constructor` у публичных use case-классов, правило размещения тестов
- [x] 12.2 Сократить `frontend-kt/cli/AGENTS.md`: убран раздел про «один активный модуль» и вся устаревшая структура `core/`/`feature/*/{domain,data}` внутри `:cli`; оставлены только правила presentation-слоя, composition root, entrypoint и ссылка на `../AGENTS.md`
- [x] 12.3 Обновить `AGENTS.md:15` в корне репозитория: ссылка на дополнительные правила для Kotlin frontend меняется с `frontend-kt/cli/AGENTS.md` на `frontend-kt/AGENTS.md` (+ `frontend-kt/cli/AGENTS.md`)
- [x] 12.4 Проверить, что каждый новый Gradle-модуль (`core-domain`, `core-network`, `core-auth`, `core-workspace`, `core-application`, все пять `feature-*`) физически лежит внутри `frontend-kt/` — подтверждено
