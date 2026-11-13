## MODIFIED Requirements

### Requirement: Managed toolchain layout

CLI SHALL install archive-based platform tools into `~/.dsbuilder/toolchains/<toolchain>/<version>` and SHALL
point the `current` symlink of that toolchain at the installed version. The `web` toolchain SHALL be installed
by npm into `~/.dsbuilder/toolchains/web` used as an npm prefix: npm owns its versions there, without `current`.

#### Scenario: Установленная версия становится текущей

- **WHEN** installation of version `<version>` of an archive-based toolchain succeeds
- **THEN** `~/.dsbuilder/toolchains/<toolchain>/<version>` MUST contain the tool
- **THEN** `~/.dsbuilder/toolchains/<toolchain>/current` MUST point at that version
- **THEN** `toolchain doctor` MUST report the tool as ready without `--tool` or environment variables

#### Scenario: Повторная установка переключает версию

- **WHEN** another version of an archive-based toolchain is installed
- **THEN** CLI MUST keep the previously installed versions on disk
- **THEN** CLI MUST repoint `current` at the newly installed version

#### Scenario: Неудачная установка не ломает текущую

- **WHEN** download or extraction fails
- **THEN** CLI MUST leave the previous `current` untouched
- **THEN** CLI MUST NOT leave a half-extracted version as `current`

#### Scenario: Toolchain web ставится в каталог пользователя

- **WHEN** `toolchain install web` succeeds
- **THEN** `~/.dsbuilder/toolchains/web` MUST be the npm prefix of the installation and MUST contain the `dsbuilder-web-generator` command
- **THEN** CLI MUST NOT write to the global npm prefix and MUST NOT require administrator rights
- **THEN** `toolchain doctor --platform react` MUST report that generator as ready without `--tool` or environment variables
- **THEN** repeated installation MUST replace the installed package version
