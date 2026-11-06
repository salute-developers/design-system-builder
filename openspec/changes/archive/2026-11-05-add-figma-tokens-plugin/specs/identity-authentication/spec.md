## ADDED Requirements

### Requirement: Авторизация Figma-плагина

Keycloak SHALL содержать публичный клиент `dsbuilder-figma-plugin` с включённым Device Authorization Grant и выключенными Authorization Code flow и паролем. Клиент SHALL настраиваться в локальном realm и в производственном bootstrap одинаково и SHALL использовать страницу входа DS Builder.

#### Scenario: Токен устройства

- **WHEN** клиент `dsbuilder-figma-plugin` получает токены по `device_code`
- **THEN** access token MUST содержать `aud` `dsbuilder-api` и приниматься project-scoped авторизацией gateway

#### Scenario: Офлайн-сессия

- **WHEN** пользователь с ролью `user` подтверждает вход клиента `dsbuilder-figma-plugin` со scope `offline_access`
- **THEN** Keycloak MUST выдать refresh token типа `Offline`, даже если пользователь создан импортом и не имеет роли по умолчанию
- **WHEN** клиент завершает сессию через `/auth/logout` этим refresh token
- **THEN** последующее обновление MUST завершаться `invalid_grant`

#### Scenario: Запрет других потоков

- **WHEN** клиент `dsbuilder-figma-plugin` пытается получить токен паролем или через Authorization Code flow
- **THEN** Keycloak MUST отклонить запрос

### Requirement: Документирование endpoint устройства

OpenAPI публичной аутентификации SHALL описывать endpoint устройства и grant `urn:ietf:params:oauth:grant-type:device_code` на `/auth/token`.

#### Scenario: Контракт устройства

- **WHEN** API Reference загружает источник Authentication
- **THEN** документ MUST содержать запрос кода устройства и его ошибки опроса и MUST NOT содержать секреты и внутренние `/internal/auth/**` endpoint
