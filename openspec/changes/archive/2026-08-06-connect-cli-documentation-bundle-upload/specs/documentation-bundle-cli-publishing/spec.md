## ADDED Requirements

### Requirement: Project-scoped публикация documentation bundle

CLI SHALL публиковать documentation bundle через authenticated gateway endpoint configured project и MUST NOT обращаться напрямую к internal endpoint `documentation-service` или формировать trusted actor/project headers.

#### Scenario: Bundle отправлен через gateway

- **WHEN** пользователь запускает `dsbuilder docs publish` в директории configured project с валидным project API key
- **THEN** CLI SHALL отправить `POST /api/projects/{projectId}/documentation/bundles` относительно resolved API URL
- **AND** request SHALL содержать `Authorization: ProjectKey <apiKey>`
- **AND** CLI MUST NOT добавлять `X-Actor-*` или `X-Project-*` headers

#### Scenario: Project context отсутствует

- **WHEN** CLI не может найти или прочитать `.sdds/config.json` для текущей директории
- **THEN** команда MUST завершиться с exit code `1`
- **AND** CLI MUST NOT выполнять upload request

### Requirement: Runtime resolution API key и API URL

Команда `docs publish` SHALL использовать общий project credential и API URL resolution CLI и SHALL поддерживать explicit runtime overrides без сохранения secrets.

#### Scenario: Используются configured runtime sources

- **WHEN** `--api-key` и `--api-url` не переданы
- **THEN** CLI SHALL разрешить API key через credential reference configured project и fallback `DSBUILDER_API_KEY`
- **AND** CLI SHALL разрешить API URL через `DSBUILDER_API_URL` и code default

#### Scenario: Runtime overrides имеют приоритет

- **WHEN** пользователь передаёт `--api-key` и `--api-url`
- **THEN** CLI SHALL использовать переданные значения вместо environment и default sources
- **AND** CLI MUST NOT сохранять API key в `.sdds/config.json`

#### Scenario: API key отсутствует

- **WHEN** API key отсутствует во всех supported runtime sources
- **THEN** команда MUST завершиться с exit code `1` и сообщением о способах настройки credential
- **AND** CLI MUST NOT выполнять upload request

### Requirement: Multipart contract документационного archive

CLI SHALL отправлять выбранный bundle как `multipart/form-data` с ровно одной file part `bundle` и SHALL использовать default path `.sdds/temp/docs-bundle.tar.gz`.

#### Scenario: Default bundle опубликован

- **WHEN** пользователь запускает `dsbuilder docs publish` без `--bundle`
- **THEN** CLI SHALL прочитать `.sdds/temp/docs-bundle.tar.gz`
- **AND** CLI SHALL отправить его bytes в file part `bundle` с filename archive и `Content-Type: application/gzip`

#### Scenario: Передан custom bundle path

- **WHEN** пользователь передаёт `--bundle <path>`
- **THEN** CLI SHALL отправить файл по указанному пути вместо default bundle

#### Scenario: Bundle отсутствует или является директорией

- **WHEN** resolved bundle path отсутствует или указывает на директорию
- **THEN** команда MUST завершиться с exit code `1` и понятной локальной диагностикой
- **AND** CLI MUST NOT выполнять upload request

### Requirement: Обработка результата приемки

CLI SHALL декодировать boundary DTO upload endpoint и SHALL выдавать deterministic output и exit code без раскрытия credentials или внутренних подробностей.

#### Scenario: Bundle принят

- **WHEN** gateway возвращает `202 Accepted` с валидными `bundleId`, `jobId` и `status = accepted`
- **THEN** CLI SHALL вывести все три значения
- **AND** команда SHALL завершиться с exit code `0`

#### Scenario: Success body некорректен

- **WHEN** gateway возвращает successful HTTP status, но response body не соответствует accepted response contract
- **THEN** команда MUST завершиться с exit code `1` с безопасной ошибкой decoding
- **AND** CLI MUST NOT печатать raw response body

### Requirement: Безопасная диагностика отказов

CLI SHALL обрабатывать structured ingestion errors и transport failures как user-facing failures и MUST NOT выводить raw API key, stack trace, internal service URL или непроверенный response body.

#### Scenario: Сервис вернул structured ingestion error

- **WHEN** gateway возвращает non-success status и JSON body `{errors: [{code, message, path?}]}`
- **THEN** CLI SHALL вывести HTTP status и безопасные `code`, `message` и optional bundle-relative `path`
- **AND** команда MUST завершиться с exit code `1`

#### Scenario: Gateway вернул неизвестный error body

- **WHEN** non-success response body пуст или не соответствует ingestion error contract
- **THEN** CLI SHALL вывести безопасный fallback с HTTP status
- **AND** CLI MUST NOT печатать raw response body

#### Scenario: Upload завершился transport failure

- **WHEN** request завершается timeout, network error или другой transport exception
- **THEN** команда MUST завершиться с exit code `1` и deterministic сообщением о недоступности upload
- **AND** CLI MUST NOT выполнять автоматический retry

### Requirement: Поддержка CLI runtime targets

Реальная публикация bundle SHALL работать через общий feature code на JVM и поддерживаемых macOS Kotlin/Native targets.

#### Scenario: Общая реализация собирается для всех targets

- **WHEN** выполняется сборка `dsbuilder-frontend/cli`
- **THEN** multipart upload implementation SHALL компилироваться для JVM, macOS arm64 и macOS x64
- **AND** platform-specific source sets SHALL содержать только runtime engine/filesystem adapters, необходимые соответствующей платформе
