# frontend-kt Architecture

Этот документ описывает модульный граф `frontend-kt`: как разложена общая клиентская бизнес-логика DS Builder между Gradle-модулями, в каком направлении между ними разрешены зависимости и какое правило Kotlin-видимости действует на границах модулей.

Правила, специфичные для `:cli` как presentation-слоя (структура `*CliCommand`, composition root, entrypoint), описаны в [`cli/AGENTS.md`](cli/AGENTS.md). Здесь фиксируется только общая для всех модулей архитектура — согласно [ADR-0004](../openspec/architecture/ADR-0004-dsbuilder-cli-mcp.md) она не принадлежит `:cli` и должна быть переиспользуема будущими клиентами (`:mcp`, `:desktop`, IDE-плагины).

## Модульный граф

```text
core-domain (leaf)  core-workspace (leaf)  core-auth (leaf)  core-process (leaf)
                                                   │
                                                   ▼
                                             core-network

core-domain, core-network, core-auth, core-workspace, core-process
       │                 │                 │
       └─────────────────┼─────────────────┘
                          ▼
                   core-application
                          │
                          ▼
                    core-platform ─────────────┐
                          │                    │
    ┌─────────┬───────────┼──────────┬─────────┤
feature-init feature-status feature-theme feature-docs feature-components feature-toolchain
    │         │            │              │            │                   │
    └─────────┴─────┬──────┴──────────────┴────────────┴───────────────────┘
                    │                    platform-ios (адаптер платформы)
                    └────────────┬───────────────┘
                    :cli (presentation + composition root)
```

Состав слоёв:

- `core-domain` — общие доменные типы без внешних зависимостей: `ProjectContext`, `ProjectApiKey`, `ProjectApiUrl`, `ProjectId`, `DesignSystemId`, `CredentialEnvName`, `ProjectAccessCheck`, `ProjectConfigDraft`.
- `core-auth` — разрешение project API key из CLI-аргумента и env (`ApiKeyResolver`, `EnvironmentReader`). Без зависимостей на другие `core-*`.
- `core-workspace` — доступ к файловой системе и `.sdds/config.json` (`WorkspaceFileSystem`, `ProjectConfigStore`, `ProjectConfig`). Без зависимостей на другие `core-*`.
- `core-network` — authenticated HTTP-клиент и разрешение backend API URL (`AuthenticatedHttpClient`, `ApiUrlResolver`). Зависит от `core-auth` — оба резолвера (API key и API URL) читают env через общий `EnvironmentReader`.
- `core-process` — порт запуска внешних процессов (`ProcessRunner`, `ProcessRequest`, `ProcessResult`). Без зависимостей на другие `core-*`: платформенные реализации живут в composition root клиента и приезжают через `ClientRuntime`.
- `core-application` — порты разрешения контекста/credentials/API URL (`ProjectContextReader`, `ProjectApiKeyProvider`, `ProjectApiUrlProvider`) и их runtime-адаптеры, плюс `ClientRuntime` — контейнер платформенных зависимостей клиента. Зависит от всех четырёх модулей выше.
- `core-platform` — делегирование платформам: порт `PlatformDelegate`, реестр `PlatformDelegateRegistry`, выбор платформы `PlatformResolver`, общий сценарий запуска `PlatformCapabilityRunner` и порт установки инструментов `ToolchainInstaller` с реестром `ToolchainInstallerRegistry`. Зависит от `core-domain` и `core-application`. Адаптеры конкретных платформ живут в отдельных модулях `platform-<toolchain>` и в `core-platform` не попадают.
- `feature-init`, `feature-status`, `feature-theme`, `feature-docs`, `feature-components`, `feature-toolchain` — по одному модулю на CLI-команду верхнего уровня. Каждый зависит только от тех `core-*`, которые реально использует (например, `feature-init` не использует `core-network`, `feature-status` не использует `core-workspace`) — зависимость не добавляется «про запас».
- `platform-ios` — адаптер платформы iOS: переводит capability в вызовы `dsbuilder-ios` и ищет этот инструмент на машине. Зависит от `core-platform` и `core-process`; ни один `feature-*` от него не зависит.
- `:cli` — тонкая presentation-обёртка и composition root. Смотри [`cli/AGENTS.md`](cli/AGENTS.md).

## Правило направления зависимостей

