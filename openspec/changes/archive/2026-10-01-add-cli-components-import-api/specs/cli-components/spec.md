## ADDED Requirements

### Requirement: CLI components import-api command

CLI `dsbuilder` SHALL предоставлять project-scoped команду `components import-api`, заводящую компоненты, свойства, состояния и платформенные имена в глобальном слое DS Builder по API-мете платформы проекта.

#### Scenario: Команда использует project-scoped context

- **WHEN** разработчик запускает `dsbuilder components import-api` внутри initialized project directory
- **THEN** CLI MUST разрешить ближайшую `.sdds/config.json`
- **THEN** CLI MUST использовать `projectId` и `designSystemId` из config
- **THEN** CLI MUST разрешить credential через CLI core и отправить его так же, как `components push`
- **THEN** CLI MUST NOT выводить raw credential

#### Scenario: Help не требует project config

- **WHEN** разработчик запускает `dsbuilder components import-api --help`
- **THEN** CLI MUST показать deterministic help
- **THEN** CLI MUST NOT требовать `.sdds/config.json`, backend, credential или private URL

#### Scenario: Команда не требует plasma-android

- **WHEN** проект пользователя применяет Gradle-плагин `dsBuilder`
- **THEN** CLI MUST NOT требовать рабочей копии plasma-android, `jq` или `curl`

### Requirement: API meta import platform

Команда SHALL брать платформу из `.sdds/config.json`, позволять переопределить её `--platform` и в первой версии поддерживать только `compose`.

#### Scenario: Платформа из config

- **WHEN** `--platform` не указан
- **THEN** CLI MUST использовать платформу из `.sdds/config.json`

#### Scenario: Неподдержанная платформа

- **WHEN** платформа — `android-view`, `swiftui` или `react`
- **THEN** CLI MUST завершиться ненулевым кодом с сообщением, что платформа пока не поддержана
- **THEN** CLI MUST NOT запускать процессы и MUST NOT обращаться к backend

#### Scenario: Соответствие платформы значению backend

- **WHEN** CLI формирует запрос
- **THEN** он MUST передать `compose` для `compose`, `xml` для `android-view`, `ios` для `swiftui`, `web` для `react`

### Requirement: API meta import gets the meta from the project artifact

CLI SHALL получать API-мету через capability `API_META` платформенного делегата, а не из рабочей копии исходников plasma-android, и MUST читать результат после успешного завершения инструмента.

#### Scenario: Мета Compose

- **WHEN** платформа — `compose`
- **THEN** CLI MUST запустить делегата с capability `API_META`
- **THEN** после успешного завершения CLI MUST прочитать `<workspaceDir>/build/theme-builder/components/uikit-compose-api-meta.json`

#### Scenario: Инструмент не запускается до проверок

- **WHEN** нет project context, явного API URL или credentials
- **THEN** CLI MUST отказать с диагностикой и MUST NOT запускать Gradle

#### Scenario: Файл не найден или пуст

- **WHEN** файл отсутствует либо содержит пустой список компонентов
- **THEN** CLI MUST завершиться ненулевым кодом с сообщением, что артефакт uikit не найден в classpath проекта, и назвать ожидаемый путь
- **THEN** CLI MUST NOT отправлять запрос на backend

#### Scenario: Ошибка инструмента

- **WHEN** делегат сообщает о сбое или об отсутствии toolchain
- **THEN** CLI MUST показать сообщение делегата и завершиться ненулевым кодом

### Requirement: API meta normalization

CLI SHALL преобразовывать API-мету Compose в манифест по фиксированным правилам до отправки.

#### Scenario: Дублирующиеся параметры сводятся

- **WHEN** один `id` повторяется у компонента, потому что билдер принимает слот в нескольких перегрузках
- **THEN** манифест MUST содержать одно свойство `(component, id)`
- **THEN** описание свойства MUST NOT содержать `group`

#### Scenario: Описание свойства

- **WHEN** у параметра заданы `methodName` и `paramSimpleType`
- **THEN** описание MUST иметь вид `method: <methodName>; param: <paramSimpleType>`

#### Scenario: Описание свойства с несколькими типами параметра

- **WHEN** один `id` встречается несколько раз с разными `paramSimpleType`
- **THEN** описание MUST перечислять все встреченные типы через `/` в порядке появления, без повторов
- **THEN** описание MUST NOT содержать `group`

#### Scenario: Платформенное имя

- **WHEN** платформа — `compose`
- **THEN** `platformName` свойства MUST быть равен `id`

#### Scenario: Состояния компонента

- **WHEN** компонент содержит `stateEnum.values`
- **THEN** имя состояния MUST быть `configName`, если оно задано, иначе `name` в kebab-case нижнего регистра
- **THEN** манифест MUST NOT содержать повторяющихся состояний одного компонента

#### Scenario: Подмена типа

- **WHEN** передан `--map-type from:to`
- **THEN** CLI MUST заменить тип `from` на `to` до отправки

### Requirement: API meta import is dry run by default

Команда SHALL по умолчанию выполнять dry run и записывать данные только с `--apply`, требовать явный backend API URL и печатать цель запроса до отправки.

#### Scenario: Dry run по умолчанию

- **WHEN** команда запущена без `--apply`
- **THEN** CLI MUST отправить запрос с `dryRun: true`
- **THEN** CLI MUST сообщить, что изменения не применены

#### Scenario: Конфликт режимов

- **WHEN** указаны `--apply` и `--dry-run` вместе
- **THEN** CLI MUST завершиться ошибкой использования до какого-либо запуска

#### Scenario: Явный API URL

- **WHEN** ни `--api-url`, ни `DSBUILDER_API_URL` не заданы
- **THEN** CLI MUST отказать и MUST NOT использовать публичное умолчание для записи

#### Scenario: Печать цели

- **WHEN** манифест готов
- **THEN** CLI MUST напечатать API URL и его источник, `projectId`, `designSystemId`, платформу, путь файла меты, число компонентов и свойств до отправки

### Requirement: API meta import backend contract

CLI SHALL отправлять весь манифест одним запросом на `import-api-meta`.

#### Scenario: Один запрос

- **WHEN** манифест готов
- **THEN** CLI MUST отправить `POST /api/projects/{projectId}/ds/component-config/import-api-meta`
- **THEN** тело MUST содержать `designSystemId` из config, `platform`, метаданные источника, `dryRun` и все компоненты
- **THEN** CLI MUST NOT отправлять по запросу на компонент или свойство

#### Scenario: Печать отчёта

- **WHEN** backend вернул успешный ответ
- **THEN** CLI MUST напечатать счётчики созданных компонентов, свойств, состояний, алиасов и привязок и число неизменённых свойств
- **THEN** CLI MUST напечатать `rejected` и `typeMismatches`, если они не пусты, каждый с причиной

#### Scenario: Строгий режим

- **WHEN** передан `--strict` и `rejected` не пуст
- **THEN** CLI MUST завершиться кодом `1`

#### Scenario: Ошибка backend

- **WHEN** backend вернул неуспешный статус
- **THEN** CLI MUST обработать его общим HTTP error handling CLI core
- **THEN** CLI MUST NOT выводить raw API key

#### Scenario: Отчёт не разбирается

- **WHEN** backend вернул успех с телом, которое не разбирается как отчёт
- **THEN** CLI MUST вернуть deterministic failure и MUST NOT печатать частичный отчёт
