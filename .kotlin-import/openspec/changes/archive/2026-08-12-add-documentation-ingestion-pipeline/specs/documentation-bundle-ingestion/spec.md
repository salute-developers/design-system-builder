## MODIFIED Requirements

### Requirement: Создание ingestion job в accepted
Сервис MUST атомарно создать metadata bundle и связанную ingestion job со статусом `accepted`; после commit upload transaction job SHALL стать входом асинхронного documentation processing pipeline и MAY переходить в дальнейшие ingestion states независимо от HTTP upload request.

#### Scenario: Bundle принят
- **WHEN** raw bundle сохранен и database transaction успешно завершена
- **THEN** сервис MUST вернуть `202 Accepted`
- **AND** response DTO SHALL содержать `bundleId`, `jobId` и первоначальный `status = "accepted"`

#### Scenario: Тяжёлая обработка не выполняется в upload request
- **WHEN** ingestion job создана upload endpoint
- **THEN** endpoint MUST NOT выполнять глубокую валидацию, нормализацию, индексацию или публикацию до ответа `202`
- **AND** background worker MAY claim-ить committed job после завершения transaction

#### Scenario: Worker не запускается
- **WHEN** ingestion job создана в рамках upload endpoint
- **THEN** upload transaction SHALL оставить её в статусе `accepted`
- **AND** upload handler SHALL NOT запускать глубокую валидацию, нормализацию, индексацию или публикацию
- **AND** background worker MAY независимо claim-ить committed job только после завершения transaction

#### Scenario: Worker временно отключён
- **WHEN** background worker disabled или недоступен
- **THEN** committed job SHALL оставаться `accepted`
- **AND** upload contract SHALL оставаться успешным
