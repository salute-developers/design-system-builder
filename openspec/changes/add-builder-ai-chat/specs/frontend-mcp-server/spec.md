## MODIFIED Requirements

### Requirement: Backend authorization остается серверной ответственностью

MCP server SHALL передавать выбранный credential в DS Builder API и SHALL NOT вычислять локальные роли или scopes. Встраивающий серверный процесс MAY скрывать инструменты от модели по разрешениям, которые вычислил серверный `PolicyEvaluator` из проверенного контекста запроса; само ядро MCP при этом MUST NOT вычислять роли или scopes, а DS Builder API MUST проверять каждый вызов.

#### Scenario: Backend запрещает операцию

- **WHEN** DS Builder API возвращает `403`
- **THEN** MCP MUST вернуть `FORBIDDEN`
- **THEN** MCP MUST NOT скрывать или повторно разрешать операцию на основании локально вычисленной роли

#### Scenario: Локальный файл обрабатывается безопасно

- **WHEN** будущий tool изменяет локальный workspace
- **THEN** пути MUST оставаться внутри разрешенной рабочей директории
- **THEN** защита пути MUST считаться filesystem boundary, а не заменой backend RBAC

#### Scenario: Встраивающий сервер скрывает инструмент

- **WHEN** серверный `PolicyEvaluator` не разрешает пользователю разрешение инструмента
- **THEN** встраивающий процесс MAY не передавать инструмент модели
- **THEN** при вызове, который всё же дошёл до API, решение MUST принимать DS Builder API

## ADDED Requirements

### Requirement: Встраивание ядра в серверный процесс

`:mcp-server-core` SHALL допускать работу в серверном процессе без рабочего каталога и локального хранилища сессии. Граф зависимостей ядра собирает встраивающая сторона. В таком режиме учётные данные MUST браться из `CallScopedCredentials` в контексте корутины вызова. Если этого элемента нет либо запрошено принудительное обновление, `CallScopedCredentialProvider` MUST возвращать `AUTH_REQUIRED` без обращения к другим источникам.

#### Scenario: Параллельные вызовы разных пользователей
- **WHEN** один экземпляр ядра одновременно выполняет вызовы в контекстах с разными `CallScopedCredentials`
- **THEN** каждый HTTP-запрос к API MUST нести Bearer своего контекста

#### Scenario: Нет учётных данных в контексте
- **WHEN** встроенное ядро вызвано вне `CallScopedCredentials`
- **THEN** результат MUST быть ошибкой `AUTH_REQUIRED`, а env, хранилище сессии и служебная учётная запись MUST NOT читаться

#### Scenario: Ответ 401 во встроенном режиме
- **WHEN** API вернул 401 и HTTP-клиент запросил учётные данные с принудительным обновлением
- **THEN** провайдер MUST вернуть `AUTH_REQUIRED`, и запрос MUST NOT повторяться с тем же токеном

#### Scenario: Токен не попадает в строковое представление
- **WHEN** `CallScopedCredentials` выводится в журнал или строку
- **THEN** значение Bearer MUST быть замаскировано

#### Scenario: CLI и Node без изменений
- **WHEN** запускаются `dsbuilder mcp serve` и `dsbuilder-mcp serve`
- **THEN** выбор учётных данных и контекста MUST оставаться прежним

### Requirement: Схема инструмента для встраивающей стороны

`:mcp-server-core` SHALL публиковать набор `mcpServerFilledFields` с полями `designSystem`, `version` и `idempotencyKey` и функцию `McpToolDefinition.inputJsonSchema(hidden)`, которая строит JSON Schema тем же переводом, что и MCP, без скрытых полей в `properties` и `required`. Набор MUST использоваться только для схемы. Разбор команд записи MUST по-прежнему отделять служебные поля, включая `baseRevision`, до строгой десериализации тела.

#### Scenario: Скрытие полей
- **WHEN** схема строится с `hidden = mcpServerFilledFields`
- **THEN** скрытые поля MUST отсутствовать и в `properties`, и в `required`, а остальные поля MUST совпадать со схемой MCP

#### Scenario: Вызов с базовой ревизией
- **WHEN** инструмент записи вызван с `baseRevision`
- **THEN** ядро MUST передать ревизию в заголовке мутации и MUST NOT отклонять команду из-за лишнего поля тела
