## ADDED Requirements

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

Пакет SHALL публиковаться вручную командой `npm publish` из `js/cli`; версия SHALL браться из поля `version`
в `package.json`. Перед упаковкой npm SHALL выполнять проверку типов и тесты генератора.

#### Scenario: Публикация

- **WHEN** владелец scope `@salutejs` выполняет `npm publish` в `js/cli`
- **THEN** npm MUST выполнить проверку типов и тесты `js/cli` до упаковки и MUST остановить публикацию при их ошибке
- **THEN** пакет MUST публиковаться с публичным доступом без дополнительных флагов

#### Scenario: Состав опубликованного архива

- **WHEN** выполняется `npm pack --dry-run` в `js/cli`
- **THEN** архив MUST содержать `bin`, исходники генератора, шаблоны и заготовку пакета
- **THEN** архив MUST NOT содержать тесты, `.sdds`, `output` и `node_modules`
