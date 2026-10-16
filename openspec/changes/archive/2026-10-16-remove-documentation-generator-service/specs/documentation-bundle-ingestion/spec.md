## ADDED Requirements

### Requirement: Project-scoped endpoint приема documentation bundle
Gateway SHALL предоставлять `POST /api/projects/{projectId}/documentation/bundles`, защищать его существующей project-scoped аутентификацией и направлять запрос в новый documentation service как `POST /documentation/bundles` вместе с trusted actor/project context.

#### Scenario: Gateway направляет upload в documentation service
- **WHEN** аутентифицированный клиент отправляет `POST /api/projects/project-a/documentation/bundles`
- **THEN** Gateway SHALL проверить доступ actor к `project-a`
- **AND** Gateway SHALL передать запрос новому documentation service по внутреннему пути `/documentation/bundles`
- **AND** Gateway SHALL явно заменить client-provided `X-Actor-*` и `X-Project-*` headers значениями Auth Helper

#### Scenario: Маршрута удалённого docs-сервиса нет
- **WHEN** клиент обращается к `/api/projects/project-a/docs/...`
- **THEN** Gateway SHALL NOT проксировать запрос в удалённый сервис `documentation-generator` и SHALL NOT объявлять upstream `docs_service_api`
- **AND** маршрут `/api/projects/{projectId}/documentation` SHALL по-прежнему проксироваться в `documentation_service_api` с `auth_request /_auth_project`

## REMOVED Requirements

### Requirement: Project-scoped endpoint приема bundle

**Reason**: требование обязывало сохранять маршрут `/api/projects/{projectId}/docs` к `docs_service_api`,
а сервис `documentation-generator` удалён.

**Migration**: приём bundle описывает требование «Project-scoped endpoint приема documentation bundle»
с тем же маршрутом `/documentation/bundles`; маршрута `/docs` больше нет.