- `core-*` не зависят от `feature-*` и никогда не будут — это было бы инверсией направления.
- `feature-*` не зависят друг от друга. Если двум фичам понадобится общая логика, она выносится в `core-*`, а не импортируется напрямую между фичами.
- Клиентские приложения (`:cli`, будущие `:mcp`, `:desktop`, IDE-плагины) зависят от `feature-*` и `core-application`. Ни один `core-*` или `feature-*` модуль не зависит от клиентского приложения.
- Composition root клиентского приложения может дополнительно зависеть напрямую от `core-network`/`core-auth`/`core-workspace`, если именно он реализует платформенный адаптер порта из этого модуля (например, `:cli`'s `Jvm/MacosClientRuntime` реализует `WorkspaceFileSystem` и создаёт `KtorAuthenticatedHttpClientFactory` для конкретной платформы). Это не транзитивный шум, а осознанная зависимость — добавляй её только тогда, когда клиент действительно предоставляет такую реализацию.
- Перед тем как добавить зависимость нового `feature-*` на `core-*`, из которого реально нужен только один тип, проверь: возможно, этот тип должен переехать в модуль, который фича уже использует, а не тянуть за собой целый слой.

## Правило видимости на границах модулей

`public` получают только типы, которые реально пересекают границу модуля:

- use case-классы фичи, потребляемые presentation (`FetchThemesUseCase`, `DocsPublishUseCase` и т.п.);
- их `*Command`/`*Result` модели;
- изредка доменный тип, который presentation использует напрямую (пример: `ComponentImportReport` в `feature-components`);
- всё содержимое `core-*`, что импортируется хотя бы одной фичой или клиентским приложением.

Всё остальное — порты, адаптеры, внутренние доменные builder'ы (`DocsCodec`, `ThemeWritePlanBuilder`, `ComponentPackageLoader` и т.п.) — остаётся `internal` в своём модуле.

Публичный use case-класс, чей конструктор принимает `internal`-порт, объявляется с `internal constructor`: класс виден снаружи модуля (для `get<XxxUseCase>()` в Koin-графе и как тип параметра presentation), но собрать его напрямую может только код внутри своего модуля — Kotlin запрещает `public`-конструктору принимать `internal`-тип параметра. Это уже сложившийся паттерн во всех `feature-*` модулях, а не разовое решение.

### `api` vs `implementation` — та же граница, но на уровне Gradle

Kotlin-видимость (`public`/`internal`) — не единственная граница. Если публичный тип (публичный класс с публичным или default-конструктором, публичная функция, публичное свойство) ссылается на тип из другого модуля, эта зависимость в `build.gradle.kts` должна быть `api`, а не `implementation` — иначе тип виден, а модуль, откуда он приходит, до консьюмера не долетает. Пример: `FetchSource`/`PushTarget` в `feature-components` публично возвращают `ResolvedApiUrl` из `core-network` → `core-network` обязан быть `api`. Каждая `*ApplicationModule()`/`coreApplicationModule()` фабрика возвращает `Module` → `koin-core` обязан быть `api` везде, где такая фабрика есть.

Внутри этого repo такая утечка не ломает сборку сама по себе, если у какого-то модуля (сегодня — `:cli`) та же зависимость уже есть напрямую по другой причине — она просто маскируется. Проверяй не «собралось ли», а явно:

```bash
./gradlew :<module>:dependencies --configuration commonMainApiDependenciesMetadata
```

Внутренние адаптеры (`ComponentPackageLoader`, `DocsCodec` и т.п.) под это правило не попадают: их конструкторы `internal`, значит типы их параметров не часть публичной сигнатуры — для них `implementation` корректен.

## DI: application vs presentation

Каждая фича делит Koin-wiring на два модуля:

- `<Feature>ApplicationModule.kt` — живёт в `feature-<name>`, wire-ит use case'ы и data-адаптеры фичи.
- `<Feature>CliPresentationModule.kt` — живёт в `:cli`, wire-ит `*CliCommand` как `CliktCommand` поверх уже собранных use case'ов.

Будущий `:mcp` получит свой аналог `<Feature>McpToolsModule.kt`, wire-ящий те же use case'ы из `<Feature>ApplicationModule.kt` в MCP-инструменты вместо `CliktCommand` — именно это разделение и делает use case'ы переиспользуемыми между клиентами.

## Тесты

Тест, который проверяет чистую логику фичи или core-слоя (use case, domain, adapter в изоляции), живёт в `commonTest` соответствующего модуля.

Тест, который проходит через `DsBuilderCli.execute()` целиком — то есть проверяет собранный composition root, а не одну фичу, — остаётся в `:cli` (`DsBuilderCliTest.kt`, `ComponentsCliCommandTest.kt`), даже если он косвенно покрывает код из `feature-*`. Такой тест физически не может переехать в `feature-*`: он опирается на `:cli`'s Koin-граф целиком.
