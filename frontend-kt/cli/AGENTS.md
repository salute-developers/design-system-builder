# DS Builder CLI Architecture

Этот документ описывает правила, специфичные для `:cli` — терминального клиента `dsbuilder`. Модульный граф всего `frontend-kt` (состав `core-*`/`feature-*` модулей, правило направления зависимостей, правило Kotlin-видимости на границах модулей) описан в [`../AGENTS.md`](../AGENTS.md) — читай его в первую очередь. Здесь фиксируется только то, что относится к `:cli` как presentation-слою.

## Назначение приложения

`dsbuilder` — CLI entrypoint для автоматизации операций над дизайн-системами.

CLI должен быть пригоден для локального запуска разработчиком и для запуска в CI/CD. Основные будущие сценарии:

- валидация дизайн-токенов, тем, компонентов и метаданных проекта;
- сборка артефактов дизайн-системы;
- публикация артефактов в backend DS Builder, package registry или другое внешнее хранилище;
- работа с проектными настройками, access keys и локальным контекстом;
- запуск repeatable workflow без интерактивной desktop UI.

CLI не является production microservice: он не открывает HTTP-порт, не имеет Docker runtime как обязательной части запуска и не должен требовать backend services, credentials или приватные URL для baseline-команд вроде help/version/smoke output.

## Роль `:cli` в модульном графе

