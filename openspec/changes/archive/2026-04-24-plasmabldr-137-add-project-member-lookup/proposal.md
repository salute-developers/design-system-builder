## Why

Управление участниками должно быть удобным для Owner и Maintainer: добавлять пользователя по Keycloak `userId` неудобно и плохо ложится на UI. Эта change добавляет добавление участника по email среди уже зарегистрированных пользователей, без pending invite flow.

## What Changes

- Добавить identity lookup port в Projects Service application layer.
- Добавить Keycloak Admin API adapter в data layer для поиска зарегистрированного пользователя по email.
- Изменить request contract добавления участника: принимать `email` и target role.
- Возвращать client error, если пользователь с email не зарегистрирован.
- Сохранить будущую совместимость с invite flow, но не создавать pending invitations в MVP.

## Capabilities

### New Capabilities

- `project-member-lookup`: добавление участника проекта по email через lookup зарегистрированного Keycloak user.

### Modified Capabilities

- Нет.

## Impact

- Сервисы: Projects Service.
- API: request DTO для добавления member по email.
- Dependencies/configuration: Keycloak Admin API client credentials, base URL, realm.
- Security: service account permissions для read-only user lookup.
- Tests: identity lookup port, Keycloak adapter, member add route error mapping.
