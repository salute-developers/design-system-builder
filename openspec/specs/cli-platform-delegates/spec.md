# cli-platform-delegates Specification

## Purpose
Определяет, как CLI `dsbuilder` делегирует генерацию кода темы, компонентов и платформенную агрегацию документации инструментам платформ: порт делегата, реестр, выбор целевой платформы, запуск внешних процессов и команды, которые этим пользуются.

## Requirements
### Requirement: Target platform dictionary

CLI SHALL define a single dictionary of target platforms shared by all platform-aware commands and by local project config.

#### Scenario: Канонические значения

- **WHEN** CLI parses a target platform value
- **THEN** it MUST accept exactly `compose`, `android-view`, `swiftui`, and `react`
- **THEN** it MUST reject aliases, other casing, and unknown values deterministically

#### Scenario: Соответствие платформе документации

- **WHEN** a target platform is mapped to a documentation platform
- **THEN** each target platform MUST map to exactly one documentation platform with the same identifier
- **THEN** documentation platforms without a platform tool, `uikit` and `design`, MUST NOT be target platforms
  and MUST be selectable only through an explicit `--platform`

### Requirement: Target platform in project config

CLI SHALL store target platforms of the project in `.sdds/config.json` as non-secret local metadata.

#### Scenario: Init записывает платформы

- **WHEN** developer runs `dsbuilder init --project-id project-a --design-system-id ds-a --platform swiftui`
- **THEN** generated config MUST contain JSON array field `platforms` with value `["swiftui"]`
- **THEN** the option MUST be repeatable for a project that targets several platforms

#### Scenario: Config без платформ остаётся валидным

- **WHEN** `.sdds/config.json` has no `platforms` field
- **THEN** CLI MUST parse the config successfully
- **THEN** the resolved project context MUST carry no target platform

#### Scenario: Неизвестная платформа в config

- **WHEN** `.sdds/config.json` contains a platform value outside the dictionary
- **THEN** CLI MUST return a deterministic error naming the value, the config path, and the supported platforms

### Requirement: Target platform resolution

CLI SHALL resolve the target platform of a command from the explicit option first and from project config second.

#### Scenario: Явная опция побеждает

- **WHEN** a platform-aware command receives `--platform <platform>`
- **THEN** CLI MUST use that platform regardless of project config

#### Scenario: Единственная платформа проекта используется без опции

- **WHEN** `--platform` is absent and project config declares exactly one platform
- **THEN** CLI MUST use that platform

#### Scenario: Платформа не задана

- **WHEN** `--platform` is absent and project config declares no platform
- **THEN** `theme generate` and `components generate` MUST return a deterministic failure naming `--platform` and the `platforms` field of `.sdds/config.json`
- **THEN** `docs generate` MUST keep its historical `compose` default instead of failing

#### Scenario: Сломанный config не превращается в умолчание

- **WHEN** `.sdds/config.json` cannot be read or declares an unknown platform
- **THEN** `docs generate` MUST return that error instead of falling back to the `compose` default

#### Scenario: Несколько платформ требуют выбора

- **WHEN** `--platform` is absent and project config declares several platforms
- **THEN** CLI MUST return a deterministic failure listing the configured platforms and naming `--platform`

### Requirement: Platform delegate contract

CLI SHALL expose a `PlatformDelegate` port that declares a toolchain id, the set of target platforms it serves, the set of capabilities it supports, a `doctor` check, and a `run` operation.

#### Scenario: Делегат объявляет платформы и capability

- **WHEN** a delegate is registered
- **THEN** it MUST declare a non-blank lowercase toolchain id matching `[a-z][a-z0-9-]*`
- **THEN** it MUST declare the target platforms it serves
- **THEN** it MUST declare which of `THEME`, `COMPONENTS`, `DOCS_AGGREGATE` it supports

#### Scenario: Вызов делегата

- **WHEN** CLI runs a delegate
- **THEN** it MUST pass the capability, the target platform, the workspace paths, an optional absolute output directory, an optional absolute tool override, and passthrough arguments unchanged
- **THEN** the delegate MUST return one of `Completed`, `Failed` with the tool exit code, `ToolchainMissing` with a hint, or `Unsupported`
- **THEN** the delegate MUST NOT receive or forward the project API key

#### Scenario: Проверка toolchain'а

