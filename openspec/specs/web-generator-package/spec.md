# web-generator-package Specification

## Purpose
Определяет npm-пакет web-генератора `@sddsjs/design-system-builder-generator`: состав пакета, команду
`dsbuilder-web-generator` и её подкоманды, scope генерируемого пакета и ручную публикацию.
## Requirements
### Requirement: npm-пакет web-генератора

Web-генератор `js/cli` SHALL публиковаться в npm как `@sddsjs/design-system-builder-generator` и SHALL объявлять
исполняемый файл `dsbuilder-web-generator`. Пакет SHALL содержать всё, что нужно генератору во время работы:
код, шаблоны и заготовку пакета, а также зависимости времени выполнения, включая `@salutejs/plasma-new-hope`.

#### Scenario: Глобальная установка

- **WHEN** пользователь выполняет `npm install -g @sddsjs/design-system-builder-generator`
- **THEN** команда `dsbuilder-web-generator` MUST появиться в каталоге исполняемых файлов глобального prefix npm
- **THEN** генератор MUST запускаться из любого каталога без клона репозитория DS Builder и без `js/.env`

#### Scenario: Требования к окружению

- **WHEN** пакет устанавливается
- **THEN** `package.json` MUST объявлять `engines.node` `>=22`
- **THEN** установка MUST NOT требовать Java, Gradle или других инструментов кроме Node.js и npm

### Requirement: Команды исполняемого файла

`dsbuilder-web-generator` SHALL предоставлять подкоманды `theme`, `components` и `ds` с теми же опциями и
результатом, что `npm run generate:theme`, `npm run generate:components` и `npm run generate:ds`.

#### Scenario: Подкоманда повторяет скрипт репозитория

- **WHEN** пользователь запускает `dsbuilder-web-generator ds --sdds <каталог .sdds> --out <каталог> --package --name base`
- **THEN** результат MUST совпадать с результатом `npm run generate:ds` с теми же аргументами
- **THEN** код возврата MUST быть ненулевым при ошибке генерации

#### Scenario: Версия и справка

- **WHEN** пользователь запускает `dsbuilder-web-generator --version`
- **THEN** команда MUST напечатать только версию пакета и завершиться с кодом 0
- **WHEN** пользователь запускает `dsbuilder-web-generator` без подкоманды или с неизвестной подкомандой
- **THEN** команда MUST напечатать список подкоманд и завершиться с ненулевым кодом

### Requirement: Scope генерируемого пакета

Генератор SHALL брать scope генерируемого npm-пакета из переменной окружения `NPM_PACKAGE_SCOPE`, а без неё
SHALL использовать `@sddsjs`.

#### Scenario: Scope по умолчанию

- **WHEN** `NPM_PACKAGE_SCOPE` не задана или пуста
- **THEN** генерация с `--package --name base` MUST создать пакет `@sddsjs/base`
- **THEN** генератор MUST NOT завершаться ошибкой из-за отсутствия переменной

#### Scenario: Переопределение scope

- **WHEN** пользователь задаёт `NPM_PACKAGE_SCOPE=@acme` для `dsbuilder-web-generator`, `npm run generate:*` или `dsbuilder ... --platform react`
- **THEN** генерация с `--package --name base` MUST создать пакет `@acme/base`

#### Scenario: Неверный scope

- **WHEN** `NPM_PACKAGE_SCOPE` не начинается с `@` или содержит символы, недопустимые в имени npm-пакета
- **THEN** генератор MUST завершиться ошибкой, назвав переменную и её значение, до записи файлов

### Requirement: Ручная публикация пакета

Пакет SHALL поддерживать ручную публикацию командой `npm publish` из `js/cli` и публикацию проверенного tarball шагом существующего `.github/workflows/publish-cli-release.yml`. Версия SHALL браться из поля `version` в `js/cli/package.json` независимо от номера CLI-релиза. Проверка типов и тесты генератора SHALL выполняться перед упаковкой/публикацией: через существующий `prepublishOnly` для локального npm publish и явно в workflow при подготовке tarball.

#### Scenario: Публикация
- **WHEN** пользователь с правом записи `@sddsjs/design-system-builder-generator` выполняет `npm publish` в `js/cli`
- **THEN** npm MUST выполнить проверку типов и тесты `js/cli` до упаковки и MUST остановить публикацию при их ошибке
- **THEN** пакет MUST публиковаться с публичным доступом без дополнительных флагов

#### Scenario: Состав опубликованного архива
- **WHEN** выполняется `npm pack --dry-run` в `js/cli`
- **THEN** архив MUST содержать `bin`, исходники генератора, шаблоны и заготовку пакета
- **THEN** архив MUST NOT содержать тесты, `.sdds`, `output` и `node_modules`

#### Scenario: Публикация в текущем CLI workflow
- **WHEN** `publish-cli-release.yml` выпускает новый CLI-тег с поддержкой Node.js-поставки
- **THEN** он MUST подготовить генератор из исходников того же тега, выполнить `npm ci`, typecheck, тесты, проверку состава и глобальной установки
- **THEN** отдельный шаг MUST опубликовать либо подтвердить совпадающую существующую версию генератора до публикации npm-пакета CLI и продвижения GitHub Release
- **THEN** workflow MUST NOT переписывать версию генератора или создавать для неё коммит/тег
- **THEN** изменение содержимого при уже занятой версии MUST остановить выпуск с требованием новой версии генератора в исходниках
