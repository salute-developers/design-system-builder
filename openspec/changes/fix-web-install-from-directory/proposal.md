## Why

`dsbuilder toolchain install web --from <каталог>` передаёт каталог прямо в
`npm install --global --prefix <prefix> <каталог>`. Для каталога npm создаёт ссылку на исходник и не ставит его
зависимости, поэтому из каталога без `node_modules` (например, распакованного из `npm pack`) установка
завершается успешно, а `dsbuilder-web-generator` падает с `ERR_MODULE_NOT_FOUND: Cannot find package 'tsx'`.
Документация и спецификация обещают, что `--from` принимает каталог.

## What Changes

- Установщик toolchain `web` при `--from <каталог>` сначала упаковывает каталог командой `npm pack` в
  `~/.dsbuilder/toolchains/web` и ставит получившийся `.tgz` вместе с зависимостями, как установку из реестра.
- Архив удаляется после установки, в том числе при ошибке.
- Установка из реестра, `--version`, `--from <.tgz>` и `--from <URL>` не меняются.

## Capabilities

### New Capabilities

### Modified Capabilities

- `platform-web-delegate`: сценарий `--from` различает архив и каталог; каталог ставится со своими
  зависимостями.

## Impact

- **frontend-kt**: `platform-web` (`WebToolchainInstaller`) и его тесты.
- **js**: `js/cli/scripts/check-global-install.sh` дополняется проверкой установки каталога без
  `node_modules` через собранный `dsbuilder`.
- **backend-kt**: не затрагивается. Документация не меняется: она уже описывает `--from <каталог>`.
