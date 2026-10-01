## MODIFIED Requirements

### Requirement: CLI components import-api command

CLI `dsbuilder` SHALL предоставлять команду `components import-api`, заводящую компоненты, свойства, состояния и платформенные имена в глобальном слое DS Builder по файлу API-меты платформы. Команда MUST быть доступна только системному администратору и MUST NOT зависеть от проекта или дизайн-системы.

#### Scenario: Команда не использует project context

- **WHEN** разработчик запускает `dsbuilder components import-api` в любой директории
- **THEN** CLI MUST NOT искать `.sdds/config.json` и MUST NOT требовать `projectId` или `designSystemId`
- **THEN** CLI MUST NOT выводить raw credential

#### Scenario: Help не требует ничего

- **WHEN** разработчик запускает `dsbuilder components import-api --help`
- **THEN** CLI MUST показать deterministic help
- **THEN** CLI MUST NOT требовать backend, credential, файл или private URL

#### Scenario: Команда не требует plasma-android и Gradle

- **WHEN** команда запущена
- **THEN** CLI MUST NOT запускать Gradle и платформенные инструменты
- **THEN** CLI MUST NOT требовать рабочей копии plasma-android, `jq` или `curl`

### Requirement: API meta import platform

Команда SHALL требовать платформу опцией `--platform` и поддерживать платформы `compose` и `android-view`.

#### Scenario: Платформа обязательна

- **WHEN** `--platform` не указан
- **THEN** CLI MUST завершиться ошибкой использования до чтения файла и обращения к backend

#### Scenario: Платформа android-view

- **WHEN** платформа — `android-view`
- **THEN** CLI MUST нормализовать мету View и отправить её одним запросом
- **THEN** CLI MUST передать backend `platform` со значением `xml`

#### Scenario: Неподдержанная платформа

- **WHEN** платформа — `swiftui` или `react`
- **THEN** CLI MUST завершиться ненулевым кодом с сообщением, что платформа пока не поддержана
- **THEN** CLI MUST NOT читать файл и MUST NOT обращаться к backend

#### Scenario: Соответствие платформы значению backend

- **WHEN** CLI формирует запрос
- **THEN** он MUST передать `compose` для `compose`, `xml` для `android-view`, `ios` для `swiftui`, `web` для `react`

### Requirement: API meta import is dry run by default

Команда SHALL по умолчанию выполнять dry run и записывать данные только с `--apply`, требовать явный backend API URL и печатать цель запроса до отправки.

#### Scenario: Dry run по умолчанию

- **WHEN** команда запущена без `--apply`
- **THEN** CLI MUST отправить запрос с `dryRun: true`
- **THEN** CLI MUST сообщить, что изменения не применены

#### Scenario: Конфликт режимов

- **WHEN** указаны `--apply` и `--dry-run` вместе
- **THEN** CLI MUST завершиться ошибкой использования до какого-либо чтения файла или запроса

#### Scenario: Явный API URL

- **WHEN** ни `--api-url`, ни `DSBUILDER_API_URL` не заданы
- **THEN** CLI MUST отказать и MUST NOT использовать публичное умолчание для записи

#### Scenario: Печать цели

- **WHEN** манифест готов
- **THEN** CLI MUST напечатать API URL и его источник, платформу, путь файла меты, число компонентов, свойств и состояний до отправки
- **THEN** CLI MUST NOT печатать `projectId` и `designSystemId`

### Requirement: API meta import backend contract

CLI SHALL отправлять весь манифест одним запросом на административный маршрут `import-api-meta`.

#### Scenario: Один запрос

- **WHEN** манифест готов
- **THEN** CLI MUST отправить `POST /api/admin/component-config/import-api-meta`
- **THEN** тело MUST содержать `platform`, метаданные источника, `dryRun` и все компоненты
- **THEN** тело MUST NOT содержать `designSystemId`
- **THEN** CLI MUST NOT отправлять по запросу на компонент или свойство

#### Scenario: Источник — имя файла

- **WHEN** CLI формирует метаданные источника
- **THEN** он MUST передать имя файла без директорий

#### Scenario: Печать отчёта

