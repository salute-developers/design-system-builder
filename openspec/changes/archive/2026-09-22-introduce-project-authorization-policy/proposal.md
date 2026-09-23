## Why

Project-scoped роли и scopes уже передаются Gateway в downstream-сервисы, но их разрешения определяются в нескольких местах: матрица ролей существует только как архитектурная документация, каталог scopes зашит в конфигурацию Projects Service, а Documentation Service применяет собственную проверку ролей и разрешает публикацию любому project key. DS Builder нужен единый machine-readable authorization policy, чтобы роли пользователей и scopes ключей имели один контракт и одинаково проверялись сервисами.

## What Changes

- Добавить versioned authorization policy с каталогом permissions, наследованием project roles, grants ролей, разрешёнными project-key scopes и `system_admin` override.
- Сделать policy machine-readable source of truth, валидировать её схему при старте и проверять общей коллекцией conformance-сценариев.
- Перевести Projects Service на общий каталог permissions/scopes без изменения существующих правил управления проектами, участниками и access keys.
- Добавить permissions `documentation:read` и `documentation:write` и применять их в Documentation Service: чтение private documentation требует `documentation:read`, загрузка bundle — `documentation:write`.
- Сохранить resource ownership checks Documentation Service: permission не заменяет проверку принадлежности job, publication, asset, binding или search context trusted project.
- **BREAKING**: project key больше не получает доступ к documentation только по факту валидности; существующим ключам понадобятся явные `documentation:read` и/или `documentation:write` scopes.
- Явно оставить вне scope `db-service`, `generator`, `documentation-generator`, `publisher` и `project-publisher`; их authorization будет рассматриваться отдельными changes.

## Capabilities

### New Capabilities

- `project-authorization-policy`: единый формат project-scoped permissions, наследования ролей, grants, project-key scopes, `system_admin` override, загрузки и fail-closed валидации policy.

### Modified Capabilities

- `project-access-keys`: каталог допустимых scopes становится частью общей policy и расширяется permissions документации.
- `documentation-bundle-ingestion`: загрузка bundle требует `documentation:write` для project key и соответствующего role grant для user actor.
- `documentation-publication-reading`: private read endpoints требуют `documentation:read` в дополнение к project ownership.
- `documentation-search`: search и knowledge fetch требуют `documentation:read` в дополнение к project ownership.

## Impact

- `backend-kt/projects-service`: конфигурация каталога scopes, application policy и тесты управления project access keys.
- `backend-kt/documentation-service`: trusted actor context, permission enforcement для ingestion/read/search routes и authorization tests.
- Общий authorization policy artifact, schema и conformance fixtures в репозитории; policy доставляется в service images как versioned release artifact.
- `backend-kt/identity-gateway`: контракт trusted headers сохраняется; функциональные изменения Gateway не требуются.
- Persistence schema и публичные request/response DTO не меняются.
- CLI и MCP, использующие project keys для documentation, должны работать с ключами, которым явно выданы новые scopes.
- `js/services/db-service`, `js/services/generator`, `js/services/documentation-generator`, `js/services/publisher` и `backend-kt/project-publisher` не изменяются.
