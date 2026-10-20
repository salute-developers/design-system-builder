## ADDED Requirements

### Requirement: CLI preview-plugin publish command

`dsbuilder` SHALL предоставлять команду `preview-plugin publish`, которая отправляет архив плагина на бэкенд через `POST /api/admin/compose-preview/plugin-builds`. Команда SHALL принимать обязательные `--platform` (в этом change только `compose`) и `--from <zip>`, необязательные `--api-url` и `--apply`. Без `--apply` команда MUST выполнять пробную отправку.

#### Scenario: Пробная отправка по умолчанию

- **WHEN** команда запущена без `--apply`
- **THEN** CLI MUST отправить запрос с `dryRun = true`
- **AND** MUST напечатать предполагаемый итог и MUST NOT изменять бэкенд.

#### Scenario: Запись с --apply

- **WHEN** команда запущена с `--apply`
- **THEN** CLI MUST отправить запрос с `dryRun = false`.

#### Scenario: Платформа не поддерживается

- **WHEN** `--platform` отличается от `compose`
- **THEN** CLI MUST завершиться ошибкой использования до обращения к сети.

### Requirement: CLI читает и проверяет архив локально

CLI SHALL читать из архива `preview-plugin.json` и `api-meta.json`, проверять, что sha256 файла меты совпадает с `apiMetaSha256` manifest, и MUST завершаться ненулевым кодом до обращения к бэкенду, если файлов нет, архив не читается или sha256 расходятся.

#### Scenario: sha256 не совпадает

- **WHEN** sha256 `api-meta.json` отличается от `apiMetaSha256`
- **THEN** CLI MUST завершиться ненулевым кодом, назвать оба значения и MUST NOT обращаться к бэкенду.

#### Scenario: Архив не найден

- **WHEN** файл по `--from` отсутствует или не является zip
- **THEN** CLI MUST завершиться ненулевым кодом и назвать путь.

### Requirement: CLI нормализует мету и отправляет её рядом с архивом

CLI SHALL нормализовать `api-meta.json` нормализатором платформы `compose` (как `components import-api`) и отправить результат частью `meta` рядом с архивом (`plugin`) одним запросом. Метаданные источника MUST содержать имя файла без директорий.

#### Scenario: Одна отправка

- **WHEN** архив проверен
- **THEN** CLI MUST отправить части `plugin` и `meta` одним запросом
- **AND** тело `meta` MUST NOT содержать `designSystemId`.

#### Scenario: Мета пуста

- **WHEN** нормализатор не находит компонентов с параметрами
- **THEN** CLI MUST завершиться ненулевым кодом и MUST NOT отправлять запрос.

### Requirement: CLI авторизуется служебной учёткой или сессией пользователя

Если заданы переменные `DSBUILDER_CLIENT_ID` и `DSBUILDER_CLIENT_SECRET`, CLI SHALL получить токен `client_credentials` по пути `/realms/<realm>/protocol/openid-connect/token` указанного API (realm по умолчанию `dsbuilder`, переопределяется `DSBUILDER_REALM`) и использовать его, не сохраняя на диск. Иначе CLI SHALL использовать сохранённую сессию пользователя. Секрет клиента MUST NOT приниматься аргументом командной строки.

#### Scenario: Служебная учётка в CI

- **WHEN** заданы `DSBUILDER_CLIENT_ID` и `DSBUILDER_CLIENT_SECRET`
- **THEN** CLI MUST получить токен `client_credentials` и выполнить запрос без интерактивного ввода
- **AND** токен MUST NOT быть записан в файл сессии.

#### Scenario: Сессия пользователя

- **WHEN** переменные служебной учётки не заданы, а сессия сохранена
- **THEN** CLI MUST использовать сессию пользователя.

#### Scenario: Секрет в аргументе

- **WHEN** команда запущена с аргументом, содержащим секрет клиента
- **THEN** CLI MUST завершиться ошибкой использования.

#### Scenario: Нет учётных данных

- **WHEN** не заданы ни служебные учётные данные, ни сессия
- **THEN** CLI MUST завершиться ненулевым кодом и подсказать способы входа.

### Requirement: CLI печатает итог публикации

После ответа бэкенда CLI SHALL напечатать итог (`published`, `activated`, `unchanged` либо конфликт), идентификатор билда, версию `uikit-compose` и адрес плагина, а также счётчики отчёта импорта меты (созданные компоненты, свойства, состояния, платформенные имена, неизменённые свойства) и непустые `rejected` и `typeMismatches` с причинами.

#### Scenario: Успешный итог

- **WHEN** бэкенд ответил успехом
- **THEN** CLI MUST напечатать итог, идентификатор билда, версию и адрес
- **AND** MUST напечатать счётчики отчёта импорта.

#### Scenario: Тот же билд без изменений

- **WHEN** итог `unchanged`
- **THEN** CLI MUST завершиться кодом `0` и сообщить, что билд уже опубликован.

#### Scenario: Конфликт содержимого

- **WHEN** бэкенд ответил `409` с кодом `build_content_changed`
- **THEN** CLI MUST завершиться ненулевым кодом и напечатать сведения о существующем билде.

#### Scenario: Ошибка бэкенда

- **WHEN** бэкенд вернул неуспешный статус
- **THEN** CLI MUST обработать его общим HTTP error handling CLI core
- **AND** MUST NOT выводить секрет или токен.
