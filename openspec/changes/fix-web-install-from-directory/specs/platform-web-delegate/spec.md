## MODIFIED Requirements

### Requirement: Установщик toolchain web

CLI SHALL регистрировать установщик toolchain `web`, который ставит `@sddsjs/design-system-builder-generator`
в каталог пользователя `~/.dsbuilder/toolchains/web` командой `npm install --global --prefix <каталог>`.
Установка SHALL NOT требовать прав администратора и SHALL NOT менять настройки npm пользователя.

#### Scenario: Последняя версия

- **WHEN** пользователь запускает `dsbuilder toolchain install web`
- **THEN** CLI MUST выполнить `npm install --global --prefix ~/.dsbuilder/toolchains/web @sddsjs/design-system-builder-generator@latest`
- **THEN** CLI MUST напечатать установленную версию из `dsbuilder-web-generator --version` и путь к исполняемому файлу в этом каталоге

#### Scenario: Системный Node.js без прав на глобальный каталог

- **WHEN** глобальный каталог npm (например, `/usr/local/lib/node_modules`) недоступен пользователю для записи
- **THEN** установка MUST завершиться успешно без `sudo` и без изменения `npm config`

#### Scenario: Конкретная версия и локальный архив

- **WHEN** пользователь запускает `dsbuilder toolchain install web --version 1.2.3`
- **THEN** CLI MUST установить `@sddsjs/design-system-builder-generator@1.2.3` в тот же каталог
- **WHEN** пользователь запускает `dsbuilder toolchain install web --from <путь к .tgz или URL>`
- **THEN** CLI MUST передать этот путь npm без обращения к реестру за другой версией

#### Scenario: Установка из каталога пакета

- **WHEN** пользователь запускает `dsbuilder toolchain install web --from <каталог>`, в котором нет `node_modules`
- **THEN** CLI MUST упаковать каталог командой `npm pack` в `~/.dsbuilder/toolchains/web` и установить получившийся архив
- **THEN** установленный `dsbuilder-web-generator` MUST запускаться, потому что его зависимости установлены вместе с ним
- **THEN** архив MUST быть удалён после установки, в том числе при ошибке установки

#### Scenario: Нет Node.js

- **WHEN** `npm` не найден в `PATH`
- **THEN** установка MUST завершиться ошибкой с подсказкой установить Node.js 22+ и MUST NOT запускать процессы

#### Scenario: Ошибка npm

- **WHEN** npm завершается ненулевым кодом, например без сети
- **THEN** CLI MUST вернуть ошибку с кодом npm и MUST NOT советовать менять глобальный prefix npm
