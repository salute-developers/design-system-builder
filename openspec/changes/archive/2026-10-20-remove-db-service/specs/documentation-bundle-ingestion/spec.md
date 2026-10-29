## MODIFIED Requirements

### Requirement: Проверка design system в project
До сохранения bundle сервис MUST проверить, что `manifest.designSystem.id` доступен в trusted project context, вызвав ds-service `GET /api/ds/design-systems/{designSystemId}` с полученными от Gateway trusted headers.

#### Scenario: Design system принадлежит project
- **WHEN** ds-service успешно возвращает design system для `manifest.designSystem.id` и trusted `X-Project-Id`
- **THEN** сервис SHALL продолжить сохранение bundle

#### Scenario: Design system не найдена в project
- **WHEN** ds-service возвращает `404` для пары trusted project/design system
- **THEN** сервис MUST вернуть `404 Not Found` с code `DESIGN_SYSTEM_NOT_FOUND`
- **AND** сообщение MUST NOT раскрывать, существует ли design system в другом project
- **AND** bundle/job MUST NOT быть созданы

#### Scenario: Db-service временно недоступен
- **WHEN** ownership request завершается timeout или ответом `5xx`
- **THEN** сервис MUST вернуть `503 Service Unavailable`
- **AND** bundle/job MUST NOT быть созданы

### Requirement: Безопасная диагностика приема
Все ошибки upload endpoint MUST использовать стабильные machine-readable codes и MUST NOT раскрывать server filesystem paths, credentials, internal URLs или содержимое archive.

#### Scenario: Acceptance validation возвращает структурированные ошибки
- **WHEN** archive или manifest нарушает приемочный контракт
- **THEN** JSON response SHALL содержать массив `errors`
- **AND** каждая ошибка SHALL содержать `code`, `message` и опциональный bundle-relative `path`

#### Scenario: Внутренняя ошибка не раскрывает инфраструктуру
- **WHEN** storage, database или downstream request завершается внутренней ошибкой
- **THEN** публичный response MUST NOT содержать stack trace, JDBC URL, storage root, credential или внутренний URL ds-service
