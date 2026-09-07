## 1. Domain и запуск процессов

- [x] 1.1 Добавить `core-domain/TargetPlatform` со значениями `compose`, `android-view`, `swiftui`, `uikit`, `react` и отображение в `DocumentationPlatform` в `feature-docs`.
- [x] 1.2 Завести модуль `core-process`: `ProcessRunner` (`fun interface`), `ProcessRequest`, `ProcessResult`, `ProcessLaunchException`.
- [x] 1.3 Добавить `ClientRuntime.processRunner` и его binding в `coreApplicationModule`.
- [x] 1.4 Реализовать `ProcessRunner` для JVM через `ProcessBuilder` в `cli/jvmMain`.
- [x] 1.5 Реализовать `ProcessRunner` для macOS через `NSTask` в `cli/macosMain`; добавить source set `macosTest`.

## 2. Контракт делегата

- [x] 2.1 Завести модуль `core-platform`: `ToolchainId`, `Capability`, `WorkspacePaths`, `DelegateInvocation`, `DelegateResult`, `ToolchainStatus`, `PlatformDelegate`.
- [x] 2.2 Реализовать `PlatformDelegateRegistry` с проверкой уникальности платформ и toolchain id при построении.
- [x] 2.3 Реализовать `PlatformResolver`: явная платформа побеждает, иначе единственная из config, иначе детерминированный отказ.
- [x] 2.4 Реализовать `PlatformCapabilityRunner`: контекст → платформа → делегат → capability → `doctor` → запуск → маппинг результата, с отдачей плана до запуска.
- [x] 2.5 Добавить `di/PlatformDelegatesModule` в `:cli` и подключить его вместе с `corePlatformModule()` в `DsBuilderCli`.

## 3. Платформа в локальном контексте

- [x] 3.1 Добавить необязательное поле `platforms` в `ProjectConfig` (`core-workspace`).
- [x] 3.2 Разбирать `platforms` в `LocalProjectContextReader` с отказом на неизвестном значении; добавить поле в `ProjectContext` и `ProjectConfigDraft`.
- [x] 3.3 Добавить повторяемую опцию `--platform` в `dsbuilder init` и запись платформ в config.

## 4. Команды генерации и toolchain

- [x] 4.1 Добавить `GenerateThemeUseCase` в `feature-theme` и команду `dsbuilder theme generate`.
- [x] 4.2 Добавить `GenerateComponentsUseCase` в `feature-components` и команду `dsbuilder components generate`.
- [x] 4.3 Завести модуль `feature-toolchain` (`ListToolchainsUseCase`, `DoctorToolchainsUseCase`) и группу команд `dsbuilder toolchain`.
- [x] 4.4 Добавить платформенный шаг в `DocsGenerateUseCase` через порт `DocsPlatformAggregator` и его адаптер поверх делегата; опции `--docs-dir`, `--no-aggregate`, `--tool` и разрешение платформы из config.

## 5. Тесты

- [x] 5.1 `core-domain`, `core-process`, `core-platform`: словарь платформ, валидация запроса процесса, реестр, резолвер, оркестратор с фейковым делегатом.
- [x] 5.2 `feature-docs`, `feature-toolchain`: платформенный шаг (выполнен, пропущен, упал, готовое дерево, `--no-aggregate`), список и `doctor` toolchain'ов.
- [x] 5.3 `cli`: help новых команд без проекта и backend, отказ генерации на пустом реестре без запуска процессов, состав composition root.
- [x] 5.4 `cli/jvmTest` и `cli/macosTest`: реальный запуск `/bin/sh` — exit code, захват вывода, окружение, рабочая директория, сигнал, отсутствующий инструмент.

## 6. Документация и верификация

- [x] 6.1 Раздел «Платформенные делегаты» в `frontend-kt/cli/AGENTS.md` и новые модули в `frontend-kt/AGENTS.md`.
- [x] 6.2 Новые команды и опции в `frontend-kt/cli/USAGE.md`.
- [x] 6.3 `cd frontend-kt && ./gradlew build` — тесты, detekt и spotlessCheck зелёные.