- **WHEN** backend вернул успешный ответ
- **THEN** CLI MUST напечатать счётчики созданных компонентов, свойств, состояний и платформенных имён и число неизменённых свойств
- **THEN** CLI MUST NOT печатать строку о привязках к дизайн-системе
- **THEN** CLI MUST напечатать `rejected` и `typeMismatches`, если они не пусты, каждый с причиной

#### Scenario: Строгий режим

- **WHEN** передан `--strict` и `rejected` не пуст
- **THEN** CLI MUST завершиться кодом `1`

#### Scenario: Ошибка backend

- **WHEN** backend вернул неуспешный статус
- **THEN** CLI MUST обработать его общим HTTP error handling CLI core
- **THEN** CLI MUST NOT выводить raw credential

#### Scenario: Отчёт не разбирается

- **WHEN** backend вернул успех с телом, которое не разбирается как отчёт
- **THEN** CLI MUST вернуть deterministic failure и MUST NOT печатать частичный отчёт

## ADDED Requirements

### Requirement: API meta import reads the meta from a file

CLI SHALL читать API-мету из локального файла, путь которого задан обязательной опцией `--from`, и MUST NOT получать её через платформенные инструменты.

#### Scenario: Файл из --from

- **WHEN** задан `--from <путь>`
- **THEN** CLI MUST прочитать файл по этому пути; относительный путь MUST быть приведён к абсолютному относительно текущей директории

#### Scenario: Оба вида файла

- **WHEN** файл — сырой вывод генератора меты либо вывод плагина `dsBuilder` с опущенными значениями по умолчанию
- **THEN** CLI MUST нормализовать оба вида одинаково

#### Scenario: --from обязателен

- **WHEN** `--from` не указан
- **THEN** CLI MUST завершиться ошибкой использования до обращения к backend

#### Scenario: Файл не найден

- **WHEN** файл по `--from` отсутствует или не читается
- **THEN** CLI MUST завершиться ненулевым кодом, назвать путь и MUST NOT обращаться к backend

#### Scenario: Файл пуст

- **WHEN** файл не содержит ни одного компонента с параметрами
- **THEN** CLI MUST завершиться ненулевым кодом с сообщением, что мета пуста, и назвать путь
- **THEN** CLI MUST NOT отправлять запрос на backend

#### Scenario: Файл другой платформы

- **WHEN** содержимое файла не соответствует формату выбранной платформы
- **THEN** CLI MUST завершиться ненулевым кодом, назвать файл и причину
- **THEN** CLI MUST NOT отправлять запрос на backend

#### Scenario: Опции удалённого способа не принимаются

- **WHEN** команда запущена с `--tool` или `--api-key`
- **THEN** CLI MUST завершиться ошибкой использования

### Requirement: API meta import requires a user session

CLI SHALL выполнять запрос только с user session и MUST NOT использовать ключи проекта для этой команды.

#### Scenario: User session

- **WHEN** для указанного API URL сохранена user session
- **THEN** CLI MUST отправить запрос с токеном пользователя (`Authorization: Bearer`)

#### Scenario: Ключ проекта игнорируется

- **WHEN** в окружении задан ключ проекта
- **THEN** CLI MUST NOT использовать его для этой команды

#### Scenario: Нет user session

- **WHEN** для указанного API URL нет user session
- **THEN** CLI MUST завершиться ненулевым кодом с указанием выполнить `dsbuilder auth login` для этого API URL
- **THEN** CLI MUST NOT отправлять запрос на backend

#### Scenario: Роль проверяет сервер

- **WHEN** пользователь не системный администратор
- **THEN** CLI MUST показать отказ backend с его причиной и завершиться ненулевым кодом
- **THEN** CLI MUST NOT проверять роль самостоятельно до запроса

## REMOVED Requirements

### Requirement: API meta import gets the meta from the project artifact

**Reason**: Мета больше не достаётся платформенным инструментом из артефакта uikit проекта: команда читает файл, указанный в `--from`, и не зависит от проекта и Gradle.

**Migration**: Передайте файл меты опцией `--from <файл>` и платформу опцией `--platform`; файл — вывод генератора меты или вывод плагина `dsBuilder` (`build/theme-builder/components/`).