`:cli` — тонкая presentation-обёртка и composition root поверх `core-application` и всех `feature-*` модулей (см. [`../AGENTS.md`](../AGENTS.md)). `:cli` не владеет бизнес-логикой: domain, application (use case'ы, порты) и data (адаптеры) любой фичи живут в её `feature-<name>` модуле, а не здесь.

`:cli` содержит только:

```text
cli/
  src/
    commonMain/kotlin/com/dsbuilder/frontend/cli/
      DsBuilderCli.kt       — composition root: собирает Koin-граф из всех модулей, парсит args
      ClientRuntime.kt      — expect fun defaultClientRuntime(): ClientRuntime
      di/CliModule.kt       — Koin-модуль верхнего уровня, собирает RootCliCommand
      presentation/RootCliCommand.kt
      feature/<name>/
        presentation/       — *CliCommand: разбор аргументов, форматирование вывода
        di/<Name>CliPresentationModule.kt — Koin-wiring *CliCommand поверх use case'ов из feature-<name>
    jvmMain/kotlin/com/dsbuilder/frontend/cli/
      Main.kt                — JVM entrypoint
      JvmClientRuntime.kt     — actual defaultClientRuntime(), JVM WorkspaceFileSystem/EnvironmentReader/HTTP client
    macosMain/kotlin/com/dsbuilder/frontend/cli/
      Main.kt                — macOS entrypoint
      MacosClientRuntime.kt   — actual defaultClientRuntime(), POSIX-based реализации
```

Ни один файл в `:cli` не должен содержать use case, domain-модель или data-адаптер для фичи — это сигнал, что код положен не в тот модуль.

## Presentation-слой

Пакет `feature/<name>/presentation` содержит CLI boundary фичи:

- описание команд, subcommands, options и arguments (Clikt);
- parsing/validation CLI input на уровне синтаксиса;
- mapping CLI input в `*Command` use case из `feature-<name>`;
- formatting stdout/stderr;
- mapping `*Result` use case в user-facing сообщения и exit codes;
- help text, если он локален для фичи.

Presentation вызывает use case'ы, полученные из Koin-графа, но не обращается напрямую к HTTP clients, файловой системе или `core-*`-адаптерам — это ответственность `feature-<name>`. Presentation импортирует из `feature-<name>.application` только то, что уже является публичным API этого модуля: use case-класс и его `*Command`/`*Result`.

CLI output должен быть предсказуемым и тестируемым.

## Entrypoint и Composition Root

`jvmMain`/`macosMain` содержат минимальный entrypoint (`Main.kt`):

- принять raw CLI arguments;
- вызвать `DsBuilderCli(defaultClientRuntime()).execute(args)`;
- напечатать stdout/stderr;
- завершиться с корректным exit code.

`actual fun defaultClientRuntime()` в `Jvm/MacosClientRuntime.kt` — единственное место в `:cli`, где допустимо писать платформенный код (JVM `java.io.File`, macOS POSIX cinterop): здесь создаются конкретные `WorkspaceFileSystem`, `EnvironmentReader` и `AuthenticatedHttpClientFactory` для текущей платформы. Будущие `:mcp`/`:desktop` реализуют свой аналог этого файла, а не переиспользуют `:cli`'s.

`DsBuilderCli.kt` — composition root: собирает `coreApplicationModule` и Koin-модули всех фич (`*ApplicationModule` + `*CliPresentationModule`) в один граф и резолвит `RootCliCommand`. Бизнес-логика фичей не должна жить в composition root.

## Платформенные делегаты

Команды генерации (`theme generate`, `components generate`, платформенный шаг `docs generate`) не знают,
чем именно генерируется код на платформе. Они вызывают use case фичи, который обращается к
`PlatformCapabilityRunner` из `core-platform`: тот резолвит проект, выбирает платформу, берёт делегат
из реестра, проверяет toolchain и запускает его. Запуск процессов — только через `ProcessRunner`
из `core-process`.

Правила:

- одна целевая платформа (`TargetPlatform`) — ровно один делегат; toolchain (`ios`, `android`) может
  обслуживать несколько платформ;
- новая платформа = модуль `platform-<toolchain>` с реализацией `PlatformDelegate` и одна строка
  в `di/PlatformDelegatesModule.kt`; больше нигде конкретные платформы не перечисляются.
  Пример — `platform-ios`: делегат, локатор инструмента и свой Koin-module;
- `feature-*` зависят только от `core-platform` (порт) и никогда не импортируют `platform-*`;
- процессы запускаются только через `ProcessRunner`; presentation и use case'ы не запускают их сами.
  Делегат собирает `ProcessRequest` (абсолютный исполняемый файл, абсолютная рабочая директория,
  `environment` добавляется к окружению родителя), по умолчанию `inheritStdio = true`, чтобы вывод
  длинных сборок шёл в терминал напрямую; захват (`inheritStdio = false`) — только для коротких
  вызовов вроде `--version`;
- делегат никогда не получает и не передаёт инструменту project API key;
- пути рабочей копии — `WorkspacePaths`: `workspaceDir` всегда родитель `.sdds`;
- выбор платформы всегда идёт через `PlatformResolver`, чтобы сообщения об ошибке были одинаковыми
  во всех командах;
- argv-билдер и обработка exit code каждого делегата тестируются фейком `ProcessRunner` (это
  `fun interface`, поэтому фейк — лямбда); оркестрация use case'ов — фейком `PlatformDelegate`;
- реальные `ProcessRunner` (`jvmMain` — `ProcessBuilder`, `macosMain` — `NSTask`) покрыты тестами,
  запускающими `/bin/sh`, в `jvmTest` и `macosTest`.

## Build-system и convention plugins

`:cli` использует `convention.kotlin-multiplatform-module` из `build-system`, как и все `core-*`/`feature-*` модули, плюс дополнительно настраивает JVM/macOS executable-таргеты и упаковку дистрибутива (см. `cli/build.gradle.kts`).

## Тестирование

- Presentation-специфичное поведение (command parsing, mapping CLI input в use case input, formatting stdout/stderr, exit codes) покрывается тестами в `:cli`.
- Тест, который проходит через `DsBuilderCli.execute()` целиком — то есть проверяет собранный composition root, а не одну фичу изолированно, — остаётся в `:cli` (`DsBuilderCliTest.kt`, `ComponentsCliCommandTest.kt`), даже если он косвенно покрывает код из `feature-*`.
- Тест use case'а, domain-модели или adapter'а фичи в изоляции живёт в `commonTest` соответствующего `feature-<name>` модуля, а не здесь — см. [`../AGENTS.md`](../AGENTS.md).
- baseline CLI behavior (help/version/error handling) должен оставаться deterministic и не требовать backend services, Docker, credentials или private URLs.
