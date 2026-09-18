## ADDED Requirements

### Requirement: Переносимая ссылка на дизайн-систему

CLI и MCP SHALL принимать `dsbuilder://projects/{projectId}/design-systems/{designSystemId}?version={version}&platform={platform}` как явный контекст; ссылка MUST NOT содержать credential или менять resolved backend API URL.

#### Scenario: Ссылка разрешена без workspace

- **WHEN** клиент получает корректную ссылку вне директории с `.sdds/config.json`
- **THEN** он MUST разрешить `projectId`, `designSystemId`, `version` и `platform` из ссылки
- **THEN** он MUST использовать API URL из общего `ApiUrlResolver`, а не из ссылки

#### Scenario: Ссылка содержит неподдерживаемые части

- **WHEN** ссылка содержит userinfo, fragment, неизвестный путь, повторяющийся обязательный параметр или некорректный identifier
- **THEN** resolver MUST вернуть `INVALID_CONTEXT` без backend-запроса
- **THEN** resolver MUST NOT искать `.sdds` как fallback

### Requirement: Приоритет явного контекста

Общий context resolver SHALL предпочитать явно переданную ссылку локальной `.sdds` и SHALL не хранить выбранный контекст как изменяемое состояние процесса.

#### Scenario: Явная ссылка и локальный config различаются

- **WHEN** запрос передаёт ссылку на дизайн-систему A из директории с `.sdds` для дизайн-системы B
- **THEN** запрос MUST использовать A
- **THEN** credential policy B MUST NOT применяться к A

#### Scenario: Ссылка не передана

- **WHEN** запрос не содержит явного контекста и доступна локальная `.sdds/config.json`
- **THEN** resolver MUST сохранить существующий workspace-сценарий

### Requirement: Полный и проверенный контекст

Контекст чтения публикации SHALL однозначно задавать version и platform; backend SHALL проверять доступ actor к проекту и принадлежность дизайн-системы этому проекту.

#### Scenario: Version или platform отсутствует

- **WHEN** запрошенное чтение публикации не имеет однозначной version или platform
- **THEN** клиент MUST вернуть `AMBIGUOUS_CONTEXT` или `CONTEXT_REQUIRED`
- **THEN** клиент MUST NOT подставлять `0.0.0`, `web` либо другую неявную версию или платформу

#### Scenario: Дизайн-система вне доступного проекта

- **WHEN** backend не подтверждает доступ к выбранным project/design-system identifiers
- **THEN** клиент MUST вернуть `FORBIDDEN` или `NOT_FOUND` согласно ответу backend
- **THEN** ссылка MUST NOT считаться доказательством доступа
