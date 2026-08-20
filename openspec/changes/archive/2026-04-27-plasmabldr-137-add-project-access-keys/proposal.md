## Why

DS Builder нужны project-bound ключи для CLI и автоматизаций, которые не должны работать как пользовательские JWT и не должны получать административные права над проектом. Эта change добавляет безопасный machine access поверх Projects Service и Gateway foundation.

## What Changes

- Добавить project-bound access keys в Projects Service.
- Хранить секрет ключа только в виде hash и показывать raw secret только при создании.
- Добавить scopes для ограничения возможностей ключа.
- Добавить API для list/create/revoke access keys.
- Расширить Auth Helper/Gateway path проверкой project access key и передачей project key actor context.

## Capabilities

### New Capabilities

- `project-access-keys`: создание, хранение, отзыв и проверка project-bound CLI/integration keys.

### Modified Capabilities

- Нет.

## Impact

- Сервисы: Projects Service, Auth Helper, nginx Gateway.
- API: endpoints для access keys и internal key verification.
- Persistence: таблица project_access_keys.
- Security: secret hashing, one-time secret response, scopes, revocation, last-used tracking.
- Конфигурация: key prefix/format, hashing parameters, optional expiration defaults.
- Инфраструктура: обновление docker-compose/local routes и health/smoke checks.
