## MODIFIED Requirements

### Requirement: Локальный stdio transport

MCP MVP SHALL работать только как локальный stdio server и SHALL NOT открывать HTTP port.

#### Scenario: Stdout зарезервирован протоколом

- **WHEN** MCP server работает
- **THEN** stdout MUST содержать только MCP protocol messages
- **THEN** process logs и диагностика launcher MUST направляться в stderr
- **THEN** raw credentials MUST NOT выводиться ни в stdout, ни в stderr

#### Scenario: Server корректно завершает lifecycle

- **WHEN** stdin закрывается или процесс получает `SIGINT`/`SIGTERM`
- **THEN** server MUST закрыть MCP session, HTTP client и файловые ресурсы
- **THEN** штатное EOF stdin MUST завершить процесс с exit code `0`

#### Scenario: Credentials отсутствуют при запуске

- **WHEN** server запускается без PAT и user session
- **THEN** server MUST успешно ответить на `initialize` и `tools/list`
- **THEN** backend-dependent `tools/call` MUST вернуть структурированный `AUTH_REQUIRED`, не завершая server

### Requirement: MCP read tool safety and errors
Expanded read tools SHALL preserve the existing MCP security and diagnostics model.

#### Scenario: Read tools do not expose credentials
- **WHEN** any new MCP read tool returns success or failure
- **THEN** the response MUST NOT contain PAT, access tokens, refresh tokens, passwords or raw credential headers

#### Scenario: Backend and validation failures map to stable errors
- **WHEN** a new MCP read tool receives invalid input or backend returns an authorization, availability or not-found failure
- **THEN** MCP server MUST return a structured error with stable code `INVALID_ARGUMENT`, `INVALID_QUERY`, `AUTH_REQUIRED`, `PAT_INVALID`, `FORBIDDEN`, `NOT_FOUND`, `PUBLICATION_NOT_FOUND`, `BACKEND_UNAVAILABLE` or `CONTEXT_NOT_FOUND`
- **THEN** MCP server MUST NOT include stack traces in the tool result body

#### Scenario: Expanded tools stay read-only
- **WHEN** MCP client lists available tools after this change
- **THEN** token and component tools MUST include only read operations
- **THEN** MCP server MUST NOT expose `token_create`, `token_update`, `token_delete`, `token_value_set`, `component_config_update` or other mutating token/component tools in this change

### Requirement: MCP использует env локального проекта

Оба MCP launcher SHALL использовать общий project-scoped env источник для локального context. Они SHALL сохранять тот же приоритет аргумента, env процесса и `.env` проекта, что и CLI, и SHALL разрешать credential отдельно для каждого вызова tool.

#### Scenario: Ключ найден в `.env` workspace

- **WHEN** MCP запущен с `--workspace /repo` и `/repo/.sdds/config.json` задаёт `credential.name = "DSB_DEV_PAT"`
- **WHEN** env процесса не содержит `DSB_DEV_PAT`, а `/repo/.env` содержит его
- **THEN** backend request MUST использовать `Authorization: Bearer <PAT>`
- **THEN** MCP result MUST NOT содержать значение key

#### Scenario: Env процесса перекрывает `.env`

- **WHEN** env процесса и проектный `.env` содержат `DSB_DEV_PAT`
- **THEN** MCP MUST использовать значение env процесса

#### Scenario: Явный designSystem не наследует локальный secret

- **WHEN** MCP tool получает явный `designSystem` URI
- **THEN** MCP MUST NOT читать PAT или API URL из локального `.env` сервера
- **THEN** MCP MUST использовать auto с приоритетом DSBUILDER_API_KEY процесса над OAuth-сессией, без чтения .env workspace

#### Scenario: Нет ключа при auto policy

- **WHEN** env процесса и проектный `.env` не содержат PAT
- **WHEN** context выбирает auto credential policy
- **THEN** MCP MUST сохранить существующий fallback на user session

#### Scenario: Один server обслуживает повторные вызовы

- **WHEN** содержимое проектного `.env` изменилось между двумя вызовами MCP tool
- **THEN** следующий вызов MUST разрешить новый снимок env проекта
- **THEN** предыдущий вызов MUST использовать один согласованный снимок значений

### Requirement: Диагностика ошибок чтения MCP

MCP SHALL отличать нарушение формата ответа backend от временной недоступности, сохраняя безопасные сообщения без секретов и тел ответа.

#### Scenario: Некорректный ответ backend
- **WHEN** ответ backend содержит невалидный JSON или несогласованные метаданные чтения
- **THEN** MCP MUST вернуть отдельный код `INVALID_BACKEND_RESPONSE`, который клиент не должен трактовать как временный сбой

#### Scenario: Ошибка авторизации и входа
- **WHEN** чтение модели с OAuth-сессией получает HTTP 401 после предусмотренного единственного обновления сессии
- **THEN** MCP MUST вернуть `AUTH_REQUIRED` с подсказкой `dsbuilder auth login`

#### Scenario: Неизвестный аргумент
- **WHEN** инструмент чтения модели получает неподдерживаемый аргумент
- **THEN** ответ `INVALID_QUERY` MUST назвать этот аргумент


#### Scenario: PAT отклонён сервером
- **WHEN** чтение модели с PAT получает HTTP 401
- **THEN** MCP MUST вернуть `PAT_INVALID` с подсказкой проверить срок, отзыв и значение PAT
- **AND** MUST NOT предлагать auth login как исправление PAT, обновлять OAuth-сессию или повторять запрос с другим типом учётных данных

#### Scenario: Проверка аккаунта недоступна
- **WHEN** запрос с PAT получает HTTP 503 из-за недоступности проверки владельца
- **THEN** MCP MUST вернуть `BACKEND_UNAVAILABLE` без удаления сессии, смены учётных данных или обозначения PAT недействительным

### Requirement: Обнаружение проектов и дизайн-систем без workspace

Все средства запуска MCP SHALL предоставлять одинаковые `projects_list` и `design_systems_list(projectId)` без требования локального контекста. Списки SHALL использовать общий выбор PAT/OAuth выбранного backend и SHALL NOT изменять файлы или глобальный выбор процесса.

#### Scenario: Начало диалога без контекста
- **WHEN** агент вызывает `projects_list` вне инициализированного проекта
- **THEN** ответ MUST содержать `items` с ID, именами и описаниями доступных проектов при наличии
- **WHEN** агент вызывает `design_systems_list` с выбранным projectId
- **THEN** ответ MUST содержать projectId и `items` систем этого проекта
- **THEN** отсутствие результатов MUST возвращать пустой список, а не ошибку

#### Scenario: Обязательные параметры и ошибки
- **WHEN** projectId отсутствует у `design_systems_list` или аргумент неизвестен
- **THEN** MCP MUST вернуть `INVALID_QUERY` до backend-запроса
- **WHEN** нет PAT и OAuth-сессии, доступ запрещён, ресурс отсутствует, backend недоступен либо ответ некорректен
- **THEN** MCP MUST вернуть соответственно `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `BACKEND_UNAVAILABLE` или `INVALID_BACKEND_RESPONSE` без секретов
- **THEN** `AUTH_REQUIRED` MUST содержать подсказку `dsbuilder auth login`


#### Scenario: PAT для обнаружения
- **WHEN** в окружении MCP задан DSBUILDER_API_KEY с PAT
- **THEN** projects_list MUST использовать PAT с projects:read, а design_systems_list — PAT с design-systems:read и проверкой доступа к проекту
- **AND** отказ PAT с 401 MUST вернуть PAT_INVALID без OAuth refresh и перехода на сессию
- **AND** отсутствие scope MUST вернуть FORBIDDEN
