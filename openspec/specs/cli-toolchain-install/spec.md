# cli-toolchain-install

## Purpose

Установка платформенных инструментов клиентом `dsbuilder`: релиз кладётся в каталог управляемых
установок, а `current` указывает на активную версию.

## Requirements

### Requirement: Toolchain installer contract

CLI SHALL expose a `ToolchainInstaller` port that declares the toolchain it installs and installs
that toolchain from a published release or from a given archive.

#### Scenario: Установщик объявляет toolchain

- **WHEN** an installer is registered
- **THEN** it MUST declare the toolchain id it installs
- **THEN** at most one installer MUST be registered per toolchain id

#### Scenario: Результат установки

- **WHEN** CLI asks an installer to install
- **THEN** the installer MUST return `Installed` with the resolved version and the executable path,
  or `Failed` with a user-facing message

#### Scenario: Установка не трогает проект

- **WHEN** an installer runs
- **THEN** it MUST NOT read or modify `.sdds` of the current project
- **THEN** it MUST NOT require an initialized project

### Requirement: Managed toolchain layout

CLI SHALL install platform tools into `~/.dsbuilder/toolchains/<toolchain>/<version>` and SHALL
point the `current` symlink of that toolchain at the installed version.

#### Scenario: Установленная версия становится текущей

- **WHEN** installation of version `<version>` succeeds
- **THEN** `~/.dsbuilder/toolchains/<toolchain>/<version>` MUST contain the tool
- **THEN** `~/.dsbuilder/toolchains/<toolchain>/current` MUST point at that version
- **THEN** `toolchain doctor` MUST report the tool as ready without `--tool` or environment variables

#### Scenario: Повторная установка переключает версию

- **WHEN** another version is installed
- **THEN** CLI MUST keep the previously installed versions on disk
- **THEN** CLI MUST repoint `current` at the newly installed version

#### Scenario: Неудачная установка не ломает текущую

- **WHEN** download or extraction fails
- **THEN** CLI MUST leave the previous `current` untouched
- **THEN** CLI MUST NOT leave a half-extracted version as `current`

### Requirement: CLI toolchain install command

CLI `dsbuilder` SHALL provide `toolchain install <toolchain>` to install a platform tool.

#### Scenario: Установка последнего релиза

- **WHEN** developer runs `dsbuilder toolchain install <toolchain>` without `--version`
- **THEN** CLI MUST install the latest published release of that tool
- **THEN** CLI MUST print the installed version and the executable path

#### Scenario: Установка конкретной версии

- **WHEN** developer runs `dsbuilder toolchain install <toolchain> --version <tag>`
- **THEN** CLI MUST install that release
- **THEN** CLI MUST fail deterministically naming the tag when the release has no tool asset

#### Scenario: Установка из готового архива

- **WHEN** developer runs `dsbuilder toolchain install <toolchain> --from <path|url>`
- **THEN** CLI MUST install that archive without resolving a release
- **THEN** CLI MUST NOT contact the release host

#### Scenario: Неизвестный toolchain

- **WHEN** the named toolchain has no registered installer
- **THEN** CLI MUST fail listing the toolchains that can be installed
- **THEN** CLI MUST exit with a non-zero code

### Requirement: iOS toolchain installer

CLI SHALL install the `ios` toolchain from the plasma-ios GitHub release asset that carries the
`dsbuilder-ios` binary and its `ios-api-meta.json`.

#### Scenario: Ассет релиза выбирается по имени

- **WHEN** the installer resolves a release
- **THEN** it MUST pick the asset whose name starts with `dsbuilder-ios-cli`
- **THEN** it MUST fail naming the release when no such asset exists

#### Scenario: Инструмент готов к запуску

- **WHEN** extraction succeeds
- **THEN** the installed `dsbuilder-ios` MUST be executable
- **THEN** `ios-api-meta.json` MUST sit next to it, because the tool reads it from its own directory
