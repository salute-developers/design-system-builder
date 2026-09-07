## Why

Согласно [ADR-0004: MCP сервер клиентской части DS Builder](../../architecture/ADR-0004-dsbuilder-cli-mcp.md), бизнес-логика `frontend-kt/cli` должна быть вынесена из единственного Gradle-модуля `:cli` в общий прикладной слой Kotlin Multiplatform, чтобы `:cli` остался тонкой terminal-оберткой, а MCP-сервер и будущие клиенты (desktop, IDE-плагины) могли переиспользовать те же прикладные сценарии, REST-клиенты и механизм разрешения контекста/учетных данных ([ADR-0005](../../architecture/ADR-0005-frontend-local-context-auth.md)) без дублирования и без вызова CLI как внешнего процесса. Сейчас вся эта логика физически недоступна снаружи `:cli`: любой новый клиент вынужден либо дублировать код, либо оборачивать CLI shell-командами, что прямо противоречит решению ADR-0004.

## What Changes

- Пакеты `core/{domain,application,config,credentials,http,data}` и `feature/{theme,docs,components,init,status}/{domain,application,data}`, сегодня лежащие внутри `:cli`, выносятся в отдельные Kotlin Multiplatform Gradle-модули: `core-domain`, `core-network`, `core-auth`, `core-workspace`, `core-application`, `feature-theme`, `feature-docs`, `feature-components`, `feature-init`, `feature-status`.
- Направление зависимостей между новыми модулями фиксируется явно: `core-*` не зависят от `feature-*`; `feature-*` не зависят друг от друга; `:cli` (и будущие `:mcp`, `:desktop`) зависят от `feature-*` и `core-application`, но не наоборот.
- Kotlin-видимость (`internal`/`public`) пересматривается по границам новых модулей: `public` остаётся только у того, что реально пересекает границу (use case-классы, их `*Command`/`*Result` модели, отдельные доменные результаты вроде `ComponentImportReport`, и весь API `core-*`, потребляемый фичами); остальное (порты и адаптеры внутри фичи) остаётся `internal`, но уже в границах нового модуля, а не всего `:cli`.
- DI каждой фичи (`feature/<name>/di/<Name>FeatureModule.kt`), сегодня в одном Koin-модуле смешивающий wiring use case'ов и wiring `*CliCommand` как `CliktCommand`, разделяется на `*ApplicationModule` (переезжает в `feature-<name>`) и `*CliPresentationModule` (остаётся в `:cli`).
- `CliFileSystem` переименовывается в `WorkspaceFileSystem`, `CliRuntime` — в клиентски-нейтральное имя (например `ClientRuntime`); оба типа физически переезжают в `core-workspace`/`core-application` и перестают нести в имени привязку к terminal CLI.
- Перед физическим переносом добавляются characterization-тесты для сегодня непокрытых зон: `init`, `status`, `core-auth` (credentials), `core-workspace` (config), `core-network` (http) — чтобы перенос проверялся автоматически, а не вручную.
- Существующий монолитный `commonTest/.../DsBuilderCliTest.kt`, сегодня вперемешку тестирующий `core.config`/`core.credentials`/`core.http` и `feature.theme.domain` в одном файле, разрезается по новым границам модулей.
- `:cli` после переноса содержит только `presentation` (`*CliCommand`) и composition root (реализацию runtime для JVM/macOS), зависящий от `core-application` и всех `feature-*`.
- **BREAKING** (внутреннее, не пользовательское): пакетные имена бизнес-логики меняются с `com.dsbuilder.frontend.cli.core.*` / `com.dsbuilder.frontend.cli.feature.*` на нейтральные (без `.cli.`) в новых модулях; поведение CLI-команд для конечного пользователя не меняется.

## Capabilities

### New Capabilities
- `frontend-core-modules`: контракт модульного графа общего прикладного слоя `frontend-kt` — состав модулей `core-domain`/`core-network`/`core-auth`/`core-workspace`/`core-application`/`feature-*`, правило направления зависимостей между ними и правило Kotlin-видимости на границах модулей.

### Modified Capabilities
- `frontend-cli`: требование "CLI module structure" меняется — `:cli` больше не содержит shared-бизнес-логику CLI-команд, а становится тонкой presentation-оберткой поверх `core-application` и `feature-*` модулей; source sets `:cli` ограничиваются presentation и composition root.

## Impact

- **Затронутый код**: весь `frontend-kt/cli/src/commonMain/kotlin/.../core/**` и `.../feature/**`, соответствующие тесты в `commonTest`, `frontend-kt/settings.gradle.kts` (добавление новых `include(...)` для модулей), `frontend-kt/cli/build.gradle.kts` (упрощение зависимостей до core-application + feature-*).
- **Затронутые Gradle-модули**: новые `:core-domain`, `:core-network`, `:core-auth`, `:core-workspace`, `:core-application`, `:feature-theme`, `:feature-docs`, `:feature-components`, `:feature-init`, `:feature-status`; существующий `:cli` меняет состав зависимостей.
- **Затронутые openspec-спеки**: `frontend-cli` (delta), новая `frontend-core-modules`. `cli-core`, `cli-themes`, `cli-components` не меняются — они описывают наблюдаемое поведение CLI-команд (формат `.sdds/config.json`, тексты ошибок, help-вывод), которое в этом изменении не затрагивается.
- **Другие части репозитория**: `backend-kt` и `js` не затрагиваются — изменение целиком внутри `frontend-kt`.
- **Зависимости**: новых внешних зависимостей не добавляется; переиспользуется существующий `convention.kotlin-multiplatform-module` для всех новых модулей (уже не CLI-специфичен — macOS execution targets и упаковка остаются только в `:cli/build.gradle.kts`).
- **Пользовательское поведение**: не меняется — help-вывод, коды выхода, формат `.sdds/config.json` и тексты ошибок CLI-команд остаются прежними; изменение проверяется тем же набором CLI-сценариев из `cli-core`/`cli-themes`/`cli-components`/`frontend-cli`.
