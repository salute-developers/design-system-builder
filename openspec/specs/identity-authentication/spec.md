# identity-authentication Specification

## Purpose
Аутентификация пользователей через Keycloak, проверка JWT, глобальные роли и авторизация нативных клиентов и IDE.
## Requirements
### Requirement: Keycloak user authentication

Система SHALL использовать Keycloak как identity provider для регистрации и аутентификации пользователей.

#### Scenario: Пользователь проходит login

- **WHEN** зарегистрированный пользователь проходит login через Keycloak
- **THEN** Keycloak MUST выдать JWT, который содержит stable user identifier в `sub`

#### Scenario: Пользователь проходит self-registration

- **WHEN** новый пользователь проходит self-registration через Keycloak
- **THEN** система MUST создать identity в Keycloak без создания project membership

### Requirement: Global roles in JWT

Система SHALL использовать Keycloak global roles для platform-level доступа.

#### Scenario: Обычный пользователь получает token

- **WHEN** пользователь с ролью `user` получает JWT
- **THEN** JWT MUST позволять Auth Helper определить global role `user`

#### Scenario: System admin получает token

- **WHEN** пользователь с ролью `system_admin` получает JWT
- **THEN** JWT MUST позволять Auth Helper определить global role `system_admin`

### Requirement: JWT validation

Auth Helper SHALL проверять JWT перед тем, как Gateway пропустит запрос к защищенному API.

#### Scenario: Валидный JWT

- **WHEN** клиент отправляет запрос с валидным Keycloak JWT
- **THEN** Auth Helper MUST подтвердить подпись, issuer, audience и срок действия token

#### Scenario: Невалидный JWT

- **WHEN** клиент отправляет запрос с отсутствующим, истекшим или неверно подписанным JWT
- **THEN** Gateway MUST вернуть `401 Unauthorized`

### Requirement: Native/IDE client authorization

Keycloak realm `dsbuilder` SHALL предоставлять отдельного публичного клиента для нативных/IDE-клиентов DS Builder (начиная с плагина Android Studio / IntelliJ IDEA), использующего Authorization Code flow с обязательным PKCE и без Resource Owner Password Credentials flow.

#### Scenario: Клиент требует PKCE

- **WHEN** нативный/IDE-клиент инициирует Authorization Code flow через клиент `dsbuilder-studio-plugin`
- **THEN** Keycloak MUST требовать `code_challenge` и `code_challenge_method=S256` для завершения flow

#### Scenario: ROPC недоступен для нативного клиента

- **WHEN** клиент `dsbuilder-studio-plugin` пытается получить токен через Resource Owner Password Credentials grant
- **THEN** Keycloak MUST отклонить запрос, так как `directAccessGrantsEnabled` для этого клиента выключен

#### Scenario: Redirect ограничен loopback-адресом

- **WHEN** Keycloak завершает Authorization Code flow для клиента `dsbuilder-studio-plugin`
- **THEN** допустимый `redirect_uri` MUST соответствовать шаблону `http://127.0.0.1:{port}/callback`, где `{port}` — локальный эфемерный порт клиента
- **THEN** Keycloak MUST отклонить `redirect_uri`, не соответствующий этому шаблону

#### Scenario: Выпущенный токен проходит проверку gateway

- **WHEN** клиент `dsbuilder-studio-plugin` обменивает authorization code на токены
- **THEN** выпущенный access token MUST содержать `aud` claim, равный значению, которое ожидает `KeycloakJwtVerifier` на identity-gateway (`dsbuilder-api`)

### Requirement: Документирование публичного token endpoint

Система MUST иметь OpenAPI-описание публичного `/auth/token` gateway для локального API Reference. Контракт MUST описывать `application/x-www-form-urlencoded` request и JSON response с access token без фиксации секретов или конкретных учётных данных.

#### Scenario: Безопасный OpenAPI контракт токена

- **WHEN** API Reference загружает Authentication source
- **THEN** документ содержит `/auth/token` и не содержит client secret, пароль или внутренний `/internal/auth/**` endpoint

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

