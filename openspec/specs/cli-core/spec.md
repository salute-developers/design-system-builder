# cli-core Specification

## Purpose
Определяет общий CLI core для project-scoped команд `dsbuilder`: discovery локального project context, credential resolution, API URL resolution и authenticated HTTP foundation.

## Requirements

### Requirement: Local project config discovery

CLI core SHALL resolve project context by searching for the nearest `.sdds/config.json` from the current working directory upward.

#### Scenario: Config найден в текущей директории

- **WHEN** CLI command запускается из директории, содержащей `.sdds/config.json`
- **THEN** CLI MUST use that config as the project context
- **THEN** resolved context MUST include `projectId`, `designSystemId`, and credential env variable name

#### Scenario: Config найден в родительской директории

- **WHEN** CLI command запускается из вложенной директории внутри project tree
- **THEN** CLI MUST search parent directories until it finds the nearest `.sdds/config.json`
- **THEN** CLI MUST use the nearest matching config

#### Scenario: Config отсутствует

- **WHEN** CLI command требует project context и `.sdds/config.json` не найден в current directory или parent directories
- **THEN** CLI MUST return a deterministic error explaining that the project is not initialized
- **THEN** CLI MUST NOT attempt backend requests

### Requirement: Project config stores no raw secrets

CLI project config SHALL store only non-secret project metadata, local tenant aliases, local artifact paths, and credential references.

#### Scenario: Config содержит env credential reference

- **WHEN** `.sdds/config.json` is generated or parsed
- **THEN** it MUST support `projectId`
- **THEN** it MUST support `designSystemId`
- **THEN** it MUST support JSON object `credential` with `type = "env"` and `name`

#### Scenario: Config содержит optional tenants metadata

- **WHEN** `.sdds/config.json` is generated, parsed, or updated by `theme fetch`
- **THEN** it MUST support optional JSON array field `tenants`
- **THEN** each tenant entry MUST support fields `id`, `designSystemId`, `name`, `description`, `createdAt`, and `updatedAt`
- **THEN** each tenant entry MUST support optional fields `directoryPath` and `alias`
- **THEN** config without `tenants` MUST remain valid
- **THEN** config with tenants that do not define `alias` MUST remain valid

#### Scenario: Config содержит optional palette path

- **WHEN** `.sdds/config.json` is generated, parsed, or updated by `theme fetch`
- **THEN** it MUST support optional JSON string field `palettePath`
- **THEN** config without `palettePath` MUST remain valid
- **THEN** `palettePath` MUST be treated as non-secret local project metadata

#### Scenario: Raw API key не сохраняется

- **WHEN** CLI creates `.sdds/config.json`
- **THEN** generated config MUST NOT contain raw API key values
- **THEN** generated config MUST NOT contain API URL values
- **THEN** generated config MUST contain only the env variable name used to read the API key

#### Scenario: Theme fetch не сохраняет runtime secrets

- **WHEN** CLI updates `.sdds/config.json` after `theme fetch`
- **THEN** updated config MUST NOT contain raw API key values
- **THEN** updated config MUST NOT contain API URL values
- **THEN** updated config MUST preserve only the credential reference used to read the API key

#### Scenario: Theme fetch сохраняет palette path

- **WHEN** CLI updates `.sdds/config.json` after successful `theme fetch`
- **THEN** updated config MUST contain `palettePath = ".sdds/tenants/palette.json"`
- **THEN** updated config MUST preserve existing `projectId`, `designSystemId`, `credential`, and tenant alias metadata
- **THEN** updated config MUST NOT contain raw API key values
- **THEN** updated config MUST NOT contain API URL values

### Requirement: Local tenant alias metadata

CLI core SHALL treat `tenants[].alias` as local non-secret tenant metadata stored only in `.sdds/config.json`.

#### Scenario: Tenant alias читается из config