- **WHEN** CLI asks a delegate for `doctor`
- **THEN** the delegate MUST return `Ready` with the executable path and version, `Missing` with a hint, or `Incompatible` with found and required versions
- **THEN** `doctor` MUST NOT generate anything

#### Scenario: Doctor проверяет инструмент из `--tool`

- **WHEN** a command is given `--tool <path>`
- **THEN** CLI MUST pass that path to `doctor`
- **THEN** the delegate MUST check that tool instead of the ones found by toolchain discovery

### Requirement: Workspace paths convention

CLI SHALL pass workspace paths to delegates as an absolute `.sdds` directory and an absolute workspace directory that is the parent of `.sdds`.

#### Scenario: Workspace выводится из найденного config

- **WHEN** the nearest project config is `/repo/Themes/PlasmaHomeDSTheme/.sdds/config.json`
- **THEN** `sddsDir` MUST be `/repo/Themes/PlasmaHomeDSTheme/.sdds`
- **THEN** `workspaceDir` MUST be `/repo/Themes/PlasmaHomeDSTheme`

#### Scenario: Относительные пути отклоняются

- **WHEN** workspace paths are built from a relative path or the file system root
- **THEN** CLI MUST reject them deterministically

### Requirement: Platform delegate registry

CLI SHALL resolve delegates through a registry where each target platform is served by exactly one delegate.

#### Scenario: Платформа разрешается в делегат

- **WHEN** a delegate declares `compose` and `android-view`
- **THEN** the registry MUST return that delegate for both platforms
- **THEN** the registry MUST return no delegate for a platform nobody declares

#### Scenario: Конфликт регистрации

- **WHEN** two delegates declare the same target platform or the same toolchain id
- **THEN** the registry MUST fail at construction with a message naming the platform and both toolchains
- **THEN** CLI MUST NOT resolve either delegate

#### Scenario: Единственное место регистрации

- **WHEN** a new platform toolchain is added
- **THEN** it MUST be registered in the composition root module for platform delegates
- **THEN** feature modules MUST NOT depend on platform adapter modules

### Requirement: Platform capability execution

CLI SHALL run a platform capability through a shared sequence: resolve project context, resolve platform, resolve delegate, check capability, check toolchain, run.

#### Scenario: Порядок проверок

- **WHEN** a platform-aware command is executed
- **THEN** CLI MUST fail with the project context error when the project is not initialized
- **THEN** CLI MUST fail naming the platform and the registered toolchains when no delegate serves it
- **THEN** CLI MUST fail naming the capability when the delegate does not support it
- **THEN** CLI MUST fail with the `doctor` hint when the toolchain is missing or incompatible
- **THEN** CLI MUST NOT start any process in these cases

#### Scenario: План печатается до запуска инструмента

- **WHEN** the platform, toolchain and workspace are resolved and the toolchain is ready
- **THEN** CLI MUST print the platform, the toolchain and the workspace directory before the tool starts
- **THEN** CLI MUST NOT print the raw API key

#### Scenario: Относительные пути приводятся к абсолютным

- **WHEN** a command receives a relative `--output` or `--tool`
- **THEN** the delegate MUST receive them as absolute paths

#### Scenario: Ошибка инструмента доходит до пользователя

- **WHEN** the platform tool exits with a non-zero code
- **THEN** CLI MUST print a message containing the toolchain, the exit code and the tool message
- **THEN** CLI MUST exit with a non-zero code

### Requirement: External process port

CLI SHALL run external tools only through a `ProcessRunner` port with platform implementations for JVM and macOS.

#### Scenario: Запрос на запуск

- **WHEN** a delegate builds a process request
- **THEN** the executable MUST be an absolute path
- **THEN** the working directory MUST be an absolute path
- **THEN** extra environment variables MUST be added to the parent environment, overriding same-named variables
- **THEN** arguments MUST be passed as is, without a shell

#### Scenario: Наследование stdio по умолчанию

- **WHEN** a process request does not disable stdio inheritance
- **THEN** the child process MUST write to the CLI terminal directly
- **THEN** the result output MUST be empty

#### Scenario: Захват вывода

- **WHEN** a process request disables stdio inheritance
- **THEN** stdout and stderr MUST be captured together into the result output

#### Scenario: Exit code

- **WHEN** the child process exits
- **THEN** the result MUST carry its exit code
- **WHEN** the child process is killed by a signal
- **THEN** the exit code MUST be `128 + signal number`

