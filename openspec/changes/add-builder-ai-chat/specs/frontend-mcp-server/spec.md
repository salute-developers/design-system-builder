## ADDED Requirements

### Requirement: Встраивание ядра в серверный процесс

`:mcp-server-core` SHALL предоставлять сборку ядра для серверного процесса без рабочего каталога, локального хранилища сессии и MCP SDK. В таком режиме учётные данные MUST браться из `CallScopedCredentials` в контексте корутины вызова. Если этого элемента нет, вызов MUST завершаться `AUTH_REQUIRED` без обращения к другим источникам.

#### Scenario: Параллельные вызовы разных пользователей
- **WHEN** один экземпляр ядра одновременно выполняет вызовы в контекстах с разными `CallScopedCredentials`
- **THEN** каждый HTTP-запрос к API MUST нести Bearer своего контекста

#### Scenario: Нет учётных данных в контексте
- **WHEN** встроенное ядро вызвано вне `CallScopedCredentials`
- **THEN** результат MUST быть ошибкой `AUTH_REQUIRED`, а env, хранилище сессии и service account MUST NOT читаться

#### Scenario: CLI и Node без изменений
- **WHEN** запускаются `dsbuilder mcp serve` и `dsbuilder-mcp serve`
- **THEN** выбор учётных данных и контекста MUST оставаться прежним

### Requirement: Публичный список полей, заполняемых встраивающей стороной

`:mcp-server-core` SHALL публиковать набор `mcpServerFilledFields` с полями `designSystem`, `version` и `idempotencyKey`. Обработка этих полей в инструментах MUST совпадать с тем, что описано в этом наборе.

#### Scenario: Сверка набора с обработчиками
- **WHEN** выполняется тест ядра
- **THEN** каждое поле из `mcpServerFilledFields` MUST присутствовать в схеме каждого инструмента записи