- **WHEN** `.sdds/config.json` contains tenant with JSON field `"alias": "main"`
- **THEN** CLI MUST parse the tenant alias as part of local project config
- **THEN** CLI MUST NOT require backend services, credentials, or private URLs only to parse the alias

#### Scenario: Tenant alias сериализуется в config

- **WHEN** CLI writes `.sdds/config.json` for a tenant with alias `main`
- **THEN** CLI MUST write JSON field `"alias": "main"` inside that tenant entry
- **THEN** CLI MUST NOT write raw API key values into `.sdds/config.json`
- **THEN** CLI MUST NOT write API URL values into `.sdds/config.json`

#### Scenario: Config без alias остается валидным

- **WHEN** `.sdds/config.json` contains tenants without `alias`
- **THEN** CLI MUST parse the config successfully
- **THEN** parsed tenants MUST have no local alias value

### Requirement: API URL resolution

CLI core SHALL resolve backend API URL from runtime sources and code defaults without reading it from `.sdds/config.json`, and SHALL report which source produced the value so that writing commands can reject the code default. Для локального проекта `.env` SHALL предоставлять fallback для `DSBUILDER_API_URL` после env процесса.

#### Scenario: CLI argument имеет высший приоритет

- **WHEN** command receives `--api-url <value>`
- **THEN** CLI MUST use that value as the backend API URL
- **THEN** CLI MUST NOT read env variables for the API URL

#### Scenario: Env API URL используется после CLI argument

- **WHEN** `--api-url` is absent
- **WHEN** env процесса contains `DSBUILDER_API_URL`
- **THEN** CLI MUST use that value as the backend API URL даже при наличии другого значения в проектном `.env`

#### Scenario: Проектный API URL используется после env процесса

- **WHEN** `--api-url` и `DSBUILDER_API_URL` в env процесса отсутствуют
- **WHEN** `.env` найденного локального проекта содержит `DSBUILDER_API_URL`
- **THEN** CLI MUST использовать значение `.env` как явно настроенный backend API URL
- **THEN** writing command MUST NOT считать его code default

#### Scenario: Default API URL используется последним

- **WHEN** `--api-url` is absent
- **WHEN** env процесса и проектный `.env` не содержат `DSBUILDER_API_URL`
- **THEN** CLI MUST use the default API URL defined in code

#### Scenario: Project config не задает API URL

- **WHEN** `.sdds/config.json` is generated or parsed
- **THEN** CLI MUST NOT require or persist `apiUrl` in project config

#### Scenario: Resolution сообщает источник значения

- **WHEN** CLI core resolves the backend API URL
- **THEN** the result MUST expose which runtime source produced the value
- **THEN** the result MUST distinguish the code default from an explicitly provided value

### Requirement: Writing commands reject the default API URL

CLI core SHALL provide a way for writing commands to require an explicitly provided backend API URL, because the code default points at a shared backend installation.

#### Scenario: Writing command отклоняет code default

- **WHEN** a writing command resolves the backend API URL
- **WHEN** the resolved source is the code default
- **THEN** CLI MUST return a deterministic failure output
- **THEN** the message MUST name both `--api-url` and `DSBUILDER_API_URL`
- **THEN** CLI MUST NOT send any backend request

#### Scenario: Reading command сохраняет прежнее поведение

- **WHEN** a reading command resolves the backend API URL
- **WHEN** the resolved source is the code default
- **THEN** CLI MUST use the code default
- **THEN** CLI MUST NOT fail only because the default was used

#### Scenario: Writing command печатает цель запроса

- **WHEN** a writing command is about to send data to the backend
- **THEN** CLI MUST print the resolved backend API URL and its source
- **THEN** CLI MUST NOT print the raw API key

### Requirement: Backend denial reason in CLI errors

CLI core SHALL дописывать к сообщению об ответе `401` и `403` причину отказа из тела ответа backend, если тело содержит текстовое поле `error` или `message`, и MUST NOT менять сообщение, если такого поля нет.