#### Scenario: Инструмент не запускается

- **WHEN** the executable does not exist or cannot be started
- **THEN** the runner MUST throw a deterministic launch error naming the executable

### Requirement: CLI generate commands

CLI `dsbuilder` SHALL provide `theme generate` and `components generate` that delegate code generation to the platform tool.

#### Scenario: Команды доступны в help

- **WHEN** developer runs `dsbuilder theme --help` or `dsbuilder components --help`
- **THEN** help MUST include the `generate` subcommand
- **THEN** help MUST NOT require `.sdds/config.json`, backend services, credentials, or private URLs

#### Scenario: Опции команд генерации

- **WHEN** developer runs `dsbuilder theme generate --help` or `dsbuilder components generate --help`
- **THEN** help MUST include `--platform`, `--output` and `--tool`
- **THEN** arguments after `--` MUST be forwarded to the platform tool unchanged

#### Scenario: Неизвестная платформа отклоняется до чтения проекта

- **WHEN** developer passes `--platform` with a value outside the dictionary
- **THEN** CLI MUST return a deterministic option error listing the supported platforms
- **THEN** CLI MUST NOT read the project config

### Requirement: CLI toolchain commands

CLI `dsbuilder` SHALL provide `toolchain list` and `toolchain doctor` to inspect platform tools without generating anything.

#### Scenario: Список toolchain'ов

- **WHEN** developer runs `dsbuilder toolchain list`
- **THEN** CLI MUST print each registered toolchain with its platforms and capabilities
- **THEN** CLI MUST print a deterministic message when nothing is registered

#### Scenario: Doctor проверяет инструменты

- **WHEN** developer runs `dsbuilder toolchain doctor`
- **THEN** CLI MUST print the status of every registered toolchain against the resolved workspace
- **THEN** CLI MUST exit with a non-zero code when at least one toolchain is missing or incompatible

#### Scenario: Doctor одной платформы

- **WHEN** developer runs `dsbuilder toolchain doctor --platform <platform>`
- **THEN** CLI MUST check only the toolchain serving that platform
- **THEN** CLI MUST fail deterministically when no toolchain serves it

#### Scenario: Doctor без проекта

- **WHEN** `dsbuilder toolchain doctor` runs outside an initialized project
- **THEN** CLI MUST use the current working directory as the workspace
- **THEN** CLI MUST NOT require `.sdds/config.json`

### Requirement: Documentation platform step

CLI `docs generate` SHALL enrich the documentation tree with the platform tool before building the package, and SHALL resolve the documentation platform from the explicit option or from project config.

#### Scenario: Платформенный шаг собирает дерево

- **WHEN** developer runs `dsbuilder docs generate` without `--docs-dir`
- **WHEN** a delegate serves the resolved platform and supports documentation aggregation
- **THEN** CLI MUST run that delegate before reading structures
- **THEN** CLI MUST build the package from the tree the delegate produced
- **THEN** CLI MUST report which toolchain aggregated the tree

#### Scenario: Готовое дерево не трогается

- **WHEN** developer runs `dsbuilder docs generate --docs-dir <dir>` or passes `--no-aggregate`
- **THEN** CLI MUST NOT run the platform aggregation step
- **THEN** CLI MUST build the package from the given or default tree

#### Scenario: Платформа без инструмента не ломает сборку

- **WHEN** no delegate serves the resolved platform or the delegate does not support documentation aggregation
- **THEN** CLI MUST skip the aggregation step
- **THEN** CLI MUST build the package from the default tree

#### Scenario: Ошибка платформенного шага останавливает сборку

- **WHEN** the platform aggregation step fails
- **THEN** CLI MUST return that failure
- **THEN** CLI MUST NOT write `docs.json`, `manifest.json` or the archive

#### Scenario: Платформа документации без опции

- **WHEN** `--platform` is absent and project config declares exactly one platform
- **THEN** CLI MUST use that platform
- **WHEN** `--platform` is absent and project config declares no platform
- **THEN** CLI MUST use the historical default `compose`
- **WHEN** `--platform` is absent and project config declares several platforms
- **THEN** CLI MUST fail deterministically naming `--platform`
- **WHEN** `--platform` is given
- **THEN** CLI MUST use it, including `design`, which has no platform tool

