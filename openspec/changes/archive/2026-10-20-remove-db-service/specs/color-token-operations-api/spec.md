## MODIFIED Requirements

### Requirement: Операции опубликованы в контракте ds-service

Операции SHALL быть описаны в группе `contracts/route-manifest.json` с `origin: ds-service` и в контракте
`openapi/documentation.yaml` с `x-permission: tenants:write`, схемами запросов и ответов и кодами ошибок.

#### Scenario: Документ OpenAPI

- **WHEN** `ds-service` отдаёт OpenAPI
- **THEN** документ MUST содержать три операции цветового токена с их схемами
- **THEN** операции манифеста и документа MUST совпадать

#### Scenario: Тесты манифеста db-service

- **WHEN** выполняются контрактные тесты манифеста маршрутов (`contracts/route-manifest.json`)
- **THEN** операции MUST быть описаны с `origin: ds-service`; записей других реализаций манифест MUST NOT содержать