#### Scenario: Причина из поля error

- **WHEN** backend отвечает `403` с телом `{"error":"System administrator role is required"}`
- **THEN** сообщение CLI MUST содержать статус отказа и текст `System administrator role is required`

#### Scenario: Причина из поля message

- **WHEN** backend отвечает `401` с телом `{"message":"Invalid bearer token"}`
- **THEN** сообщение CLI MUST содержать статус отказа и текст `Invalid bearer token`

#### Scenario: Тело без причины

- **WHEN** backend отвечает `403` с пустым телом или телом без полей `error` и `message`
- **THEN** сообщение CLI MUST совпадать с сообщением без причины

#### Scenario: Причина усечена

- **WHEN** текст причины длиннее лимита вывода
- **THEN** CLI MUST усечь его до лимита и MUST NOT выводить многострочное тело целиком

### Requirement: Брейкпоинты web-типографики в project config

CLI core SHALL принимать в `.sdds/config.json` необязательный JSON-массив `breakpoints` как
несекретные локальные метаданные проекта, SHALL NOT интерпретировать и проверять его содержимое
(это делает web-генератор) и SHALL сохранять его при перезаписи config.

#### Scenario: Config с брейкпоинтами читается

- **WHEN** `.sdds/config.json` содержит массив `breakpoints`
- **THEN** команды `dsbuilder`, читающие project context, MUST работать так же, как без него

#### Scenario: Брейкпоинты сохраняются при обновлении config

- **WHEN** `theme fetch` или изменение алиасов тем перезаписывает config, в котором есть `breakpoints`
- **THEN** записанный config MUST содержать то же значение `breakpoints`

#### Scenario: Брейкпоинты не добавляются сами

- **WHEN** CLI создаёт или перезаписывает config без `breakpoints`
- **THEN** записанный config MUST NOT содержать ключ `breakpoints`

### Requirement: Параметры API key принимают PAT

CLI SHALL сохранять `--api-key`, `DSBUILDER_API_KEY` и `init --api-key-env` для передачи PAT. Новые параметры PAT SHALL NOT вводиться. Прежний `--project-key-env` SHALL отклоняться до сетевых запросов.

#### Scenario: Передача PAT
- **WHEN** пользователь задаёт PAT через --api-key либо DSBUILDER_API_KEY
- **THEN** общий выбор учётных данных MUST выбрать PAT согласно приоритету и отправить Bearer

#### Scenario: Ссылка без проектного параметра
- **WHEN** передан --design-system и доступен DSBUILDER_API_KEY
- **THEN** клиент MUST использовать PAT без --project-key-env

#### Scenario: Создание конфигурации
- **WHEN** пользователь задаёт init --api-key-env CI_TOKEN
- **THEN** конфигурация MUST сохранить только имя CI_TOKEN, без секрета

### Requirement: Разрешение PAT из окружения и параметров
CLI core SHALL выбирать PAT в порядке `--api-key`, настроенное `credential.name`, `DSBUILDER_API_KEY`, OAuth-сессия в режиме `auto`. Для каждого имени окружение процесса SHALL иметь приоритет над `.env` выбранного локального проекта. Пустые значения SHALL пропускаться; режим `user-session` SHALL обходить источники PAT.

#### Scenario: Явный PAT
- **WHEN** передан непустой `--api-key`
- **THEN** CLI MUST использовать его без чтения других источников PAT в режиме `auto`

#### Scenario: Настроенное окружение
- **WHEN** явного PAT нет и конфигурация задаёт имя переменной
- **THEN** CLI MUST проверить это имя в процессе, затем в `.env` выбранного проекта, до `DSBUILDER_API_KEY`

#### Scenario: Стандартная переменная
- **WHEN** явный PAT и значение настроенного имени отсутствуют
- **THEN** CLI MUST проверить `DSBUILDER_API_KEY` процесса, затем выбранного проектного `.env`

