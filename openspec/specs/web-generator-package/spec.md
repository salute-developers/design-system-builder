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
результатом, что `npm run generate:theme`, `npm run generate:components` и `npm run generate:ds`, и подкоманду
`api-meta`, которая строит web API-мету тем же кодом, что `npm run generate:api-meta`. Для `api-meta` пакет
компонентов (`--package`, по умолчанию `@salutejs/plasma-new-hope`) SHALL искаться от текущего каталога вверх по
`node_modules`, а результат SHALL записываться в файл `--out`; без `--out` подкоманда SHALL завершаться ошибкой. Подкоманда
`manifests` SHALL записывать в файл `--out` все манифесты `src/generator/templates/<X>/component.json` одним JSON
`{ "<X>": <манифест> }`; без `--out` она SHALL завершаться ошибкой.

#### Scenario: Подкоманда повторяет скрипт репозитория

- **WHEN** пользователь запускает `dsbuilder-web-generator ds --sdds <каталог .sdds> --out <каталог> --package --name base`
- **THEN** результат MUST совпадать с результатом `npm run generate:ds` с теми же аргументами
- **THEN** код возврата MUST быть ненулевым при ошибке генерации

#### Scenario: Мета из ядра текущего каталога

- **WHEN** в каталоге с установленным `@salutejs/plasma-new-hope` выполняется `dsbuilder-web-generator api-meta --out public/api-meta.json`
- **THEN** файл MUST совпадать с результатом `npm run generate:api-meta -- --package @salutejs/plasma-new-hope --out <файл>` для той же версии ядра
- **THEN** ядро MUST искаться в `node_modules` от текущего каталога вверх, а не в зависимостях пакета генератора

#### Scenario: Ядро не установлено

- **WHEN** `dsbuilder-web-generator api-meta --out <файл>` запускается в каталоге, где ни в нём, ни выше нет `@salutejs/plasma-new-hope`
- **THEN** команда MUST завершиться с ненулевым кодом, назвав пакет, и MUST NOT создать файл

#### Scenario: Манифесты одним файлом

- **WHEN** выполняется `dsbuilder-web-generator manifests --out manifests.json`
- **THEN** файл MUST содержать запись для каждой папки `src/generator/templates/<X>` с `component.json`, с тем же содержимым

#### Scenario: Нет файла результата

- **WHEN** пользователь запускает `dsbuilder-web-generator api-meta` или `manifests` без `--out`
- **THEN** команда MUST завершиться с ненулевым кодом и MUST NOT писать файлы внутри установленного пакета

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

### Requirement: Независимые функции web-маппинга

Пакет SHALL публиковать точку входа `@sddsjs/design-system-builder-generator/web-mapping` (поле `exports`
`package.json`) с правилами, которыми генератор переводит свойства компонента в web-параметры и переменные темы: типы API-меты и
базовые параметры свойства, суффиксы ключей состояний, данные `web-adapter.json`, подстановка `$1…$n`, имена
компонентов и `compose`-связи, перевод px в `rem` и радиус с поправкой, поле типографики параметра, основа имени переменных
типографики темы, имя объекта токенов и базового конфига ядра компонента по манифесту, имя переменной цвета
темы и суффиксы производных токенов состояний. Модуль SHALL
содержать только правила, которые вызывает сам генератор. Функции SHALL быть чистыми и SHALL NOT зависеть от генерации кода,
превью и формата payload. Модуль SHALL NOT импортировать модули Node.js, `@salutejs/plasma-new-hope` и код пакета вне
`src/web-mapping`, кроме `src/data/web-adapter.json`. Генератор SHALL пользоваться этими функциями сам, а не держать
вторую реализацию тех же правил.

#### Scenario: Генератор на общих функциях

- **WHEN** генератор подставляет шаблон web-адаптера, переводит размер в `rem`, выбирает ключ состояния или поле типографики, строит `deps` по `compose` имена переменных цвета и типографики темы или имя объекта ядра
- **THEN** он MUST вызывать функции `src/web-mapping`
- **THEN** сгенерированный код MUST совпадать с кодом до выноса функций

#### Scenario: Импорт в браузерной сборке

- **WHEN** приложение на Vite импортирует `@sddsjs/design-system-builder-generator/web-mapping`
- **THEN** сборка MUST завершиться без полифилов Node.js и MUST NOT включить в бандл `@salutejs/plasma-new-hope` из зависимостей пакета генератора

#### Scenario: Ограничение импортов

- **WHEN** запускаются тесты `js/cli`
- **THEN** тест MUST упасть, если файл `src/web-mapping`, кроме `*.test.ts`, импортирует `node:*`, `@salutejs/plasma-new-hope` или модуль вне `src/web-mapping` и `src/data/web-adapter.json`

#### Scenario: Проверка типов под флагами браузерного потребителя

- **WHEN** выполняется `npm run typecheck` в `js/cli`
- **THEN** `src/web-mapping` MUST проверяться и с настройками CLI, и с `moduleResolution: bundler`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`

#### Scenario: Тесты подкаталогов

- **WHEN** выполняется `npm test` в `js/cli`
- **THEN** MUST запускаться тесты из подкаталогов `src`, включая `src/web-mapping`

#### Scenario: Compose-связи из адаптера

- **WHEN** в `web-adapter.json` у `tabs` указано `compose: ["icon-tab-item", "tab-item"]`
- **THEN** `composeOf` MUST вернуть для `tabs` `[{ id: "icon-tab-item", name: "IconTabItem" }, { id: "tab-item", name: "TabItem" }]` в этом порядке

#### Scenario: Основа имени типографики

- **WHEN** вызывается `typographyVariableBase` для `header.h3.bold`, `display.l.normal` и `text.m.bold`
- **THEN** результат MUST быть `h3-bold`, `dspl-l` и `text-m-bold`, как в `@salutejs/plasma-typo` и сгенерированной теме

#### Scenario: Объект ядра по манифесту

- **WHEN** манифест `TabItem` задаёт `coreTokensExport: "tabsTokens"`, а у `Button` манифеста нет
- **THEN** `coreTokensExportName` MUST вернуть `tabsTokens` для `TabItem` и `buttonTokens` для `Button`

