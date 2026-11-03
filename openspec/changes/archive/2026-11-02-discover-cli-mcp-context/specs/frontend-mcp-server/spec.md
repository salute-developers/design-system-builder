## ADDED Requirements

### Requirement: Обнаружение проектов и дизайн-систем без workspace

Все средства запуска MCP SHALL предоставлять одинаковые `projects_list` и `design_systems_list(projectId)` без требования локального контекста. Списки SHALL использовать пользовательскую сессию выбранного backend и SHALL NOT изменять файлы или глобальный выбор процесса.

#### Scenario: Начало диалога без контекста
- **WHEN** агент вызывает `projects_list` вне инициализированного проекта
- **THEN** ответ MUST содержать `items` с ID, именами и описаниями доступных проектов при наличии
- **WHEN** агент вызывает `design_systems_list` с выбранным projectId
- **THEN** ответ MUST содержать projectId и `items` систем этого проекта
- **THEN** отсутствие результатов MUST возвращать пустой список, а не ошибку

#### Scenario: Обязательные параметры и ошибки
- **WHEN** projectId отсутствует у `design_systems_list` или аргумент неизвестен
- **THEN** MCP MUST вернуть `INVALID_QUERY` до backend-запроса
- **WHEN** отсутствует сессия, доступ запрещён, ресурс отсутствует, backend недоступен либо ответ некорректен
- **THEN** MCP MUST вернуть соответственно `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `BACKEND_UNAVAILABLE` или `INVALID_BACKEND_RESPONSE` без секретов
- **THEN** `AUTH_REQUIRED` MUST содержать подсказку `dsbuilder auth login`

### Requirement: Получение версий до создания ссылки

`design_system_versions_list` SHALL дополнительно принимать пару projectId/designSystemId для обнаружения версий без workspace и готового URI. Прежнее чтение по URI либо локальному контексту SHALL сохраняться.

#### Scenario: Выбор версии агентом
- **WHEN** агент передаёт пару projectId/designSystemId без designSystem URI
- **THEN** сервер MUST проверить доступ через backend и вернуть версии с существующей серверной пагинацией limit/cursor
- **THEN** каждый опубликованный вариант MUST содержать канонический `designSystem` URI с его версией без обязательной платформы
- **THEN** описание инструмента MUST объяснять переход от списков проектов и систем к версиям и последующим чтениям

#### Scenario: Неоднозначные аргументы
- **WHEN** передан только один ID либо пара ID вместе с designSystem URI
- **THEN** MCP MUST вернуть `INVALID_QUERY` до запроса
- **THEN** сервер MUST NOT заменять ошибочную пару локальным контекстом

#### Scenario: Независимые вызовы
- **WHEN** агент выбрал систему A, затем вызвал чтение со ссылкой на B
- **THEN** чтение MUST использовать B без сохранённого выбора A
- **THEN** выбор MUST NOT создавать `.sdds/config.json`
