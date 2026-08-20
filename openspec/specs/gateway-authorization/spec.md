# gateway-authorization Specification

## Purpose
TBD - created by archiving change plasmabldr-137-add-identity-gateway-foundation. Update Purpose after archive.
## Requirements
### Requirement: Gateway protects project routes

Gateway SHALL направлять project-scoped routes через internal auth flow перед проксированием в downstream-сервисы.

#### Scenario: Запрос к project-scoped API

- **WHEN** клиент обращается к `/projects/{projectId}/...`
- **THEN** Gateway MUST запросить Auth Helper до проксирования запроса

#### Scenario: Запрос без доступа

- **WHEN** Auth Helper возвращает отказ доступа
- **THEN** Gateway MUST вернуть клиенту `401 Unauthorized` или `403 Forbidden` без вызова downstream-сервиса

### Requirement: Trusted request context headers

Gateway SHALL передавать downstream-сервисам нормализованный trusted context только после успешной проверки.

#### Scenario: User actor context

- **WHEN** authenticated user получает доступ к project-scoped route
- **THEN** Gateway MUST передать `X-Actor-Type`, `X-User-Id`, `X-Project-Id`, `X-Project-Role` и `X-System-Admin`

#### Scenario: Incoming trusted headers are spoofed

- **WHEN** внешний клиент отправляет `X-User-Id`, `X-Project-Role` или другие trusted headers
- **THEN** Gateway MUST удалить incoming values и установить только значения, полученные от Auth Helper

### Requirement: Internal endpoints are not externally available

Gateway SHALL запрещать внешний доступ к internal endpoints.

#### Scenario: Внешний запрос к internal route

- **WHEN** внешний клиент обращается к `/internal/**`
- **THEN** Gateway MUST отклонить запрос без проксирования во внутренний сервис