#### Scenario: PAT отсутствует
- **WHEN** ни один источник не содержит PAT
- **THEN** режим `auto` MUST использовать OAuth-сессию
- **AND** режим `pat-env` MUST вернуть ошибку без backend-запроса

### Requirement: Политика PAT в локальной конфигурации
CLI core SHALL поддерживать `credential.type=auto|user-session|pat-env` и имя окружения с умолчанием `DSBUILDER_API_KEY` без хранения секрета. Прежний `env` SHALL читаться как `auto`; `project-key-env` SHALL отклоняться с инструкцией перехода.

#### Scenario: Совместимый env
- **WHEN** прочитана ссылка `env` с именем переменной
- **THEN** клиент MUST трактовать её как `auto` с тем же именем

#### Scenario: Принудительная сессия
- **WHEN** выбран `user-session`
- **THEN** клиент MUST использовать только OAuth-сессию

#### Scenario: Принудительный PAT
- **WHEN** выбран `pat-env`
- **THEN** клиент MUST использовать PAT или вернуть ошибку без перехода на OAuth

#### Scenario: Прежняя проектная политика
- **WHEN** конфигурация содержит `project-key-env`
- **THEN** клиент MUST сообщить о замене на `pat-env` без отправки запроса

### Requirement: Независимый выбор контекста и авторизации
CLI core SHALL получать контекст из `--design-system` либо локальной конфигурации независимо от авторизации. Для явной ссылки SHALL применяться `auto` с источниками `--api-key`, `DSBUILDER_API_KEY` процесса и OAuth-сессией без чтения авторизации из постороннего локального проекта.

#### Scenario: Явная ссылка из чужой директории
- **WHEN** ссылка выбирает A, а `.sdds` и `.env` текущей директории относятся к B
- **THEN** контекст MUST соответствовать A
- **AND** клиент MUST NOT использовать настройки авторизации или `.env` B

#### Scenario: PAT со ссылкой
- **WHEN** задана ссылка и PAT доступен в `DSBUILDER_API_KEY` процесса
- **THEN** клиент MUST использовать PAT без дополнительных флагов выбора авторизации

#### Scenario: Ссылка без PAT
- **WHEN** PAT не задан, а OAuth-сессия доступна
- **THEN** клиент MUST использовать сессию для контекста ссылки

### Requirement: Общий HTTP-слой PAT и OAuth
Общий HTTP-слой SHALL поддерживать чтение, JSON-запись и multipart через типизированные PAT и OAuth-учётные данные с заголовком Bearer. Авторизация PAT SHALL проверяться сервером; клиент MUST NOT проверять локально scopes, членство, отзыв или срок.

#### Scenario: Чтение и запись с PAT
- **WHEN** команда выполняет GET, JSON POST или multipart POST с выбранным PAT
- **THEN** запрос MUST использовать выбранный API URL и `Authorization: Bearer <PAT>`

#### Scenario: Отказы backend
- **WHEN** PAT получает `401`, `403` или `404`
- **THEN** клиент MUST вернуть соответственно `PAT_INVALID`, ошибку доступа или ошибку отсутствующего ресурса без смены учётных данных

### Requirement: Init сохраняет независимый выбор авторизации

Интерактивный и явный init SHALL создавать credential.type=auto с credential.name=DSBUILDER_API_KEY либо явно заданным --api-key-env. Существующие конфигурации user-session MUST NOT автоматически переписываться.

#### Scenario: Одинаковые умолчания init
- **WHEN** пользователь завершает интерактивный либо явный init
- **THEN** созданная конфигурация MUST использовать auto с тем же правилом имени окружения

#### Scenario: Явный выбор сохранён
- **WHEN** существующая конфигурация содержит user-session либо pat-env
- **THEN** команды MUST соблюдать принудительный выбор, не заменяя его auto
