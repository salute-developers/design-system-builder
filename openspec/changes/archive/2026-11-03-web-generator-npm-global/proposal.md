## Why

Готовый `dsbuilder` из релиза не умеет генерировать React-пакет без клона репозитория: делегат `web`
находит генератор только по `DSBUILDER_WEB_TOOL` или `--tool`, а сам генератор `js/cli` требует
`NPM_PACKAGE_SCOPE` и запускается только из каталога репозитория. Пользователю web-платформы
нужна такая же установка «одной командой», как у iOS и Android.

## What Changes

- `js/cli`: `NPM_PACKAGE_SCOPE` становится необязательной; без неё генератор использует `@sddsjs`.
  Переопределить scope можно переменной окружения, в том числе при запуске через `dsbuilder`.
- `js/cli` становится публикуемым npm-пакетом `@sddsjs/design-system-builder-generator`
  (сейчас `@sddsjs/design-system-builder-cli`, в npm не публиковался) с исполняемым файлом
  `dsbuilder-web-generator` и подкомандами `theme`, `components`, `ds`. Скрипты `npm run generate:*`
  остаются для работы из репозитория.
- Пакет публикуется в npm вручную командой `npm publish` из `js/cli`; версия берётся из `package.json`.
  Автоматической публикации из CI нет.
- Делегат `web`: `DSBUILDER_WEB_TOOL` больше не обязателен. Без `--tool` и `DSBUILDER_WEB_TOOL`
  делегат запускает установленный `dsbuilder-web-generator`: из `~/.dsbuilder/toolchains/web`, иначе из
  глобального npm. Явный путь к репозиторию по-прежнему важнее установленного генератора.
- `dsbuilder toolchain install web` ставит последнюю (или указанную) версию генератора в каталог
  пользователя `~/.dsbuilder/toolchains/web` (`npm install --global --prefix`): без `sudo` и без изменения
  настроек npm, в том числе когда глобальный каталог npm принадлежит root.
- Установщики `dsbuilder` (macOS, JVM, Windows и сетевые) после установки CLI ставят генератор той же
  командой. Без Node.js, без сети или при ошибке npm установка CLI завершается успешно с понятным
  предупреждением; шаг отключается флагом `--without-web` (`-WithoutWeb` в PowerShell).
- Документация называет Node.js 22+ и npm требованием для генерации React, как Java 17+ для JVM-сборки.

## Capabilities

### New Capabilities

- `web-generator-package`: npm-пакет web-генератора: имя, исполняемый файл и его подкоманды, scope
  по умолчанию, ручная публикация.

### Modified Capabilities

- `platform-web-delegate`: поиск генератора дополняется установленным генератором, `DSBUILDER_WEB_TOOL`
  становится необязательным, появляется установщик toolchain `web`.
- `local-web-generation`: `NPM_PACKAGE_SCOPE` больше не обязательна и не требует `js/.env`.
- `cli-toolchain-install`: toolchain `web` устанавливается npm в `~/.dsbuilder/toolchains/web` как в prefix, без
  версионных каталогов и `current`.
- `cli-release-delivery`: установщики дистрибутивов ставят web-генератор необязательным шагом с флагом
  отказа; установка CLI без сети остаётся рабочей.

## Impact

- **js**: `js/cli/package.json` (имя, `bin`, `files`, `engines`, перенос зависимостей времени выполнения
  из `devDependencies`), новая точка входа `js/cli/bin/dsbuilder-web-generator.js`,
  `js/cli/src/generator/utils/index.ts`, `js/cli/README.md`, `js/.env.example`, тесты `js/cli`.
- **frontend-kt**: `platform-web` (`WebToolLocator`, `WebNpmDelegate`, новый `WebToolchainInstaller`,
  `WebPlatformModule`), регистрация установщика в `:cli`, установщики в `cli/distribution`
  (`install-unix-common.sh`, `install-macos-cli.sh`, `install-jvm-cli.sh`, `install-windows-cli.ps1`,
  `bootstrap/install.sh`, `bootstrap/install.ps1`) и их тесты, `cli/USAGE.md`, `README.md`.
- **CI**: smoke-проверки релиза CLI ставят CLI с `--without-web`. Workflow публикации и secret
  `NPM_TOKEN` не нужны.
- **backend-kt**: не затрагивается.
- **Предусловия**: первая публикация пакета (вручную, владельцем scope `@salutejs`) до выпуска CLI,
  который его ставит; иначе установщики CLI выдают предупреждение и пропускают шаг.
